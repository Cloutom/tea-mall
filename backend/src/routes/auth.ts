import { Router } from 'express';
import { body } from 'express-validator';
import {
  register, login, kakaoLogin, googleLogin, naverLogin,
  verifyBusiness, refreshToken, getMe, logout, updateProfile,
  sendPhoneCode, verifyPhoneCode,
  changeSellerPassword, requestSellerWithdraw, updateNotificationSettings,
  verifyCurrentPassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/phone/send', sendPhoneCode);
router.post('/phone/verify', verifyPhoneCode);

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty().trim(),
], register);

router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty(),
], login);

router.post('/oauth/kakao', kakaoLogin);
router.post('/oauth/google', googleLogin);
router.post('/oauth/naver', naverLogin);

router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.put('/notification-settings', authenticate, updateNotificationSettings);
router.post('/verify-password', authenticate, verifyCurrentPassword);
router.post('/change-password', authenticate, changeSellerPassword);
router.post('/withdraw', authenticate, requestSellerWithdraw);

// 카카오 알림 연동
import { getKakaoAuthUrl, handleKakaoCallback } from '../utils/kakao-notify';
router.get('/kakao-notify/connect', authenticate, (req: any, res: any) => {
  const url = getKakaoAuthUrl(req.seller.id);
  res.json({ success: true, data: { url } });
});
router.get('/kakao-notify/callback', async (req: any, res: any) => {
  try {
    const { code, state: sellerId } = req.query;
    if (!code || !sellerId) { res.status(400).send('잘못된 요청입니다.'); return; }
    await handleKakaoCallback(code as string, sellerId as string);
    res.send('<script>alert("카카오톡 알림 연동 완료!"); window.close();</script>');
  } catch (e: any) {
    console.error('[카카오 콜백 에러]', e.response?.data || e.message);
    res.send('<script>alert("연동 실패. 다시 시도해주세요."); window.close();</script>');
  }
});
router.post('/kakao-notify/disconnect', authenticate, async (req: any, res: any) => {
  try {
    await require('../config/database').default.seller.update({
      where: { id: req.seller.id },
      data: { kakaoConnected: false, kakaoAccessToken: null, kakaoRefreshToken: null, notifyKakao: false },
    });
    res.json({ success: true, message: '카카오톡 알림 연동이 해제되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '연동 해제 실패' }); }
});

// 서류 업로드 (사업자등록증, 통신판매업신고증, 통장사본)
const { uploadSingle: docUpload } = require('../middleware/upload');
router.post('/upload-document', authenticate, docUpload, async (req: any, res: any) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ success: false, error: '파일을 업로드해주세요.' }); return; }
    const url = file.location || `/uploads/${file.filename}`;
    const { docType } = req.body;
    const prisma = require('../config/database').default;
    const data: any = {};
    if (docType === 'license') data.businessLicenseUrl = url;
    else if (docType === 'permit') data.salesPermitUrl = url;
    else if (docType === 'bank') data.bankCopyUrl = url;
    else { res.status(400).json({ success: false, error: '문서 유형을 지정해주세요.' }); return; }
    await prisma.seller.update({ where: { id: req.seller.id }, data });
    res.json({ success: true, url });
  } catch { res.status(500).json({ success: false, error: '업로드 실패' }); }
});

router.post('/verify-business', authenticate, [
  body('businessNumber').notEmpty().trim(),
  body('businessName').notEmpty().trim(),
  body('businessOwner').notEmpty().trim(),
], verifyBusiness);

export default router;
