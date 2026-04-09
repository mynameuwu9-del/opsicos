const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  sender: {
    type: String,
    default: 'Admin'
  },
  recipientType: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  specificRecipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ timestamp: -1 });
notificationSchema.index({ 'readBy.userId': 1 });

module.exports = mongoose.model('Notification', notificationSchema);
