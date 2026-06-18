import { Router } from 'express';
import {
  getMyStore, createStore, updateStore, updateStoreTheme, updateShippingSettings,
  addBanner, deleteBanner, reorderBanners,
  getPopups, createPopup, updatePopup, deletePopup, updatePopupDisplayMode,
} from '../controllers/store.controller';
import { authenticate } from '../middleware/auth';
import { uploadSingle, uploadStoreFields } from '../middleware/upload';

const router = Router();

router.use(authenticate);

router.get('/', getMyStore);
router.post('/', createStore);
router.put('/', uploadStoreFields, updateStore);
router.put('/theme', updateStoreTheme);
router.put('/shipping', updateShippingSettings);

router.post('/banners', uploadSingle, addBanner);
router.delete('/banners/:bannerId', deleteBanner);
router.put('/banners/reorder', reorderBanners);

router.get('/popup', getPopups);
router.post('/popup', uploadSingle, createPopup);
router.put('/popup/display-mode', updatePopupDisplayMode);
router.put('/popup/:popupId', uploadSingle, updatePopup);
router.delete('/popup/:popupId', deletePopup);

export default router;
