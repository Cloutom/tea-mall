import { Request, Response } from 'express';
import prisma from '../config/database';
import { cache } from '../utils/cache';

const NEW_STORE_DAYS = 30;
const STORE_SLUG_TTL = 30_000;   // 30초
const ALL_STORES_TTL = 60_000;   // 60초

export const getAllStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const cacheKey = `stores:all:${search}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const where: any = { isOpen: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const stores = await prisma.store.findMany({
      where,
      select: {
        id: true, name: true, slug: true, description: true,
        logoUrl: true, bannerUrl: true, themeColor: true, isOpen: true,
        createdAt: true,
        _count: { select: { products: { where: { isActive: true } } } },
        orders: { select: { finalAmount: true }, where: { status: { in: ['DELIVERED', 'SHIPPING', 'CONFIRMED', 'PREPARING'] } } },
      },
    });

    const now = new Date();
    const newStoreCutoff = new Date(now.getTime() - NEW_STORE_DAYS * 24 * 60 * 60 * 1000);

    const enriched = stores.map((s) => {
      const totalSales = s.orders.reduce((sum, o) => sum + o.finalAmount, 0);
      const orderCount = s.orders.length;
      const isNew = s.createdAt >= newStoreCutoff;
      const { orders, ...rest } = s;
      return { ...rest, totalSales, orderCount, isNew };
    });

    enriched.sort((a, b) => b.totalSales - a.totalSales);

    cache.set(cacheKey, enriched, ALL_STORES_TTL);
    res.json({ success: true, data: enriched });
  } catch {
    res.status(500).json({ success: false, error: '스토어 목록 조회 중 오류가 발생했습니다.' });
  }
};

export const getStoreBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const cacheKey = `store:slug:${slug}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const store = await prisma.store.findUnique({
      where: { slug },
      select: {
        id: true, name: true, slug: true, description: true,
        logoUrl: true, bannerUrl: true, themeColor: true, accentColor: true,
        isOpen: true, openMessage: true, closedMessage: true,
        shippingPolicy: true, returnPolicy: true, minOrderAmount: true,
        shippingFee: true, freeShippingThreshold: true, shippingPolicies: true,
        instagramUrl: true, naverBlogUrl: true, youtubeUrl: true,
        popupDisplayMode: true,
        storeCategories: {
          where: { isActive: true }, orderBy: { order: 'asc' },
          select: { id: true, name: true, icon: true },
        },
      },
    });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    cache.set(cacheKey, store, STORE_SLUG_TTL);
    res.json({ success: true, data: store });
  } catch {
    res.status(500).json({ success: false, error: '스토어 조회 중 오류가 발생했습니다.' });
  }
};

export const getStorePopups = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const now = new Date();
    const popups = await prisma.storePopup.findMany({
      where: { storeId: store.id, isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { order: 'asc' },
    });

    res.json({ success: true, data: popups });
  } catch {
    res.status(500).json({ success: false, error: '팝업 조회 중 오류가 발생했습니다.' });
  }
};

export const getStoreProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const categoryId = req.query.categoryId as string;
    const categoryName = req.query.category as string;
    const search = req.query.search as string;
    const sort = (req.query.sort as string) || 'newest';

    const where: any = { storeId: store.id, isActive: true };
    if (categoryId) where.storeCategoryId = categoryId;
    else if (categoryName) where.storeCategory = { name: { equals: categoryName, mode: 'insensitive' } };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const orderBy =
      sort === 'price_asc' ? { price: 'asc' as const } :
      sort === 'price_desc' ? { price: 'desc' as const } :
      sort === 'sales' ? { totalSales: 'desc' as const } :
      { createdAt: 'desc' as const };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, name: true, description: true, price: true,
          originalPrice: true, discountRate: true, stock: true, unit: true,
          thumbnail: true, tags: true, teaType: true, teaTypeCustom: true,
          caffeineLevel: true, isSignature: true, isFeatured: true,
          newBadgeDays: true, createdAt: true,
          storeCategory: { select: { id: true, name: true, icon: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // 신상품 여부 계산
    const now = new Date();
    const productsWithNewBadge = products.map((p) => ({
      ...p,
      isNew: p.newBadgeDays > 0
        ? (now.getTime() - new Date(p.createdAt).getTime()) <= p.newBadgeDays * 24 * 60 * 60 * 1000
        : false,
    }));

    res.json({ success: true, data: productsWithNewBadge, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, isActive: true },
      include: {
        store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true } },
        storeCategory: { select: { id: true, name: true, icon: true } },
      },
    });
    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }
    prisma.product.update({ where: { id: req.params.id }, data: { totalViews: { increment: 1 } } }).catch(() => {});
    res.json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

// 통합 검색: 스토어 + 상품 동시 검색
export const searchAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) { res.json({ success: true, data: { stores: [], products: [] } }); return; }

    const [stores, products] = await Promise.all([
      prisma.store.findMany({
        where: {
          isOpen: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, name: true, slug: true, description: true,
          logoUrl: true, bannerUrl: true, themeColor: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
        take: 10,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { tags: { has: q } },
          ],
        },
        select: {
          id: true, name: true, price: true, originalPrice: true, discountRate: true,
          thumbnail: true, teaType: true, totalSales: true,
          store: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: { totalSales: 'desc' },
        take: 30,
      }),
    ]);

    res.json({ success: true, data: { stores, products } });
  } catch {
    res.status(500).json({ success: false, error: '검색 중 오류가 발생했습니다.' });
  }
};

// 차 종류별 상품 목록 (메인 페이지 인라인용)
export const getProductsByTeaType = async (req: Request, res: Response): Promise<void> => {
  try {
    const teaType = (req.query.teaType as string || '').trim();
    if (!teaType) { res.json({ success: true, data: [] }); return; }

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { teaType: { contains: teaType, mode: 'insensitive' } },
          { name: { contains: teaType, mode: 'insensitive' } },
          { tags: { has: teaType } },
        ],
      },
      select: {
        id: true, name: true, price: true, originalPrice: true, discountRate: true,
        thumbnail: true, teaType: true, totalSales: true, newBadgeDays: true, createdAt: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true } },
      },
      orderBy: { totalSales: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: products });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

// 티 카테고리 목록 (시스템 전역)
export const getTeaCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, nameEn: true, icon: true, description: true },
    });
    // 카테고리별 상품 수도 포함
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.product.count({
          where: { categoryId: cat.id, isActive: true },
        });
        return { ...cat, productCount: count };
      })
    );
    res.json({ success: true, data: withCounts });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 조회 중 오류가 발생했습니다.' });
  }
};

// 특정 카테고리 상품 목록
export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { categoryId, isActive: true },
        select: {
          id: true, name: true, price: true, originalPrice: true,
          discountRate: true, thumbnail: true, teaType: true, newBadgeDays: true, createdAt: true,
          store: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: { totalSales: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where: { categoryId, isActive: true } }),
    ]);

    res.json({ success: true, data: products, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 상품 조회 중 오류가 발생했습니다.' });
  }
};
