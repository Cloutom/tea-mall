import { Request, Response } from 'express';
import prisma from '../config/database';
import { cache } from '../utils/cache';

const NEW_STORE_DAYS = 30;
const STORE_SLUG_TTL = 30_000;   // 30초
const ALL_STORES_TTL = 60_000;   // 60초

function applyDiscountPeriod(p: any): any {
  if (!p.discountStartAt && !p.discountEndAt) return p;
  const now = new Date();
  const start = p.discountStartAt ? new Date(p.discountStartAt) : null;
  const end = p.discountEndAt ? new Date(p.discountEndAt) : null;
  const inPeriod = (!start || now >= start) && (!end || now <= end);
  if (!inPeriod) {
    return { ...p, price: p.originalPrice ?? p.price, discountRate: null, originalPrice: null };
  }
  return p;
}

export const getAllStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string) || '';
    const cacheKey = `stores:all:${search}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) { res.json({ success: true, data: cached }); return; }

    const where: any = { isOpen: true, isPublished: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const stores = await prisma.store.findMany({
      where,
      select: {
        id: true, name: true, slug: true, description: true,
        logoUrl: true, bannerUrl: true, themeColor: true, isOpen: true,
        createdAt: true,
        _count: { select: { products: { where: { isActive: true } }, wishlists: true } },
        orders: { select: { finalAmount: true }, where: { status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] } } },
      },
    });

    const now = new Date();
    const newStoreCutoff = new Date(now.getTime() - NEW_STORE_DAYS * 24 * 60 * 60 * 1000);

    const enriched = stores.map((s) => {
      const totalSales = s.orders.reduce((sum, o) => sum + o.finalAmount, 0);
      const orderCount = s.orders.length;
      const productCount = s._count?.products || 0;
      const wishlistCount = s._count?.wishlists || 0;
      const isNew = s.createdAt >= newStoreCutoff;
      const score = orderCount * 3 + wishlistCount * 2 + productCount + (totalSales / 10000);
      const { orders, ...rest } = s;
      return { ...rest, totalSales, orderCount, isNew, score };
    });

    enriched.sort((a, b) => b.score - a.score);

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
        isOpen: true, isPublished: true, openMessage: true, closedMessage: true,
        vacationStartAt: true, vacationEndAt: true,
        shippingPolicy: true, returnPolicy: true, minOrderAmount: true,
        shippingFee: true, freeShippingThreshold: true, shippingPolicies: true,
        instagramUrl: true, naverBlogUrl: true, youtubeUrl: true,
        popupDisplayMode: true, pageSections: true,
        storeCategories: {
          where: { isActive: true }, orderBy: { order: 'asc' },
          select: { id: true, name: true, icon: true },
        },
      },
    });
    if (!store || !store.isPublished) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    prisma.store.update({ where: { slug }, data: { totalViews: { increment: 1 } } }).catch(() => {});
    cache.set(cacheKey, store, STORE_SLUG_TTL);
    res.json({ success: true, data: store });
  } catch {
    res.status(500).json({ success: false, error: '스토어 조회 중 오류가 발생했습니다.' });
  }
};

export const getStorePopups = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, select: { id: true, isPublished: true } });
    if (!store || !store.isPublished) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

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
    const store = await prisma.store.findUnique({ where: { slug: req.params.slug }, select: { id: true, isPublished: true } });
    if (!store || !store.isPublished) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

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
          originalPrice: true, discountRate: true, discountStartAt: true, discountEndAt: true,
          stock: true, unit: true,
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

    // 할인 기간 체크 + 신상품 여부 계산
    const now = new Date();
    const productsWithNewBadge = products.map((p) => {
      const dp = applyDiscountPeriod(p);
      return {
        ...dp,
        isNew: dp.newBadgeDays > 0
          ? (now.getTime() - new Date(dp.createdAt).getTime()) <= dp.newBadgeDays * 24 * 60 * 60 * 1000
          : false,
      };
    });

    res.json({ success: true, data: productsWithNewBadge, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, isActive: true, store: { isPublished: true } },
      include: {
        store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true } },
        storeCategory: { select: { id: true, name: true, icon: true } },
      },
    });
    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }
    prisma.product.update({ where: { id: req.params.id }, data: { totalViews: { increment: 1 } } }).catch(() => {});
    prisma.productImpression.create({
      data: {
        productId: product.id,
        source: (req.query.source as string) || 'detail',
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
        userAgent: req.headers['user-agent'],
      },
    }).catch(() => {});
    res.json({ success: true, data: applyDiscountPeriod(product) });
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
          isPublished: true,
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
          store: { isPublished: true },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { tags: { has: q } },
          ],
        },
        select: {
          id: true, name: true, price: true, originalPrice: true, discountRate: true,
          discountStartAt: true, discountEndAt: true, stock: true,
          thumbnail: true, teaType: true, totalSales: true,
          store: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: { totalSales: 'desc' },
        take: 30,
      }),
    ]);

    res.json({ success: true, data: { stores, products: products.map(applyDiscountPeriod) } });
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
        store: { isPublished: true },
        OR: [
          { teaType: { contains: teaType, mode: 'insensitive' } },
          { name: { contains: teaType, mode: 'insensitive' } },
          { tags: { has: teaType } },
        ],
      },
      select: {
        id: true, name: true, price: true, originalPrice: true, discountRate: true,
        discountStartAt: true, discountEndAt: true, stock: true,
        thumbnail: true, teaType: true, totalSales: true, newBadgeDays: true, createdAt: true,
        store: { select: { id: true, name: true, slug: true, logoUrl: true, themeColor: true } },
      },
      orderBy: { totalSales: 'desc' },
      take: 20,
    });

    res.json({ success: true, data: products.map(applyDiscountPeriod) });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

// 메인 배너 (활성만)
export const getMainBanners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const banners = await prisma.mainBanner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: banners });
  } catch {
    res.status(500).json({ success: false, error: '배너 조회 중 오류가 발생했습니다.' });
  }
};

// 메인 팝업 (활성 + 기간 내)
export const getMainPopups = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const popups = await prisma.mainPopup.findMany({
      where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      orderBy: { order: 'asc' },
      select: {
        id: true, imageUrl: true, linkUrl: true, hasLink: true,
        width: true, height: true, startAt: true, endAt: true,
        closeType: true, order: true,
      },
    });
    res.json({ success: true, data: popups });
  } catch {
    res.status(500).json({ success: false, error: '팝업 조회 중 오류가 발생했습니다.' });
  }
};

// Tea 프로필 기반 상품 추천
export const getTeaRecommendations = async (req: Request, res: Response): Promise<void> => {
  try {
    const codes = (req.query.codes as string || '').split(',').filter(Boolean).slice(0, 3);
    if (!codes.length) { res.json({ success: true, data: [] }); return; }

    const select = {
      id: true, name: true, price: true, originalPrice: true, discountRate: true,
      discountStartAt: true, discountEndAt: true, stock: true,
      thumbnail: true, teaType: true, aromaProfile: true, totalSales: true,
      store: { select: { id: true, name: true, slug: true, logoUrl: true } },
    };

    let products = await prisma.product.findMany({
      where: { isActive: true, store: { isPublished: true }, aromaProfile: { hasSome: codes } },
      select, orderBy: { totalSales: 'desc' }, take: 40,
    });

    // 매칭 상품이 없으면 빈 배열 반환 (관련 없는 상품은 추천하지 않음)

    // 매번 다른 순서로 셔플 + 점수 가중치
    const scored = products.map((p: any) => {
      const matchCount = (p.aromaProfile || []).filter((a: string) => codes.includes(a)).length;
      const randomFactor = Math.random() * 0.4;
      return { ...p, score: matchCount * 0.6 + randomFactor };
    });
    scored.sort((a: any, b: any) => b.score - a.score);
    const result = scored.slice(0, 20).map(({ score, ...rest }: any) => applyDiscountPeriod(rest));

    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: '추천 조회 중 오류가 발생했습니다.' });
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
          where: { categoryId: cat.id, isActive: true, store: { isPublished: true } },
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
          discountRate: true, discountStartAt: true, discountEndAt: true, stock: true,
          thumbnail: true, teaType: true, newBadgeDays: true, createdAt: true,
          store: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
        orderBy: { totalSales: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where: { categoryId, isActive: true } }),
    ]);

    res.json({ success: true, data: products.map(applyDiscountPeriod), pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 상품 조회 중 오류가 발생했습니다.' });
  }
};
