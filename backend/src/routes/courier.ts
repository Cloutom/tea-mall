import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getCourierAccounts, createCourierAccount,
  updateCourierAccount, deleteCourierAccount, setDefaultCourier,
} from '../controllers/courier.controller';

const router = Router();
router.use(authenticate);

router.get('/', getCourierAccounts);
router.post('/', createCourierAccount);
router.put('/:accountId', updateCourierAccount);
router.delete('/:accountId', deleteCourierAccount);
router.patch('/:accountId/default', setDefaultCourier);

export default router;
