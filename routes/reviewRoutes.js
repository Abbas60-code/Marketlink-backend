import express from 'express';
import {
  createReview,
  getFarmerReviews,
  getProductReviews,
  replyToReview,
  getAllReviewsAdmin,
  moderateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/farmer/:farmerId', getFarmerReviews);
router.get('/product/:productId', getProductReviews);

// Customer
router.post('/', protect, createReview);

// Farmer response
router.post('/:id/reply', protect, authorize('farmer', 'admin'), replyToReview);

// Admin Moderation
router.get('/admin', protect, authorize('admin'), getAllReviewsAdmin);
router.patch('/:id/moderate', protect, authorize('admin'), moderateReview);
router.delete('/:id', protect, authorize('admin'), deleteReview);

export default router;
