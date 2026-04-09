const mongoose = require('mongoose');

const banListSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['email', 'ip', 'device']
  },
  value: { 
    type: String, 
    required: true 
  },
  reason: String,
  bannedBy: String,
  bannedAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

// Create unique index on type and value combination
banListSchema.index({ type: 1, value: 1 }, { unique: true });
banListSchema.index({ active: 1 });

module.exports = mongoose.model('BanList', banListSchema);
