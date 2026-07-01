import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { verifyBusinessNumber } from '../utils/businessVerification';
import { AuthRequest } from '../types';
import { sanitizeString, sanitizeEmail, sanitizePhone, validatePassword } from '../utils/sanitize';
import { generateCode, sendSMS } from '../utils/sms';

// 휴대폰 인증번호 발송
export const sendPhoneCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = sanitizePhone(req.body.phone);
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      res.status(400).json({ success: false, error: '올바른 휴대폰 번호를 입력해주세요.' });
      return;
    }

    const normalized = phone.replace(/\D/g, '');

    const existingSeller = await prisma.seller.findUnique({ where: { phone: normalized } });
    if (existingSeller) {
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
export const verifyPhoneCode = async (req: Request, res: Response): Promise<void> => {
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

    if (!record) {
      res.status(400).json({ success: false, error: '인증 요청을 먼저 해주세요.' });
      return;
    }

    if (record.attempts >= 5) {
      res.status(429).json({ success: false, error: '시도 횟수 초과. 인증번호를 재발송해주세요.' });
      return;
    }

    if (record.expiresAt < new Date()) {
      res.status(400).json({ success: false, error: '인증번호가 만료되었습니다. 재발송해주세요.' });
      return;
    }

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

// 이메일 회원가입
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    const name = sanitizeString(req.body.name).slice(0, 50);
    const phone = sanitizePhone(req.body.phone);
    const password = req.body.password;
    const { businessNumber, businessName, businessOwner, businessAddress, businessType, businessCategory, birthDate, bankName, bankAccountNo, bankAccountHolder } = req.body;

    if (!email) { res.status(400).json({ success: false, error: '올바른 이메일을 입력해주세요.' }); return; }
    if (!name || name.length < 2) { res.status(400).json({ success: false, error: '이름은 2자 이상 입력해주세요.' }); return; }
    if (!phone) { res.status(400).json({ success: false, error: '휴대폰 번호를 입력해주세요.' }); return; }

    // 만 15세 이상 확인
    if (birthDate) {
      const bd = birthDate.replace(/\D/g, '');
      if (bd.length === 8) {
        const birthYear = parseInt(bd.slice(0, 4));
        const age = new Date().getFullYear() - birthYear;
        if (age < 15) { res.status(400).json({ success: false, error: '만 15세 이상만 판매자로 가입할 수 있습니다.' }); return; }
      }
    }

    // 사업자 정보 검증 (입력된 경우에만)
    if (businessName && /[<>{}()\/\\]/.test(businessName)) {
      res.status(400).json({ success: false, error: '상호명에 특수문자를 사용할 수 없습니다.' }); return;
    }
    if (bankAccountHolder && businessName && bankAccountHolder !== businessName && bankAccountHolder !== businessOwner) {
      res.status(400).json({ success: false, error: '예금주가 사업자 상호 또는 대표자명과 일치하지 않습니다.' }); return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) { res.status(400).json({ success: false, error: pwErr }); return; }

    const normalizedPhone = phone.replace(/\D/g, '');

    // TODO: SMS 서비스 활성화 시 주석 해제
    // const phoneVerification = await prisma.phoneVerification.findFirst({
    //   where: { phone: normalizedPhone, verified: true },
    //   orderBy: { createdAt: 'desc' },
    // });
    // if (!phoneVerification) {
    //   res.status(400).json({ success: false, error: '휴대폰 인증을 먼저 완료해주세요.' });
    //   return;
    // }

    if (normalizedPhone) {
      const existingPhone = await prisma.seller.findUnique({ where: { phone: normalizedPhone } });
      if (existingPhone) {
        res.status(409).json({ success: false, error: '이미 가입된 휴대폰 번호입니다.' });
        return;
      }
    }

    const existing = await prisma.seller.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: '이미 가입된 이메일입니다.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const seller = await prisma.seller.create({
      data: {
        email, password: hashedPassword, name, phone: normalizedPhone,
        businessNumber: businessNumber?.replace(/-/g, '') || null, businessName: businessName || null,
        businessOwner: businessOwner || null, businessAddress: businessAddress || null,
        businessType: businessType || null, businessCategory: businessCategory || null,
        birthDate: birthDate || null,
        bankName: bankName || null, bankAccountNo: bankAccountNo || null, bankAccountHolder: bankAccountHolder || null,
      },
    });

    await prisma.phoneVerification.deleteMany({ where: { phone: normalizedPhone } });

    const payload = {
      sellerId: seller.id,
      email: seller.email,
      name: seller.name,
      businessVerified: seller.businessVerified,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sellerId: seller.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        accessToken,
        refreshToken,
        seller: { id: seller.id, email: seller.email, name: seller.name, businessVerified: false },
      },
    });

    // 관리자 알림 (비동기)
    import('../utils/admin-notify').then(({ notifyAdminNewSeller }) => {
      notifyAdminNewSeller(seller.name, seller.email).catch(() => {});
    }).catch(() => {});
  } catch (error) {
    res.status(500).json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
  }
};

// 이메일 로그인
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string') {
      res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }

    const seller = await prisma.seller.findUnique({
      where: { email },
      include: { store: { select: { id: true, name: true, slug: true, logoUrl: true, isOpen: true } } },
    });
    if (!seller || !seller.password) {
      res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const isValid = await bcrypt.compare(password, seller.password);
    if (!isValid) {
      res.status(401).json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    if (!seller.isActive) {
      res.status(403).json({ success: false, error: '비활성화된 계정입니다. 고객센터에 문의하세요.' });
      return;
    }

    if (seller.status === 'PENDING') {
      res.status(403).json({ success: false, error: '가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있습니다.' });
      return;
    }
    if (seller.status === 'REJECTED') {
      res.status(403).json({ success: false, error: `가입이 거절되었습니다. 사유: ${seller.rejectionReason || '관리자에게 문의하세요.'}` });
      return;
    }

    await prisma.seller.update({
      where: { id: seller.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = {
      sellerId: seller.id,
      email: seller.email,
      name: seller.name,
      businessVerified: seller.businessVerified,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        sellerId: seller.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          businessVerified: seller.businessVerified,
          store: seller.store ?? null,
        },
      },
    });
  } catch {
    res.status(500).json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
  }
};

// 카카오 OAuth
export const kakaoLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    // 카카오 액세스 토큰 발급
    const tokenRes = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID!,
        redirect_uri: process.env.KAKAO_REDIRECT_URI!,
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // 카카오 사용자 정보 조회
    const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const kakaoUser = userRes.data;
    const providerId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email;
    const name = kakaoUser.kakao_account?.profile?.nickname || '카카오 사용자';

    await handleOAuthLogin(res, 'kakao', providerId, email, name);
  } catch {
    res.status(500).json({ success: false, error: '카카오 로그인 중 오류가 발생했습니다.' });
  }
};

// 구글 OAuth
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const googleUser = userRes.data;
    await handleOAuthLogin(res, 'google', googleUser.id, googleUser.email, googleUser.name);
  } catch {
    res.status(500).json({ success: false, error: '구글 로그인 중 오류가 발생했습니다.' });
  }
};

// 네이버 OAuth
export const naverLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state } = req.body;

    const tokenRes = await axios.get('https://nid.naver.com/oauth2.0/token', {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.NAVER_CLIENT_ID,
        client_secret: process.env.NAVER_CLIENT_SECRET,
        code,
        state,
      },
    });

    const userRes = await axios.get('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
    });

    const naverUser = userRes.data.response;
    await handleOAuthLogin(res, 'naver', naverUser.id, naverUser.email, naverUser.name);
  } catch {
    res.status(500).json({ success: false, error: '네이버 로그인 중 오류가 발생했습니다.' });
  }
};

// OAuth 공통 처리 로직
async function handleOAuthLogin(
  res: Response,
  provider: string,
  providerId: string,
  email: string,
  name: string
): Promise<void> {
  let seller = await prisma.seller.findFirst({
    where: { oauthAccounts: { some: { provider, providerId } } },
  });

  if (!seller && email) {
    seller = await prisma.seller.findUnique({ where: { email } });
  }

  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        email: email || `${provider}_${providerId}@tea-mall.com`,
        name,
        oauthAccounts: { create: { provider, providerId } },
      },
    });
  } else {
    const hasOauth = await prisma.oAuthAccount.findUnique({
      where: { provider_providerId: { provider, providerId } },
    });
    if (!hasOauth) {
      await prisma.oAuthAccount.create({
        data: { provider, providerId, sellerId: seller.id },
      });
    }
  }

  await prisma.seller.update({
    where: { id: seller.id },
    data: { lastLoginAt: new Date() },
  });

  const payload = {
    sellerId: seller.id,
    email: seller.email,
    name: seller.name,
    businessVerified: seller.businessVerified,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      sellerId: seller.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      seller: {
        id: seller.id,
        email: seller.email,
        name: seller.name,
        businessVerified: seller.businessVerified,
      },
    },
  });
}

// 사업자 등록번호 인증
export const verifyBusiness = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { businessNumber, businessName, businessOwner, startDate, businessAddress, businessType, businessCategory } = req.body;
    const sellerId = req.seller!.id;

    const existing = await prisma.seller.findFirst({
      where: { businessNumber: businessNumber.replace(/-/g, ''), id: { not: sellerId } },
    });
    if (existing) {
      res.status(409).json({ success: false, error: '이미 등록된 사업자 등록번호입니다.' });
      return;
    }

    const verifyResult = await verifyBusinessNumber(businessNumber, startDate, businessOwner, businessName);

    const seller = await prisma.seller.update({
      where: { id: sellerId },
      data: {
        businessNumber: businessNumber.replace(/-/g, ''),
        businessName,
        businessOwner,
        businessAddress,
        businessType,
        businessCategory,
        businessVerified: verifyResult.valid,
        businessVerifiedAt: verifyResult.valid ? new Date() : null,
      },
    });

    if (!verifyResult.valid) {
      res.status(400).json({
        success: false,
        error: verifyResult.message || '사업자 인증에 실패했습니다.',
      });
      return;
    }

    res.json({
      success: true,
      message: '사업자 인증이 완료되었습니다.',
      data: { businessVerified: seller.businessVerified },
    });
  } catch {
    res.status(500).json({ success: false, error: '사업자 인증 중 오류가 발생했습니다.' });
  }
};

// 토큰 갱신
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(401).json({ success: false, error: '리프레시 토큰이 필요합니다.' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const stored = await prisma.refreshToken.findUnique({ where: { token } });

    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: '만료된 토큰입니다. 다시 로그인해주세요.' });
      return;
    }

    const seller = await prisma.seller.findUnique({ where: { id: payload.sellerId } });
    if (!seller) {
      res.status(401).json({ success: false, error: '유효하지 않은 사용자입니다.' });
      return;
    }

    const newPayload = {
      sellerId: seller.id,
      email: seller.email,
      name: seller.name,
      businessVerified: seller.businessVerified,
    };

    const newAccessToken = generateAccessToken(newPayload);
    res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch {
    res.status(401).json({ success: false, error: '토큰 갱신에 실패했습니다.' });
  }
};

// 내 정보 조회
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.seller!.id },
      select: {
        id: true, email: true, name: true, phone: true,
        profileImageUrl: true, businessNumber: true, businessName: true,
        businessOwner: true, businessAddress: true, businessType: true, businessCategory: true,
        businessVerified: true, businessVerifiedAt: true, status: true,
        withdrawRequestedAt: true, withdrawReason: true, createdAt: true,
        notifyOrder: true, notifyReview: true, notifySettlement: true,
        notifyStock: true, notifySystem: true, notifyKakao: true, kakaoConnected: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true, isOpen: true } },
      },
    });

    res.json({ success: true, data: seller });
  } catch {
    res.status(500).json({ success: false, error: '정보 조회 중 오류가 발생했습니다.' });
  }
};

// 프로필(사업자 정보) 업데이트
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { businessNumber, businessName, businessOwner, businessAddress, businessType, businessCategory, phone } = req.body;
    const updated = await prisma.seller.update({
      where: { id: req.seller!.id },
      data: {
        ...(phone !== undefined && { phone: phone || null }),
        ...(businessNumber && { businessNumber }),
        ...(businessName && { businessName }),
        ...(businessOwner && { businessOwner }),
        ...(businessAddress && { businessAddress }),
        ...(businessType && { businessType }),
        ...(businessCategory && { businessCategory }),
      },
      select: {
        id: true, email: true, name: true, phone: true,
        profileImageUrl: true, businessNumber: true, businessName: true,
        businessOwner: true, businessAddress: true, businessType: true, businessCategory: true,
        businessVerified: true, createdAt: true,
        notifyOrder: true, notifyReview: true, notifySettlement: true,
        notifyStock: true, notifySystem: true, notifyKakao: true, kakaoConnected: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true, isOpen: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '프로필 업데이트 실패' });
  }
};

// 알림 설정 업데이트
export const updateNotificationSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { notifyOrder, notifyReview, notifySettlement, notifyStock, notifySystem, notifyKakao } = req.body;
    const updated = await prisma.seller.update({
      where: { id: req.seller!.id },
      data: {
        ...(notifyOrder !== undefined && { notifyOrder }),
        ...(notifyReview !== undefined && { notifyReview }),
        ...(notifySettlement !== undefined && { notifySettlement }),
        ...(notifyStock !== undefined && { notifyStock }),
        ...(notifySystem !== undefined && { notifySystem }),
        ...(notifyKakao !== undefined && { notifyKakao }),
      },
      select: {
        notifyOrder: true, notifyReview: true, notifySettlement: true,
        notifyStock: true, notifySystem: true, notifyKakao: true, kakaoConnected: true,
      },
    });
    res.json({ success: true, data: updated, message: '알림 설정이 저장되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '알림 설정 저장 실패' });
  }
};

// 현재 비밀번호 확인
export const verifyCurrentPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    if (!password) { res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' }); return; }
    const seller = await prisma.seller.findUnique({ where: { id: req.seller!.id } });
    if (!seller?.password) { res.status(400).json({ success: false, error: '비밀번호를 확인할 수 없습니다.' }); return; }
    const valid = await bcrypt.compare(password, seller.password);
    if (!valid) { res.status(400).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }
    res.json({ success: true, message: '비밀번호가 확인되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '비밀번호 확인 실패' }); }
};

// 판매자 비밀번호 변경
export const changeSellerPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.seller!.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({ success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }); return; }
    if (currentPassword === newPassword) { res.status(400).json({ success: false, error: '현재 비밀번호와 새 비밀번호가 동일합니다. 다른 비밀번호를 입력해주세요.' }); return; }
    const pwErr = validatePassword(newPassword);
    if (pwErr) { res.status(400).json({ success: false, error: pwErr }); return; }
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller?.password) { res.status(400).json({ success: false, error: '비밀번호를 확인할 수 없습니다.' }); return; }
    const valid = await bcrypt.compare(currentPassword, seller.password);
    if (!valid) { res.status(400).json({ success: false, error: '현재 비밀번호가 일치하지 않습니다.' }); return; }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.seller.update({ where: { id: sellerId }, data: { password: hashed, passwordChangedAt: new Date() } });
    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '비밀번호 변경 실패' }); }
};

// 판매자 탈퇴 신청
export const requestSellerWithdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.seller!.id;
    const { reason, password } = req.body;
    if (!password) { res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' }); return; }
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    if (!seller?.password) { res.status(400).json({ success: false, error: '확인 실패' }); return; }
    const valid = await bcrypt.compare(password, seller.password);
    if (!valid) { res.status(400).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }
    await prisma.seller.update({
      where: { id: sellerId },
      data: { withdrawRequestedAt: new Date(), withdrawReason: reason || '사유 없음', status: 'WITHDRAW_REQUESTED' },
    });
    res.json({ success: true, message: '폐업 신청이 완료되었습니다. 관리자 확인 후 처리됩니다.' });
    // 폐업 신청은 관리자 알림 제외
  } catch { res.status(500).json({ success: false, error: '탈퇴 신청 실패' }); }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    res.json({ success: true, message: '로그아웃 되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '로그아웃 중 오류가 발생했습니다.' });
  }
};
