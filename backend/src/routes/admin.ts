import { Router } from 'express';
import { adminLogin, getAdminStats, getSellers, approveSeller, rejectSeller, seedAdmin } from '../controllers/admin.controller';
import { authenticateAdmin } from '../middleware/adminAuth';

const router = Router();

router.post('/login', adminLogin);
router.post('/seed', seedAdmin);

router.get('/stats', authenticateAdmin, getAdminStats);
router.get('/sellers', authenticateAdmin, getSellers);
router.patch('/sellers/:id/approve', authenticateAdmin, approveSeller);
router.patch('/sellers/:id/reject', authenticateAdmin, rejectSeller);

export default router;
