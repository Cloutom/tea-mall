import { Router } from 'express';
import {
  getOrders, getOrder, updateOrderStatus,
  bulkUpdateShipping, bulkStatusUpdate, getOrderSummary, processRefund,
  autoAssignTracking, getShippingLabels,
} from '../controllers/orders.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getOrders);
router.get('/summary', getOrderSummary);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
router.post('/:id/refund', processRefund);
router.post('/bulk-status', bulkStatusUpdate);
router.post('/bulk-shipping', bulkUpdateShipping);
router.post('/auto-tracking', autoAssignTracking);
router.post('/shipping-labels', getShippingLabels);

export default router;
