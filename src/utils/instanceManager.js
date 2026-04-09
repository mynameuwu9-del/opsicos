const fs = require('fs');
const path = require('path');

/**
 * Instance Manager to prevent duplicate bot instances in cPanel/Passenger environment
 * This uses both PID-based lock files and database locks for maximum reliability
 *
 * 🔒 RACE CONDITION FIX: Uses atomic file operations (fs.openSync with 'wx' flag)
 * to prevent the critical race condition where multiple instances could acquire
 * the same lock simultaneously during the check-then-write window.
 */
class InstanceManager {
  constructor() {
    // Store PID file in a persistent location that survives restarts
    this.pidFilePath = path.join(__dirname, '../../.discord-bot.pid');
    this.lockFilePath = path.join(__dirname, '../../.discord-bot.lock');
    this.instanceId = `${process.pid}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.isMainInstance = false;
    this.dbLock = null;
    this.heartbeatInterval = null;
  }

  /**
   * Check if another instance is already running
   * @returns {boolean} True if another instance is running
   */
  isAnotherInstanceRunning() {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const storedPid = fs.readFileSync(this.pidFilePath, 'utf8').trim();
        
        // Check if the process with stored PID is actually running
        try {
          // Sending signal 0 to check if process exists
          process.kill(parseInt(storedPid), 0);
          console.log(`⚠️ Another instance is already running with PID: ${storedPid}`);
          return true;
        } catch (err) {
          // Process doesn't exist, clean up stale PID file
          console.log(`🧹 Cleaning up stale PID file from non-existent process: ${storedPid}`);
          fs.unlinkSync(this.pidFilePath);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking for existing instance:', error);
      return false;
    }
  }

  /**
   * Try to acquire exclusive lock for this instance
   * @param {boolean} useDatabase - Whether to also use database locking
   * @returns {boolean} True if lock acquired successfully
   */
  async acquireLock(useDatabase = false) {
    try {
      // 🔒 ATOMIC LOCK ACQUISITION: Use exclusive file creation to prevent race conditions
      // This fixes the critical race condition between check and write operations
      let lockFileHandle;

      try {
        // Try to create PID file exclusively (fails if file already exists)
        lockFileHandle = fs.openSync(this.pidFilePath, 'wx');

        // If we get here, we successfully created the file exclusively
        fs.writeSync(lockFileHandle, process.pid.toString());
        fs.closeSync(lockFileHandle);

        console.log(`🔒 Atomic lock acquired for PID: ${process.pid}`);

      } catch (fileError) {
        // File already exists, check if the process is still running
        if (fileError.code === 'EEXIST') {
          console.log('🔍 Lock file exists, checking if process is still alive...');

          if (this.isAnotherInstanceRunning()) {
            console.log('❌ Cannot acquire lock: Another instance is already running');
            return false;
          }

          // Process is dead, clean up and try again
          console.log('🧹 Previous process is dead, cleaning up and retrying...');
          try {
            fs.unlinkSync(this.pidFilePath);
            if (fs.existsSync(this.lockFilePath)) {
              fs.unlinkSync(this.lockFilePath);
            }
          } catch (cleanupError) {
            console.error('Error cleaning up stale lock files:', cleanupError);
          }

          // Retry atomic lock acquisition
          try {
            lockFileHandle = fs.openSync(this.pidFilePath, 'wx');
            fs.writeSync(lockFileHandle, process.pid.toString());
            fs.closeSync(lockFileHandle);
            console.log(`🔒 Atomic lock acquired after cleanup for PID: ${process.pid}`);
          } catch (retryError) {
            console.error('Failed to acquire lock after cleanup:', retryError);
            return false;
          }
        } else {
          console.error('Unexpected error during atomic lock acquisition:', fileError);
          return false;
        }
      }

      // Create detailed lock file with more info
      const lockInfo = {
        pid: process.pid,
        instanceId: this.instanceId,
        startTime: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        lockMethod: 'atomic-exclusive'
      };

      fs.writeFileSync(this.lockFilePath, JSON.stringify(lockInfo, null, 2), { flag: 'w' });
      
      // Try to acquire database lock if requested
      if (useDatabase) {
        try {
          const InstanceLock = require('../models/InstanceLock');
          const dbLockResult = await InstanceLock.acquireLock(process.pid, this.instanceId);
          
          if (!dbLockResult.success) {
            console.log('❌ Database lock acquisition failed');
            if (dbLockResult.existingLock) {
              console.log('Existing database lock:', {
                pid: dbLockResult.existingLock.pid,
                instanceId: dbLockResult.existingLock.instanceId,
                lastHeartbeat: dbLockResult.existingLock.lastHeartbeat
              });
            }
            // Clean up file locks since we couldn't get database lock
            fs.unlinkSync(this.pidFilePath);
            fs.unlinkSync(this.lockFilePath);
            return false;
          }
          
          this.dbLock = dbLockResult.lock;
          console.log('✅ Database lock acquired');
          
          // Start heartbeat to keep database lock alive
          this.startHeartbeat();
        } catch (dbError) {
          console.error('Database lock error:', dbError.message);
          // Continue with file-based lock only
        }
      }
      
      this.isMainInstance = true;
      console.log(`✅ Lock acquired for instance ${this.instanceId} (PID: ${process.pid})`);
      
      // Set up cleanup handlers
      this.setupCleanupHandlers();
      
      return true;
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Release the lock held by this instance
   */
  async releaseLock() {
    try {
      if (this.isMainInstance) {
        // Stop heartbeat
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
          this.heartbeatInterval = null;
        }
        
        // Release database lock
        if (this.dbLock) {
          try {
            const InstanceLock = require('../models/InstanceLock');
            await InstanceLock.releaseLock(process.pid);
            console.log('🔓 Database lock released');
          } catch (dbError) {
            console.error('Error releasing database lock:', dbError);
          }
        }
        
        // Release file locks
        if (fs.existsSync(this.pidFilePath)) {
          const storedPid = fs.readFileSync(this.pidFilePath, 'utf8').trim();
          
          // Only remove if it's our PID
          if (storedPid === process.pid.toString()) {
            fs.unlinkSync(this.pidFilePath);
            console.log(`🔓 File lock released for PID: ${process.pid}`);
          }
        }
        
        if (fs.existsSync(this.lockFilePath)) {
          fs.unlinkSync(this.lockFilePath);
        }
        
        this.isMainInstance = false;
      }
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  /**
   * Force kill any existing instance (use with caution)
   * Enhanced with better process verification and atomic cleanup
   */
  async forceKillExistingInstance() {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const storedPid = parseInt(fs.readFileSync(this.pidFilePath, 'utf8').trim());

        // Validate PID is reasonable (not 0, not our own PID)
        if (!storedPid || storedPid === process.pid || storedPid <= 0) {
          console.log(`🧹 Invalid PID in lock file: ${storedPid}, cleaning up...`);
          fs.unlinkSync(this.pidFilePath);
          if (fs.existsSync(this.lockFilePath)) {
            fs.unlinkSync(this.lockFilePath);
          }
          return;
        }

        try {
          console.log(`⚠️ Force killing existing instance with PID: ${storedPid}`);
          process.kill(storedPid, 'SIGTERM');

          // Wait longer for graceful shutdown (increased from 2s to 4s)
          await new Promise(resolve => setTimeout(resolve, 4000));

          // Verify if process is still running
          let processStillRunning = false;
          try {
            process.kill(storedPid, 0); // Check if still running
            processStillRunning = true;
          } catch (err) {
            // Process is gone
            processStillRunning = false;
          }

          if (processStillRunning) {
            console.log(`💀 Process ${storedPid} still running, using SIGKILL...`);
            try {
              process.kill(storedPid, 'SIGKILL');
              // Wait a bit more for SIGKILL to take effect
              await new Promise(resolve => setTimeout(resolve, 2000));
              console.log(`💀 SIGKILL sent to PID: ${storedPid}`);
            } catch (killError) {
              console.log(`Process ${storedPid} could not be killed:`, killError.message);
            }
          } else {
            console.log(`✅ Process ${storedPid} terminated gracefully`);
          }
        } catch (err) {
          console.log(`Process ${storedPid} was already dead:`, err.message);
        }

        // 🔒 ATOMIC CLEANUP: Always clean up lock files after force kill
        try {
          if (fs.existsSync(this.pidFilePath)) {
            fs.unlinkSync(this.pidFilePath);
          }
          if (fs.existsSync(this.lockFilePath)) {
            fs.unlinkSync(this.lockFilePath);
          }
          console.log(`🧹 Lock files cleaned up after force kill`);
        } catch (cleanupError) {
          console.error('Error cleaning up lock files after force kill:', cleanupError);
        }
      } else {
        console.log('ℹ️ No existing lock file found during force kill');
      }
    } catch (error) {
      console.error('Error force killing existing instance:', error);
    }
  }

  /**
   * Set up cleanup handlers to release lock on exit
   */
  setupCleanupHandlers() {
    const cleanup = (signal) => {
      console.log(`\n🛑 ${signal} received: Releasing instance lock...`);
      this.releaseLock();
    };

    // Handle various termination signals
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGHUP', () => cleanup('SIGHUP'));
    process.on('exit', () => cleanup('exit'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.releaseLock();
    });
  }

  /**
   * Get information about the currently running instance
   */
  getCurrentInstanceInfo() {
    try {
      if (fs.existsSync(this.lockFilePath)) {
        const lockInfo = JSON.parse(fs.readFileSync(this.lockFilePath, 'utf8'));
        return lockInfo;
      }
      return null;
    } catch (error) {
      console.error('Error reading lock info:', error);
      return null;
    }
  }

  /**
   * Start heartbeat to keep database lock alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Update heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(async () => {
      if (this.dbLock) {
        try {
          const InstanceLock = require('../models/InstanceLock');
          await InstanceLock.updateHeartbeat(process.pid);
        } catch (error) {
          console.error('Error updating heartbeat:', error);
        }
      }
    }, 30000);
  }

  /**
   * Verify that our lock is still valid (prevents lock hijacking)
   * @returns {boolean} True if our lock is still valid
   */
  verifyLockOwnership() {
    try {
      if (!this.isMainInstance) {
        return false;
      }

      // Check if PID file still exists and contains our PID
      if (fs.existsSync(this.pidFilePath)) {
        const storedPid = fs.readFileSync(this.pidFilePath, 'utf8').trim();
        if (storedPid === process.pid.toString()) {
          return true;
        } else {
          console.warn(`⚠️ Lock hijacked! Expected PID ${process.pid}, found ${storedPid}`);
          this.isMainInstance = false;
          return false;
        }
      } else {
        console.warn(`⚠️ Lock file disappeared! Expected at ${this.pidFilePath}`);
        this.isMainInstance = false;
        return false;
      }
    } catch (error) {
      console.error('Error verifying lock ownership:', error);
      return false;
    }
  }

  /**
   * Force clear all locks (emergency use)
   */
  async forceClearAllLocks() {
    try {
      console.log('🔥 Force clearing all instance locks...');
      
      // Clear database locks
      try {
        const InstanceLock = require('../models/InstanceLock');
        await InstanceLock.forceReleaseAllLocks();
        console.log('✅ Database locks cleared');
      } catch (dbError) {
        console.error('Error clearing database locks:', dbError);
      }
      
      // Clear file locks
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
      }
      if (fs.existsSync(this.lockFilePath)) {
        fs.unlinkSync(this.lockFilePath);
      }
      
      console.log('✅ All locks force cleared');
    } catch (error) {
      console.error('Error force clearing locks:', error);
    }
  }

  /**
   * Check if this is the main instance
   */
  isMain() {
    return this.isMainInstance;
  }
}

module.exports = new InstanceManager();
