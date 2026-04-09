const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');

// Admin authentication middleware (session-based)
const requireAdminAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Admin access required.' });
};

// User authentication middleware
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login.' });
};

/**
 * @route   POST /api/admin/notifications
 * @desc    Send a system notification (admin only)
 * @access  Admin
 */
router.post('/admin/notifications', requireAdminAuth, async (req, res) => {
  try {
    const { title, content, recipientType, specificRecipients } = req.body;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (recipientType === 'specific' && (!specificRecipients || specificRecipients.length === 0)) {
      return res.status(400).json({ error: 'Specific recipients are required when recipientType is "specific"' });
    }

    // Create notification
    const notification = new Notification({
      title,
      content,
      sender: 'Admin',
      recipientType: recipientType || 'all',
      specificRecipients: recipientType === 'specific' ? specificRecipients : []
    });

    await notification.save();

    // Emit socket event to connected users
    const io = req.app.get('io');
    if (io) {
      if (recipientType === 'all') {
        // Broadcast to all connected users
        io.emit('notification', {
          id: notification._id,
          title: notification.title,
          content: notification.content,
          timestamp: notification.timestamp
        });
      } else {
        // Emit to specific users
        specificRecipients.forEach(userId => {
          io.to(`user_${userId}`).emit('notification', {
            id: notification._id,
            title: notification.title,
            content: notification.content,
            timestamp: notification.timestamp
          });
        });
      }
    }

    res.json({
      success: true,
      notification,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find notifications where user is a recipient (all or specific)
    const notifications = await Notification.find({
      $or: [
        { recipientType: 'all' },
        { recipientType: 'specific', specificRecipients: userId }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    // Add read status for each notification
    const notificationsWithReadStatus = notifications.map(notification => ({
      ...notification,
      isRead: notification.readBy.some(read => read.userId.toString() === userId.toString())
    }));

    res.json({
      notifications: notificationsWithReadStatus
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check if already read by this user
    const alreadyRead = notification.readBy.some(
      read => read.userId.toString() === userId.toString()
    );

    if (!alreadyRead) {
      notification.readBy.push({
        userId,
        readAt: new Date()
      });
      await notification.save();
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all notifications for this user
    const notifications = await Notification.find({
      $or: [
        { recipientType: 'all' },
        { recipientType: 'specific', specificRecipients: userId }
      ]
    }).lean();

    // Count unread notifications
    const unreadCount = notifications.filter(notification =>
      !notification.readBy.some(read => read.userId.toString() === userId.toString())
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * @route   GET /api/admin/notifications/history
 * @desc    Get all sent notifications (admin only)
 * @access  Admin
 */
router.get('/admin/notifications/history', requireAdminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('specificRecipients', 'name email')
      .lean();

    // Add statistics
    const notificationsWithStats = notifications.map(notification => ({
      ...notification,
      totalRecipients: notification.recipientType === 'all' ? 'All Users' : notification.specificRecipients.length,
      readCount: notification.readBy.length
    }));

    res.json({
      notifications: notificationsWithStats
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

/**
 * @route   DELETE /api/admin/notifications/:id
 * @desc    Delete a notification (admin only)
 * @access  Admin
 */
router.delete('/admin/notifications/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
