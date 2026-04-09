const mongoose = require('mongoose');

const maintenanceModeSchema = new mongoose.Schema({
  enabled: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: 'We are currently performing scheduled maintenance to improve your experience.'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  estimatedEndTime: {
    type: Date,
    default: null
  },
  enabledBy: {
    type: String,
    default: 'Administrator'
  },
  reason: {
    type: String,
    default: 'Scheduled maintenance'
  }
}, {
  timestamps: true
});

// Ensure only one maintenance mode document exists
maintenanceModeSchema.statics.getInstance = async function() {
  let instance = await this.findOne();
  if (!instance) {
    instance = await this.create({});
  }
  return instance;
};

maintenanceModeSchema.statics.enable = async function(options = {}) {
  const instance = await this.getInstance();
  instance.enabled = true;
  instance.message = options.message || instance.message;
  instance.startTime = new Date();
  instance.estimatedEndTime = options.estimatedEndTime || null;
  instance.enabledBy = options.enabledBy || 'Administrator';
  instance.reason = options.reason || 'Scheduled maintenance';
  await instance.save();
  
  // Stop all bots during maintenance
  try {
    const discordBotService = require('../services/discordBotService');
    console.log('🛑 Maintenance mode enabled - stopping all Discord bots...');
    const stopResult = await discordBotService.stopAllBots();
    console.log('✅ All bots stopped for maintenance:', stopResult);
  } catch (error) {
    console.error('❌ Error stopping bots during maintenance:', error.message);
    // Don't fail maintenance mode if bot stopping fails
  }
  
  return instance;
};

maintenanceModeSchema.statics.disable = async function() {
  const instance = await this.getInstance();
  instance.enabled = false;
  await instance.save();
  
  // Restart all bots that should be running after maintenance
  try {
    const discordBotService = require('../services/discordBotService');
    console.log('🚀 Maintenance mode disabled - restarting Discord bots...');
    
    // Start all bots that were previously set to auto-restart
    const startResult = await discordBotService.startAllBots();
    console.log('✅ All bots restarted after maintenance:', startResult);
  } catch (error) {
    console.error('❌ Error restarting bots after maintenance:', error.message);
    // Don't fail maintenance disable if bot starting fails
  }
  
  return instance;
};

maintenanceModeSchema.statics.isEnabled = async function() {
  const instance = await this.getInstance();
  return instance.enabled;
};

module.exports = mongoose.model('MaintenanceMode', maintenanceModeSchema);
