import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types';
import { cache } from '../utils/cache';

// 내 스토어 조회
export const getMyStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({
      where: { sellerId: req.seller!.id },
      include: {
        banners: { orderBy: { order: 'asc' } },
        _count: { select: { products: true, orders: true, reviews: true } },
      },
    });

    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    res.json({ success: true, data: store });
  } catch {
    res.status(500).json({ success: false, error: '스토어 조회 중 오류가 발생했습니다.' });
  }
};

// 스토어 생성
export const createStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sellerId = req.seller!.id;
    const existing = await prisma.store.findUnique({ where: { sellerId } });
    if (existing) {
      res.status(409).json({ success: false, error: '이미 스토어가 존재합니다.' });
      return;
    }

    const { name, description } = req.body;

    // slug 생성 (한글 → 영문 변환 + 고유값)
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-');
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const store = await prisma.store.create({
      data: { sellerId, name, description, slug },
    });

    res.status(201).json({ success: true, message: '스토어가 생성되었습니다.', data: store });
  } catch {
    res.status(500).json({ success: false, error: '스토어 생성 중 오류가 발생했습니다.' });
  }
};

// 스토어 기본 정보 수정
export const updateStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const {
      name, description, shippingPolicy, returnPolicy,
      minOrderAmount, isOpen, openMessage, closedMessage,
      instagramUrl, naverBlogUrl, youtubeUrl,
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const logoUrl = files?.logo?.[0]
      ? ((files.logo[0] as any).location || `/uploads/${files.logo[0].filename}`)
      : store.logoUrl;
    const bannerUrl = files?.banner?.[0]
      ? ((files.banner[0] as any).location || `/uploads/${files.banner[0].filename}`)
      : store.bannerUrl;

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name, description, logoUrl, bannerUrl,
        shippingPolicy, returnPolicy,
        minOrderAmount: minOrderAmount !== undefined && minOrderAmount !== '' ? parseFloat(minOrderAmount) : null,
        isOpen: isOpen === 'true' || isOpen === true,
        openMessage, closedMessage,
        instagramUrl, naverBlogUrl, youtubeUrl,
      },
    });

    cache.del(`store:slug:${store.slug}`);
    cache.delByPrefix('stores:all:');
    res.json({ success: true, message: '스토어 정보가 수정되었습니다.', data: updated });
  } catch {
    res.status(500).json({ success: false, error: '스토어 수정 중 오류가 발생했습니다.' });
  }
};

// 스토어 테마 설정
export const updateStoreTheme = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const { themeColor, accentColor, backgroundColor, fontFamily, layoutType, bannerType } = req.body;

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: { themeColor, accentColor, backgroundColor, fontFamily, layoutType, bannerType },
    });

    cache.del(`store:slug:${store.slug}`);
    res.json({ success: true, message: '테마가 저장되었습니다.', data: updated });
  } catch {
    res.status(500).json({ success: false, error: '테마 저장 중 오류가 발생했습니다.' });
  }
};

// 배송비 설정
export const updateShippingSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const { shippingFee, freeShippingThreshold, shippingPolicies } = req.body;
    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        shippingFee: shippingFee !== undefined ? Number(shippingFee) : store.shippingFee,
        freeShippingThreshold: freeShippingThreshold !== undefined
          ? (freeShippingThreshold === null || freeShippingThreshold === '' ? null : Number(freeShippingThreshold))
          : store.freeShippingThreshold,
        shippingPolicies: shippingPolicies !== undefined ? shippingPolicies : store.shippingPolicies,
      },
    });
    cache.del(`store:slug:${store.slug}`);
    res.json({ success: true, message: '배송비 설정이 저장되었습니다.', data: updated });
  } catch {
    res.status(500).json({ success: false, error: '배송비 설정 저장 실패' });
  }
};

// 배너 추가
export const addBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: '이미지 파일이 필요합니다.' });
      return;
    }

    const imageUrl = (file as any).location || `/uploads/${file.filename}`;

    const { linkUrl, title } = req.body;
    const count = await prisma.storeBanner.count({ where: { storeId: store.id } });

    const banner = await prisma.storeBanner.create({
      data: { storeId: store.id, imageUrl, linkUrl, title, order: count },
    });

    res.status(201).json({ success: true, data: banner });
  } catch {
    res.status(500).json({ success: false, error: '배너 추가 중 오류가 발생했습니다.' });
  }
};

// 배너 삭제
export const deleteBanner = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    await prisma.storeBanner.deleteMany({
      where: { id: req.params.bannerId, storeId: store.id },
    });

    res.json({ success: true, message: '배너가 삭제되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '배너 삭제 중 오류가 발생했습니다.' });
  }
};

// 팝업 목록 조회
export const getPopups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const popups = await prisma.storePopup.findMany({
      where: { storeId: store.id },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: { popups, displayMode: store.popupDisplayMode } });
  } catch {
    res.status(500).json({ success: false, error: '팝업 조회 중 오류가 발생했습니다.' });
  }
};

// 팝업 생성
export const createPopup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const { linkUrl, hasLink, width, height, startAt, endAt, isActive, closeType } = req.body;
    const file = req.file;
    const imageUrl = file
      ? ((file as any).location || `/uploads/${file.filename}`)
      : undefined;

    const count = await prisma.storePopup.count({ where: { storeId: store.id } });

    const popup = await prisma.storePopup.create({
      data: {
        storeId: store.id,
        imageUrl,
        linkUrl: hasLink === 'true' ? linkUrl : null,
        hasLink: hasLink === 'true',
        width: parseInt(width) || 400,
        height: parseInt(height) || 500,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isActive: isActive === 'true',
        closeType: closeType || 'close_only',
        order: count,
      },
    });

    res.status(201).json({ success: true, data: popup });
  } catch {
    res.status(500).json({ success: false, error: '팝업 생성 중 오류가 발생했습니다.' });
  }
};

// 팝업 수정
export const updatePopup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }

    const popup = await prisma.storePopup.findFirst({
      where: { id: req.params.popupId, storeId: store.id },
    });
    if (!popup) { res.status(404).json({ success: false, error: '팝업을 찾을 수 없습니다.' }); return; }

    const { linkUrl, hasLink, width, height, startAt, endAt, isActive, closeType } = req.body;
    const file = req.file;
    const imageUrl = file
      ? ((file as any).location || `/uploads/${file.filename}`)
      : popup.imageUrl;

    const updated = await prisma.storePopup.update({
      where: { id: popup.id },
      data: {
        imageUrl,
        linkUrl: hasLink === 'true' ? linkUrl : null,
        hasLink: hasLink === 'true',
        width: parseInt(width) || 400,
        height: parseInt(height) || 500,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isActive: isActive === 'true',
        closeType: closeType || 'close_only',
      },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '팝업 수정 중 오류가 발생했습니다.' });
  }
};

// 팝업 삭제
export const deletePopup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    await prisma.storePopup.deleteMany({ where: { id: req.params.popupId, storeId: store.id } });
    res.json({ success: true, message: '팝업이 삭제되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '팝업 삭제 중 오류가 발생했습니다.' });
  }
};

// 팝업 표시 방식 설정
export const updatePopupDisplayMode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' }); return; }
    const { displayMode } = req.body;
    await prisma.store.update({ where: { id: store.id }, data: { popupDisplayMode: displayMode } });
    cache.del(`store:slug:${store.slug}`);
    res.json({ success: true, message: '표시 방식이 변경되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '표시 방식 변경 중 오류가 발생했습니다.' });
  }
};

// 배너 순서 변경
export const reorderBanners = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bannerIds } = req.body as { bannerIds: string[] };
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    await Promise.all(
      bannerIds.map((id, index) =>
        prisma.storeBanner.update({ where: { id }, data: { order: index } })
      )
    );

    res.json({ success: true, message: '배너 순서가 변경되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: '배너 순서 변경 중 오류가 발생했습니다.' });
  }
};
