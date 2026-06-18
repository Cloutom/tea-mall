import { Router } from 'express';
import { body } from 'express-validator';
import {
  register, login, kakaoLogin, googleLogin, naverLogin,
  verifyBusiness, refreshToken, getMe, logout, updateProfile,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

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

router.post('/verify-business', authenticate, [
  body('businessNumber').notEmpty().trim(),
  body('businessName').notEmpty().trim(),
  body('businessOwner').notEmpty().trim(),
], verifyBusiness);

export default router;
