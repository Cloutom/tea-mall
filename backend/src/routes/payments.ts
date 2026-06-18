import { Router } from 'express';
import { prepareTossPayment, confirmTossPayment, lookupOrder, requestCancelOrRefund } from '../controllers/payments.controller';

const router = Router();

router.post('/toss/prepare', prepareTossPayment);
router.post('/toss/confirm', confirmTossPayment);
router.post('/orders/lookup', lookupOrder);
router.post('/orders/cancel-request', requestCancelOrRefund);

export default router;