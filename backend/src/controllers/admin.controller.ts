import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { sanitizeEmail, sanitizeString } from '../utils/sanitize';
import { maskPhone, maskEmail, maskName } from '../utils/crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

function toKSTDate(input: string): Date {
  if (input.includes('T') && !input.includes('+') && !input.includes('Z')) {
    return new Date(input + '+09:00');
  }
  return new Date(input);
}

// 관리자 로그인
export const getAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).admin?.adminId || (req as any).adminId;
    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { id: true, email: true, name: true, phone: true } });
    res.json({ success: true, data: admin });
  } catch { res.status(500).json({ success: false, error: '조회 실패' }); }
};

export const updateAdminPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).admin?.adminId || (req as any).adminId;
    const { phone } = req.body;
    await prisma.admin.update({ where: { id: adminId }, data: { phone: phone || null } });
    res.json({ success: true, message: '전화번호가 저장되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '저장 실패' }); }
};

export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string') {
      res.status(400).json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      res.status(401).json({ success: false, error: '관리자 계정을 찾을 수 없습니다.' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      res.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    const token = jwt.sign({ adminId: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      data: { token, admin: { id: admin.id, email: admin.email, name: admin.name } },
    });
  } catch {
    res.status(500).json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
  }
};

// 관리자 대시보드 통계
export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalSellers, pendingSellers, approvedSellers, rejectedSellers, totalOrders, totalProducts] = await Promise.all([
      prisma.seller.count(),
      prisma.seller.count({ where: { status: 'PENDING' } }),
      prisma.seller.count({ where: { status: 'APPROVED' } }),
      prisma.seller.count({ where: { status: 'REJECTED' } }),
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    res.json({
      success: true,
      data: { totalSellers, pendingSellers, approvedSellers, rejectedSellers, totalOrders, totalProducts },
    });
  } catch {
    res.status(500).json({ success: false, error: '통계 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 목록 (필터링)
export const getSellers = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const where: any = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sellers, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        select: {
          id: true, email: true, name: true, phone: true,
          businessName: true, businessNumber: true, businessOwner: true,
          businessAddress: true, businessType: true, businessCategory: true,
          businessVerified: true, businessVerifiedAt: true,
          businessLicenseUrl: true, salesPermitUrl: true, bankCopyUrl: true,
          bankName: true, bankAccountNo: true, bankAccountHolder: true, birthDate: true,
          status: true, rejectionReason: true, approvedAt: true,
          isActive: true, createdAt: true, lastLoginAt: true,
          store: {
            select: {
              id: true, name: true, slug: true, description: true,
              logoUrl: true, isOpen: true, isPublished: true, themeColor: true,
              _count: { select: { products: true, orders: true } },
              customPlatformFee: true, customPaymentFee: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.seller.count({ where }),
    ]);

    res.json({ success: true, data: sellers, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '판매자 목록 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 승인
export const approveSeller = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) { res.status(404).json({ success: false, error: '판매자를 찾을 수 없습니다.' }); return; }

    const updated = await prisma.seller.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        rejectionReason: null,
        businessVerified: !!seller.businessNumber,
        businessVerifiedAt: seller.businessNumber ? new Date() : undefined,
      },
    });

    res.json({ success: true, message: `${updated.name}님이 승인되었습니다.`, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '승인 처리 중 오류가 발생했습니다.' });
  }
};

// 판매자 거절
export const rejectSeller = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) { res.status(404).json({ success: false, error: '판매자를 찾을 수 없습니다.' }); return; }

    const updated = await prisma.seller.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason || '관리자에 의해 거절되었습니다.' },
    });

    res.json({ success: true, message: `${updated.name}님이 거절되었습니다.`, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '거절 처리 중 오류가 발생했습니다.' });
  }
};

// 판매자 승인 취소 (APPROVED -> PENDING)
export const suspendSeller = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) { res.status(404).json({ success: false, error: '판매자를 찾을 수 없습니다.' }); return; }

    const updated = await prisma.seller.update({
      where: { id },
      data: { status: 'REJECTED', approvedAt: null, rejectionReason: reason || '관리자에 의해 승인이 취소되었습니다.', businessVerified: false, businessVerifiedAt: null },
    });

    res.json({ success: true, message: `${updated.name}님의 승인이 취소되었습니다.`, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '승인 취소 처리 중 오류가 발생했습니다.' });
  }
};

// ── 메인 배너 CRUD ──

export const getMainBanners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const banners = await prisma.mainBanner.findMany({ orderBy: { order: 'asc' } });
    res.json({ success: true, data: banners });
  } catch {
    res.status(500).json({ success: false, error: '배너 조회 중 오류가 발생했습니다.' });
  }
};

export const createMainBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as any;
    if (!file) { res.status(400).json({ success: false, error: '이미지를 업로드해주세요.' }); return; }
    const imageUrl = file.location || `/uploads/${file.filename}`;
    const { linkUrl, title, height } = req.body;
    const count = await prisma.mainBanner.count();
    const banner = await prisma.mainBanner.create({ data: { imageUrl, linkUrl: linkUrl || null, title: title || null, height: height ? parseInt(height) : 300, order: count } });
    res.json({ success: true, data: banner });
  } catch {
    res.status(500).json({ success: false, error: '배너 생성 중 오류가 발생했습니다.' });
  }
};

export const updateMainBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file as any;
    const data: any = {};
    if (file) data.imageUrl = file.location || `/uploads/${file.filename}`;
    if (req.body.linkUrl !== undefined) data.linkUrl = req.body.linkUrl || null;
    if (req.body.title !== undefined) data.title = req.body.title || null;
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive === 'true';
    if (req.body.height) data.height = parseInt(req.body.height);
    const banner = await prisma.mainBanner.update({ where: { id }, data });
    res.json({ success: true, data: banner });
  } catch {
    res.status(500).json({ success: false, error: '배너 수정 중 오류가 발생했습니다.' });
  }
};

export const deleteMainBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.mainBanner.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: '배너가 삭제되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '배너 삭제 중 오류가 발생했습니다.' });
  }
};

export const reorderMainBanners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) { res.status(400).json({ success: false, error: 'ids 배열이 필요합니다.' }); return; }
    await Promise.all(ids.map((id: string, i: number) => prisma.mainBanner.update({ where: { id }, data: { order: i } })));
    res.json({ success: true, message: '순서가 변경되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '순서 변경 중 오류가 발생했습니다.' });
  }
};

// ── 메인 팝업 CRUD ──

export const getMainPopups = async (_req: Request, res: Response): Promise<void> => {
  try {
    const popups = await prisma.mainPopup.findMany({ orderBy: { order: 'asc' } });
    res.json({ success: true, data: popups });
  } catch {
    res.status(500).json({ success: false, error: '팝업 조회 중 오류가 발생했습니다.' });
  }
};

export const createMainPopup = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file as any;
    const imageUrl = file ? (file.location || `/uploads/${file.filename}`) : null;
    const { linkUrl, hasLink, width, height, startAt, endAt, closeType } = req.body;
    if (!startAt || !endAt) { res.status(400).json({ success: false, error: '시작일과 종료일을 입력해주세요.' }); return; }
    const count = await prisma.mainPopup.count();
    const popup = await prisma.mainPopup.create({
      data: {
        imageUrl, linkUrl: linkUrl || null, hasLink: hasLink === 'true',
        width: parseInt(width) || 400, height: parseInt(height) || 500,
        startAt: toKSTDate(startAt), endAt: toKSTDate(endAt),
        closeType: closeType || 'close_only', order: count,
      },
    });
    res.json({ success: true, data: popup });
  } catch {
    res.status(500).json({ success: false, error: '팝업 생성 중 오류가 발생했습니다.' });
  }
};

export const updateMainPopup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file as any;
    const data: any = {};
    if (file) data.imageUrl = file.location || `/uploads/${file.filename}`;
    if (req.body.linkUrl !== undefined) data.linkUrl = req.body.linkUrl || null;
    if (req.body.hasLink !== undefined) data.hasLink = req.body.hasLink === 'true';
    if (req.body.width) data.width = parseInt(req.body.width);
    if (req.body.height) data.height = parseInt(req.body.height);
    if (req.body.startAt) data.startAt = toKSTDate(req.body.startAt);
    if (req.body.endAt) data.endAt = toKSTDate(req.body.endAt);
    if (req.body.isActive !== undefined) data.isActive = req.body.isActive === 'true';
    if (req.body.closeType) data.closeType = req.body.closeType;
    const popup = await prisma.mainPopup.update({ where: { id }, data });
    res.json({ success: true, data: popup });
  } catch {
    res.status(500).json({ success: false, error: '팝업 수정 중 오류가 발생했습니다.' });
  }
};

export const deleteMainPopup = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.mainPopup.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: '팝업이 삭제되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '팝업 삭제 중 오류가 발생했습니다.' });
  }
};

// ── 포인트 설정 ──

export const getPointSetting = async (_req: Request, res: Response): Promise<void> => {
  try {
    let setting = await prisma.pointSetting.findFirst();
    if (!setting) setting = await prisma.pointSetting.create({ data: {} });
    res.json({ success: true, data: setting });
  } catch { res.status(500).json({ success: false, error: '설정 조회 실패' }); }
};

export const updatePointSetting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { minOrderAmount, earnRate, maxEarnAmount, minUseAmount, platformFeeRate, paymentFeeRate, settlementNotice,
      reviewPointType, reviewPointFixed, reviewPhotoBonus, reviewPointRate } = req.body;
    let setting = await prisma.pointSetting.findFirst();
    if (!setting) setting = await prisma.pointSetting.create({ data: {} });
    const updated = await prisma.pointSetting.update({
      where: { id: setting.id },
      data: {
        ...(minOrderAmount !== undefined && { minOrderAmount: parseInt(minOrderAmount) }),
        ...(earnRate !== undefined && { earnRate: parseFloat(earnRate) }),
        ...(maxEarnAmount !== undefined && { maxEarnAmount: parseInt(maxEarnAmount) }),
        ...(minUseAmount !== undefined && { minUseAmount: parseInt(minUseAmount) }),
        ...(platformFeeRate !== undefined && { platformFeeRate: parseFloat(platformFeeRate) }),
        ...(paymentFeeRate !== undefined && { paymentFeeRate: parseFloat(paymentFeeRate) }),
        ...(settlementNotice !== undefined && { settlementNotice }),
        ...(reviewPointType !== undefined && { reviewPointType }),
        ...(reviewPointFixed !== undefined && { reviewPointFixed: parseInt(reviewPointFixed) }),
        ...(reviewPhotoBonus !== undefined && { reviewPhotoBonus: parseInt(reviewPhotoBonus) }),
        ...(reviewPointRate !== undefined && { reviewPointRate: parseFloat(reviewPointRate) }),
      },
    });
    // 수수료 변경 시 미정산 데이터 재계산
    if (platformFeeRate !== undefined || paymentFeeRate !== undefined) {
      const platRate = updated.platformFeeRate / 100;
      const payRate = updated.paymentFeeRate / 100;
      const pending = await prisma.settlement.findMany({ where: { status: 'PENDING' } });
      for (const s of pending) {
        const store = await prisma.store.findUnique({ where: { id: s.storeId }, select: { customPlatformFee: true, customPaymentFee: true } });
        const pr = (store?.customPlatformFee != null ? store.customPlatformFee / 100 : platRate);
        const payr = (store?.customPaymentFee != null ? store.customPaymentFee / 100 : payRate);
        const pFee = Math.round(s.totalSales * pr);
        const payFee = Math.round(s.totalSales * payr);
        await prisma.settlement.update({ where: { id: s.id }, data: { platformFee: pFee, paymentFee: payFee, netAmount: s.totalSales - pFee - payFee } });
      }
    }

    res.json({ success: true, data: updated });
  } catch { res.status(500).json({ success: false, error: '설정 저장 실패' }); }
};

// ── 공지사항 CRUD ──

export const getNotices = async (req: Request, res: Response): Promise<void> => {
  try {
    const onlyActive = !req.headers.authorization;
    const where = onlyActive ? { isActive: true } : {};
    const notices = await prisma.notice.findMany({ where, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
    res.json({ success: true, data: notices });
  } catch { res.status(500).json({ success: false, error: '공지사항 조회 실패' }); }
};

export const createNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, isPinned } = req.body;
    if (!title || !content) { res.status(400).json({ success: false, error: '제목과 내용을 입력해주세요.' }); return; }
    const notice = await prisma.notice.create({ data: { title: sanitizeString(title), content: sanitizeString(content), isPinned: isPinned === true } });
    res.json({ success: true, data: notice });
  } catch { res.status(500).json({ success: false, error: '공지사항 생성 실패' }); }
};

export const updateNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, isPinned, isActive } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = sanitizeString(title);
    if (content !== undefined) data.content = sanitizeString(content);
    if (isPinned !== undefined) data.isPinned = isPinned;
    if (isActive !== undefined) data.isActive = isActive;
    const notice = await prisma.notice.update({ where: { id: req.params.id }, data });
    res.json({ success: true, data: notice });
  } catch { res.status(500).json({ success: false, error: '공지사항 수정 실패' }); }
};

export const deleteNotice = async (req: Request, res: Response): Promise<void> => {
  try {
    await prisma.notice.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '공지사항 삭제 실패' }); }
};

// ── 스토어 게시 승인/거절 ──

export const publishStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    const store = await prisma.store.update({ where: { id }, data: { isPublished: publish !== false } });
    res.json({ success: true, message: publish !== false ? '스토어가 게시되었습니다.' : '스토어 게시가 해제되었습니다.', data: store });
  } catch { res.status(500).json({ success: false, error: '처리 실패' }); }
};

// ── 소비자 관리 ──

export const getConsumers = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const where: any = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search.replace(/-/g, ''), mode: 'insensitive' } },
    ];
    const [consumers, total] = await Promise.all([
      prisma.consumer.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, username: true, email: true, name: true, phone: true, isActive: true, createdAt: true, lastLoginAt: true, teaProfile: true, withdrawRequestedAt: true },
      }),
      prisma.consumer.count({ where }),
    ]);
    const masked = (req.query.unmask !== 'true') ? consumers.map((c: any) => ({
      ...c, phone: maskPhone(c.phone || ''), email: maskEmail(c.email), name: maskName(c.name),
    })) : consumers;
    res.json({ success: true, data: masked, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch { res.status(500).json({ success: false, error: '소비자 조회 실패' }); }
};

export const getConsumerDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const consumer = await prisma.consumer.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, name: true, phone: true,
        isActive: true, createdAt: true, lastLoginAt: true, teaProfile: true,
        emailVerified: true, identityVerified: true,
        withdrawRequestedAt: true, withdrawReason: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, orderNumber: true, status: true, finalAmount: true,
            createdAt: true, buyerName: true, trackingNumber: true, courier: true,
            store: { select: { name: true } },
            items: { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, rating: true, content: true, createdAt: true, product: { select: { name: true } } },
        },
        addresses: {
          select: { id: true, label: true, recipientName: true, recipientPhone: true, zipCode: true, address: true, addressDetail: true, isDefault: true },
        },
        points: {
          orderBy: { createdAt: 'desc' }, take: 20,
          select: { id: true, type: true, amount: true, reason: true, createdAt: true },
        },
      },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '소비자를 찾을 수 없습니다.' }); return; }

    const masked = {
      ...consumer,
      phone: maskPhone(consumer.phone || ''),
      email: maskEmail(consumer.email),
      name: maskName(consumer.name),
      addresses: consumer.addresses.map((a: any) => ({ ...a, recipientName: maskName(a.recipientName), recipientPhone: maskPhone(a.recipientPhone || ''), address: '***', addressDetail: '***' })),
    };
    res.json({ success: true, data: masked });
  } catch { res.status(500).json({ success: false, error: '소비자 상세 조회 실패' }); }
};

export const unmaskConsumer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) { res.status(400).json({ success: false, error: '비밀번호를 입력해주세요.' }); return; }

    const adminId = (req as any).admin?.adminId || (req as any).adminId;
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) { res.status(401).json({ success: false, error: '관리자 정보를 찾을 수 없습니다.' }); return; }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) { res.status(401).json({ success: false, error: '비밀번호가 일치하지 않습니다.' }); return; }

    const consumer = await prisma.consumer.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, birthDate: true,
        addresses: { select: { id: true, label: true, recipientName: true, recipientPhone: true, zipCode: true, address: true, addressDetail: true, isDefault: true } },
      },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '소비자를 찾을 수 없습니다.' }); return; }

    res.json({ success: true, data: consumer });
  } catch { res.status(500).json({ success: false, error: '개인정보 조회 실패' }); }
};

// ── 폐업 신청 승인/거절 ──
export const approveWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const seller = await prisma.seller.findUnique({ where: { id }, include: { store: true } });
    if (!seller) { res.status(404).json({ success: false, error: '판매자를 찾을 수 없습니다.' }); return; }

    await prisma.seller.update({
      where: { id },
      data: { status: 'CLOSED', isActive: false, withdrawScheduledAt: new Date() },
    });

    if (seller.store) {
      await prisma.store.update({
        where: { id: seller.store.id },
        data: { isOpen: false, isPublished: false, closedMessage: '폐업된 스토어입니다.' },
      });
    }

    res.json({ success: true, message: '폐업 처리가 완료되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '폐업 처리 실패' }); }
};

export const rejectWithdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.seller.update({
      where: { id },
      data: { status: 'APPROVED', withdrawRequestedAt: null, withdrawReason: null, withdrawScheduledAt: null },
    });
    res.json({ success: true, message: '폐업 신청이 반려되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '반려 처리 실패' }); }
};

// ── 관리자 주문 상태 변경 ──
export const adminUpdateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'PURCHASE_CONFIRMED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) { res.status(400).json({ success: false, error: '유효하지 않은 상태입니다.' }); return; }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) { res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' }); return; }

    const data: any = { status };
    if (status === 'CANCELLED') { data.cancelledAt = new Date(); data.cancelReason = '관리자 취소 처리'; }
    if (status === 'REFUNDED') { data.refundedAt = new Date(); data.refundAmount = order.finalAmount; data.cancelReason = '관리자 환불 처리'; }
    if (status === 'SHIPPING') data.shippedAt = new Date();
    if (status === 'DELIVERED') data.deliveredAt = new Date();

    await prisma.order.update({ where: { id: orderId }, data });
    res.json({ success: true, message: `주문 상태가 ${status}로 변경되었습니다.` });
  } catch { res.status(500).json({ success: false, error: '주문 상태 변경 실패' }); }
};

// ── 관리자 리뷰 삭제 ──
export const adminDeleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reviewId } = req.params;
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) { res.status(404).json({ success: false, error: '리뷰를 찾을 수 없습니다.' }); return; }
    await prisma.review.update({ where: { id: reviewId }, data: { isVisible: false } });
    res.json({ success: true, message: '리뷰가 삭제(숨김) 처리되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '리뷰 삭제 실패' }); }
};

// ── 신고 관리 ──

export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const where: any = {};
    if (status && ['PENDING', 'RESOLVED', 'REJECTED'].includes(status)) where.status = status;

    const reports = await prisma.report.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });

    const productIds = reports.filter((r: any) => r.type === 'PRODUCT').map((r: any) => r.targetId);
    const consumerIds = reports.filter((r: any) => r.consumerId).map((r: any) => r.consumerId);

    const [products, consumers] = await Promise.all([
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, thumbnail: true, isActive: true, store: { select: { name: true, slug: true } } },
          })
        : [],
      consumerIds.length > 0
        ? prisma.consumer.findMany({
            where: { id: { in: consumerIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
    ]);

    const productMap = new Map(products.map((p: any) => [p.id, p]));
    const consumerMap = new Map(consumers.map((c: any) => [c.id, c]));

    const data = reports.map((r: any) => ({
      ...r,
      product: r.type === 'PRODUCT' ? productMap.get(r.targetId) || null : null,
      consumer: r.consumerId ? consumerMap.get(r.consumerId) || null : null,
    }));

    res.json({ success: true, data });
  } catch { res.status(500).json({ success: false, error: '신고 조회 실패' }); }
};

export const resolveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, adminNote } = req.body;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: status || 'RESOLVED', adminNote: adminNote?.trim() || null },
    });

    if (report.consumerId && adminNote?.trim()) {
      await prisma.consumerNotification.create({
        data: {
          consumerId: report.consumerId,
          title: '신고 처리 결과',
          message: `신고하신 건에 대한 처리가 완료되었습니다: ${adminNote.trim()}`,
          type: 'REPORT',
        },
      });
    }

    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '처리 실패' }); }
};

export const deleteReportedProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
    res.json({ success: true, message: '상품이 비활성화되었습니다.' });
  } catch { res.status(500).json({ success: false, error: '상품 처리 실패' }); }
};

// ── 1:1 문의 관리 ──

export const getInquiries = async (_req: Request, res: Response): Promise<void> => {
  try {
    const inquiries = await prisma.inquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: inquiries });
  } catch { res.status(500).json({ success: false, error: '문의 조회 실패' }); }
};

export const answerInquiry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { answer } = req.body;
    if (!answer) { res.status(400).json({ success: false, error: '답변을 입력해주세요.' }); return; }
    await prisma.inquiry.update({ where: { id: req.params.id }, data: { answer, status: 'ANSWERED', answeredAt: new Date() } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '답변 실패' }); }
};

// ── 2FA (TOTP) ──

export const setup2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).admin?.adminId;
    const { authenticator } = require('otplib');
    const QRCode = require('qrcode');
    const secret = authenticator.generateSecret();
    await prisma.admin.update({ where: { id: adminId }, data: { totpSecret: secret } });
    const otpauth = authenticator.keyuri('admin@teabri.com', 'teabri Admin', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    res.json({ success: true, data: { secret, qrCode: qrDataUrl } });
  } catch { res.status(500).json({ success: false, error: '2FA 설정 실패' }); }
};

export const verify2FA = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).admin?.adminId;
    const { token: totpToken } = req.body;
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin?.totpSecret) { res.status(400).json({ success: false, error: '2FA가 설정되지 않았습니다.' }); return; }
    const { authenticator } = require('otplib');
    const valid = authenticator.verify({ token: totpToken, secret: admin.totpSecret });
    if (!valid) { res.status(400).json({ success: false, error: '인증 코드가 올바르지 않습니다.' }); return; }
    if (!admin.totpEnabled) await prisma.admin.update({ where: { id: adminId }, data: { totpEnabled: true } });
    res.json({ success: true, message: '2FA 인증 성공' });
  } catch { res.status(500).json({ success: false, error: '2FA 인증 실패' }); }
};

// 초기 관리자 생성 (관리자가 없을 때만)
export const seedAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const count = await prisma.admin.count();
    if (count > 0) { res.status(400).json({ success: false, error: '이미 관리자가 존재합니다.' }); return; }

    const hashed = await bcrypt.hash('admin1234', 12);
    const admin = await prisma.admin.create({
      data: { email: 'admin@teabri.com', password: hashed, name: '관리자' },
    });

    res.json({ success: true, message: '기본 관리자가 생성되었습니다.', data: { email: admin.email, password: 'admin1234' } });
  } catch {
    res.status(500).json({ success: false, error: '관리자 생성 중 오류가 발생했습니다.' });
  }
};
