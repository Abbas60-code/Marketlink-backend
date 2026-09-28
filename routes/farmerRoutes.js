import express from 'express';
import {
  createOrUpdateFarmerProfile,
  getAllFarmers,
  getFarmerById,
  getMyFarmerProfile,
  updateWeeklyStock,
  updatePickupSlots,
  getAdminFarmers,
  updateFarmerStatus,
  deleteFarmerProfile,
} from '../controllers/farmerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Public
router.get('/', getAllFarmers);
router.get('/me', protect, getMyFarmerProfile);
router.get('/admin/all', protect, authorize('admin'), getAdminFarmers);
router.get('/:idOrSlug', getFarmerById);

// Farmer protected routes
router.post('/profile', protect, upload.single('profileImage'), createOrUpdateFarmerProfile);
router.put('/weekly-stock', protect, authorize('farmer', 'admin'), updateWeeklyStock);
router.put('/pickup-slots', protect, authorize('farmer', 'admin'), updatePickupSlots);

router.patch('/:id/status', protect, authorize('admin'), updateFarmerStatus);
router.delete('/:id', protect, authorize('admin'), deleteFarmerProfile);

export default router;
