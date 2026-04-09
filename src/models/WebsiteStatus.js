const mongoose = require('mongoose');

const WebsiteStatusSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    default: 'https://opsicos.onrender.com'
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'degraded'],
    default: 'online'
  },
  lastCheck: {
    type: Date,
    default: Date.now
  },
  responseTime: {
    type: Number,
    default: 0
  },
  statusCode: {
    type: Number,
    default: 200
  },
  uptimeStartedAt: {
    type: Date,
    default: Date.now
  },
  totalUptime: {
    type: Number,
    default: 0
  },
  totalDowntime: {
    type: Number,
    default: 0
  },
  incidentCount: {
    type: Number,
    default: 0
  },
  lastIncident: {
    date: Date,
    duration: Number,
    reason: String,
    statusCode: Number
  },
  // Historical data for graphs
  uptimeHistory: [{
    timestamp: Date,
    status: {
      type: String,
      enum: ['online', 'offline', 'degraded']
    },
    responseTime: Number,
    statusCode: Number
  }],
  // Daily statistics
  dailyStats: [{
    date: Date,
    uptimePercentage: Number,
    avgResponseTime: Number,
    incidents: Number,
    totalDowntime: Number
  }],
  // Monthly statistics
  monthlyStats: [{
    month: Date,
    uptimePercentage: Number,
    avgResponseTime: Number,
    incidents: Number,
    totalDowntime: Number
  }],
  // Configuration
  checkInterval: {
    type: Number,
    default: 300000 // 5 minutes in milliseconds
  },
  timeout: {
    type: Number,
    default: 30000 // 30 seconds
  },
  alertsEnabled: {
    type: Boolean,
    default: true
  },
  alertThreshold: {
    type: Number,
    default: 3 // Alert after 3 consecutive failures
  }
}, { 
  timestamps: true,
  // Add indexes for better query performance
  indexes: [
    { lastCheck: -1 },
    { status: 1 },
    { 'uptimeHistory.timestamp': -1 },
    { 'dailyStats.date': -1 }
  ]
});

// Virtual for current uptime percentage
WebsiteStatusSchema.virtual('currentUptimePercentage').get(function() {
  const now = Date.now();
  const startTime = this.uptimeStartedAt ? this.uptimeStartedAt.getTime() : now;
  const totalTime = now - startTime;
  
  if (totalTime <= 0) return 100;
  
  const currentSessionUptime = this.status === 'online' ? (now - startTime) : 0;
  const totalUptime = this.totalUptime + currentSessionUptime;
  
  return Math.round((totalUptime / totalTime) * 100);
});

// Virtual for formatted uptime duration
WebsiteStatusSchema.virtual('formattedUptime').get(function() {
  const now = Date.now();
  const startTime = this.uptimeStartedAt ? this.uptimeStartedAt.getTime() : now;
  const uptime = now - startTime;
  
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 30) {
    const months = Math.floor(days / 30);
    const remainingDays = days % 30;
    return `${months}mo ${remainingDays}d ${hours}h`;
  } else if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
});

// Method to record a status check
WebsiteStatusSchema.methods.recordCheck = function(status, responseTime, statusCode) {
  const now = new Date();
  
  // Update basic fields
  this.lastCheck = now;
  this.responseTime = responseTime;
  this.statusCode = statusCode;
  
  // Handle status change
  if (this.status !== status) {
    if (this.status === 'online' && status !== 'online') {
      // Going down - record incident
      this.incidentCount += 1;
      this.lastIncident = {
        date: now,
        reason: `Status changed to ${status}`,
        statusCode: statusCode
      };
    } else if (this.status !== 'online' && status === 'online') {
      // Coming back up - calculate downtime
      if (this.lastIncident && this.lastIncident.date) {
        const downtime = now.getTime() - this.lastIncident.date.getTime();
        this.totalDowntime += downtime;
        if (this.lastIncident) {
          this.lastIncident.duration = downtime;
        }
      }
      this.uptimeStartedAt = now;
    }
    
    this.status = status;
  }
  
  // Add to history (keep last 24 hours)
  this.uptimeHistory.push({
    timestamp: now,
    status: status,
    responseTime: responseTime,
    statusCode: statusCode
  });
  
  // Keep only last 24 hours of history
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  this.uptimeHistory = this.uptimeHistory.filter(entry => entry.timestamp > oneDayAgo);
  
  return this.save();
};

// Method to get uptime statistics for a period
WebsiteStatusSchema.methods.getUptimeStats = function(hours = 24) {
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
  
  const relevantHistory = this.uptimeHistory.filter(entry => entry.timestamp >= startTime);
  
  if (relevantHistory.length === 0) {
    return {
      uptimePercentage: this.status === 'online' ? 100 : 0,
      incidents: 0,
      avgResponseTime: this.responseTime || 0,
      totalChecks: 0
    };
  }
  
  const onlineChecks = relevantHistory.filter(entry => entry.status === 'online').length;
  const uptimePercentage = Math.round((onlineChecks / relevantHistory.length) * 100);
  
  const incidents = relevantHistory.reduce((count, entry, index) => {
    if (index > 0 && entry.status !== 'online' && relevantHistory[index - 1].status === 'online') {
      return count + 1;
    }
    return count;
  }, 0);
  
  const avgResponseTime = relevantHistory
    .filter(entry => entry.responseTime > 0)
    .reduce((sum, entry, _, arr) => sum + entry.responseTime / arr.length, 0);
  
  return {
    uptimePercentage,
    incidents,
    avgResponseTime: Math.round(avgResponseTime),
    totalChecks: relevantHistory.length
  };
};

// Static method to get or create website status
WebsiteStatusSchema.statics.getWebsiteStatus = async function() {
  let status = await this.findOne({ url: 'https://opsicos.onrender.com' });
  
  if (!status) {
    status = new this({
      url: 'https://opsicos.onrender.com',
      status: 'online',
      uptimeStartedAt: new Date()
    });
    await status.save();
  }
  
  return status;
};

module.exports = mongoose.models.WebsiteStatus || mongoose.model('WebsiteStatus', WebsiteStatusSchema);
