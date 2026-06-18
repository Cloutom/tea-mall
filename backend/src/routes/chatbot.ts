import { Router } from 'express';
import { getStoreFaqs, getSellerFaqs, createFaq, updateFaq, deleteFaq } from '../controllers/chatbot.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// 공개 - 스토어 챗봇 FAQ 조회
router.get('/stores/:slug/chatbot', getStoreFaqs);

// 판매자 - FAQ 관리
router.get('/seller/chatbot', authenticate, getSellerFaqs as any);
router.post('/seller/chatbot', authenticate, createFaq as any);
router.patch('/seller/chatbot/:id', authenticate, updateFaq as any);
router.delete('/seller/chatbot/:id', authenticate, deleteFaq as any);

export default router;
