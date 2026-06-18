import { Router } from 'express';
import {
  getDashboardStats, getSalesChart, getProductAnalytics,
  getSettlements, getNotifications, markNotificationsRead,
} from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/sales-chart', getSalesChart);
router.get('/products', getProductAnalytics);
router.get('/settlements', getSettlements);
router.get('/notifications', getNotifications);
router.post('/notifications/read', markNotificationsRead);

export default router;
