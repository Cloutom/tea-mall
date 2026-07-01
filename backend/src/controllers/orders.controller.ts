import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types';

// 주문 목록 조회
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = { storeId: store.id, status: { not: 'PENDING' } };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { buyerName: { contains: search } },
        { buyerPhone: { contains: search } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { name: true, thumbnail: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, error: '주문 조회 중 오류가 발생했습니다.' });
  }
};

// 주문 상세 조회
export const getOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: store.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, thumbnail: true, images: true } } },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' });
      return;
    }

    res.json({ success: true, data: order });
  } catch {
    res.status(500).json({ success: false, error: '주문 조회 중 오류가 발생했습니다.' });
  }
};

// 주문 상태 변경
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const { status, trackingNumber, courier, memo } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: store.id },
    });

    if (!order) {
      res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' });
      return;
    }

    const updateData: any = { status, memo };
    if (status === 'SHIPPING') {
      updateData.trackingNumber = trackingNumber;
      updateData.courier = courier;
      updateData.shippedAt = new Date();
    }
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    }
    if (status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    });

    // 주문 상태 변경 알림
    await prisma.notification.create({
      data: {
        sellerId: req.seller!.id,
        type: 'order',
        title: '주문 상태 변경',
        message: `주문번호 ${order.orderNumber}이 ${getStatusLabel(status)}으로 변경되었습니다.`,
        link: `/dashboard/orders/${order.id}`,
      },
    });

    res.json({ success: true, message: '주문 상태가 변경되었습니다.', data: updated });
  } catch {
    res.status(500).json({ success: false, error: '주문 상태 변경 중 오류가 발생했습니다.' });
  }
};

// 주문 일괄 상태 변경
export const bulkStatusUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const { orderIds, status, trackingNumber, courier } = req.body;
    if (!orderIds?.length || !status) {
      res.status(400).json({ success: false, error: '주문 ID와 상태가 필요합니다.' }); return;
    }

    // 목표 상태별로 전환 가능한 현재 상태 정의
    const VALID_FROM: Record<string, any[]> = {
      CONFIRMED:  ['PENDING'],
      PREPARING:  ['CONFIRMED'],
      SHIPPING:   ['CONFIRMED', 'PREPARING'],
      DELIVERED:  ['SHIPPING'],
      CANCELLED:  ['PENDING', 'CONFIRMED', 'PREPARING'],
    };
    if (!VALID_FROM[status]) {
      res.status(400).json({ success: false, error: '허용되지 않는 상태입니다.' }); return;
    }

    if (status === 'SHIPPING') {
      if (!trackingNumber || !courier) { res.status(400).json({ success: false, error: '배송 정보(택배사/송장번호)를 입력해주세요.' }); return; }
    }

    // 전환 가능한 주문만 사전 조회 (이미 완료/취소된 주문 제외)
    const eligibleOrders = await prisma.order.findMany({
      where: { id: { in: orderIds }, storeId: store.id, status: { in: VALID_FROM[status] } },
      include: { items: true },
    });
    if (eligibleOrders.length === 0) {
      res.status(400).json({ success: false, error: '처리 가능한 주문이 없습니다. 이미 완료되었거나 취소된 주문은 변경할 수 없습니다.' }); return;
    }

    const eligibleIds = eligibleOrders.map((o) => o.id);
    const skipped = orderIds.length - eligibleIds.length;

    const updateData: any = { status };
    if (status === 'SHIPPING') {
      updateData.trackingNumber = trackingNumber;
      updateData.courier = courier;
      updateData.shippedAt = new Date();
    }
    if (status === 'DELIVERED') updateData.deliveredAt = new Date();
    if (status === 'CANCELLED') updateData.cancelledAt = new Date();

    // 전환 가능한 주문만 업데이트
    const result = await prisma.order.updateMany({
      where: { id: { in: eligibleIds } },
      data: updateData,
    });

    // 취소 시 재고 복구 + 매출 차감
    if (status === 'CANCELLED') {
      await Promise.all(eligibleOrders.flatMap((o) => o.items.map((item) =>
        prisma.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity }, totalSales: { decrement: item.quantity }, totalRevenue: { decrement: item.unitPrice * item.quantity } },
        })
      )));
    }

    const message = skipped > 0
      ? `${result.count}건 처리 완료 (이미 처리된 ${skipped}건 건너뜀)`
      : `${result.count}건 처리 완료`;

    res.json({ success: true, message, data: { count: result.count, skipped } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '일괄 처리 중 오류가 발생했습니다.' });
  }
};

// 배송 정보 일괄 업데이트
export const bulkUpdateShipping = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const { orderIds, trackingNumber, courier } = req.body;

    await prisma.order.updateMany({
      where: { id: { in: orderIds }, storeId: store.id },
      data: {
        status: 'SHIPPING',
        trackingNumber,
        courier,
        shippedAt: new Date(),
      },
    });

    res.json({ success: true, message: `${orderIds.length}건의 배송 정보가 업데이트되었습니다.` });
  } catch {
    res.status(500).json({ success: false, error: '배송 정보 업데이트 중 오류가 발생했습니다.' });
  }
};

// 주문 통계 요약
export const getOrderSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, confirmed, shipping, todayOrders] = await Promise.all([
      prisma.order.count({ where: { storeId: store.id, status: 'PENDING' } }),
      prisma.order.count({ where: { storeId: store.id, status: 'CONFIRMED' } }),
      prisma.order.count({ where: { storeId: store.id, status: 'SHIPPING' } }),
      prisma.order.count({ where: { storeId: store.id, createdAt: { gte: today } } }),
    ]);

    res.json({ success: true, data: { pending, confirmed, shipping, todayOrders } });
  } catch {
    res.status(500).json({ success: false, error: '주문 통계 조회 중 오류가 발생했습니다.' });
  }
};

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: '주문 대기',
    CONFIRMED: '주문 확인',
    PREPARING: '준비중',
    SHIPPING: '배송중',
    DELIVERED: '배송 완료',
    CANCELLED: '취소',
    REFUNDED: '환불 완료',
  };
  return labels[status] || status;
}

// 판매자 환불/취소 처리 (Toss 결제 취소 포함)
export const processRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: store.id },
      include: { items: true },
    }) as any;
    if (!order) { res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' }); return; }

    const allowedStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'REFUND_REQ'];
    if (!allowedStatuses.includes(order.status)) {
      res.status(400).json({ success: false, error: '이미 처리된 주문입니다.' }); return;
    }

    const { cancelReason = '판매자 환불 처리', refundAmount, returnShippingCost } = req.body;

    // 반품 배송비 계산: 단순변심이면 소비자 부담, 상품문제면 판매자 부담
    const returnShipCost = returnShippingCost ? Number(returnShippingCost) : 0;
    const isBuyerRemorse = order.refundType === 'BUYER_REMORSE';
    const actualRefundAmount = refundAmount
      ? Number(refundAmount)
      : isBuyerRemorse
        ? Math.max(0, order.finalAmount - returnShipCost)
        : order.finalAmount;

    // Toss 결제 취소 API 호출
    if (order.paymentId) {
      const secretKey = process.env.TOSS_SECRET_KEY || 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R';
      const encoded = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');
      try {
        await require('axios').default.post(
          `https://api.tosspayments.com/v1/payments/${order.paymentId}/cancel`,
          { cancelReason, cancelAmount: actualRefundAmount },
          { headers: { Authorization: encoded, 'Content-Type': 'application/json' } }
        );
      } catch (tossErr: any) {
        res.status(400).json({
          success: false,
          error: `결제 취소 실패: ${tossErr.response?.data?.message || tossErr.message}`,
        });
        return;
      }
    }

    const shippedStatuses = ['SHIPPING', 'DELIVERED'];
    const newStatus = shippedStatuses.includes(order.status) || order.refundType ? 'REFUNDED' : 'CANCELLED';
    const now = new Date();

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        cancelReason,
        cancelledAt: now,
        refundAmount: actualRefundAmount,
        refundedAt: newStatus === 'REFUNDED' ? now : undefined,
        returnShippingCost: returnShipCost || undefined,
        sellerRefundMemo: cancelReason,
      },
    });

    // 재고 복구 + 매출 차감
    await Promise.all(order.items.map((item: any) =>
      prisma.product.updateMany({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity }, totalSales: { decrement: item.quantity }, totalRevenue: { decrement: item.unitPrice * item.quantity } },
      })
    ));

    await prisma.notification.create({
      data: {
        sellerId: req.seller!.id,
        type: 'order',
        title: newStatus === 'REFUNDED' ? '환불 처리 완료' : '주문 취소 완료',
        message: `주문번호 ${order.orderNumber} ${newStatus === 'REFUNDED' ? '환불' : '취소'} 처리 완료`,
        link: `/dashboard/orders/${order.id}`,
      },
    });

    res.json({ success: true, message: `${newStatus === 'REFUNDED' ? '환불' : '취소'} 처리가 완료되었습니다.`, data: { status: newStatus } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '처리 중 오류가 발생했습니다.' });
  }
};

// 운송장 자동 발급 (택배사 계약 정보 기반)
export const autoAssignTracking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const { orderIds, courierAccountId } = req.body;
    if (!orderIds?.length) { res.status(400).json({ success: false, error: '주문을 선택해주세요.' }); return; }

    const accountWhere: any = { storeId: store.id, isActive: true };
    if (courierAccountId) accountWhere.id = courierAccountId;
    else accountWhere.isDefault = true;

    const account = await prisma.courierAccount.findFirst({ where: accountWhere });
    if (!account) { res.status(400).json({ success: false, error: '등록된 택배사가 없습니다. 배송 관리에서 택배사를 먼저 등록해주세요.' }); return; }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, storeId: store.id, status: { in: ['CONFIRMED', 'PREPARING'] } },
      include: { items: true },
    });

    if (orders.length === 0) { res.status(400).json({ success: false, error: '발급 가능한 주문이 없습니다.' }); return; }

    const results: any[] = [];

    for (const order of orders) {
      const trackingNumber = generateTrackingNumber(account.courierCode);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          trackingNumber,
          courier: account.courierName,
          status: 'SHIPPING',
          shippedAt: new Date(),
        },
      });

      if (order.consumerId) {
        await prisma.consumerNotification.create({
          data: {
            consumerId: order.consumerId,
            title: '배송 시작',
            message: `주문하신 상품이 발송되었습니다. (${account.courierName} ${trackingNumber})`,
            type: 'order_shipping',
          },
        }).catch(() => {});
      }

      results.push({ orderId: order.id, orderNumber: order.orderNumber, trackingNumber, courier: account.courierName });
    }

    res.json({ success: true, message: `${results.length}건의 운송장이 자동 발급되었습니다.`, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '운송장 발급 중 오류가 발생했습니다.' });
  }
};

function generateTrackingNumber(courierCode: string): string {
  const prefix: Record<string, string> = {
    CJ: '6', HANJIN: '4', LOTTE: '2', LOGEN: '9', EPOST: '1', KDEXP: '3', CVSNET: '7', CHUNILPS: '8',
  };
  const p = prefix[courierCode] || '5';
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${p}${ts}${rand}`;
}

// 송장 출력 데이터 조회
export const getShippingLabels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const { orderIds } = req.body;
    if (!orderIds?.length) { res.status(400).json({ success: false, error: '주문을 선택해주세요.' }); return; }

    const accountWhere: any = { storeId: store.id, isActive: true, isDefault: true };
    const account = await prisma.courierAccount.findFirst({ where: accountWhere });

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, storeId: store.id },
      include: { items: true },
    });

    const labels = orders.map((order: any) => ({
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber || '',
      courier: order.courier || account?.courierName || '',
      sender: {
        name: account?.senderName || store.name,
        phone: account?.senderPhone || '',
        zipCode: account?.senderZipCode || '',
        address: `${account?.senderAddress || ''} ${account?.senderAddressDetail || ''}`.trim(),
      },
      receiver: {
        name: order.recipientName,
        phone: order.recipientPhone,
        zipCode: order.postalCode,
        address: `${order.address} ${order.addressDetail || ''}`.trim(),
      },
      memo: order.deliveryMemo || '',
      items: order.items.map((item: any) => ({ name: item.productName, qty: item.quantity })),
      totalAmount: order.finalAmount,
    }));

    res.json({ success: true, data: labels });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '송장 데이터 조회 실패' });
  }
};