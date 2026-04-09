const mongoose = require('mongoose');

const BotProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  botName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  personality: {
    type: String,
    enum: ['', 'friendly', 'professional', 'chill', 'enthusiastic', 'sarcastic', 'helpful', 'witty', 'serious', 'playful', 'rude'],
    default: ''
  },
  tone: {
    type: String,
    enum: ['', 'casual', 'formal', 'confident', 'humble', 'energetic', 'calm', 'direct', 'diplomatic', 'quirky', 'authoritative'],
    default: ''
  },
  messageHistoryLimit: {
    type: Number,
    enum: [20, 50, 80, 100, 150, 200],
    default: 50
  },
  replyToDMs: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    enum: ['english', 'hindi', 'french', 'spanish', 'chinese', 'russian', 'japanese', 'filipino', 'bangla', 'polish'],
    default: 'english'
  },
  sentenceLength: {
    type: String,
    enum: ['1', '2', '3', '4', 'long'],
    default: 'long'
  },
  sentenceLengthDynamic: {
    type: Boolean,
    default: false
  },
  knowledgeEntries: [{
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
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastUsedAt: {
    type: Date,
    default: Date.now
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

// Compound index for efficient lookups
BotProfileSchema.index({ userId: 1, botName: 1 });

// Update lastUsedAt when profile is accessed
BotProfileSchema.methods.touch = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

module.exports = mongoose.models.BotProfile || mongoose.model('BotProfile', BotProfileSchema);
