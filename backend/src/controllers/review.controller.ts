import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest as ConsumerAuthRequest } from '../types';
import { OrderStatus } from '@prisma/client';

// 상품 리뷰 목록 조회 (공개)
export const getProductReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sort = req.query.sort as string || 'latest';

    const orderBy =
      sort === 'rating_high' ? [{ rating: 'desc' as const }, { createdAt: 'desc' as const }] :
      sort === 'rating_low' ? [{ rating: 'asc' as const }, { createdAt: 'desc' as const }] :
      [{ createdAt: 'desc' as const }];

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId, isVisible: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, buyerName: true, rating: true, content: true,
          images: true, sellerReply: true, repliedAt: true, createdAt: true,
        },
      }),
      prisma.review.count({ where: { productId, isVisible: true } }),
    ]);

    const ratingStats = await prisma.review.aggregate({
      where: { productId, isVisible: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    res.json({
      success: true,
      data: reviews,
      stats: { avg: ratingStats._avg.rating || 0, count: ratingStats._count.rating },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, error: '리뷰 조회 중 오류가 발생했습니다.' });
  }
};

// 리뷰 작성 (소비자 인증 필요)
export const createReview = async (req: ConsumerAuthRequest, res: Response): Promise<void> => {
  try {
    const { orderId, productId, rating, content } = req.body;
    const consumerId = (req as any).consumerId;

    const getUrl = (file: Express.Multer.File) =>
      (file as any).location || `/uploads/${file.filename}`;

    const uploadedImages = req.files
      ? (req.files as Express.Multer.File[]).map(getUrl)
      : [];
    const images = uploadedImages;

    if (!productId || !rating) {
      res.status(400).json({ success: false, error: '필수 항목이 누락되었습니다.' }); return;
    }
    if (rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: '별점은 1~5 사이여야 합니다.' }); return;
    }
    if (content && content.trim().length < 10) {
      res.status(400).json({ success: false, error: '리뷰 내용은 10자 이상 작성해주세요.' }); return;
    }

    // 구매확정된 주문만 리뷰 작성 가능
    const targetOrderId = orderId && orderId !== 'skip' ? orderId : null;
    const order = await prisma.order.findFirst({
      where: {
        consumerId,
        status: 'PURCHASE_CONFIRMED',
        items: { some: { productId } },
        ...(targetOrderId ? { id: targetOrderId } : {}),
      },
      include: { items: true },
    });
    if (!order) {
      res.status(400).json({ success: false, error: '구매확정 후에만 리뷰를 작성할 수 있습니다.' }); return;
    }

    // 한 주문당 하나의 리뷰만 허용
    const existing = await prisma.review.findFirst({ where: { orderId: order.id, consumerId } });
    if (existing) {
      res.status(400).json({ success: false, error: '이 주문에 대해 이미 리뷰를 작성하셨습니다.' }); return;
    }

    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId }, select: { name: true } });

    const review = await prisma.review.create({
      data: {
        storeId: order.storeId,
        productId,
        orderId: order.id,
        consumerId,
        buyerName: consumer?.name || '구매자',
        rating: parseInt(rating),
        content: content?.trim() || null,
        images: images || [],
      },
    });

    // 리뷰 포인트 지급 (관리자 설정 기반)
    const pointSetting = await prisma.pointSetting.findFirst();
    const hasPhoto = images && images.length > 0;
    let reviewPoints = 0;

    if (pointSetting) {
      if (pointSetting.reviewPointType === 'percent' && pointSetting.reviewPointRate > 0) {
        const orderItem = (order as any).items?.find((i: any) => i.productId === productId);
        const itemAmount = orderItem ? orderItem.totalPrice : order.finalAmount;
        reviewPoints = Math.round(itemAmount * pointSetting.reviewPointRate / 100);
      } else {
        reviewPoints = pointSetting.reviewPointFixed || 0;
      }
      if (hasPhoto) reviewPoints += (pointSetting.reviewPhotoBonus || 0);
    }

    if (reviewPoints > 0) {
      const reason = hasPhoto ? '리뷰 작성 포인트 (사진 포함)' : '리뷰 작성 포인트';
      await prisma.pointHistory.create({
        data: { consumerId, amount: reviewPoints, type: 'EARN', reason, orderId: order.id },
      });
    }

    res.json({ success: true, data: review, reviewPoints });
  } catch {
    res.status(500).json({ success: false, error: '리뷰 작성 중 오류가 발생했습니다.' });
  }
};

// 판매자 리뷰 목록 조회
export const getSellerReviews = async (req: ConsumerAuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: (req as any).seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unanswered = req.query.unanswered === 'true' || req.query.unanswered === '1';

    const where = { storeId: store.id, ...(unanswered ? { sellerReply: null } : {}) };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [reviews, total, unansweredCount, avgRating, thisMonthCount] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, thumbnail: true } },
          consumer: { select: { name: true } },
        },
      }),
      prisma.review.count({ where: { storeId: store.id } }),
      prisma.review.count({ where: { storeId: store.id, sellerReply: null } }),
      prisma.review.aggregate({ where: { storeId: store.id }, _avg: { rating: true } }),
      prisma.review.count({ where: { storeId: store.id, createdAt: { gte: startOfMonth } } }),
    ]);

    res.json({
      success: true,
      data: reviews,
      stats: { total, unanswered: unansweredCount, avgRating: avgRating._avg.rating || 0, thisMonth: thisMonthCount },
      pagination: { total: unanswered ? unansweredCount : total, page, limit, totalPages: Math.ceil((unanswered ? unansweredCount : total) / limit) },
    });
  } catch {
    res.status(500).json({ success: false, error: '리뷰 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 리뷰 답변
export const replyToReview = async (req: ConsumerAuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: (req as any).seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const { reply } = req.body;
    if (!reply?.trim()) { res.status(400).json({ success: false, error: '답변 내용을 입력해주세요.' }); return; }

    const review = await prisma.review.findFirst({ where: { id: req.params.id, storeId: store.id } });
    if (!review) { res.status(404).json({ success: false, error: '리뷰를 찾을 수 없습니다.' }); return; }

    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: { sellerReply: reply.trim(), repliedAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '답변 저장 중 오류가 발생했습니다.' });
  }
};
