/**
 * Security Service for advanced user tracking and restrictions
 */

const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const crypto = require('crypto');

class SecurityService {
  /**
   * Generate enhanced device fingerprint
   */
  static generateDeviceFingerprint(req) {
    const userAgent = req.get('user-agent') || '';
    const acceptLanguage = req.get('accept-language') || '';
    const acceptEncoding = req.get('accept-encoding') || '';
    const acceptCharset = req.get('accept-charset') || '';
    const dnt = req.get('dnt') || '';
    
    // Create a more comprehensive fingerprint
    const fingerprintData = {
      userAgent,
      acceptLanguage,
      acceptEncoding,
      acceptCharset,
      dnt,
      // Add more headers for better fingerprinting
      connection: req.get('connection') || '',
      cacheControl: req.get('cache-control') || '',
      upgradeInsecureRequests: req.get('upgrade-insecure-requests') || '',
      secFetchSite: req.get('sec-fetch-site') || '',
      secFetchMode: req.get('sec-fetch-mode') || '',
      secFetchUser: req.get('sec-fetch-user') || '',
      secFetchDest: req.get('sec-fetch-dest') || ''
    };

    // Create hash of fingerprint data
    const fingerprintString = JSON.stringify(fingerprintData);
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  /**
   * Check if IP has multiple accounts
   */
  static async checkIPRestriction(ip, currentUserEmail = null) {
    try {
      // Find all unique users who have logged in from this IP
      const logsFromIP = await LoginLog.find({ ip }).distinct('email');
      
      // Filter out current user if provided
      const otherUsers = currentUserEmail 
        ? logsFromIP.filter(email => email !== currentUserEmail)
        : logsFromIP;

      return {
        isViolation: otherUsers.length > 0,
        userCount: otherUsers.length,
        users: otherUsers,
        message: otherUsers.length > 0 
          ? `This IP address is already used by ${otherUsers.length} other account(s)`
          : null
      };
    } catch (error) {
      console.error('Error checking IP restriction:', error);
      return { isViolation: false, userCount: 0, users: [] };
    }
  }

  /**
   * Check if device has multiple accounts
   */
  static async checkDeviceRestriction(deviceFingerprint, currentUserEmail = null) {
    try {
      // Find all unique users who have logged in from this device
      const logsFromDevice = await LoginLog.find({ deviceFingerprint }).distinct('email');
      
      // Filter out current user if provided
      const otherUsers = currentUserEmail 
        ? logsFromDevice.filter(email => email !== currentUserEmail)
        : logsFromDevice;

      return {
        isViolation: otherUsers.length > 0,
        userCount: otherUsers.length,
        users: otherUsers,
        message: otherUsers.length > 0 
          ? `This device is already used by ${otherUsers.length} other account(s)`
          : null
      };
    } catch (error) {
      console.error('Error checking device restriction:', error);
      return { isViolation: false, userCount: 0, users: [] };
    }
  }

  /**
   * Check if VPN is being used
   */
  static checkVPNRestriction(ipInfo) {
    console.log('🔍 VPN Check - IP Info:', JSON.stringify(ipInfo, null, 2));
    console.log('🔍 VPN Check - vpn:', ipInfo.vpn, 'proxy:', ipInfo.proxy, 'hosting:', ipInfo.hosting);

    // Check multiple VPN indicators
    const isVPN = ipInfo.vpn || ipInfo.proxy || ipInfo.hosting;
    const isVPNByISP = ipInfo.isp && this.checkVPNByISP(ipInfo.isp);
    const isVPNByCountry = this.checkSuspiciousLocation(ipInfo);

    console.log('🔍 VPN indicators - isVPN:', isVPN, 'isVPNByISP:', isVPNByISP, 'isVPNByCountry:', isVPNByCountry);

    if (isVPN || isVPNByISP || isVPNByCountry) {
      const violation = {
        isViolation: true,
        message: 'login with vpn is not allowed',
        type: isVPN ? 'VPN' : isVPNByISP ? 'VPN_ISP' : 'VPN_LOCATION'
      };
      console.log('🚫 VPN VIOLATION DETECTED:', violation);
      return violation;
    }
    console.log('✅ No VPN detected');
    return { isViolation: false };
  }

  /**
   * Check if ISP name indicates VPN/Proxy
   */
  static checkVPNByISP(isp) {
    const vpnKeywords = [
      'vpn', 'proxy', 'hosting', 'server', 'cloud', 'datacenter',
      'digital ocean', 'amazon', 'google cloud', 'microsoft azure',
      'linode', 'vultr', 'ovh', 'hetzner', 'contabo', 'nordvpn',
      'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
      'protonvpn', 'tunnelbear', 'windscribe', 'hotspot shield'
    ];

    const ispLower = isp.toLowerCase();
    return vpnKeywords.some(keyword => ispLower.includes(keyword));
  }

  /**
   * Check for suspicious VPN locations
   */
  static checkSuspiciousLocation(ipInfo) {
    // Common VPN server locations that are often used for bypassing restrictions
    const suspiciousCountries = ['AR', 'BE']; // Add more as needed

    // For now, let's be more aggressive and block these specific countries that appeared in your logs
    if (suspiciousCountries.includes(ipInfo.countryCode)) {
      console.log('🔍 Suspicious country detected:', ipInfo.countryCode, ipInfo.country);
      return true;
    }

    return false;
  }

  /**
   * Comprehensive security check for login
   */
  static async performSecurityCheck(req, user) {
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    
    // Get IP info (assuming this is available from ipInfoService)
    const ipInfoService = require('./ipInfoService');
    const ipInfo = await ipInfoService.getIPInfo(clientIP);

    const results = {
      ip: clientIP,
      deviceFingerprint,
      violations: [],
      isBlocked: false,
      user: user.email
    };

    // Check VPN restriction
    console.log('🔍 Starting VPN check for IP:', clientIP);
    const vpnCheck = this.checkVPNRestriction(ipInfo);
    console.log('🔍 VPN check result:', vpnCheck);

    if (vpnCheck.isViolation) {
      const violation = {
        type: 'VPN',
        message: vpnCheck.message,
        severity: 'HIGH'
      };
      results.violations.push(violation);
      results.isBlocked = true;
      console.log('🚫 VPN violation added to results:', violation);
    }

    // Check IP restriction
    const ipCheck = await this.checkIPRestriction(clientIP, user.email);
    if (ipCheck.isViolation) {
      results.violations.push({
        type: 'MULTIPLE_IP_ACCOUNTS',
        message: ipCheck.message,
        severity: 'HIGH',
        conflictingUsers: ipCheck.users
      });
      results.isBlocked = true;
    }

    // Check device restriction
    const deviceCheck = await this.checkDeviceRestriction(deviceFingerprint, user.email);
    if (deviceCheck.isViolation) {
      results.violations.push({
        type: 'MULTIPLE_DEVICE_ACCOUNTS',
        message: deviceCheck.message,
        severity: 'HIGH',
        conflictingUsers: deviceCheck.users
      });
      results.isBlocked = true;
    }

    return results;
  }

  /**
   * Get users sharing same IP
   */
  static async getUsersBySameIP(ip) {
    try {
      const logs = await LoginLog.find({ ip })
        .populate('userId', 'name email')
        .sort({ loginTime: -1 });

      const userMap = new Map();
      logs.forEach(log => {
        if (log.userId && !userMap.has(log.email)) {
          userMap.set(log.email, {
            user: log.userId,
            lastLogin: log.loginTime,
            loginCount: 1,
            ip: log.ip,
            location: `${log.city || 'Unknown'}, ${log.country || 'Unknown'}`
          });
        } else if (log.userId && userMap.has(log.email)) {
          userMap.get(log.email).loginCount++;
        }
      });

      return Array.from(userMap.values());
    } catch (error) {
      console.error('Error getting users by same IP:', error);
      return [];
    }
  }

  /**
   * Get users sharing same device
   */
  static async getUsersBySameDevice(deviceFingerprint) {
    try {
      const logs = await LoginLog.find({ deviceFingerprint })
        .populate('userId', 'name email')
        .sort({ loginTime: -1 });

      const userMap = new Map();
      logs.forEach(log => {
        if (log.userId && !userMap.has(log.email)) {
          userMap.set(log.email, {
            user: log.userId,
            lastLogin: log.loginTime,
            loginCount: 1,
            deviceFingerprint: log.deviceFingerprint,
            deviceInfo: `${log.deviceType || 'Unknown'} - ${log.deviceModel || 'Unknown'}`
          });
        } else if (log.userId && userMap.has(log.email)) {
          userMap.get(log.email).loginCount++;
        }
      });

      return Array.from(userMap.values());
    } catch (error) {
      console.error('Error getting users by same device:', error);
      return [];
    }
  }

  /**
   * Log security violation
   */
  static async logSecurityViolation(req, user, violations) {
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
      const deviceFingerprint = this.generateDeviceFingerprint(req);
      const ipInfoService = require('./ipInfoService');
      const ipInfo = await ipInfoService.getIPInfo(clientIP);
      const deviceInfo = ipInfoService.getDeviceInfo(req);

      const loginLog = new LoginLog({
        userId: user._id,
        email: user.email,
        ip: clientIP,
        deviceFingerprint,
        ...ipInfo,
        ...deviceInfo,
        securityViolations: violations,
        blocked: true,
        blockReason: violations.map(v => v.message).join('; ')
      });

      await loginLog.save();
      console.log(`🚫 Security violation logged for user: ${user.email} - ${violations.map(v => v.type).join(', ')}`);
    } catch (error) {
      console.error('Error logging security violation:', error);
    }
  }
}

module.exports = SecurityService;
