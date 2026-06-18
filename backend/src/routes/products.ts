import { Router } from 'express';
import {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, toggleProductStatus, getCategories,
  getStoreCategories, createStoreCategory, updateStoreCategory, deleteStoreCategory,
} from '../controllers/products.controller';
import { authenticate } from '../middleware/auth';
import { uploadFields } from '../middleware/upload';

const router = Router();

router.get('/categories', getCategories);

router.use(authenticate);

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', uploadFields, createProduct);
router.put('/:id', uploadFields, updateProduct);
router.delete('/:id', deleteProduct);
router.patch('/:id/toggle', toggleProductStatus);

// 스토어 전용 카테고리
router.get('/store-categories/list', getStoreCategories);
router.post('/store-categories', createStoreCategory);
router.put('/store-categories/:id', updateStoreCategory);
router.delete('/store-categories/:id', deleteStoreCategory);

export default router;
