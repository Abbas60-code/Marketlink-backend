import express from 'express';
import {
  getAdminDashboardStats,
  getAdminCustomers,
  updateCustomerStatus,
  updateProductStatus,
  getAdminReports,
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard-stats', protect, authorize('admin'), getAdminDashboardStats);
router.get('/customers', protect, authorize('admin'), getAdminCustomers);
router.patch('/customers/:id/status', protect, authorize('admin'), updateCustomerStatus);
router.patch('/products/:id/status', protect, authorize('admin'), updateProductStatus);
router.get('/reports', protect, authorize('admin'), getAdminReports);

export default router;
