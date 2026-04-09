const mongoose = require('mongoose');

const webhookSettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  webhookUrl: {
    type: String,
    required: true,
    validate: {
      validator: function(url) {
        return url.startsWith('https://discord.com/api/webhooks/');
      },
      message: 'Webhook URL must be a valid Discord webhook URL'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastTestDate: {
    type: Date,
    default: null
  }
});

// Update the updatedAt field before saving
webhookSettingsSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WebhookSettings', webhookSettingsSchema);
