import Notification from '../models/notificationModel.js';
import User from '../models/userModel.js';

// Helper function to create notification
export const createNotificationHelper = async ({ recipient, title, message, type = 'order_status', link = '', metadata = {} }) => {
  try {
    return await Notification.create({ recipient, title, message, type, link, metadata });
  } catch (err) {
    console.error('Create notification helper failed:', err.message);
  }
};

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ success: true, count: notifications.length, unreadCount, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create platform announcement / broadcast notification (Admin)
// @route   POST /api/notifications/announcement
// @access  Private/Admin
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRole } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    let userQuery = {};
    if (targetRole && ['user', 'farmer'].includes(targetRole)) {
      userQuery.role = targetRole;
    }

    const recipients = await User.find(userQuery).select('_id');
    const notificationDocs = recipients.map((u) => ({
      recipient: u._id,
      title,
      message,
      type: 'announcement',
    }));

    if (notificationDocs.length > 0) {
      await Notification.insertMany(notificationDocs);
    }

    res.json({ success: true, message: `Announcement broadcasted to ${notificationDocs.length} users.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
