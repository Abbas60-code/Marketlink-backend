import express from 'express';
import {
  createBanner,
  getAllBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  toggleBannerStatus,
  deleteBanner,
} from '../controllers/bannerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public Routes: View banners
router.get('/', getAllBanners);
router.get('/active', getActiveBanners);
router.get('/:id', getBannerById);

// Admin Routes: Create, Update, Toggle Status, Delete banners
router.post('/', protect, authorize('admin'), upload.single('image'), createBanner);
router.put('/:id', protect, authorize('admin'), upload.single('image'), updateBanner);
router.patch('/:id/status', protect, authorize('admin'), toggleBannerStatus);
router.delete('/:id', protect, authorize('admin'), deleteBanner);

export default router;
