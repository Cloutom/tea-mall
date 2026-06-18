import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import prisma from '../config/database';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const ACCESS_SECRET = process.env.CONSUMER_JWT_SECRET || 'consumer-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.CONSUMER_JWT_REFRESH_SECRET || 'consumer-refresh-secret-change-in-prod';
const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '30d';

function signAccess(id: string) {
  return jwt.sign({ id, type: 'consumer' }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefresh(id: string) {
  return jwt.sign({ id, type: 'consumer' }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: '이름, 이메일, 비밀번호는 필수입니다.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' });
      return;
    }
    const existing = await prisma.consumer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: '이미 사용 중인 이메일입니다.' });
      return;
    }
    const hashed = await bcrypt.hash(password, 12);
    const consumer = await prisma.consumer.create({
      data: { email, password: hashed, name, phone: phone || null },
    });

    const accessToken = signAccess(consumer.id);
    const refreshToken = signRefresh(consumer.id);
    await prisma.consumerRefreshToken.create({
      data: { token: refreshToken, consumerId: consumer.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    res.cookie('consumer_refresh_token', refreshToken, {
      httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({
      success: true,
      data: { accessToken, consumer: { id: consumer.id, email: consumer.email, name: consumer.name, phone: consumer.phone } },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '회원가입 중 오류가 발생했습니다.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }
    const consumer = await prisma.consumer.findUnique({ where: { email } });
    if (!consumer || !(await bcrypt.compare(password, consumer.password))) {
      res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }
    if (!consumer.isActive) {
      res.status(403).json({ success: false, error: '비활성화된 계정입니다.' });
      return;
    }

    await prisma.consumer.update({ where: { id: consumer.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signAccess(consumer.id);
    const refreshToken = signRefresh(consumer.id);
    await prisma.consumerRefreshToken.create({
      data: { token: refreshToken, consumerId: consumer.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    res.cookie('consumer_refresh_token', refreshToken, {
      httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({
      success: true,
      data: { accessToken, consumer: { id: consumer.id, email: consumer.email, name: consumer.name, phone: consumer.phone } },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const consumer = await prisma.consumer.findUnique({
      where: { id: consumerId },
      select: { id: true, email: true, name: true, phone: true, createdAt: true },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' }); return; }
    res.json({ success: true, data: consumer });
  } catch {
    res.status(500).json({ success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.consumer_refresh_token;
    if (!token) { res.status(401).json({ success: false, error: '리프레시 토큰이 없습니다.' }); return; }

    const stored = await prisma.consumerRefreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: '만료된 토큰입니다.' }); return;
    }

    const payload = jwt.verify(token, REFRESH_SECRET) as any;
    const accessToken = signAccess(payload.id);
    res.json({ success: true, data: { accessToken } });
  } catch {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.consumer_refresh_token;
    if (token) {
      await prisma.consumerRefreshToken.deleteMany({ where: { token } });
    }
    res.clearCookie('consumer_refresh_token');
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '로그아웃 중 오류가 발생했습니다.' });
  }
};

export const getMyOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const orders = await prisma.order.findMany({
      where: { consumerId, status: { not: 'PENDING' } },
      include: {
        store: { select: { name: true, slug: true, logoUrl: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch {
    res.status(500).json({ success: false, error: '주문 내역 조회 중 오류가 발생했습니다.' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { name, phone } = req.body;
    const consumer = await prisma.consumer.update({
      where: { id: consumerId },
      data: { name: name || undefined, phone: phone || undefined },
      select: { id: true, email: true, name: true, phone: true },
    });
    res.json({ success: true, data: consumer });
  } catch {
    res.status(500).json({ success: false, error: '프로필 수정 중 오류가 발생했습니다.' });
  }
};

// 이메일 인증 메일 발송
export const sendEmailVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) { res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' }); return; }
    if (consumer.emailVerified) { res.json({ success: true, message: '이미 인증된 이메일입니다.' }); return; }

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.consumer.update({
      where: { id: consumerId },
      data: { emailVerifyToken: token, emailVerifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const verifyUrl = `${CLIENT_URL}/auth/verify-email?token=${token}`;
    try {
      const mailer = getMailer();
      await mailer.sendMail({
        from: `"teabri" <${process.env.SMTP_USER}>`,
        to: consumer.email,
        subject: '[teabri] 이메일 인증',
        html: `<p>아래 링크를 클릭하여 이메일 인증을 완료해주세요.</p>
               <a href="${verifyUrl}" style="padding:10px 20px;background:#2D6A4F;color:white;text-decoration:none;border-radius:6px;display:inline-block;margin-top:10px">이메일 인증하기</a>
               <p style="color:#666;font-size:12px;margin-top:16px">링크는 24시간 후 만료됩니다.</p>`,
      });
    } catch (mailErr) {
      console.error('메일 발송 오류:', mailErr);
    }

    res.json({ success: true, message: '인증 메일을 발송했습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '메일 발송 중 오류가 발생했습니다.' });
  }
};

// 이메일 인증 완료
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ success: false, error: '토큰이 없습니다.' }); return; }

    const consumer = await prisma.consumer.findFirst({
      where: { emailVerifyToken: token, emailVerifyTokenExpiry: { gte: new Date() } },
    });
    if (!consumer) { res.status(400).json({ success: false, error: '유효하지 않거나 만료된 토큰입니다.' }); return; }

    await prisma.consumer.update({
      where: { id: consumer.id },
      data: { emailVerified: true, emailVerifyToken: null, emailVerifyTokenExpiry: null },
    });

    res.json({ success: true, message: '이메일 인증이 완료되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '인증 중 오류가 발생했습니다.' });
  }
};

// ─── 소셜 로그인 ───────────────────────────────────

async function findOrCreateConsumerFromOAuth(
  provider: string, providerId: string, email: string, name: string
) {
  // 1. 기존 OAuth 계정으로 조회
  const existing = await prisma.consumerOAuthAccount.findUnique({
    where: { provider_providerId: { provider, providerId } },
    include: { consumer: true },
  });
  if (existing) return existing.consumer;

  // 2. 이메일로 기존 소비자 조회 → OAuth 연결
  let consumer = await prisma.consumer.findUnique({ where: { email } });
  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: { email, password: crypto.randomBytes(16).toString('hex'), name, emailVerified: true },
    });
  }
  await prisma.consumerOAuthAccount.create({ data: { provider, providerId, consumerId: consumer.id } });
  return consumer;
}

function issueTokensAndRedirect(res: Response, consumer: any, redirectPath = '/') {
  const accessToken = signAccess(consumer.id);
  const refreshToken = signRefresh(consumer.id);
  prisma.consumerRefreshToken.create({
    data: { token: refreshToken, consumerId: consumer.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  }).catch(() => {});
  res.cookie('consumer_refresh_token', refreshToken, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.redirect(`${CLIENT_URL}/auth/social-callback?token=${accessToken}&name=${encodeURIComponent(consumer.name)}&email=${encodeURIComponent(consumer.email)}&id=${consumer.id}`);
}

// 카카오 로그인 시작
export const kakaoLogin = (_req: Request, res: Response) => {
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.KAKAO_CONSUMER_REDIRECT_URI || `${process.env.CLIENT_URL?.replace('3000', '4000') || 'http://localhost:4000'}/api/consumer/auth/social/kakao/callback`)}&response_type=code`;
  res.redirect(url);
};

// 카카오 콜백
export const kakaoCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    const redirectUri = process.env.KAKAO_CONSUMER_REDIRECT_URI || `http://localhost:4000/api/consumer/auth/social/kakao/callback`;
    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: { grant_type: 'authorization_code', client_id: process.env.KAKAO_CLIENT_ID, redirect_uri: redirectUri, code },
    });
    const profileRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { id, kakao_account } = profileRes.data;
    const email = kakao_account?.email || `kakao_${id}@teabri.social`;
    const name = kakao_account?.profile?.nickname || '카카오 사용자';
    const consumer = await findOrCreateConsumerFromOAuth('kakao', String(id), email, name);
    issueTokensAndRedirect(res, consumer);
  } catch (err) {
    console.error('Kakao callback error', err);
    res.redirect(`${CLIENT_URL}/auth/login?error=social_failed`);
  }
};

// 구글 로그인 시작
export const googleLogin = (_req: Request, res: Response) => {
  const redirectUri = process.env.GOOGLE_CONSUMER_REDIRECT_URI || `http://localhost:4000/api/consumer/auth/social/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email profile`;
  res.redirect(url);
};

// 구글 콜백
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    const redirectUri = process.env.GOOGLE_CONSUMER_REDIRECT_URI || `http://localhost:4000/api/consumer/auth/social/google/callback`;
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri, grant_type: 'authorization_code',
    });
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { id, email, name } = profileRes.data;
    const consumer = await findOrCreateConsumerFromOAuth('google', id, email, name);
    issueTokensAndRedirect(res, consumer);
  } catch (err) {
    console.error('Google callback error', err);
    res.redirect(`${CLIENT_URL}/auth/login?error=social_failed`);
  }
};

// 네이버 로그인 시작
export const naverLogin = (_req: Request, res: Response) => {
  const redirectUri = process.env.NAVER_CONSUMER_REDIRECT_URI || `http://localhost:4000/api/consumer/auth/social/naver/callback`;
  const state = crypto.randomBytes(8).toString('hex');
  const url = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${process.env.NAVER_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.redirect(url);
};

// 네이버 콜백
export const naverCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.query;
    const redirectUri = process.env.NAVER_CONSUMER_REDIRECT_URI || `http://localhost:4000/api/consumer/auth/social/naver/callback`;
    const tokenRes = await axios.get('https://nid.naver.com/oauth2.0/token', {
      params: { grant_type: 'authorization_code', client_id: process.env.NAVER_CLIENT_ID, client_secret: process.env.NAVER_CLIENT_SECRET, redirect_uri: redirectUri, code, state },
    });
    const profileRes = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });
    const { id, email, name } = profileRes.data.response;
    const consumer = await findOrCreateConsumerFromOAuth('naver', id, email || `naver_${id}@teabri.social`, name);
    issueTokensAndRedirect(res, consumer);
  } catch (err) {
    console.error('Naver callback error', err);
    res.redirect(`${CLIENT_URL}/auth/login?error=social_failed`);
  }
};