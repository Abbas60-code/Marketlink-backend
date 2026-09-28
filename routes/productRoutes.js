import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductByIdOrSlug,
  updateProduct,
  deleteProduct,
  getMyProducts,
} from '../controllers/productController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public
router.get('/', getAllProducts);
router.get('/my-products', protect, getMyProducts);
router.get('/:idOrSlug', getProductByIdOrSlug);

// Protected
router.post('/', protect, upload.single('image'), createProduct);
router.put('/:id', protect, upload.single('image'), updateProduct);
router.delete('/:id', protect, deleteProduct);

export default router;
