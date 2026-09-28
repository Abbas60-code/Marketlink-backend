import express from 'express';
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  createAnnouncement,
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getMyNotifications);
router.patch('/read-all', protect, markAllAsRead);
router.patch('/:id/read', protect, markAsRead);
router.post('/announcement', protect, authorize('admin'), createAnnouncement);

export default router;
