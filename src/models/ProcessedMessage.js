const mongoose = require('mongoose');

/**
 * ProcessedMessage Schema - Prevents duplicate message responses across multiple instances
 * Uses MongoDB TTL index to auto-delete old entries after 60 seconds
 */
const processedMessageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    index: true
  },
  botId: {
    type: String,
    required: true
  },
  instanceId: {
    type: String,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for fast lookups
processedMessageSchema.index({ messageId: 1, botId: 1 }, { unique: true });

// TTL index - auto-delete entries after 60 seconds
processedMessageSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 });

/**
 * Try to acquire a lock for processing a message
 * Returns true if this instance should process, false if already being processed
 */
processedMessageSchema.statics.tryAcquireLock = async function(messageId, botId, instanceId) {
  try {
    await this.create({
      messageId,
      botId,
      instanceId,
      processedAt: new Date()
    });
    return { acquired: true };
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - message already being processed
      const existing = await this.findOne({ messageId, botId });
      return { 
        acquired: false, 
        existingInstanceId: existing?.instanceId,
        processedAt: existing?.processedAt
      };
    }
    throw error;
  }
};

/**
 * Release a lock (optional - TTL will auto-cleanup)
 */
processedMessageSchema.statics.releaseLock = async function(messageId, botId) {
  try {
    await this.deleteOne({ messageId, botId });
  } catch (error) {
    console.error('Error releasing message lock:', error);
  }
};

/**
 * Clean up old locks (emergency use - TTL should handle this automatically)
 */
processedMessageSchema.statics.cleanupOldLocks = async function() {
  try {
    const cutoff = new Date(Date.now() - 60000); // 60 seconds ago
    const result = await this.deleteMany({ processedAt: { $lt: cutoff } });
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old message locks:', error);
    return 0;
  }
};

const ProcessedMessage = mongoose.model('ProcessedMessage', processedMessageSchema);

module.exports = ProcessedMessage;
