import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const CONSUMER_SECRET = process.env.CONSUMER_JWT_SECRET || 'consumer-access-secret-change-in-prod';
const TOSS_SECRET = process.env.TOSS_SECRET_KEY || 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R';

function getConsumerId(req: Request): string | null {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const payload = jwt.verify(auth.slice(7), CONSUMER_SECRET) as any;
    return payload.type === 'consumer' ? payload.id : null;
  } catch { return null; }
}

function tossAuth(): string {
  return 'Basic ' + Buffer.from(TOSS_SECRET + ':').toString('base64');
}

function genOrderNumber(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${d}-${r}`;
}

export const prepareTossPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      items, amount,
      customerName, customerPhone, customerEmail,
      recipientName, recipientPhone,
      shippingAddress, deliveryMemo,
    } = req.body;
    const consumerId = getConsumerId(req);

    if (!items?.length || !amount || !customerName || !customerPhone || !shippingAddress) {
      res.status(400).json({ success: false, error: '필수 주문 정보가 누락되었습니다.' });
      return;
    }

    // '[우편번호] 주소 상세주소' 형식에서 우편번호 파싱
    const addrMatch = shippingAddress.match(/^\[(\d{5})\]\s*(.+)/);
    const postalCode = addrMatch ? addrMatch[1] : '';
    const parsedAddress = addrMatch ? addrMatch[2].trim() : shippingAddress.trim();

    const productIds: string[] = items.map((i: any) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { store: { select: { id: true, shippingFee: true, freeShippingThreshold: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const orderItemsData: any[] = [];
    let storeId: string | null = null;
    let storeShippingFee = 0;
    let storeFreeThreshold: number | null = null;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) { res.status(400).json({ success: false, error: `상품을 찾을 수 없습니다: ${item.productId}` }); return; }
      if (product.stock < item.quantity) { res.status(400).json({ success: false, error: `재고 부족: ${product.name}` }); return; }
      if (!storeId) {
        storeId = product.store.id;
        storeShippingFee = product.store.shippingFee ?? 0;
        storeFreeThreshold = product.store.freeShippingThreshold ?? null;
      }
      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;
      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        productImage: product.thumbnail || null,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
      });
    }

    // 배송비 계산
    const appliedShippingFee = (storeFreeThreshold !== null && totalAmount >= storeFreeThreshold)
      ? 0
      : storeShippingFee;
    const finalAmount = totalAmount + appliedShippingFee;

    if (Math.abs(finalAmount - Number(amount)) > 1) {
      res.status(400).json({ success: false, error: '결제 금액이 올바르지 않습니다.' });
      return;
    }

    const tossOrderId = crypto.randomUUID().replace(/-/g, '').slice(0, 20);

    const order = await prisma.order.create({
      data: {
        orderNumber: tossOrderId,
        storeId: storeId!,
        consumerId: consumerId || null,
        buyerName: customerName,
        buyerEmail: customerEmail || '',
        buyerPhone: customerPhone,
        recipientName: recipientName || customerName,
        recipientPhone: recipientPhone || customerPhone,
        postalCode,
        address: parsedAddress,
        addressDetail: '',
        deliveryMemo: deliveryMemo || '',
        totalAmount,
        shippingFee: appliedShippingFee,
        discountAmount: 0,
        finalAmount,
        items: { create: orderItemsData },
      },
    });

    res.json({ success: true, data: { orderId: tossOrderId, dbOrderId: order.id, amount: finalAmount, shippingFee: appliedShippingFee, itemsTotal: totalAmount } });
  } catch (err: any) {
    console.error('prepareTossPayment error:', err?.message);
    res.status(500).json({ success: false, error: err?.message || '주문 준비 중 오류가 발생했습니다.' });
  }
};

export const confirmTossPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { paymentKey, orderId, amount } = req.body;
    if (!paymentKey || !orderId || !amount) {
      res.status(400).json({ success: false, error: '결제 정보가 올바르지 않습니다.' }); return;
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber: orderId },
      include: { items: true },
    });
    if (!order) { res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' }); return; }
    if (Math.abs(order.finalAmount - Number(amount)) > 1) {
      res.status(400).json({ success: false, error: '결제 금액이 일치하지 않습니다.' }); return;
    }
    // 이미 확인된 주문 중복 처리 방지
    if (order.status !== 'PENDING') {
      res.json({ success: true, data: { orderNumber: order.orderNumber, orderId: order.id } }); return;
    }

    try {
      await axios.post(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey, orderId, amount: Number(amount) },
        { headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' }, timeout: 30000 }
      );
    } catch (tossErr: any) {
      const errMsg = tossErr.code === 'ECONNABORTED'
        ? '결제 확인 요청이 시간 초과되었습니다. 잠시 후 다시 시도해주세요.'
        : tossErr.response?.data?.message || '결제 확인에 실패했습니다.';
      res.status(400).json({ success: false, error: errMsg });
      return;
    }

    const humanOrderNumber = genOrderNumber();
    await prisma.order.update({
      where: { id: order.id },
      data: { orderNumber: humanOrderNumber, status: 'CONFIRMED', paymentMethod: 'toss', paymentId: paymentKey, paidAt: new Date() },
    });

    // 재고 일괄 업데이트
    await Promise.all(order.items.map((item) =>
      prisma.product.updateMany({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity }, totalSales: { increment: item.quantity } },
      })
    ));

    res.json({ success: true, data: { orderNumber: humanOrderNumber, orderId: order.id } });
  } catch (err: any) {
    console.error('confirmTossPayment error:', err?.message);
    res.status(500).json({ success: false, error: '결제 처리 중 오류가 발생했습니다.' });
  }
};

export const lookupOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderNumber, phone } = req.body;
    if (!orderNumber || !phone) {
      res.status(400).json({ success: false, error: '주문번호와 연락처를 입력해주세요.' }); return;
    }
    const order = await prisma.order.findFirst({
      where: { orderNumber, buyerPhone: phone },
      include: { store: { select: { name: true, slug: true, logoUrl: true } }, items: true },
    });
    if (!order) { res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다. 주문번호와 연락처를 확인해주세요.' }); return; }
    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: '주문 조회 중 오류가 발생했습니다.' });
  }
};

// 소비자/비회원 취소·환불 신청
export const requestCancelOrRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderNumber, phone, reason } = req.body;
    const consumerId = getConsumerId(req);

    let order: any;
    if (consumerId) {
      const { orderId } = req.body;
      order = await prisma.order.findFirst({ where: { id: orderId, consumerId }, include: { items: true } });
    } else {
      if (!orderNumber || !phone) {
        res.status(400).json({ success: false, error: '주문번호와 연락처가 필요합니다.' }); return;
      }
      order = await prisma.order.findFirst({ where: { orderNumber, buyerPhone: phone }, include: { items: true } });
    }

    if (!order) { res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' }); return; }

    const nonCancellable = ['CANCELLED', 'REFUND_REQ', 'REFUNDED'];
    if (nonCancellable.includes(order.status)) {
      res.status(400).json({ success: false, error: '이미 취소/환불 처리된 주문입니다.' }); return;
    }

    const cancelReason = reason || '고객 요청';

    // PENDING이고 결제 전이면 즉시 취소
    if (order.status === 'PENDING' && !order.paymentId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', cancelReason, cancelledAt: new Date() },
      });
      res.json({ success: true, message: '주문이 취소되었습니다.', data: { status: 'CANCELLED' } });
      return;
    }

    // 결제 완료 이후: 환불 신청 → 판매자가 처리
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'REFUND_REQ', cancelReason },
    });
    res.json({ success: true, message: '취소/환불 신청이 접수되었습니다. 판매자 확인 후 처리됩니다.', data: { status: 'REFUND_REQ' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '처리 중 오류가 발생했습니다.' });
  }
};