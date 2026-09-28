import express from 'express';
import { createMarket, getAllMarkets, getMarketById, updateMarket, deleteMarket } from '../controllers/marketController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getAllMarkets);
router.get('/:id', getMarketById);
router.post('/', protect, authorize('admin'), upload.single('image'), createMarket);
router.put('/:id', protect, authorize('admin'), upload.single('image'), updateMarket);
router.delete('/:id', protect, authorize('admin'), deleteMarket);

export default router;
