import { Router } from 'express';
import { getProductReviews, createReview, getSellerReviews, replyToReview } from '../controllers/review.controller';
import { consumerAuth } from '../middleware/consumerAuth';
import { authenticate } from '../middleware/auth';
import { uploadReviewImages } from '../middleware/upload';

const router = Router();

// 공개 - 상품 리뷰 조회
router.get('/products/:productId/reviews', getProductReviews);

// 소비자 - 리뷰 작성 (이미지 업로드 지원)
router.post('/reviews', consumerAuth, uploadReviewImages, createReview);

// 판매자 - 리뷰 목록 / 답변
router.get('/seller/reviews', authenticate, getSellerReviews as any);
router.patch('/seller/reviews/:id/reply', authenticate, replyToReview as any);

export default router;
