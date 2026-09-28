import express from 'express';
import {
  createCategory,
  getAllCategories,
  getActiveCategories,
  getCategoryByIdOrSlug,
  updateCategory,
  toggleCategoryStatus,
  toggleFeaturedStatus,
  deleteCategory,
} from '../controllers/categoryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public Routes: Read categories
router.get('/', getAllCategories);
router.get('/active', getActiveCategories);
router.get('/:idOrSlug', getCategoryByIdOrSlug);

// Admin Protected Routes: Write/Modify categories
router.post('/', protect, authorize('admin'), upload.single('image'), createCategory);
router.put('/:id', protect, authorize('admin'), upload.single('image'), updateCategory);
router.patch('/:id/status', protect, authorize('admin'), toggleCategoryStatus);
router.patch('/:id/featured', protect, authorize('admin'), toggleFeaturedStatus);
router.delete('/:id', protect, authorize('admin'), deleteCategory);

export default router;
