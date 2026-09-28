import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  sendAIMessage,
  getAIHistory,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  getAdminConversations,
  updateConversationStatus,
} from '../controllers/chatController.js';

const router = express.Router();

// Rate limiter for AI endpoint
const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optional auth middleware — attaches req.user if token is present, but doesn't block if not
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = (await import('jsonwebtoken')).default;
      const User = (await import('../models/userModel.js')).default;
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'techwiz_secret');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (_) {
      // Token invalid — continue as guest
    }
  }
  next();
};

// -----------------------------
// AI Chatbot Routes (PUBLIC — no login required)
// -----------------------------
router.post('/ai', aiRateLimiter, optionalAuth, sendAIMessage);
router.get('/ai/history', protect, getAIHistory);

// -----------------------------
// Live Chat Routes (Login required)
// -----------------------------
router.post('/conversations', protect, getOrCreateConversation);
router.get('/conversations', protect, getOrCreateConversation);
router.get('/conversations/:id/messages', protect, getMessages);
router.post('/conversations/:id/messages', protect, sendMessage);

// -----------------------------
// Admin Only
// -----------------------------
router.get('/admin/conversations', protect, authorize('admin'), getAdminConversations);
router.patch('/admin/conversations/:id/status', protect, authorize('admin'), updateConversationStatus);

export default router;

