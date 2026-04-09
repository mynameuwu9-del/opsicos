const mongoose = require('mongoose');

const KnowledgeSchema = new mongoose.Schema({
  botId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bot',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
KnowledgeSchema.index({ botId: 1, isActive: 1 });
KnowledgeSchema.index({ userId: 1, botId: 1 });

// Update the updatedAt field before saving
KnowledgeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for character count
KnowledgeSchema.virtual('characterCount').get(function() {
  return this.content ? this.content.length : 0;
});

module.exports = mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema);
