import { Router } from 'express';
import {
  register, login, me, refresh, logout, getMyOrders, updateProfile, updatePhone,
  sendEmailVerify, verifyEmail,
  verifyIdentity, sendConsumerPhoneCode, verifyConsumerPhoneCode, checkUsername,
  changePassword, requestWithdraw, cancelWithdraw,
  toggleWishlist, getMyWishlists,
  kakaoLogin, kakaoCallback, googleLogin, googleCallback, naverLogin, naverCallback,
} from '../controllers/consumer-auth.controller';
import { getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } from '../controllers/consumer-addresses.controller';
import {
  getBillingKeys, confirmBillingKey, deleteBillingKey, payWithBillingKey,
  getWebAuthnRegisterOptions, verifyWebAuthnRegistration,
  getWebAuthnAuthOptions, verifyWebAuthnAuth,
  getWebAuthnCreds, deleteWebAuthnCred,
} from '../controllers/consumer-webauthn.controller';
import { consumerAuth } from '../middleware/consumerAuth';

const router = Router();

// 본인인증
router.post('/identity/verify', verifyIdentity);
router.post('/phone/send', sendConsumerPhoneCode);
router.post('/phone/verify', verifyConsumerPhoneCode);

// 아이디 중복확인
router.post('/check-username', checkUsername);

// 인증
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', consumerAuth, me);
router.get('/orders', consumerAuth, getMyOrders);
router.patch('/profile', consumerAuth, updateProfile);
router.patch('/phone', consumerAuth, updatePhone);

// 이메일 인증
router.post('/send-email-verify', consumerAuth, sendEmailVerify);
router.post('/verify-email', verifyEmail);

// 소셜 로그인 (카카오/구글/네이버)
router.get('/social/kakao', kakaoLogin);
router.get('/social/kakao/callback', kakaoCallback);
router.get('/social/google', googleLogin);
router.get('/social/google/callback', googleCallback);
router.get('/social/naver', naverLogin);
router.get('/social/naver/callback', naverCallback);

// Tea 프로필
router.post('/tea-profile', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const { teaProfile, teaScores } = req.body;
    if (!teaProfile) { res.status(400).json({ success: false, error: '프로필 데이터가 필요합니다.' }); return; }
    const { PrismaClient } = require('@prisma/client');
    const prisma = require('../config/database').default;
    await prisma.consumer.update({ where: { id: consumerId }, data: { teaProfile, teaScores } });
    res.json({ success: true, message: 'Tea 프로필이 저장되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '프로필 저장 실패' }); }
});

// 비밀번호 확인 (개인정보 변경 전 본인확인)
router.post('/verify-password', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const bcrypt = require('bcryptjs');
    const { password } = req.body;
    if (!password) { res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' }); return; }
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) { res.status(404).json({ success: false }); return; }
    const valid = await bcrypt.compare(password, consumer.password);
    if (!valid) { res.status(400).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }
    res.json({ success: true, verified: true });
  } catch { res.status(500).json({ success: false, error: '확인 실패' }); }
});

// 비밀번호 변경 / 탈퇴
router.post('/change-password', consumerAuth, changePassword);
router.post('/withdraw', consumerAuth, requestWithdraw);
router.post('/cancel-withdraw', consumerAuth, cancelWithdraw);

// 탈퇴 계정 살리기 (비로그인 상태에서 호출)
router.post('/reactivate', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }); return; }
    const prisma = require('../config/database').default;
    const bcrypt = require('bcryptjs');
    const consumer = await prisma.consumer.findUnique({ where: { email } });
    if (!consumer) { res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' }); return; }
    if (consumer.isActive) { res.status(400).json({ success: false, error: '이미 활성화된 계정입니다.' }); return; }
    if (!consumer.withdrawScheduledAt || new Date() >= consumer.withdrawScheduledAt) {
      res.status(400).json({ success: false, error: '복구 기간이 만료되었습니다.' }); return;
    }
    const valid = await bcrypt.compare(password, consumer.password);
    if (!valid) { res.status(400).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }
    await prisma.consumer.update({
      where: { id: consumer.id },
      data: { isActive: true, withdrawRequestedAt: null, withdrawReason: null, withdrawScheduledAt: null },
    });
    res.json({ success: true, message: '계정이 복구되었습니다. 다시 로그인해주세요.' });
  } catch { res.status(500).json({ success: false, error: '계정 복구 실패' }); }
});

// 내 리뷰 목록
router.get('/reviews', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const reviews = await prisma.review.findMany({
      where: { consumerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, thumbnail: true, store: { select: { name: true, slug: true } } } },
      },
    });
    res.json({ success: true, data: reviews });
  } catch { res.status(500).json({ success: false, error: '리뷰 조회 실패' }); }
});

// 리뷰 수정
router.put('/reviews/:id', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const review = await prisma.review.findFirst({ where: { id: req.params.id, consumerId } });
    if (!review) { res.status(404).json({ success: false, error: '리뷰를 찾을 수 없습니다.' }); return; }
    const { rating, content } = req.body;
    const data: any = {};
    if (rating) data.rating = parseInt(rating);
    if (content !== undefined) data.content = content.trim() || null;
    const updated = await prisma.review.update({ where: { id: review.id }, data });
    res.json({ success: true, data: updated });
  } catch { res.status(500).json({ success: false, error: '리뷰 수정 실패' }); }
});

// 리뷰 삭제
router.delete('/reviews/:id', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const review = await prisma.review.findFirst({ where: { id: req.params.id, consumerId } });
    if (!review) { res.status(404).json({ success: false, error: '리뷰를 찾을 수 없습니다.' }); return; }
    await prisma.review.delete({ where: { id: review.id } });
    res.json({ success: true, message: '리뷰가 삭제되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '리뷰 삭제 실패' }); }
});

// 구매확정
router.post('/orders/:orderId/confirm', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const order = await prisma.order.findFirst({ where: { id: req.params.orderId, consumerId, status: 'DELIVERED' } });
    if (!order) { res.status(400).json({ success: false, error: '구매확정 가능한 주문이 아닙니다.' }); return; }
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PURCHASE_CONFIRMED' } });

    // 정산 예정에 추가 (수수료는 DB 설정에서 가져옴)
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let setting = await prisma.pointSetting.findFirst();
    if (!setting) setting = await prisma.pointSetting.create({ data: {} });
    const store = await prisma.store.findUnique({ where: { id: order.storeId }, select: { customPlatformFee: true, customPaymentFee: true } });
    const platformFeeRate = (store?.customPlatformFee ?? setting.platformFeeRate) / 100;
    const paymentFeeRate = (store?.customPaymentFee ?? setting.paymentFeeRate) / 100;
    const pFee = Math.round(order.finalAmount * platformFeeRate);
    const payFee = Math.round(order.finalAmount * paymentFeeRate);
    const net = order.finalAmount - pFee - payFee;
    await prisma.settlement.upsert({
      where: { storeId_period: { storeId: order.storeId, period } },
      update: { totalSales: { increment: order.finalAmount }, platformFee: { increment: pFee }, paymentFee: { increment: payFee }, netAmount: { increment: net }, orderCount: { increment: 1 } },
      create: { storeId: order.storeId, period, totalSales: order.finalAmount, platformFee: pFee, paymentFee: payFee, netAmount: net, orderCount: 1 },
    });

    let earnedPoints = 0;
    if (order.discountAmount === 0) {
      let setting = await prisma.pointSetting.findFirst();
      if (!setting) setting = await prisma.pointSetting.create({ data: {} });
      if (order.finalAmount >= setting.minOrderAmount) {
        earnedPoints = Math.min(Math.round(order.finalAmount * setting.earnRate / 100), setting.maxEarnAmount);
        if (earnedPoints > 0) {
          await prisma.pointHistory.create({ data: { consumerId, amount: earnedPoints, type: 'EARN', reason: `주문 ${order.orderNumber} 구매확정 적립`, orderId: order.id } });
        }
      }
    }
    const { notifySellerOrderStatus } = require('../utils/kakao-notify');
    notifySellerOrderStatus({
      orderNumber: order.orderNumber, storeId: order.storeId,
      status: 'PURCHASE_CONFIRMED', buyerName: order.buyerName,
    }).catch(() => {});
    res.json({ success: true, message: `구매확정 완료${earnedPoints > 0 ? `. ${earnedPoints}P 적립!` : ''}`, earnedPoints });
  } catch { res.status(500).json({ success: false, error: '구매확정 실패' }); }
});

// 포인트
router.get('/points', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const histories = await prisma.pointHistory.findMany({ where: { consumerId }, orderBy: { createdAt: 'desc' }, take: 50 });
    const earn = await prisma.pointHistory.aggregate({ where: { consumerId, type: 'EARN' }, _sum: { amount: true } });
    const use = await prisma.pointHistory.aggregate({ where: { consumerId, type: 'USE' }, _sum: { amount: true } });
    const balance = (earn._sum.amount || 0) + (use._sum.amount || 0);
    res.json({ success: true, data: { balance, histories } });
  } catch { res.status(500).json({ success: false, error: '포인트 조회 실패' }); }
});

// 최근 본 상품
router.post('/recent-view/:productId', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const { productId } = req.params;
    const prisma = require('../config/database').default;
    await prisma.recentView.upsert({
      where: { consumerId_productId: { consumerId, productId } },
      update: { viewedAt: new Date() },
      create: { consumerId, productId },
    });
    const count = await prisma.recentView.count({ where: { consumerId } });
    if (count > 30) {
      const oldest = await prisma.recentView.findMany({ where: { consumerId }, orderBy: { viewedAt: 'asc' }, take: count - 30 });
      await prisma.recentView.deleteMany({ where: { id: { in: oldest.map((r: any) => r.id) } } });
    }
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '기록 실패' }); }
});

router.get('/recent-views', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const views = await prisma.recentView.findMany({
      where: { consumerId },
      orderBy: { viewedAt: 'desc' },
      take: 20,
      include: { product: { select: { id: true, name: true, price: true, thumbnail: true, discountRate: true, store: { select: { name: true, slug: true } } } } },
    });
    res.json({ success: true, data: views });
  } catch { res.status(500).json({ success: false, error: '조회 실패' }); }
});

// 스토어 찜
router.post('/wishlist/:slug', consumerAuth, toggleWishlist);
router.get('/wishlists', consumerAuth, getMyWishlists);

// 제품 찜
router.post('/product-wishlist/:productId', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const { productId } = req.params;
    const prisma = require('../config/database').default;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }
    const existing = await prisma.productWishlist.findUnique({
      where: { consumerId_productId: { consumerId, productId } },
    });
    if (existing) {
      await prisma.productWishlist.delete({ where: { id: existing.id } });
      res.json({ success: true, wishlisted: false });
    } else {
      await prisma.productWishlist.create({ data: { consumerId, productId } });
      res.json({ success: true, wishlisted: true });
    }
  } catch { res.status(500).json({ success: false, error: '찜 처리 실패' }); }
});

router.get('/product-wishlists', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const wishlists = await prisma.productWishlist.findMany({
      where: { consumerId },
      include: {
        product: {
          select: {
            id: true, name: true, price: true, originalPrice: true, discountRate: true,
            thumbnail: true, stock: true, isActive: true,
            store: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: wishlists });
  } catch { res.status(500).json({ success: false, error: '찜 목록 조회 실패' }); }
});

// 알림
router.get('/notifications', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const notifications = await prisma.consumerNotification.findMany({
      where: { consumerId }, orderBy: { createdAt: 'desc' }, take: 50,
    });
    const unreadCount = await prisma.consumerNotification.count({ where: { consumerId, isRead: false } });
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch { res.status(500).json({ success: false, error: '알림 조회 실패' }); }
});

router.patch('/notifications/read-all', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    await prisma.consumerNotification.updateMany({ where: { consumerId, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '알림 읽음 처리 실패' }); }
});

router.patch('/notifications/:id/read', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    await prisma.consumerNotification.updateMany({ where: { id: req.params.id, consumerId }, data: { isRead: true } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '알림 읽음 처리 실패' }); }
});

// 1:1 문의
router.get('/inquiries', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const inquiries = await prisma.inquiry.findMany({
      where: { consumerId }, orderBy: { createdAt: 'desc' }, take: 30,
    });
    res.json({ success: true, data: inquiries });
  } catch { res.status(500).json({ success: false, error: '문의 조회 실패' }); }
});

router.post('/inquiries', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId }, select: { name: true, email: true } });
    const { category, title, content } = req.body;
    if (!title?.trim() || !content?.trim()) { res.status(400).json({ success: false, error: '제목과 내용을 입력해주세요.' }); return; }
    const inquiry = await prisma.inquiry.create({
      data: {
        consumerId,
        name: consumer?.name || '회원',
        email: consumer?.email || '',
        category: category || '일반',
        title: title.trim(),
        content: content.trim(),
      },
    });
    res.status(201).json({ success: true, data: inquiry });
  } catch { res.status(500).json({ success: false, error: '문의 등록 실패' }); }
});

// 제품 신고
router.post('/reports', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const { type, targetId, reason, detail } = req.body;
    if (!type || !targetId || !reason?.trim()) {
      res.status(400).json({ success: false, error: '신고 사유를 입력해주세요.' }); return;
    }
    const existing = await prisma.report.findFirst({
      where: { consumerId, targetId, status: 'PENDING' },
    });
    if (existing) {
      res.status(400).json({ success: false, error: '이미 접수된 신고가 있습니다.' }); return;
    }
    await prisma.report.create({
      data: { consumerId, type, targetId, reason: reason.trim(), detail: detail?.trim() || null },
    });
    res.json({ success: true, message: '신고가 접수되었습니다.' });
    require('../utils/admin-notify').notifyAdminNewReport(reason.trim(), type).catch(() => {});
  } catch { res.status(500).json({ success: false, error: '신고 접수 실패' }); }
});

router.get('/reports', consumerAuth, async (req, res) => {
  try {
    const consumerId = (req as any).consumerId;
    const prisma = require('../config/database').default;
    const reports = await prisma.report.findMany({
      where: { consumerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const productIds = reports.filter((r: any) => r.type === 'PRODUCT').map((r: any) => r.targetId);
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, thumbnail: true },
        })
      : [];
    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const data = reports.map((r: any) => {
      const prod: any = r.type === 'PRODUCT' ? productMap.get(r.targetId) : null;
      return {
        ...r,
        targetName: prod?.name || (r.type === 'PRODUCT' ? '삭제된 상품' : r.targetId),
        targetThumbnail: prod?.thumbnail || null,
      };
    });
    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: '신고 내역 조회 실패' }); }
});

// 배송지
router.get('/addresses', consumerAuth, getAddresses);
router.post('/addresses', consumerAuth, createAddress);
router.put('/addresses/:id', consumerAuth, updateAddress);
router.delete('/addresses/:id', consumerAuth, deleteAddress);
router.patch('/addresses/:id/default', consumerAuth, setDefaultAddress);

// Toss Billing Key (간편결제 카드 등록)
router.get('/billing', consumerAuth, getBillingKeys);
router.post('/billing/confirm', consumerAuth, confirmBillingKey);
router.delete('/billing/:id', consumerAuth, deleteBillingKey);
router.post('/billing/pay', consumerAuth, payWithBillingKey);

// WebAuthn (지문인증)
router.get('/webauthn', consumerAuth, getWebAuthnCreds);
router.post('/webauthn/register-options', consumerAuth, getWebAuthnRegisterOptions);
router.post('/webauthn/register', consumerAuth, verifyWebAuthnRegistration);
router.post('/webauthn/auth-options', consumerAuth, getWebAuthnAuthOptions);
router.post('/webauthn/auth', consumerAuth, verifyWebAuthnAuth);
router.delete('/webauthn/:id', consumerAuth, deleteWebAuthnCred);

// 스토어 1:1 문의
router.post('/qna', consumerAuth, async (req: any, res: any) => {
  try {
    const consumerId = req.consumerId;
    const { storeId, question } = req.body;
    if (!storeId || !question?.trim()) {
      return res.status(400).json({ success: false, error: '스토어와 문의 내용을 입력해주세요.' });
    }
    const prisma = require('../config/database').default;
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId }, select: { name: true } });
    const qna = await prisma.storeQnA.create({
      data: { storeId, consumerId, buyerName: consumer?.name || '소비자', question: question.trim(), isPrivate: true },
    });
    res.json({ success: true, data: qna });
    require('../utils/admin-notify').notifyAdminNewInquiry(consumer?.name || '소비자', question.trim()).catch(() => {});
  } catch { res.status(500).json({ success: false, error: '문의 접수 실패' }); }
});

export default router;