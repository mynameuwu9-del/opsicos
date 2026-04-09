/**
 * Authentication middleware
 */

const BanList = require('../models/BanList');
const ipInfoService = require('../services/ipInfoService');

/**
 * Middleware to check if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isAuthenticated = (req, res, next) => {
  console.log('=== AUTH MIDDLEWARE CHECK ===');
  console.log('URL:', req.originalUrl);
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('Session exists:', !!req.session);
  console.log('Session data:', JSON.stringify(req.session, null, 2));

  if (req.isAuthenticated()) {
    console.log('✅ Authentication passed for:', req.originalUrl);
    return next();
  }

  console.log('❌ Authentication failed for:', req.originalUrl);

  if (req.xhr || req.headers.accept.indexOf('json') !== -1) {
    console.log('Returning 401 JSON response');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Redirecting to /login');
  res.redirect('/login');
};

/**
 * Middleware to check if user is not authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  
  res.redirect('/dashboard');
};

/**
 * Middleware to check if user is banned and logout if they are
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const checkBanned = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }
  
  try {
    // Get user's current IP
    const clientIP = ipInfoService.getClientIP(req);
    
    // Check if email or IP is banned
    const emailBan = await BanList.findOne({ 
      type: 'email', 
      value: req.user.email, 
      active: true 
    });
    
    const ipBan = await BanList.findOne({ 
      type: 'ip', 
      value: clientIP, 
      active: true 
    });
    
    if (emailBan || ipBan) {
      // Log them out immediately
      req.logout(function(err) {
        req.session.destroy();
      });
      
      const banReason = 'You are banned from Opsicos';
      
      console.log(`🚫 Banned user ${req.user.email} (${clientIP}) was automatically logged out`);
      
      // For API requests
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') !== -1)) {
        return res.status(403).json({ 
          error: 'Access Denied',
          message: banReason,
          banned: true
        });
      }
      
      // For page requests, redirect with error
      return res.redirect(`/?error=banned&reason=${encodeURIComponent(banReason)}`);
    }
    
    next();
  } catch (error) {
    console.error('Error checking ban status:', error);
    next(); // Continue even if ban check fails
  }
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  checkBanned
};
