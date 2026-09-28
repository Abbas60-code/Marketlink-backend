import express from 'express';
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  reorderOrder,
  getFarmerOrders,
  updateOrderStatus,
  getFarmerStats,
  getAllOrders,
  getOrderStats,
  createPaymentIntent,
} from '../controllers/orderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer routes
router.post('/create-payment-intent', protect, createPaymentIntent);
router.post('/', protect, placeOrder);
router.get('/my-orders', protect, getMyOrders);
router.post('/:id/reorder', protect, reorderOrder);
router.patch('/:id/cancel', protect, cancelOrder);

// Farmer routes
router.get('/farmer-orders', protect, authorize('farmer', 'admin'), getFarmerOrders);
router.get('/farmer-stats', protect, authorize('farmer', 'admin'), getFarmerStats);

// Status update (Farmer or Admin)
router.patch('/:id/status', protect, authorize('farmer', 'admin'), updateOrderStatus);

// Admin routes
router.get('/', protect, authorize('admin'), getAllOrders);
router.get('/stats', protect, authorize('admin'), getOrderStats);

// Single order view (Customer own, Farmer of order, or Admin)
router.get('/:id', protect, getOrderById);

export default router;
