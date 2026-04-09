/**
 * Authentication middleware
 */

const BanList = require('../models/BanList');
const ipInfoService = require('../services/ipInfoService');
const logger = require('../config/logger');

/**
 * Middleware to check if user is authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') !== -1)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    const clientIP = ipInfoService.getClientIP(req);

    const [emailBan, ipBan] = await Promise.all([
      BanList.findOne({ type: 'email', value: req.user.email, active: true }),
      BanList.findOne({ type: 'ip', value: clientIP, active: true }),
    ]);

    if (emailBan || ipBan) {
      req.logout(function(err) {
        req.session.destroy();
      });

      logger.warn('Banned user auto-logged out', { email: req.user.email, ip: clientIP });

      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') !== -1)) {
        return res.status(403).json({
          error: 'Access Denied',
          message: 'You are banned from Opsicos',
          banned: true
        });
      }

      return res.redirect('/?error=banned');
    }

    next();
  } catch (error) {
    logger.error('Error checking ban status', error);
    next();
  }
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  checkBanned
};
