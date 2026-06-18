import { Router } from 'express';
import {
  register, login, me, refresh, logout, getMyOrders, updateProfile,
  sendEmailVerify, verifyEmail,
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

// 인증
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', consumerAuth, me);
router.get('/orders', consumerAuth, getMyOrders);
router.patch('/profile', consumerAuth, updateProfile);

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

export default router;