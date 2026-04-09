const express = require('express');
const passport = require('../config/passport');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const LoginLog = require('../models/LoginLog');
const BanList = require('../models/BanList');
const ipInfoService = require('../services/ipInfoService');
const SecurityService = require('../services/securityService');

// Store logs in memory instead of file
let debugLogs = [];

function logToMemory(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}`;

  debugLogs.push(logMessage);

  // Keep only last 100 logs to prevent memory issues
  if (debugLogs.length > 100) {
    debugLogs = debugLogs.slice(-100);
  }

  console.log(logMessage);
}

/**
 * @route   GET /auth/test
 * @desc    Test authentication setup
 * @access  Public
 */
router.get('/test', (req, res) => {
  const passport = require('passport');
  const strategy = passport._strategy('discord');
  
  res.json({
    message: 'Discord OAuth Test',
    currentURL: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    expectedCallbackURL: `${req.protocol}://${req.get('host')}/auth/discord/callback`,
    configuredCallbackURL: strategy ? strategy._callbackURL : 'NOT_SET',
    match: strategy ? (strategy._callbackURL === `${req.protocol}://${req.get('host')}/auth/discord/callback`) : false,
    environment: process.env.NODE_ENV,
    renderInfo: {
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME
    }
  });
});

/**
 * @route   GET /auth/discord
 * @desc    Redirect to Discord for authentication
 * @access  Public
 */
router.get('/discord', (req, res, next) => {
  logToMemory('=== DISCORD LOGIN INITIATED ===');
  logToMemory(`Host: ${req.get('host')}`);
  logToMemory(`User-Agent: ${req.get('user-agent')}`);
  logToMemory(`Referer: ${req.get('referer')}`);
  logToMemory(`Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);

  // Log the Discord OAuth URL that will be generated
  const passport = require('passport');
  const strategy = passport._strategy('discord');
  if (strategy) {
    logToMemory(`Discord Client ID: ${strategy._oauth2._clientId}`);
    logToMemory(`Discord Redirect URI: ${strategy._callbackURL}`);
    logToMemory(`Expected Callback: ${req.protocol}://${req.get('host')}/auth/discord/callback`);
    logToMemory(`URLs Match: ${strategy._callbackURL === `${req.protocol}://${req.get('host')}/auth/discord/callback`}`);
  }

  next();
}, passport.authenticate('discord'));

/**
 * @route   GET /auth/discord/callback
 * @desc    Discord auth callback
 * @access  Public
 */
router.get('/discord/callback',
  (req, res, next) => {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      host: req.get('host'),
      protocol: req.protocol,
      originalUrl: req.originalUrl,
      queryParams: req.query,
      sessionID: req.sessionID,
      headers: req.headers
    };

    logToMemory('=== DISCORD CALLBACK DEBUG ===');
    logToMemory(JSON.stringify(debugInfo, null, 2));

    console.log('=== DISCORD CALLBACK DEBUG ===');
    console.log('Host:', req.get('host'));
    console.log('Protocol:', req.protocol);
    console.log('Original URL:', req.originalUrl);
    console.log('Query params:', req.query);
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    next();
  },
  passport.authenticate('discord', {
    failureRedirect: '/?error=auth_failed',
    failureFlash: false
  }),
  async (req, res) => {
    logToMemory('=== DISCORD AUTH SUCCESS ===');
    logToMemory(`User authenticated: ${req.user.name}`);
    logToMemory(`Session after auth: ${JSON.stringify(req.session)}`);
    logToMemory(`Is authenticated: ${req.isAuthenticated()}`);

    console.log('=== DISCORD AUTH SUCCESS ===');
    console.log('User authenticated:', req.user.name);
    console.log('Session after auth:', req.session);
    console.log('Is authenticated:', req.isAuthenticated());
    
    // Track login information and perform security checks
    try {
      console.log('🔍 STARTING LOGIN TRACKING AND SECURITY CHECKS');
      logToMemory('🔍 STARTING LOGIN TRACKING AND SECURITY CHECKS');

      const clientIP = ipInfoService.getClientIP(req);
      console.log('🔍 Client IP:', clientIP);
      logToMemory(`🔍 Client IP: ${clientIP}`);

      console.log('🔍 About to get device info...');
      const deviceInfo = ipInfoService.getDeviceInfo(req);
      console.log('🔍 Device Info:', deviceInfo);
      logToMemory(`🔍 Device Info: ${JSON.stringify(deviceInfo)}`);

      console.log('🔍 About to get IP info for:', clientIP);
      logToMemory(`🔍 About to get IP info for: ${clientIP}`);

      // Add timeout to IP info service call
      const ipInfoPromise = ipInfoService.getIPInfo(clientIP);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('IP info service timeout')), 10000)
      );

      const ipInfo = await Promise.race([ipInfoPromise, timeoutPromise]);
      console.log('🔍 IP Info received:', ipInfo);
      logToMemory(`🔍 IP Info received: ${JSON.stringify(ipInfo)}`);

      console.log('🔍 About to generate device fingerprint...');
      const deviceFingerprint = SecurityService.generateDeviceFingerprint(req);
      console.log('🔍 Device fingerprint:', deviceFingerprint);
      logToMemory(`🔍 Device fingerprint: ${deviceFingerprint}`);

      // 🚫 IMMEDIATE VPN CHECK - BYPASS BAN CHECKS FOR NOW
      console.log('🔍 IMMEDIATE VPN CHECK - IP Info:', JSON.stringify(ipInfo));
      logToMemory(`🔍 IMMEDIATE VPN CHECK - IP Info: ${JSON.stringify(ipInfo)}`);

      if (ipInfo.vpn || ipInfo.proxy || ipInfo.hosting) {
        console.log('🚫 VPN/PROXY/HOSTING DETECTED - BLOCKING LOGIN IMMEDIATELY');
        logToMemory('🚫 VPN/PROXY/HOSTING DETECTED - BLOCKING LOGIN IMMEDIATELY');

        const message = 'Login with VPN/Proxy is not allowed. Please disable your VPN and try again.';
        const userEmail = req.user.email; // Store email before logout

        logToMemory(`🚫 VPN violation blocked login for ${userEmail}: ${message}`);
        console.log(`🚫 VPN violation blocked login for ${userEmail}: ${message}`);

        // Logout the user and destroy session
        return req.logout(function(err) {
          if (err) {
            console.error('Error during logout:', err);
          }
          req.session.destroy(function(err) {
            if (err) {
              console.error('Error destroying session:', err);
            }
            // Redirect with error message
            res.redirect(`/?error=security_violation&reason=${encodeURIComponent(message)}`);
          });
        });
      }

      console.log('✅ No VPN detected, checking for multiple accounts...');

      // 🚫 IMMEDIATE MULTIPLE ACCOUNT CHECK (Device-based only)
      console.log('🔍 CHECKING FOR MULTIPLE ACCOUNTS ON SAME DEVICE');
      logToMemory('🔍 CHECKING FOR MULTIPLE ACCOUNTS ON SAME DEVICE');

      try {
        // Only check device fingerprint, not IP (IPs can be shared in networks, ISPs, etc.)
        const firstDeviceLogin = await LoginLog.findOne({ deviceFingerprint }).sort({ loginTime: 1 });
        const firstDeviceAccount = firstDeviceLogin ? firstDeviceLogin.email : null;

        console.log('🔍 First account on this device:', firstDeviceAccount);
        console.log('🔍 Current user:', req.user.email);

        // Only block if this is a DIFFERENT account on the SAME device
        if (firstDeviceAccount && firstDeviceAccount !== req.user.email) {
          console.log('🚫 DIFFERENT ACCOUNT ON SAME DEVICE - BLOCKING LOGIN');
          logToMemory('🚫 DIFFERENT ACCOUNT ON SAME DEVICE - BLOCKING LOGIN');

          const message = 'Multiple accounts per device are not allowed. Only one account is allowed per device.';
          const userEmail = req.user.email;

          logToMemory(`🚫 Multiple account violation blocked login for ${userEmail}: ${message}`);
          console.log(`🚫 Multiple account violation blocked login for ${userEmail}: ${message}`);
          console.log(`🚫 First device account: ${firstDeviceAccount}`);

          // Logout the user and destroy session
          return req.logout(function(err) {
            if (err) {
              console.error('Error during logout:', err);
            }
            req.session.destroy(function(err) {
              if (err) {
                console.error('Error destroying session:', err);
              }
              // Redirect with error message
              res.redirect(`/?error=security_violation&reason=${encodeURIComponent(message)}`);
            });
          });
        }

        console.log('✅ No multiple accounts detected on this device, continuing...');

      } catch (error) {
        console.error('🚫 Error checking multiple accounts:', error);
        logToMemory(`🚫 Error checking multiple accounts: ${error.message}`);
      }

      // Check if email, IP, or device is banned
      console.log('🔍 About to check ban lists...');
      logToMemory('🔍 About to check ban lists...');

      const emailBan = await BanList.findOne({ type: 'email', value: req.user.email, active: true });
      console.log('🔍 Email ban check result:', emailBan);

      const ipBan = await BanList.findOne({ type: 'ip', value: clientIP, active: true });
      console.log('🔍 IP ban check result:', ipBan);

      const deviceBan = await BanList.findOne({ type: 'device', value: deviceInfo.deviceModel, active: true });
      console.log('🔍 Device ban check result:', deviceBan);

      if (emailBan || ipBan || deviceBan) {
        // Log the blocked attempt
        const banReason = 'You are banned from Opsicos. Contact support if you believe this is an error.';

        const loginLog = new LoginLog({
          userId: req.user._id,
          email: req.user.email,
          ip: clientIP,
          deviceFingerprint,
          ...ipInfo,
          ...deviceInfo,
          banned: true,
          banType: emailBan ? 'email' : ipBan ? 'ip' : 'device',
          banReason: banReason
        });
        await loginLog.save();

        const userEmail = req.user.email;

        // Logout the user and destroy session
        return req.logout(function(err) {
          if (err) {
            console.error('Error during logout:', err);
          }
          req.session.destroy(function(err) {
            if (err) {
              console.error('Error destroying session:', err);
            }
            // Redirect with error message
            res.redirect(`/?error=banned&reason=${encodeURIComponent(banReason)}`);
          });
        });
      }

      // 🚫 ENHANCED SECURITY CHECKS - VPN BLOCKING ACTIVE
      console.log('🔍 Starting security check for user:', req.user.email);
      const securityCheck = await SecurityService.performSecurityCheck(req, req.user);
      console.log('🔍 Security check results:', JSON.stringify(securityCheck, null, 2));

      // Log security violations but don't block for now (for testing)
      if (securityCheck.violations && securityCheck.violations.length > 0) {
        await SecurityService.logSecurityViolation(req, req.user, securityCheck.violations);
        logToMemory(`⚠️ Security violation detected for ${req.user.email}: ${securityCheck.violations.map(v => v.message).join(', ')}`);
        console.log(`⚠️ Security violation detected for ${req.user.email}:`, securityCheck.violations);
      }

      // Block ALL VPN violations (VPN blocking is now ACTIVE)
      const vpnViolation = securityCheck.violations?.find(v => v.type === 'VPN');
      console.log('🔍 Looking for VPN violation:', vpnViolation);

      if (vpnViolation) {
        console.log('🚫 VPN VIOLATION FOUND - BLOCKING LOGIN');

        // Log security violation
        await SecurityService.logSecurityViolation(req, req.user, [vpnViolation]);

        const userEmail = req.user.email;
        logToMemory(`🚫 VPN violation blocked login for ${userEmail}: ${vpnViolation.message}`);
        console.log(`🚫 VPN violation blocked login for ${userEmail}:`, vpnViolation);

        // Logout the user and destroy session
        return req.logout(function(err) {
          if (err) {
            console.error('Error during logout:', err);
          }
          req.session.destroy(function(err) {
            if (err) {
              console.error('Error destroying session:', err);
            }
            // Redirect with error message
            res.redirect(`/?error=security_violation&reason=${encodeURIComponent(vpnViolation.message)}`);
          });
        });
      }

      console.log('✅ No VPN violation found, allowing login');
      
      // Log successful login
      const loginLog = new LoginLog({
        userId: req.user._id,
        email: req.user.email,
        ip: clientIP,
        deviceFingerprint,
        ...ipInfo,
        ...deviceInfo
      });
      
      await loginLog.save();
      console.log('Login tracked:', loginLog);
    } catch (error) {
      console.error('🚫 ERROR in login tracking/security check:', error);
      console.error('🚫 Error stack:', error.stack);
      logToMemory(`🚫 ERROR in login tracking/security check: ${error.message}`);
      logToMemory(`🚫 Error stack: ${error.stack}`);
    }
    
    res.redirect('/dashboard');
  }
);

/**
 * @route   GET /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) {
      console.error('Error during logout:', err);
      return next(err);
    }
    req.session.destroy();
    res.redirect('/');
  });
});

/**
 * @route   GET /auth/status
 * @desc    Get current user status
 * @access  Public
 */
router.get('/status', (req, res) => {
  console.log('=== AUTH STATUS CHECK ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session data:', req.session);
  console.log('Is authenticated:', req.isAuthenticated());
  console.log('User:', req.user);
  console.log('Host:', req.get('host'));
  console.log('Protocol:', req.protocol);

  if (req.isAuthenticated()) {
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user._id,
        username: req.user.name,
        avatar: req.user.avatar,
        email: req.user.email,
        discordId: req.user.oauthId
      }
    });
  } else {
    res.json({ isAuthenticated: false });
  }
});

/**
 * @route   GET /auth/user
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/user', (req, res) => {
  console.log('=== /auth/user REQUEST ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('Session:', JSON.stringify(req.session, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  if (!req.isAuthenticated() || !req.user) {
    console.log('❌ User not authenticated for /auth/user');
    return res.status(401).json({ error: 'Not authenticated' });
  }

  console.log('✅ User authenticated for /auth/user:', req.user.name);
  res.json({
    _id: req.user._id,
    name: req.user.name,
    username: req.user.username,
    avatar: req.user.avatar,
    email: req.user.email
  });
});

/**
 * @route   GET /auth/debug
 * @desc    Debug authentication and session info
 * @access  Public
 */
router.get('/debug', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    user: req.user || null,
    session: req.session,
    headers: {
      host: req.get('host'),
      'user-agent': req.get('user-agent'),
      'x-forwarded-for': req.get('x-forwarded-for'),
      'x-forwarded-proto': req.get('x-forwarded-proto')
    },
    cookies: req.cookies,
    protocol: req.protocol,
    secure: req.secure
  });
});

/**
 * @route   GET /auth/debug-logs
 * @desc    View debug logs
 * @access  Public (for debugging)
 */
router.get('/debug-logs', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  if (debugLogs.length === 0) {
    res.send('No debug logs yet. Try logging in with Discord first.');
  } else {
    res.send(debugLogs.join('\n'));
  }
});

/**
 * @route   GET /auth/discord-config
 * @desc    Check Discord OAuth configuration
 * @access  Public (for debugging)
 */
router.get('/discord-config', (req, res) => {
  const passport = require('passport');
  const strategy = passport._strategy('discord');

  res.json({
    hasDiscordStrategy: !!strategy,
    clientId: strategy ? strategy._oauth2._clientId : 'NOT_SET',
    callbackURL: strategy ? strategy._callbackURL : 'NOT_SET',
    currentHost: req.get('host'),
    currentProtocol: req.protocol,
    fullCallbackURL: `${req.protocol}://${req.get('host')}/auth/discord/callback`,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      RENDER: !!process.env.RENDER,
      RENDER_SERVICE_ID: !!process.env.RENDER_SERVICE_ID,
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      RENDER_SERVICE_NAME: process.env.RENDER_SERVICE_NAME,
      DISCORD_CALLBACK_URL: process.env.DISCORD_CALLBACK_URL,
      PASSENGER_APP_ENV: !!process.env.PASSENGER_APP_ENV
    },
    recommendedCallbackURL: `${req.protocol}://${req.get('host')}/auth/discord/callback`
  });
});

module.exports = router;