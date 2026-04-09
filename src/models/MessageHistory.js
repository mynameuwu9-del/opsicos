const mongoose = require('mongoose');

const MessageHistorySchema = new mongoose.Schema({
  botId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bot',
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000 // Discord message limit
  },
  author: {
    id: String,
    username: String,
    displayName: String,
    avatar: String
  },
  isBot: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  attachments: [{
    id: String,
    name: String,
    url: String,
    contentType: String,
    size: Number
  }],
  embeds: [{
    title: String,
    description: String,
    url: String,
    color: Number,
    timestamp: Date
  }],
  mentions: [{
    id: String,
    username: String,
    displayName: String
  }],
  referencedMessage: {
    messageId: String,
    content: String,
    author: {
      id: String,
      username: String,
      displayName: String
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
MessageHistorySchema.index({ botId: 1, channelId: 1, timestamp: -1 });
MessageHistorySchema.index({ botId: 1, guildId: 1, timestamp: -1 });
MessageHistorySchema.index({ botId: 1, userId: 1, timestamp: -1 });

// TTL index to automatically delete old messages (optional fallback)
MessageHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days

// Static method to maintain message limit per bot per channel
MessageHistorySchema.statics.addMessage = async function(messageData, maxMessages = 50) {
  const { botId, channelId } = messageData;
  
  // Add the new message
  const newMessage = new this(messageData);
  await newMessage.save();
  
  // Count messages for this bot in this channel
  const messageCount = await this.countDocuments({ botId, channelId });
  
  // If we exceed the limit, remove the oldest messages
  if (messageCount > maxMessages) {
    const messagesToDelete = messageCount - maxMessages;
    const oldestMessages = await this.find({ botId, channelId })
      .sort({ timestamp: 1 })
      .limit(messagesToDelete)
      .select('_id');
    
    const idsToDelete = oldestMessages.map(msg => msg._id);
    await this.deleteMany({ _id: { $in: idsToDelete } });
    
    console.log(`🗑️ Deleted ${messagesToDelete} old messages for bot ${botId} in channel ${channelId}`);
  }
  
  return newMessage;
};

// Static method to get recent messages for context
MessageHistorySchema.statics.getRecentMessages = async function(botId, channelId, limit = 20) {
  return this.find({ botId, channelId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

// Static method to clear all messages for a bot
MessageHistorySchema.statics.clearBotMessages = async function(botId) {
  const result = await this.deleteMany({ botId });
  console.log(`🗑️ Cleared ${result.deletedCount} messages for bot ${botId}`);
  return result;
};

module.exports = mongoose.models.MessageHistory || mongoose.model('MessageHistory', MessageHistorySchema);
