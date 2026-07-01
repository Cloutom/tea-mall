import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types';
import { notifyWishlistConsumers, notifyProductWishlistConsumers } from './consumer-auth.controller';

const VALID_AROMA = ['FLA','FRU','CIT','SWE','HON','CRE','VEG','MAR','MIN','ROA','MAL','WOO','EAR','SPI','SMO','COM'];
function parseAromaProfile(v: any): string[] {
  if (!v) return [];
  const arr = typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v : [];
  return arr.map((s: string) => s.trim().toUpperCase()).filter((s: string) => VALID_AROMA.includes(s));
}

// 상품 목록 조회
export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const category = req.query.category as string;
    const sort = (req.query.sort as string) || 'createdAt';
    const order = (req.query.order as string) || 'desc';

    const where: any = { storeId: store.id };
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (category) where.categoryId = category;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          storeCategory: { select: { id: true, name: true } },
          _count: { select: { orderItems: true, impressions: true, reviews: true } },
        },
        orderBy: { [sort]: order as 'asc' | 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: products, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

// 상품 상세 조회
export const getProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const product = await prisma.product.findFirst({
      where: { id: req.params.id, storeId: store.id },
      include: {
        category: true,
        storeCategory: true,
        _count: { select: { orderItems: true, impressions: true, reviews: true } },
      },
    });

    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }
    res.json({ success: true, data: product });
  } catch {
    res.status(500).json({ success: false, error: '상품 조회 중 오류가 발생했습니다.' });
  }
};

// 상품 등록
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const getUrl = (file: Express.Multer.File) =>
      (file as any).location || `/uploads/${file.filename}`;

    const thumbnail = files?.thumbnail?.[0] ? getUrl(files.thumbnail[0]) : undefined;
    const images = files?.images ? files.images.map(getUrl).filter(Boolean) : [];

    const {
      name, description, detailHtml, price, originalPrice, discountRate,
      discountStartAt, discountEndAt,
      stock, unit, weight, categoryId, storeCategoryId,
      teaOrigin, teaType, teaTypeCustom, caffeineLevel, brewingTemp, brewingTime,
      harvestSeason, processingMethod, liquidColor, body, aroma,
      flavorBitter, flavorSweet, flavorAstringent, flavorSavory, flavorFloral,
      flavorFruity, flavorNutty, flavorSmoky, flavorEarthy, flavorFresh, flavorCreamy,
      recommendedTime,
      tags, isActive, isFeatured, isSignature, newBadgeDays,
      wholesaleSupplier, wholesalePrice, wholesaleShipping, marketShippingCost,
      options: productOptions,
    } = req.body;

    const priceNum = parseFloat(price);
    const originalPriceNum = originalPrice ? parseFloat(originalPrice) : null;
    const calcDiscountRate = originalPriceNum && originalPriceNum > priceNum
      ? Math.round((originalPriceNum - priceNum) / originalPriceNum * 100)
      : (discountRate ? parseInt(discountRate) : null);

    const parseTags = (t: any): string[] => {
      if (!t) return [];
      if (Array.isArray(t)) return t;
      return [t];
    };

    const product = await prisma.product.create({
      data: {
        storeId: store.id,
        name, description, detailHtml,
        price: priceNum,
        originalPrice: originalPriceNum,
        discountRate: calcDiscountRate,
        discountStartAt: discountStartAt ? new Date(discountStartAt) : null,
        discountEndAt: discountEndAt ? new Date(discountEndAt) : null,
        stock: parseInt(stock) || 0,
        unit: unit || '개',
        weight: weight ? parseFloat(weight) : null,
        thumbnail, images,
        categoryId: categoryId || null,
        storeCategoryId: storeCategoryId || null,
        teaOrigin, teaType, teaTypeCustom, caffeineLevel, brewingTemp, brewingTime,
        harvestSeason, processingMethod, liquidColor, body, aroma, recommendedTime,
        flavorBitter: flavorBitter !== undefined && flavorBitter !== '' ? parseInt(flavorBitter) : null,
        flavorSweet: flavorSweet !== undefined && flavorSweet !== '' ? parseInt(flavorSweet) : null,
        flavorAstringent: flavorAstringent !== undefined && flavorAstringent !== '' ? parseInt(flavorAstringent) : null,
        flavorSavory: flavorSavory !== undefined && flavorSavory !== '' ? parseInt(flavorSavory) : null,
        flavorFloral: flavorFloral !== undefined && flavorFloral !== '' ? parseInt(flavorFloral) : null,
        flavorFruity: flavorFruity !== undefined && flavorFruity !== '' ? parseInt(flavorFruity) : null,
        flavorNutty: flavorNutty !== undefined && flavorNutty !== '' ? parseInt(flavorNutty) : null,
        flavorSmoky: flavorSmoky !== undefined && flavorSmoky !== '' ? parseInt(flavorSmoky) : null,
        flavorEarthy: flavorEarthy !== undefined && flavorEarthy !== '' ? parseInt(flavorEarthy) : null,
        flavorFresh: flavorFresh !== undefined && flavorFresh !== '' ? parseInt(flavorFresh) : null,
        flavorCreamy: flavorCreamy !== undefined && flavorCreamy !== '' ? parseInt(flavorCreamy) : null,
        tags: parseTags(tags),
        isActive: isActive !== 'false',
        isFeatured: isFeatured === 'true',
        isSignature: isSignature === 'true',
        newBadgeDays: newBadgeDays ? parseInt(newBadgeDays) : 0,
        aromaProfile: parseAromaProfile(req.body.aromaProfile),
        wholesaleSupplier: wholesaleSupplier || null,
        wholesalePrice: wholesalePrice ? parseFloat(wholesalePrice) : null,
        wholesaleShipping: wholesaleShipping ? parseFloat(wholesaleShipping) : null,
        marketShippingCost: marketShippingCost ? parseFloat(marketShippingCost) : null,
        options: productOptions ? (typeof productOptions === 'string' ? JSON.parse(productOptions) : productOptions) : null,
      },
    });

    res.status(201).json({ success: true, message: '상품이 등록되었습니다.', data: product });

    const storeName = store.name || '스토어';
    const productLink = `/store/${store.slug}/products/${product.id}`;
    if (product.discountRate && product.discountRate > 0) {
      notifyWishlistConsumers(store.id, `${storeName}에서 ${product.name} ${product.discountRate}% 할인 상품이 등록되었습니다!`, {
        type: 'store_discount', title: '할인 상품 등록', link: productLink, imageUrl: product.thumbnail || undefined,
      }).catch(() => {});
    } else {
      notifyWishlistConsumers(store.id, `${storeName}에서 새 상품 "${product.name}"이 등록되었습니다!`, {
        type: 'store_new_product', title: '신상품 등록', link: productLink, imageUrl: product.thumbnail || undefined,
      }).catch(() => {});
    }
  } catch (err: any) {
    console.error('createProduct error:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || '상품 등록 중 오류가 발생했습니다.' });
  }
};

// 상품 수정
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const product = await prisma.product.findFirst({ where: { id: req.params.id, storeId: store.id } });
    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const getUrl = (file: Express.Multer.File) =>
      (file as any).location || `/uploads/${file.filename}`;

    const thumbnail = files?.thumbnail?.[0] ? getUrl(files.thumbnail[0]) : product.thumbnail;
    const newImages = files?.images ? files.images.map(getUrl) : [];
    const existingImages = req.body.existingImages
      ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages])
      : product.images;
    const images = [...existingImages, ...newImages];

    const {
      name, description, detailHtml, price, originalPrice, discountRate,
      discountStartAt, discountEndAt,
      stock, unit, weight, categoryId, storeCategoryId,
      teaOrigin, teaType, teaTypeCustom, caffeineLevel, brewingTemp, brewingTime,
      harvestSeason, processingMethod, liquidColor, body, aroma,
      flavorBitter, flavorSweet, flavorAstringent, flavorSavory, flavorFloral,
      flavorFruity, flavorNutty, flavorSmoky, flavorEarthy, flavorFresh, flavorCreamy,
      recommendedTime,
      tags, isActive, isFeatured, isSignature, newBadgeDays,
      wholesaleSupplier, wholesalePrice, wholesaleShipping, marketShippingCost,
      options: optionsBody,
    } = req.body;

    const priceNum = parseFloat(price);
    const originalPriceNum = originalPrice ? parseFloat(originalPrice) : null;
    const calcDiscountRate = originalPriceNum && originalPriceNum > priceNum
      ? Math.round((originalPriceNum - priceNum) / originalPriceNum * 100)
      : (discountRate ? parseInt(discountRate) : null);

    const parseTags = (t: any, fallback: string[]): string[] => {
      if (!t) return fallback;
      if (Array.isArray(t)) return t;
      return [t];
    };

    const parseFlavorInt = (val: any, fallback: number | null) =>
      val !== undefined && val !== '' ? parseInt(val) : fallback;

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: {
        name, description, detailHtml,
        price: priceNum,
        originalPrice: originalPriceNum,
        discountRate: calcDiscountRate,
        discountStartAt: discountStartAt ? new Date(discountStartAt) : null,
        discountEndAt: discountEndAt ? new Date(discountEndAt) : null,
        stock: parseInt(stock) || 0,
        unit, weight: weight ? parseFloat(weight) : null,
        thumbnail, images,
        categoryId: categoryId || null,
        storeCategoryId: storeCategoryId || null,
        teaOrigin, teaType, teaTypeCustom, caffeineLevel, brewingTemp, brewingTime,
        harvestSeason, processingMethod, liquidColor, body, aroma, recommendedTime,
        flavorBitter: parseFlavorInt(flavorBitter, product.flavorBitter),
        flavorSweet: parseFlavorInt(flavorSweet, product.flavorSweet),
        flavorAstringent: parseFlavorInt(flavorAstringent, product.flavorAstringent),
        flavorSavory: parseFlavorInt(flavorSavory, product.flavorSavory),
        flavorFloral: parseFlavorInt(flavorFloral, product.flavorFloral),
        tags: parseTags(tags, product.tags),
        isActive: isActive !== 'false',
        isFeatured: isFeatured === 'true',
        isSignature: isSignature === 'true',
        newBadgeDays: newBadgeDays !== undefined ? parseInt(newBadgeDays) : product.newBadgeDays,
        aromaProfile: req.body.aromaProfile !== undefined ? parseAromaProfile(req.body.aromaProfile) : product.aromaProfile,
        wholesaleSupplier: wholesaleSupplier !== undefined ? (wholesaleSupplier || null) : product.wholesaleSupplier,
        wholesalePrice: wholesalePrice !== undefined ? (wholesalePrice ? parseFloat(wholesalePrice) : null) : product.wholesalePrice,
        wholesaleShipping: wholesaleShipping !== undefined ? (wholesaleShipping ? parseFloat(wholesaleShipping) : null) : product.wholesaleShipping,
        marketShippingCost: marketShippingCost !== undefined ? (marketShippingCost ? parseFloat(marketShippingCost) : null) : product.marketShippingCost,
        options: optionsBody !== undefined ? (optionsBody ? (typeof optionsBody === 'string' ? JSON.parse(optionsBody) : optionsBody) : null) : undefined,
      },
    });

    res.json({ success: true, message: '상품이 수정되었습니다.', data: updated });

    const storeName = store.name || '스토어';
    const productLink = `/store/${store.slug}/products/${updated.id}`;
    const oldDiscount = product.discountRate || 0;
    const newDiscount = updated.discountRate || 0;

    if (newDiscount > 0 && newDiscount !== oldDiscount) {
      notifyWishlistConsumers(store.id, `${storeName} "${updated.name}" ${newDiscount}% 할인 이벤트가 시작되었습니다!`, {
        type: 'store_discount', title: '할인 이벤트', link: productLink, imageUrl: updated.thumbnail || undefined,
      }).catch(() => {});
      notifyProductWishlistConsumers(updated.id, {
        type: 'product_discount', title: '찜한 상품 할인',
        message: `"${updated.name}" ${newDiscount}% 할인이 시작되었습니다!`,
        link: productLink, imageUrl: updated.thumbnail || undefined,
      }).catch(() => {});
    }

    const newStock = updated.stock;
    const oldStock = product.stock;
    if (newStock <= 5 && newStock > 0 && oldStock > 5) {
      notifyProductWishlistConsumers(updated.id, {
        type: 'product_low_stock', title: '찜한 상품 품절 임박',
        message: `"${updated.name}" 재고가 ${newStock}개 남았습니다. 서두르세요!`,
        link: productLink, imageUrl: updated.thumbnail || undefined,
      }).catch(() => {});
    }
  } catch (err: any) {
    console.error('updateProduct error:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || '상품 수정 중 오류가 발생했습니다.' });
  }
};

// 상품 삭제(비활성화)
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    await prisma.product.updateMany({ where: { id: req.params.id, storeId: store.id }, data: { isActive: false } });
    res.json({ success: true, message: '상품이 비활성화되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '상품 삭제 중 오류가 발생했습니다.' });
  }
};

// 상품 활성/비활성 토글
export const toggleProductStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const product = await prisma.product.findFirst({ where: { id: req.params.id, storeId: store.id } });
    if (!product) { res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' }); return; }
    const updated = await prisma.product.update({ where: { id: product.id }, data: { isActive: !product.isActive } });
    res.json({ success: true, data: { isActive: updated.isActive } });
  } catch {
    res.status(500).json({ success: false, error: '상태 변경 중 오류가 발생했습니다.' });
  }
};

// 전역 카테고리 목록
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: { children: { where: { isActive: true } } },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 조회 중 오류가 발생했습니다.' });
  }
};

// ── 스토어 전용 카테고리 CRUD ──

export const getStoreCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const cats = await prisma.storeCategory.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: cats });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 조회 중 오류가 발생했습니다.' });
  }
};

export const createStoreCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const { name, icon } = req.body;
    if (!name) { res.status(400).json({ success: false, error: '카테고리 이름을 입력해주세요.' }); return; }
    const count = await prisma.storeCategory.count({ where: { storeId: store.id } });
    const cat = await prisma.storeCategory.create({ data: { storeId: store.id, name, icon: icon || null, order: count } });
    res.status(201).json({ success: true, data: cat });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 생성 중 오류가 발생했습니다.' });
  }
};

export const updateStoreCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const { name, icon } = req.body;
    const cat = await prisma.storeCategory.updateMany({
      where: { id: req.params.id, storeId: store.id },
      data: { ...(name && { name }), ...(icon !== undefined && { icon }) },
    });
    res.json({ success: true, data: cat });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 수정 중 오류가 발생했습니다.' });
  }
};

export const deleteStoreCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    await prisma.storeCategory.updateMany({
      where: { id: req.params.id, storeId: store.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '카테고리 삭제 중 오류가 발생했습니다.' });
  }
};
