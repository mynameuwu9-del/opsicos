const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  email: String,
  ip: String,
  vpn: { type: Boolean, default: false },
  vpnInfo: String,
  isp: String,
  city: String,
  country: String,
  countryCode: String,
  deviceModel: String,
  deviceType: String,
  deviceBrand: String,
  os: String,
  browser: String,
  loginTime: { type: Date, default: Date.now },
  banned: { type: Boolean, default: false },
  banType: String, // 'ip', 'email', 'device'
  banReason: String,
  // Enhanced security fields
  deviceFingerprint: String,
  securityViolations: [{
    type: String, // 'VPN', 'MULTIPLE_IP_ACCOUNTS', 'MULTIPLE_DEVICE_ACCOUNTS'
    message: String,
    severity: String, // 'LOW', 'MEDIUM', 'HIGH'
    conflictingUsers: [String]
  }],
  blocked: { type: Boolean, default: false },
  blockReason: String,
  proxy: { type: Boolean, default: false },
  hosting: { type: Boolean, default: false }
});

// Index for efficient searching
loginLogSchema.index({ email: 1 });
loginLogSchema.index({ ip: 1 });
loginLogSchema.index({ loginTime: -1 });
loginLogSchema.index({ userId: 1 });
loginLogSchema.index({ deviceFingerprint: 1 });
loginLogSchema.index({ blocked: 1 });
loginLogSchema.index({ 'securityViolations.type': 1 });

module.exports = mongoose.model('LoginLog', loginLogSchema);
