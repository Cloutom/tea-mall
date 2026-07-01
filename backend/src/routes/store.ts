import { Router } from 'express';
import {
  getMyStore, createStore, updateStore, updateStoreTheme, updateShippingSettings,
  addBanner, deleteBanner, reorderBanners,
  getPopups, createPopup, updatePopup, deletePopup, updatePopupDisplayMode,
} from '../controllers/store.controller';
import { authenticate } from '../middleware/auth';
import { uploadSingle, uploadStoreFields } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', getMyStore);
router.post('/', createStore);
router.put('/', uploadStoreFields, updateStore);
router.put('/theme', updateStoreTheme);
router.put('/shipping', updateShippingSettings);

router.post('/banners', uploadSingle, addBanner);
router.delete('/banners/:bannerId', deleteBanner);
router.put('/banners/reorder', reorderBanners);

router.get('/popup', getPopups);
router.post('/popup', uploadSingle, createPopup);
router.put('/popup/display-mode', updatePopupDisplayMode);
router.put('/popup/:popupId', uploadSingle, updatePopup);
router.delete('/popup/:popupId', deletePopup);

// 정산 조회
router.get('/settlements', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const seller = await prisma.seller.findUnique({ where: { id: (req as any).seller.id } });
    const store = await prisma.store.findUnique({ where: { sellerId: (req as any).seller.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어 없음' }); return; }

    // 정산 내역 (과거)
    const settlements = await prisma.settlement.findMany({
      where: { storeId: store.id }, orderBy: { period: 'desc' }, take: 12,
    });

    // 당월 정산 예정 (이번 달 구매확정된 금액)
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentSettlement = await prisma.settlement.findUnique({
      where: { storeId_period: { storeId: store.id, period: currentPeriod } },
    });

    // 다음 정산일 계산 (다음달 10일)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);
    const nextSettlementDate = nextMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    res.json({
      success: true,
      data: {
        settlements,
        pending: {
          period: currentPeriod,
          amount: currentSettlement?.totalSales || 0,
          orderCount: currentSettlement?.orderCount || 0,
          nextSettlementDate,
        },
        bankInfo: {
          bankName: seller?.bankName || null,
          bankAccountNo: seller?.bankAccountNo || null,
          bankAccountHolder: seller?.bankAccountHolder || null,
        },
      },
    });
  } catch { res.status(500).json({ success: false, error: '정산 조회 실패' }); }
});

// 정산 상세 (엑셀용)
router.get('/settlement-detail', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const store = await prisma.store.findUnique({ where: { sellerId: (req as any).seller.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어 없음' }); return; }
    const period = (req.query.period as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = period.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const orders = await prisma.order.findMany({
      where: { storeId: store.id, createdAt: { gte: start, lte: end } },
      include: {
        items: { include: { product: { select: {
          wholesaleSupplier: true, wholesalePrice: true, wholesaleShipping: true,
          marketShippingCost: true, category: { select: { name: true } },
        } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const setting = await prisma.pointSetting.findFirst();
    const platRate = (store.customPlatformFee ?? setting?.platformFeeRate ?? 3.5) / 100;
    const payRate = (store.customPaymentFee ?? setting?.paymentFeeRate ?? 2) / 100;

    const STATUS_LABEL: Record<string, string> = {
      PENDING: '주문접수', CONFIRMED: '확인', PREPARING: '준비중', SHIPPING: '배송중',
      DELIVERED: '배송완료', PURCHASE_CONFIRMED: '구매확정',
      CANCELLED: '취소', REFUND_REQ: '환불요청', REFUNDED: '환불완료',
    };

    const rows = orders.flatMap((o: any) => o.items.map((item: any) => {
      const p = item.product;
      const orderPrice = item.totalPrice;
      const pFee = Math.round(orderPrice * platRate);
      const payFee = Math.round(orderPrice * payRate);
      const settlementPrice = orderPrice - pFee - payFee;
      const wPrice = (p?.wholesalePrice || 0) * item.quantity;
      const wShip = p?.wholesaleShipping || 0;
      const mShipCost = p?.marketShippingCost || 0;
      const consumerPaidShip = o.shippingFee || 0;
      const discount = o.discountAmount ? Math.round(o.discountAmount / o.items.length) : 0;
      const totalCost = wPrice + wShip + mShipCost;
      const netProfit = settlementPrice - totalCost + (consumerPaidShip > 0 ? Math.round(consumerPaidShip / o.items.length) : 0);
      const marginAmount = p?.wholesalePrice ? (orderPrice - totalCost) : null;
      const marginRate = marginAmount !== null && orderPrice > 0 ? Math.round(marginAmount / orderPrice * 100) : null;

      return {
        wholesaleSupplier: p?.wholesaleSupplier || '',
        productName: item.productName,
        category: p?.category?.name || '',
        recipient: o.recipientName || '',
        status: STATUS_LABEL[o.status] || o.status,
        orderDate: o.createdAt,
        wholesalePrice: p?.wholesalePrice ? wPrice : null,
        wholesaleShipping: p?.wholesaleShipping ?? null,
        marketShippingCost: mShipCost || null,
        consumerShippingFee: Math.round((o.shippingFee || 0) / o.items.length),
        marketDiscount: discount > 0 ? discount : 0,
        marginRate,
        marginAmount,
        settlementPrice,
        orderPrice,
        netProfit: p?.wholesalePrice ? netProfit : null,
        quantity: item.quantity,
        orderNumber: o.orderNumber,
      };
    }));

    res.json({ success: true, data: { rows, period } });
  } catch { res.status(500).json({ success: false, error: '정산 상세 조회 실패' }); }
});

// 계좌 설정
router.put('/bank-account', async (req, res) => {
  try {
    const prisma = require('../config/database').default;
    const sellerId = (req as any).seller.id;
    const { bankName, bankAccountNo, bankAccountHolder } = req.body;

    if (!bankName || !bankAccountNo || !bankAccountHolder) {
      res.status(400).json({ success: false, error: '은행명, 계좌번호, 예금주를 모두 입력해주세요.' }); return;
    }

    // 사업자명과 예금주 일치 확인
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (seller?.businessName && seller.businessName !== bankAccountHolder && seller.businessOwner !== bankAccountHolder) {
      res.status(400).json({ success: false, error: '예금주가 사업자 상호 또는 대표자명과 일치하지 않습니다.' }); return;
    }

    await prisma.seller.update({
      where: { id: sellerId },
      data: { bankName, bankAccountNo, bankAccountHolder },
    });
    res.json({ success: true, message: '계좌 정보가 저장되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '계좌 저장 실패' }); }
});

export default router;
