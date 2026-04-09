const fs = require('fs').promises;
const path = require('path');
const rateLimitConfig = require('../config/rateLimits');

class DeploymentManager {
  constructor() {
    this.deploymentFile = path.join(__dirname, '../../.deployment-state.json');
    this.sessionFile = path.join(__dirname, '../../.bot-sessions.json');
    this.rateLimitFile = path.join(__dirname, '../../.rate-limits.json');
    this.isNewDeployment = false;
    this.deploymentId = null;
    this.lastDeploymentTime = null;
    
    // Use conservative limits for Render.com free tier
    this.config = rateLimitConfig.render.useConservativeLimits ? 
      { ...rateLimitConfig.deployment, ...rateLimitConfig.render.freeTeir } : 
      rateLimitConfig.deployment;
  }

  async initialize() {
    try {
      // Check if this is a new deployment
      const currentDeploymentId = process.env.RENDER_DEPLOY_ID || Date.now().toString();
      
      const previousState = await this.loadDeploymentState();
      
      if (!previousState || previousState.deploymentId !== currentDeploymentId) {
        this.isNewDeployment = true;
        this.deploymentId = currentDeploymentId;
        this.lastDeploymentTime = new Date().toISOString();
        
        console.log('🚀 NEW DEPLOYMENT DETECTED:', {
          deploymentId: currentDeploymentId,
          previousId: previousState?.deploymentId,
          time: this.lastDeploymentTime
        });
        
        await this.saveDeploymentState();
      } else {
        this.deploymentId = previousState.deploymentId;
        this.lastDeploymentTime = previousState.lastDeploymentTime;
        console.log('♻️ Existing deployment continued:', currentDeploymentId);
      }
      
      // Load rate limit info
      await this.loadRateLimits();
      
    } catch (error) {
      console.error('Error initializing deployment manager:', error);
      this.isNewDeployment = true;
      this.deploymentId = Date.now().toString();
    }
  }

  async loadDeploymentState() {
    try {
      const data = await fs.readFile(this.deploymentFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async saveDeploymentState() {
    try {
      const state = {
        deploymentId: this.deploymentId,
        lastDeploymentTime: this.lastDeploymentTime,
        timestamp: Date.now()
      };
      await fs.writeFile(this.deploymentFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Error saving deployment state:', error);
    }
  }

  async loadBotSessions() {
    try {
      const data = await fs.readFile(this.sessionFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  async saveBotSession(botId, sessionData) {
    try {
      const sessions = await this.loadBotSessions();
      sessions[botId] = {
        ...sessionData,
        savedAt: Date.now(),
        deploymentId: this.deploymentId
      };
      await fs.writeFile(this.sessionFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Error saving bot session:', error);
    }
  }

  async getBotSession(botId) {
    try {
      const sessions = await this.loadBotSessions();
      const session = sessions[botId];
      
      if (!session) return null;
      
      // Check if session is still valid using configuration
      const sessionAge = Date.now() - session.savedAt;
      const maxAge = this.config.sessionMaxAge || (24 * 60 * 60 * 1000);
      
      if (sessionAge > maxAge) {
        console.log(`⏰ Bot session expired for ${botId} (age: ${Math.floor(sessionAge / 1000 / 60)}m, max: ${Math.floor(maxAge / 1000 / 60)}m)`);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error getting bot session:', error);
      return null;
    }
  }

  async loadRateLimits() {
    try {
      const data = await fs.readFile(this.rateLimitFile, 'utf8');
      this.rateLimits = JSON.parse(data);
      
      // Check if rate limit has reset
      if (this.rateLimits.resetTime) {
        const resetTime = new Date(this.rateLimits.resetTime);
        if (Date.now() >= resetTime.getTime()) {
          console.log('✅ Discord rate limit has reset');
          this.rateLimits = {};
          await this.saveRateLimits();
        }
      }
    } catch (error) {
      this.rateLimits = {};
    }
  }

  async saveRateLimits() {
    try {
      await fs.writeFile(this.rateLimitFile, JSON.stringify(this.rateLimits, null, 2));
    } catch (error) {
      console.error('Error saving rate limits:', error);
    }
  }

  async updateRateLimit(resetTime, remainingSessions) {
    this.rateLimits = {
      resetTime: resetTime.toISOString(),
      remainingSessions,
      lastUpdated: Date.now()
    };
    await this.saveRateLimits();
  }

  async canStartBot() {
    // Check if we're rate limited
    if (this.rateLimits.resetTime) {
      const resetTime = new Date(this.rateLimits.resetTime);
      if (Date.now() < resetTime.getTime()) {
        const waitTime = resetTime.getTime() - Date.now();
        console.log(`⏳ Rate limited until ${resetTime.toISOString()} (${Math.ceil(waitTime / 1000)}s)`);
        
        if (this.rateLimits.remainingSessions > 0) {
          console.log(`✅ But we have ${this.rateLimits.remainingSessions} sessions remaining`);
          return true;
        }
        
        return false;
      }
    }
    
    return true;
  }

  getStartupDelay(index) {
    // Calculate staggered delay for bot startup
    if (!this.isNewDeployment) {
      return 0; // No delay if not a new deployment
    }
    
    // On new deployment, stagger bot startups using configuration
    const baseDelay = this.config.baseStartupDelay || 15000;
    const incrementalDelay = this.config.incrementalDelay || 10000;
    
    const delay = baseDelay + (index * incrementalDelay);
    console.log(`📊 Calculated startup delay for bot #${index + 1}: ${delay / 1000}s (base: ${baseDelay / 1000}s + ${index} × ${incrementalDelay / 1000}s)`);
    
    return delay;
  }

  async shouldReconnectBot(botId) {
    // Check if bot should reconnect after deployment
    const session = await this.getBotSession(botId);
    
    if (!session) {
      return true; // No session, should connect
    }
    
    // If this is the same deployment and bot was recently active, don't reconnect
    if (session.deploymentId === this.deploymentId && session.status === 'online') {
      const timeSinceActive = Date.now() - session.lastActive;
      const inactivityThreshold = this.config.inactivityThreshold || (5 * 60 * 1000);
      
      if (timeSinceActive < inactivityThreshold) {
        console.log(`🔄 Bot ${botId} was recently active (${Math.floor(timeSinceActive / 1000)}s ago), skipping reconnect`);
        return false;
      }
    }
    
    return true;
  }

  async markBotActive(botId, status = 'online') {
    await this.saveBotSession(botId, {
      status,
      lastActive: Date.now()
    });
  }
}

// Singleton instance
const deploymentManager = new DeploymentManager();

module.exports = deploymentManager;
