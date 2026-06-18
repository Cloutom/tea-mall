import { Router } from 'express';
import { getStoreQnAs, createQnA, getSellerQnAs, answerQnA } from '../controllers/qna.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// 공개 - 스토어 QnA 조회 / 등록
router.get('/stores/:slug/qna', getStoreQnAs);
router.post('/stores/:slug/qna', createQnA);

// 판매자 - QnA 목록 / 답변
router.get('/seller/qna', authenticate, getSellerQnAs as any);
router.patch('/seller/qna/:id/answer', authenticate, answerQnA as any);

export default router;
