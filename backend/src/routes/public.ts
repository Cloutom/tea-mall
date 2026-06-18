import { Router } from 'express';
import {
  getAllStores, getStoreBySlug, getStorePopups, getStoreProducts, getProductById,
  searchAll, getTeaCategories, getProductsByCategory, getProductsByTeaType,
} from '../controllers/public.controller';

const router = Router();

router.get('/stores', getAllStores);
router.get('/stores/:slug', getStoreBySlug);
router.get('/stores/:slug/popups', getStorePopups);
router.get('/stores/:slug/products', getStoreProducts);
router.get('/products/:id', getProductById);
router.get('/search', searchAll);
router.get('/tea-type', getProductsByTeaType);
router.get('/categories', getTeaCategories);
router.get('/categories/:categoryId/products', getProductsByCategory);

export default router;