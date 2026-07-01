import { Router } from 'express';
import {
  adminLogin, getAdminStats, getSellers, approveSeller, rejectSeller, suspendSeller, seedAdmin,
  getMainBanners, createMainBanner, updateMainBanner, deleteMainBanner, reorderMainBanners,
  getMainPopups, createMainPopup, updateMainPopup, deleteMainPopup,
  getPointSetting, updatePointSetting,
  getNotices, createNotice, updateNotice, deleteNotice,
  publishStore, getConsumers, getConsumerDetail, unmaskConsumer,
  adminUpdateOrderStatus, adminDeleteReview, approveWithdraw, rejectWithdraw,
  getAdminProfile, updateAdminPhone,
  getReports, resolveReport, deleteReportedProduct,
  getInquiries, answerInquiry, setup2FA, verify2FA,
} from '../controllers/admin.controller';
import { authenticateAdmin } from '../middleware/adminAuth';
import { uploadSingle } from '../middleware/upload';

const router = Router();

router.post('/login', adminLogin);
router.post('/seed', seedAdmin);
router.get('/profile', authenticateAdmin, getAdminProfile);
router.put('/profile/phone', authenticateAdmin, updateAdminPhone);

router.get('/stats', authenticateAdmin, getAdminStats);
router.get('/sellers', authenticateAdmin, getSellers);
router.patch('/sellers/:id/approve', authenticateAdmin, approveSeller);
router.patch('/sellers/:id/reject', authenticateAdmin, rejectSeller);
router.patch('/sellers/:id/suspend', authenticateAdmin, suspendSeller);
router.patch('/sellers/:id/approve-withdraw', authenticateAdmin, approveWithdraw);
router.patch('/sellers/:id/reject-withdraw', authenticateAdmin, rejectWithdraw);

// 메인 배너
router.get('/banners', authenticateAdmin, getMainBanners);
router.post('/banners', authenticateAdmin, uploadSingle, createMainBanner);
router.put('/banners/:id', authenticateAdmin, uploadSingle, updateMainBanner);
router.delete('/banners/:id', authenticateAdmin, deleteMainBanner);
router.put('/banners-reorder', authenticateAdmin, reorderMainBanners);

// 메인 팝업
router.get('/popups', authenticateAdmin, getMainPopups);
router.post('/popups', authenticateAdmin, uploadSingle, createMainPopup);
router.put('/popups/:id', authenticateAdmin, uploadSingle, updateMainPopup);
router.delete('/popups/:id', authenticateAdmin, deleteMainPopup);

// 포인트 설정
router.get('/point-setting', authenticateAdmin, getPointSetting);
router.put('/point-setting', authenticateAdmin, updatePointSetting);

// 공지사항
router.get('/notices', authenticateAdmin, getNotices);
router.post('/notices', authenticateAdmin, createNotice);
router.put('/notices/:id', authenticateAdmin, updateNotice);
router.delete('/notices/:id', authenticateAdmin, deleteNotice);

// 스토어 게시 승인
router.patch('/stores/:id/publish', authenticateAdmin, publishStore);

// 스토어 개별 수수료 설정
router.patch('/stores/:id/fees', authenticateAdmin, async (req, res) => {
  try {
    const { customPlatformFee, customPaymentFee } = req.body;
    const prisma = require('../config/database').default;
    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: {
        customPlatformFee: customPlatformFee !== undefined ? (customPlatformFee === null ? null : parseFloat(customPlatformFee)) : undefined,
        customPaymentFee: customPaymentFee !== undefined ? (customPaymentFee === null ? null : parseFloat(customPaymentFee)) : undefined,
      },
    });

    // 이 가게의 미정산 데이터 재계산
    const setting = await prisma.pointSetting.findFirst();
    const pr = (store.customPlatformFee != null ? store.customPlatformFee : (setting?.platformFeeRate || 3.5)) / 100;
    const payr = (store.customPaymentFee != null ? store.customPaymentFee : (setting?.paymentFeeRate || 2)) / 100;
    const pending = await prisma.settlement.findMany({ where: { storeId: store.id, status: 'PENDING' } });
    for (const s of pending) {
      const pFee = Math.round(s.totalSales * pr);
      const payFee = Math.round(s.totalSales * payr);
      await prisma.settlement.update({ where: { id: s.id }, data: { platformFee: pFee, paymentFee: payFee, netAmount: s.totalSales - pFee - payFee } });
    }

    res.json({ success: true, data: store });
  } catch { res.status(500).json({ success: false, error: '수수료 설정 실패' }); }
});

// 소비자 관리
router.get('/consumers', authenticateAdmin, getConsumers);
router.get('/consumers/:id', authenticateAdmin, getConsumerDetail);
router.post('/consumers/:id/unmask', authenticateAdmin, unmaskConsumer);
router.patch('/orders/:orderId/status', authenticateAdmin, adminUpdateOrderStatus);
router.delete('/reviews/:reviewId', authenticateAdmin, adminDeleteReview);

// 신고 관리
router.get('/reports', authenticateAdmin, getReports);
router.patch('/reports/:id', authenticateAdmin, resolveReport);
router.delete('/reports/product/:productId', authenticateAdmin, deleteReportedProduct);

// 1:1 문의 관리
router.get('/inquiries', authenticateAdmin, getInquiries);
router.patch('/inquiries/:id/answer', authenticateAdmin, answerInquiry);

// 2FA
router.post('/2fa/setup', authenticateAdmin, setup2FA);
router.post('/2fa/verify', authenticateAdmin, verify2FA);

export default router;
