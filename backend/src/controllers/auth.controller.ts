import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import prisma from '../config/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { verifyBusinessNumber } from '../utils/businessVerification';
import { AuthRequest } from '../types';

// 이메일 회원가입
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, phone } = req.body;

    const existing = await prisma.seller.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ success: false, error: '이미 가입된 이메일입니다.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const seller = await prisma.seller.create({
      data: { email, password: hashedPassword, name, phone },
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

    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: {
        accessToken,
        refreshToken,
        seller: { id: seller.id, email: seller.email, name: seller.name, businessVerified: false },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
  }
};

// 이메일 로그인
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

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
        businessOwner: true, businessAddress: true, businessVerified: true,
        businessVerifiedAt: true, createdAt: true,
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
    const { businessNumber, businessName, businessOwner, businessAddress, businessType, businessCategory, name, phone } = req.body;
    const updated = await prisma.seller.update({
      where: { id: req.seller!.id },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
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
        businessOwner: true, businessAddress: true, businessVerified: true,
        createdAt: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true, isOpen: true } },
      },
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '프로필 업데이트 실패' });
  }
};

// 로그아웃
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
