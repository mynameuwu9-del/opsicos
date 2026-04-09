const mongoose = require('mongoose');

/**
 * InstanceLock Schema - Prevents duplicate app instances in cPanel
 * This provides a database-based lock that persists across process restarts
 */
const instanceLockSchema = new mongoose.Schema({
  lockId: {
    type: String,
    required: true,
    unique: true,
    default: 'main-instance'
  },
  pid: {
    type: Number,
    required: true
  },
  instanceId: {
    type: String,
    required: true
  },
  hostname: {
    type: String,
    default: () => require('os').hostname()
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  nodeVersion: {
    type: String,
    default: () => process.version
  },
  platform: {
    type: String,
    default: () => process.platform
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
instanceLockSchema.index({ lockId: 1, isActive: 1 });
instanceLockSchema.index({ lastHeartbeat: 1 });

// TTL index to auto-delete stale locks after 5 minutes of no heartbeat
instanceLockSchema.index({ lastHeartbeat: 1 }, { expireAfterSeconds: 300 });

/**
 * Static method to acquire instance lock
 */
instanceLockSchema.statics.acquireLock = async function(pid, instanceId) {
  try {
    // First, check if there's an active lock
    const existingLock = await this.findOne({ 
      lockId: 'main-instance',
      isActive: true,
      lastHeartbeat: { $gte: new Date(Date.now() - 60000) } // Active within last minute
    });

    if (existingLock && existingLock.pid !== pid) {
      // Check if the process is actually running
      try {
        process.kill(existingLock.pid, 0);
        // Process exists, cannot acquire lock
        return { success: false, existingLock };
      } catch (err) {
        // Process doesn't exist, clean up stale lock
        await this.deleteOne({ _id: existingLock._id });
      }
    }

    // Try to create or update the lock
    const lock = await this.findOneAndUpdate(
      { lockId: 'main-instance' },
      {
        pid,
        instanceId,
        hostname: require('os').hostname(),
        startTime: new Date(),
        lastHeartbeat: new Date(),
        nodeVersion: process.version,
        platform: process.platform,
        isActive: true
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    return { success: true, lock };
  } catch (error) {
    console.error('Error acquiring database lock:', error);
    return { success: false, error };
  }
};

/**
 * Static method to release instance lock
 */
instanceLockSchema.statics.releaseLock = async function(pid) {
  try {
    const result = await this.findOneAndUpdate(
      { lockId: 'main-instance', pid },
      { isActive: false },
      { new: true }
    );
    return result;
  } catch (error) {
    console.error('Error releasing database lock:', error);
    return null;
  }
};

/**
 * Static method to update heartbeat
 */
instanceLockSchema.statics.updateHeartbeat = async function(pid) {
  try {
    const result = await this.findOneAndUpdate(
      { lockId: 'main-instance', pid, isActive: true },
      { lastHeartbeat: new Date() },
      { new: true }
    );
    return result;
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    return null;
  }
};

/**
 * Static method to force clear all locks (emergency use)
 */
instanceLockSchema.statics.forceReleaseAllLocks = async function() {
  try {
    const result = await this.deleteMany({});
    return result;
  } catch (error) {
    console.error('Error force releasing all locks:', error);
    return null;
  }
};

const InstanceLock = mongoose.model('InstanceLock', instanceLockSchema);

module.exports = InstanceLock;
