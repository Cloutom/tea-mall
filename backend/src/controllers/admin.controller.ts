import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// 관리자 로그인
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
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
          businessName: true, businessNumber: true, businessVerified: true,
          status: true, rejectionReason: true, approvedAt: true,
          isActive: true, createdAt: true, lastLoginAt: true,
          store: { select: { id: true, name: true, slug: true, isOpen: true } },
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
      data: { status: 'APPROVED', approvedAt: new Date(), rejectionReason: null },
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
