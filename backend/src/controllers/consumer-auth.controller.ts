import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import nodemailer from 'nodemailer';
import prisma from '../config/database';
import { sanitizeEmail, sanitizePhone, sanitizeString, validatePassword, sanitizeBirthDate } from '../utils/sanitize';
import { generateCode, sendSMS } from '../utils/sms';

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

// PortOne 본인인증 결과 검증
export const verifyIdentity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imp_uid } = req.body;
    if (!imp_uid || typeof imp_uid !== 'string') {
      res.status(400).json({ success: false, error: '인증 정보가 없습니다.' });
      return;
    }

    const impKey = process.env.PORTONE_API_KEY || process.env.IMP_API_KEY;
    const impSecret = process.env.PORTONE_API_SECRET || process.env.IMP_API_SECRET;
    if (!impKey || !impSecret) {
      res.status(500).json({ success: false, error: '본인인증 서비스가 설정되지 않았습니다.' });
      return;
    }

    const tokenRes = await axios.post('https://api.iamport.kr/users/getToken', {
      imp_key: impKey, imp_secret: impSecret,
    });
    const accessToken = tokenRes.data?.response?.access_token;
    if (!accessToken) {
      res.status(500).json({ success: false, error: '인증 서버 연결에 실패했습니다.' });
      return;
    }

    const certRes = await axios.get(`https://api.iamport.kr/certifications/${imp_uid}`, {
      headers: { Authorization: accessToken },
    });
    const cert = certRes.data?.response;
    if (!cert) {
      res.status(400).json({ success: false, error: '인증 결과를 확인할 수 없습니다.' });
      return;
    }

    const { name, phone, birthday, unique_key } = cert;
    const normalizedPhone = (phone || '').replace(/\D/g, '');
    const normalizedBirth = (birthday || '').replace(/\D/g, '').slice(0, 8);

    if (unique_key) {
      const existingByKey = await prisma.consumer.findUnique({ where: { uniqueKey: unique_key } });
      if (existingByKey) {
        res.status(409).json({ success: false, error: '이미 가입된 본인인증 정보입니다. 동일인은 중복 가입할 수 없습니다.' });
        return;
      }
    }

    if (normalizedPhone) {
      const existingByPhone = await prisma.consumer.findUnique({ where: { phone: normalizedPhone } });
      if (existingByPhone) {
        res.status(409).json({ success: false, error: '이미 가입된 휴대폰 번호입니다.' });
        return;
      }
    }

    res.json({
      success: true,
      message: '본인인증이 완료되었습니다.',
      data: {
        name: name || '',
        phone: normalizedPhone,
        birthDate: normalizedBirth,
        uniqueKey: unique_key || '',
      },
    });
  } catch (err: any) {
    const msg = err?.response?.data?.message || '본인인증 검증 중 오류가 발생했습니다.';
    res.status(500).json({ success: false, error: msg });
  }
};

// 휴대폰 인증번호 발송 (SMS OTP 폴백)
export const sendConsumerPhoneCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = sanitizePhone(req.body.phone);
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ success: false, error: '올바른 휴대폰 번호를 입력해주세요.' });
      return;
    }
    const normalized = phone.replace(/\D/g, '');

    const existingConsumer = await prisma.consumer.findUnique({ where: { phone: normalized } });
    if (existingConsumer) {
      res.status(409).json({ success: false, error: '이미 가입된 휴대폰 번호입니다.' });
      return;
    }

    const recent = await prisma.phoneVerification.findFirst({
      where: { phone: normalized, createdAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) {
      res.status(429).json({ success: false, error: '1분 후에 다시 시도해주세요.' });
      return;
    }

    await prisma.phoneVerification.deleteMany({ where: { phone: normalized } });

    const code = generateCode();
    await prisma.phoneVerification.create({
      data: { phone: normalized, code, expiresAt: new Date(Date.now() + 3 * 60_000) },
    });

    const sent = await sendSMS(normalized, `[teabri] 인증번호 ${code}를 입력해주세요.`);
    if (!sent) {
      res.status(500).json({ success: false, error: 'SMS 발송에 실패했습니다.' });
      return;
    }
    res.json({ success: true, message: '인증번호가 발송되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '인증번호 발송 중 오류가 발생했습니다.' });
  }
};

// 휴대폰 인증번호 확인
export const verifyConsumerPhoneCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = sanitizePhone(req.body.phone).replace(/\D/g, '');
    const code = String(req.body.code || '').trim();

    if (!phone || !code) {
      res.status(400).json({ success: false, error: '번호와 인증번호를 입력해주세요.' });
      return;
    }

    const record = await prisma.phoneVerification.findFirst({
      where: { phone, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) { res.status(400).json({ success: false, error: '인증 요청을 먼저 해주세요.' }); return; }
    if (record.attempts >= 5) { res.status(429).json({ success: false, error: '시도 횟수 초과. 인증번호를 재발송해주세요.' }); return; }
    if (record.expiresAt < new Date()) { res.status(400).json({ success: false, error: '인증번호가 만료되었습니다. 재발송해주세요.' }); return; }

    if (record.code !== code) {
      await prisma.phoneVerification.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      res.status(400).json({ success: false, error: '인증번호가 일치하지 않습니다.' });
      return;
    }

    await prisma.phoneVerification.update({ where: { id: record.id }, data: { verified: true } });
    res.json({ success: true, message: '인증이 완료되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '인증 확인 중 오류가 발생했습니다.' });
  }
};

// 아이디 중복 확인
export const checkUsername = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = sanitizeString(req.body.username).toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!username || username.length < 4 || username.length > 20) {
      res.status(400).json({ success: false, error: '아이디는 영문/숫자/밑줄 4~20자여야 합니다.' });
      return;
    }
    const exists = await prisma.consumer.findUnique({ where: { username } });
    res.json({ success: true, available: !exists });
  } catch {
    res.status(500).json({ success: false, error: '중복 확인 중 오류가 발생했습니다.' });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = sanitizeString(req.body.username).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const email = sanitizeEmail(req.body.email);
    const name = sanitizeString(req.body.name).slice(0, 50);
    const phone = sanitizePhone(req.body.phone);
    const birthDate = sanitizeBirthDate(req.body.birthDate);
    const password = req.body.password;
    const uniqueKey = req.body.uniqueKey || null;

    if (!username || username.length < 4 || username.length > 20) { res.status(400).json({ success: false, error: '아이디는 영문/숫자/밑줄 4~20자여야 합니다.' }); return; }
    if (!email) { res.status(400).json({ success: false, error: '올바른 이메일을 입력해주세요.' }); return; }
    // 본인인증 활성화 시 아래 주석 해제
    // if (!name || name.length < 2) { res.status(400).json({ success: false, error: '이름은 2자 이상 입력해주세요.' }); return; }
    // if (!phone) { res.status(400).json({ success: false, error: '휴대폰 번호를 입력해주세요.' }); return; }
    // if (!birthDate) { res.status(400).json({ success: false, error: '올바른 생년월일을 입력해주세요.' }); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { res.status(400).json({ success: false, error: pwErr }); return; }

    const normalizedPhone = phone.replace(/\D/g, '');

    // 본인인증 확인 (PortOne CI 또는 SMS OTP) - SMS 서비스 활성화 시 주석 해제
    // if (uniqueKey) {
    //   const existByKey = await prisma.consumer.findUnique({ where: { uniqueKey } });
    //   if (existByKey) { res.status(409).json({ success: false, error: '이미 본인인증으로 가입된 계정이 있습니다.' }); return; }
    // } else {
    //   const phoneVerification = await prisma.phoneVerification.findFirst({
    //     where: { phone: normalizedPhone, verified: true },
    //     orderBy: { createdAt: 'desc' },
    //   });
    //   if (!phoneVerification) { res.status(400).json({ success: false, error: '본인인증을 먼저 완료해주세요.' }); return; }
    // }

    // 중복 체크
    const existUsername = await prisma.consumer.findUnique({ where: { username } });
    if (existUsername) { res.status(409).json({ success: false, error: '이미 사용 중인 아이디입니다.' }); return; }

    if (normalizedPhone) {
      const existingPhone = await prisma.consumer.findUnique({ where: { phone: normalizedPhone } });
      if (existingPhone) { res.status(409).json({ success: false, error: '이미 가입된 휴대폰 번호입니다.' }); return; }
    }

    // 동일인 체크 - 이름+생년월일 모두 있을 때만
    if (name && birthDate) {
      const existPerson = await prisma.consumer.findFirst({ where: { name, birthDate } });
      if (existPerson) { res.status(409).json({ success: false, error: '동일한 이름과 생년월일로 이미 가입된 계정이 있습니다.' }); return; }
    }

    const existingEmail = await prisma.consumer.findUnique({ where: { email } });
    if (existingEmail) { res.status(409).json({ success: false, error: '이미 사용 중인 이메일입니다.' }); return; }

    const hashed = await bcrypt.hash(password, 12);
    const consumer = await prisma.consumer.create({
      data: {
        username, email, password: hashed, name: name || '회원', phone: normalizedPhone || null, birthDate: birthDate || null,
        uniqueKey: uniqueKey || null, identityVerified: !!uniqueKey,
      },
    });

    await prisma.phoneVerification.deleteMany({ where: { phone: normalizedPhone } });

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
      data: { accessToken, consumer: { id: consumer.id, email: consumer.email, name: consumer.name, phone: consumer.phone, teaProfile: (consumer as any).teaProfile || null } },
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
      if (consumer.withdrawRequestedAt && consumer.withdrawScheduledAt && new Date() < consumer.withdrawScheduledAt) {
        res.status(403).json({
          success: false,
          error: '탈퇴 신청된 계정입니다.',
          canReactivate: true,
          withdrawScheduledAt: consumer.withdrawScheduledAt,
        });
        return;
      }
      res.status(403).json({ success: false, error: '비활성화된 계정입니다. 고객센터에 문의해주세요.' });
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
      data: { accessToken, consumer: { id: consumer.id, email: consumer.email, name: consumer.name, phone: consumer.phone, teaProfile: (consumer as any).teaProfile || null } },
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
      select: { id: true, email: true, name: true, username: true, phone: true, createdAt: true, teaProfile: true, teaScores: true, passwordChangedAt: true, withdrawRequestedAt: true, withdrawScheduledAt: true },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' }); return; }
    res.json({ success: true, data: { ...consumer, nickname: consumer.username } });
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
        reviews: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    const ordersWithReview = orders.map((o: any) => ({
      ...o, hasReview: o.reviews && o.reviews.length > 0, reviews: undefined,
    }));
    res.json({ success: true, data: ordersWithReview });
  } catch {
    res.status(500).json({ success: false, error: '주문 내역 조회 중 오류가 발생했습니다.' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { nickname } = req.body;

    if (nickname !== undefined) {
      const trimmed = nickname.trim();
      if (trimmed.length > 20) {
        res.status(400).json({ success: false, error: '닉네임은 20자 이하로 입력해주세요.' }); return;
      }
      if (trimmed && /[<>{}()\/\\]/.test(trimmed)) {
        res.status(400).json({ success: false, error: '닉네임에 특수문자를 사용할 수 없습니다.' }); return;
      }
    }

    const consumer = await prisma.consumer.update({
      where: { id: consumerId },
      data: { ...(nickname !== undefined && { username: nickname.trim() || null }) },
      select: { id: true, email: true, name: true, username: true, phone: true },
    });
    res.json({ success: true, data: { ...consumer, nickname: consumer.username } });
  } catch {
    res.status(500).json({ success: false, error: '프로필 수정 중 오류가 발생했습니다.' });
  }
};

// 전화번호 변경 (SMS 인증 후)
export const updatePhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { phone, code } = req.body;
    if (!phone || !code) {
      res.status(400).json({ success: false, error: '전화번호와 인증번호를 입력해주세요.' }); return;
    }
    const normalizedPhone = phone.replace(/\D/g, '');
    const verification = await prisma.phoneVerification.findFirst({
      where: { phone: normalizedPhone, code, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!verification || new Date() > new Date(verification.expiresAt || Date.now())) {
      res.status(400).json({ success: false, error: '인증번호가 올바르지 않거나 만료되었습니다.' }); return;
    }
    // 이미 사용 중인 번호 체크
    const existing = await prisma.consumer.findUnique({ where: { phone: normalizedPhone } });
    if (existing && existing.id !== consumerId) {
      res.status(400).json({ success: false, error: '이미 사용 중인 전화번호입니다.' }); return;
    }
    await prisma.phoneVerification.update({ where: { id: verification.id }, data: { verified: true } });
    const consumer = await prisma.consumer.update({
      where: { id: consumerId },
      data: { phone: normalizedPhone },
      select: { id: true, email: true, name: true, username: true, phone: true },
    });
    res.json({ success: true, data: { ...consumer, nickname: consumer.username } });
  } catch {
    res.status(500).json({ success: false, error: '전화번호 변경 중 오류가 발생했습니다.' });
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

// ── 스토어 찜 ──

// 비밀번호 변경
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }); return; }
    const pwErr = validatePassword(newPassword);
    if (pwErr) { res.status(400).json({ success: false, error: pwErr }); return; }

    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) { res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' }); return; }

    const valid = await bcrypt.compare(currentPassword, consumer.password);
    if (!valid) { res.status(400).json({ success: false, error: '현재 비밀번호가 일치하지 않습니다.' }); return; }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.consumer.update({ where: { id: consumerId }, data: { password: hashed, passwordChangedAt: new Date() } });
    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '비밀번호 변경 실패' }); }
};

// 소비자 탈퇴 신청
export const requestWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { reason, password } = req.body;
    if (!password) { res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' }); return; }

    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) { res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' }); return; }

    const valid = await bcrypt.compare(password, consumer.password);
    if (!valid) { res.status(400).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }

    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.consumer.update({
      where: { id: consumerId },
      data: { withdrawRequestedAt: new Date(), withdrawReason: reason || '사유 없음', withdrawScheduledAt: scheduledAt, isActive: false },
    });
    res.json({ success: true, message: '탈퇴 신청이 완료되었습니다. 30일 후 정보가 삭제됩니다.' });
  } catch { res.status(500).json({ success: false, error: '탈퇴 신청 실패' }); }
};

// 탈퇴 철회
export const cancelWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    await prisma.consumer.update({
      where: { id: consumerId },
      data: { withdrawRequestedAt: null, withdrawReason: null, withdrawScheduledAt: null, isActive: true },
    });
    res.json({ success: true, message: '탈퇴가 철회되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '탈퇴 철회 실패' }); }
};

export const toggleWishlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const existing = await prisma.storeWishlist.findUnique({
      where: { consumerId_storeId: { consumerId, storeId: store.id } },
    });

    if (existing) {
      await prisma.storeWishlist.delete({ where: { id: existing.id } });
      res.json({ success: true, wishlisted: false, message: '찜이 해제되었습니다.' });
    } else {
      await prisma.storeWishlist.create({ data: { consumerId, storeId: store.id } });
      res.json({ success: true, wishlisted: true, message: '찜 되었습니다.' });
    }
  } catch {
    res.status(500).json({ success: false, error: '찜 처리 중 오류가 발생했습니다.' });
  }
};

export const getMyWishlists = async (req: Request, res: Response): Promise<void> => {
  try {
    const consumerId = (req as any).consumerId;
    const wishlists = await prisma.storeWishlist.findMany({
      where: { consumerId },
      include: {
        store: {
          select: {
            id: true, name: true, slug: true, description: true,
            logoUrl: true, bannerUrl: true, themeColor: true,
            _count: { select: { products: true, wishlists: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: wishlists });
  } catch {
    res.status(500).json({ success: false, error: '찜 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 찜한 소비자에게 SMS 알림 (상품 할인/신규 등록 시 판매자가 호출)
export const notifyWishlistConsumers = async (
  storeId: string, message: string,
  opts?: { type?: string; title?: string; link?: string; imageUrl?: string; productId?: string }
): Promise<number> => {
  try {
    const wishlists = await prisma.storeWishlist.findMany({
      where: { storeId }, select: { consumerId: true },
    });
    if (wishlists.length > 0) {
      await prisma.consumerNotification.createMany({
        data: wishlists.map((w: any) => ({
          consumerId: w.consumerId,
          type: opts?.type || 'store_new_product',
          title: opts?.title || '스토어 소식',
          message,
          link: opts?.link,
          imageUrl: opts?.imageUrl,
        })),
      });
    }
    return wishlists.length;
  } catch {
    return 0;
  }
};

export const notifyProductWishlistConsumers = async (
  productId: string, opts: { type: string; title: string; message: string; link?: string; imageUrl?: string }
): Promise<number> => {
  try {
    const wishlists = await prisma.productWishlist.findMany({
      where: { productId }, select: { consumerId: true },
    });
    if (wishlists.length > 0) {
      await prisma.consumerNotification.createMany({
        data: wishlists.map((w: any) => ({
          consumerId: w.consumerId,
          type: opts.type,
          title: opts.title,
          message: opts.message,
          link: opts.link,
          imageUrl: opts.imageUrl,
        })),
      });
    }
    return wishlists.length;
  } catch {
    return 0;
  }
};