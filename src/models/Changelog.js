const mongoose = require('mongoose');

const changelogSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  updates: [{
    type: String,
    required: true
  }],
  type: {
    type: String,
    enum: ['feature', 'bugfix', 'improvement', 'security'],
    default: 'feature'
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  publishedBy: {
    type: String,
    default: 'Admin'
  },
  discordMessageSent: {
    type: Boolean,
    default: false
  },
  discordMessageIds: [{
    type: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
changelogSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('Changelog', changelogSchema);
