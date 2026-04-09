const express = require('express');
const router = express.Router();
const LoginLog = require('../models/LoginLog');
const BanList = require('../models/BanList');
const User = require('../models/User');
const Bot = require('../models/Bot');
const MaintenanceMode = require('../models/MaintenanceMode');
const SecurityService = require('../services/securityService');
const discordBotService = require('../services/discordBotService');
const logger = require('../config/logger');
const axios = require('axios');

// Admin password from environment variables
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Session-based admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized. Please login to admin panel.' });
};

// Admin login
router.post('/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true, message: 'Admin authenticated successfully' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Admin logout
router.post('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.json({ success: true, message: 'Logged out from admin panel' });
});

// Check admin status
router.get('/check-auth', (req, res) => {
  res.json({ isAuthenticated: req.session.isAdmin === true });
});

// Get all login logs with pagination and search
router.get('/login-logs', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { ip: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
          { country: { $regex: search, $options: 'i' } },
          { deviceModel: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const totalCount = await LoginLog.countDocuments(query);
    const logs = await LoginLog.find(query)
      .populate('userId', 'name email avatar')
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    res.json({
      logs,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ error: 'Failed to fetch login logs' });
  }
});

// Get all users with search
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    const { search = '' } = req.query;
    
    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { nickname: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    const users = await User.find(query)
      .select('name email nickname avatar plan banned lastLogin createdAt')
      .sort({ lastLogin: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get ban list
router.get('/bans', requireAdminAuth, async (req, res) => {
  try {
    const bans = await BanList.find({ active: true }).sort({ bannedAt: -1 });
    res.json(bans);
  } catch (error) {
    console.error('Error fetching ban list:', error);
    res.status(500).json({ error: 'Failed to fetch ban list' });
  }
});

// Add to ban list
router.post('/ban', requireAdminAuth, async (req, res) => {
  try {
    const { type, value, reason } = req.body;
    
    if (!type || !value) {
      return res.status(400).json({ error: 'Type and value are required' });
    }
    
    // Check if already banned
    const existing = await BanList.findOne({ type, value, active: true });
    if (existing) {
      return res.status(400).json({ error: 'This item is already banned' });
    }
    
    const ban = new BanList({
      type,
      value,
      reason: reason || 'Banned by admin',
      bannedBy: 'Admin'
    });
    
    await ban.save();
    
    // If banning an email, also ban the user
    if (type === 'email') {
      await User.updateMany({ email: value }, { banned: true });
    }
    
    console.log(`🚫 Admin banned ${type}: ${value} - Reason: ${reason || 'No reason provided'}`);
    
    // Try to destroy active sessions for banned users
    // This will force them to be logged out on next request
    if (type === 'email') {
      // Note: In a production system with Redis sessions, you would clear sessions here
      console.log(`💀 Sessions should be cleared for banned email: ${value}`);
    }
    
    res.json({ 
      success: true, 
      ban,
      message: `Successfully banned ${type}: ${value}. User will be logged out automatically.`
    });
  } catch (error) {
    console.error('Error adding to ban list:', error);
    res.status(500).json({ error: 'Failed to add to ban list' });
  }
});

// Update missing IP/location data for existing users
router.post('/update-user-data', requireAdminAuth, async (req, res) => {
  try {
    const ipInfoService = require('../services/ipInfoService');
    
    // Find users with no recent login logs or missing location data
    const usersWithoutData = await User.find({}).select('email name');
    const logCounts = await LoginLog.aggregate([
      {
        $group: {
          _id: '$email',
          count: { $sum: 1 },
          hasLocation: { $max: { $cond: [{ $ne: ['$city', null] }, 1, 0] } }
        }
      }
    ]);
    
    const usersNeedingUpdate = usersWithoutData.filter(user => {
      const logData = logCounts.find(log => log._id === user.email);
      return !logData || logData.count === 0 || logData.hasLocation === 0;
    });
    
    console.log(`Found ${usersNeedingUpdate.length} users needing data update`);
    
    let updatedCount = 0;
    const results = [];
    
    for (const user of usersNeedingUpdate.slice(0, 50)) { // Limit to 50 at a time to prevent timeout
      try {
        // Try to get the user's current IP from session or create a dummy log entry
        const dummyIP = '8.8.8.8'; // Default for testing - in real scenario you'd want actual user IPs
        
        const ipInfo = await ipInfoService.getIPInfo(dummyIP);
        const deviceInfo = {
          deviceModel: 'Unknown Device',
          deviceType: 'Unknown',
          deviceBrand: 'Unknown',
          os: 'Unknown',
          browser: 'Unknown',
          platform: 'Unknown'
        };
        
        // Create a dummy login log entry to populate user data
        const existingLog = await LoginLog.findOne({ email: user.email }).sort({ loginTime: -1 });
        
        if (!existingLog || !existingLog.city) {
          const loginLog = new LoginLog({
            userId: user._id,
            email: user.email,
            ip: dummyIP,
            deviceFingerprint: `dummy_${user._id}`,
            ...ipInfo,
            ...deviceInfo,
            loginTime: new Date()
          });
          
          await loginLog.save();
          updatedCount++;
          
          results.push({
            email: user.email,
            name: user.name,
            updated: true,
            location: `${ipInfo.city}, ${ipInfo.country}`
          });
        } else {
          results.push({
            email: user.email,
            name: user.name,
            updated: false,
            reason: 'Already has location data'
          });
        }
      } catch (error) {
        console.error(`Error updating data for user ${user.email}:`, error);
        results.push({
          email: user.email,
          name: user.name,
          updated: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Updated ${updatedCount} users`,
      totalProcessed: results.length,
      results: results
    });
    
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({ error: 'Failed to update user data' });
  }
});

// Remove from ban list
router.delete('/ban/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const ban = await BanList.findById(id);
    if (!ban) {
      return res.status(404).json({ error: 'Ban not found' });
    }
    
    ban.active = false;
    await ban.save();
    
    // If unbanning an email, also unban the user
    if (ban.type === 'email') {
      await User.updateMany({ email: ban.value }, { banned: false });
    }
    
    res.json({ success: true, message: 'Ban removed successfully' });
  } catch (error) {
    console.error('Error removing ban:', error);
    res.status(500).json({ error: 'Failed to remove ban' });
  }
});

// Ban user by ID
router.post('/ban-user/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.banned = true;
    await user.save();
    
    // Also add email to ban list
    const emailBan = new BanList({
      type: 'email',
      value: user.email,
      reason: reason || 'Banned by admin',
      bannedBy: 'Admin'
    });
    
    try {
      await emailBan.save();
    } catch (err) {
      // Ignore if already exists
    }
    
    res.json({ success: true, message: 'User banned successfully' });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user by ID
router.post('/unban-user/:userId', requireAdminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.banned = false;
    await user.save();
    
    // Also remove email from ban list
    await BanList.updateMany(
      { type: 'email', value: user.email },
      { active: false }
    );
    
    res.json({ success: true, message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Get statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const bannedUsers = await User.countDocuments({ banned: true });
    const totalLogins = await LoginLog.countDocuments();
    const vpnLogins = await LoginLog.countDocuments({ vpn: true });
    const totalBans = await BanList.countDocuments({ active: true });
    
    // Get recent logins (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogins = await LoginLog.countDocuments({ 
      loginTime: { $gte: yesterday } 
    });
    
    res.json({
      totalUsers,
      bannedUsers,
      totalLogins,
      vpnLogins,
      totalBans,
      recentLogins
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Instant ban user route
router.post('/ban-user', requireAdminAuth, async (req, res) => {
  try {
    const { userId, reason = 'Banned by admin' } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user ban status
    await User.findByIdAndUpdate(userId, {
      banned: true,
      banReason: reason,
      bannedAt: new Date(),
      bannedBy: 'Admin'
    });

    // Add email to ban list
    const existingEmailBan = await BanList.findOne({
      type: 'email',
      value: user.email
    });

    if (!existingEmailBan) {
      await BanList.create({
        type: 'email',
        value: user.email,
        reason: reason,
        bannedBy: 'Admin',
        active: true
      });
    } else {
      await BanList.findByIdAndUpdate(existingEmailBan._id, {
        active: true,
        reason: reason,
        bannedBy: 'Admin',
        bannedAt: new Date()
      });
    }

    // Get user's recent IP and ban it too
    const recentLogin = await LoginLog.findOne({ email: user.email }).sort({ loginTime: -1 });
    if (recentLogin && recentLogin.ip) {
      const existingIPBan = await BanList.findOne({
        type: 'ip',
        value: recentLogin.ip
      });

      if (!existingIPBan) {
        await BanList.create({
          type: 'ip',
          value: recentLogin.ip,
          reason: `IP banned with user: ${user.email}`,
          bannedBy: 'Admin',
          active: true
        });
      }
    }

    console.log(`🚫 Admin banned user: ${user.email} (${user.name}) - Reason: ${reason}`);

    res.json({
      success: true,
      message: 'User banned successfully. They will be logged out immediately on their next request.'
    });

  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Get users with same IP
router.get('/same-ip-users', requireAdminAuth, async (req, res) => {
  try {
    // Get all IPs that have multiple users
    const ipGroups = await LoginLog.aggregate([
      {
        $group: {
          _id: '$ip',
          emails: { $addToSet: '$email' },
          count: { $sum: 1 },
          lastLogin: { $max: '$loginTime' },
          location: { $first: { city: '$city', country: '$country', countryCode: '$countryCode' } }
        }
      },
      {
        $match: {
          'emails.1': { $exists: true } // Only IPs with more than 1 unique email
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get detailed user info for each IP group
    const detailedGroups = await Promise.all(
      ipGroups.map(async (group) => {
        const users = await User.find({ email: { $in: group.emails } })
          .select('name email banned createdAt lastLogin');

        return {
          ip: group._id,
          location: group.location,
          userCount: group.emails.length,
          totalLogins: group.count,
          lastActivity: group.lastLogin,
          users: users
        };
      })
    );

    res.json(detailedGroups);
  } catch (error) {
    console.error('Error fetching same IP users:', error);
    res.status(500).json({ error: 'Failed to fetch same IP users' });
  }
});

// Get users with same device
router.get('/same-device-users', requireAdminAuth, async (req, res) => {
  try {
    // Get all device fingerprints that have multiple users
    const deviceGroups = await LoginLog.aggregate([
      {
        $match: {
          deviceFingerprint: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$deviceFingerprint',
          emails: { $addToSet: '$email' },
          count: { $sum: 1 },
          lastLogin: { $max: '$loginTime' },
          deviceInfo: {
            $first: {
              type: '$deviceType',
              model: '$deviceModel',
              os: '$os',
              browser: '$browser'
            }
          }
        }
      },
      {
        $match: {
          'emails.1': { $exists: true } // Only devices with more than 1 unique email
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get detailed user info for each device group
    const detailedGroups = await Promise.all(
      deviceGroups.map(async (group) => {
        const users = await User.find({ email: { $in: group.emails } })
          .select('name email banned createdAt lastLogin');

        return {
          deviceFingerprint: group._id,
          deviceInfo: group.deviceInfo,
          userCount: group.emails.length,
          totalLogins: group.count,
          lastActivity: group.lastLogin,
          users: users
        };
      })
    );

    res.json(detailedGroups);
  } catch (error) {
    console.error('Error fetching same device users:', error);
    res.status(500).json({ error: 'Failed to fetch same device users' });
  }
});

// Get security violations
router.get('/security-violations', requireAdminAuth, async (req, res) => {
  try {
    const violations = await LoginLog.find({
      $or: [
        { blocked: true },
        { 'securityViolations.0': { $exists: true } }
      ]
    })
    .populate('userId', 'name email')
    .sort({ loginTime: -1 })
    .limit(100);

    res.json(violations);
  } catch (error) {
    console.error('Error fetching security violations:', error);
    res.status(500).json({ error: 'Failed to fetch security violations' });
  }
});

// Get all bots with user information
router.get('/all-bots', requireAdminAuth, async (req, res) => {
  try {
    const bots = await Bot.find({})
      .populate('userId', 'name email banned')
      .sort({ createdAt: -1 });

    // Group bots by user for better organization
    const botsByUser = {};
    bots.forEach(bot => {
      const userEmail = bot.userId?.email || 'unknown';
      if (!botsByUser[userEmail]) {
        botsByUser[userEmail] = {
          user: bot.userId,
          bots: []
        };
      }
      botsByUser[userEmail].bots.push(bot);
    });

    res.json({
      totalBots: bots.length,
      botsByUser: Object.values(botsByUser),
      allBots: bots
    });
  } catch (error) {
    console.error('Error fetching all bots:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// Start a bot
router.post('/bot/:botId/start', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = await Bot.findById(botId).populate('userId', 'name email');

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if user is banned
    if (bot.userId?.banned) {
      return res.status(403).json({ error: 'Cannot start bot for banned user' });
    }

    // Start the bot using the discord bot service
    const result = await discordBotService.startBot(bot);

    console.log(`🚀 Admin started bot: ${bot.botName} (${bot._id}) for user: ${bot.userId?.email}`);

    if (result.success) {
      // Fetch updated bot status
      const updatedBot = await Bot.findById(botId).populate('userId', 'name email');

      res.json({
        success: true,
        message: 'Bot started successfully',
        bot: updatedBot,
        botStatus: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message || 'Failed to start bot'
      });
    }

  } catch (error) {
    console.error('Error starting bot:', error);
    res.status(500).json({ error: 'Failed to start bot' });
  }
});

// Stop a bot
router.post('/bot/:botId/stop', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    const bot = await Bot.findById(botId).populate('userId', 'name email');

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Stop the bot using the discord bot service
    const result = await discordBotService.stopBot(bot);

    console.log(`⏹️ Admin stopped bot: ${bot.botName} (${bot._id}) for user: ${bot.userId?.email}`);

    if (result.success) {
      // Mark bot as manually stopped (should not auto-restart)
      await Bot.findByIdAndUpdate(botId, { shouldAutoRestart: false });

      // Fetch updated bot status
      const updatedBot = await Bot.findById(botId).populate('userId', 'name email');

      res.json({
        success: true,
        message: 'Bot stopped successfully',
        bot: updatedBot,
        botStatus: result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message || 'Failed to stop bot'
      });
    }

  } catch (error) {
    console.error('Error stopping bot:', error);
    res.status(500).json({ error: 'Failed to stop bot' });
  }
});

// Delete a bot
router.delete('/bot/:botId', requireAdminAuth, async (req, res) => {
  try {
    const { botId } = req.params;
    const { reason = 'Deleted by admin' } = req.body;

    const bot = await Bot.findById(botId).populate('userId', 'name email');

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Stop the bot first if it's running
    try {
      await discordBotService.stopBot(botId);
    } catch (stopError) {
      console.log('Bot was not running or already stopped');
    }

    // Delete the bot from database
    await Bot.findByIdAndDelete(botId);

    console.log(`🗑️ Admin deleted bot: ${bot.botName} (${bot._id}) for user: ${bot.userId?.email} - Reason: ${reason}`);

    res.json({
      success: true,
      message: 'Bot deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// Bulk bot operations
router.post('/bots/bulk-action', requireAdminAuth, async (req, res) => {
  try {
    const { action, botIds, reason = 'Bulk action by admin' } = req.body;

    if (!['start', 'stop', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!Array.isArray(botIds) || botIds.length === 0) {
      return res.status(400).json({ error: 'No bot IDs provided' });
    }

    const results = [];

    for (const botId of botIds) {
      try {
        const bot = await Bot.findById(botId).populate('userId', 'name email');
        if (!bot) {
          results.push({ botId, success: false, error: 'Bot not found' });
          continue;
        }

        let result;
        switch (action) {
          case 'start':
            if (bot.userId?.banned) {
              results.push({ botId, success: false, error: 'User is banned' });
              continue;
            }
            result = await discordBotService.startBot(bot);
            break;
          case 'stop':
            result = await discordBotService.stopBot(bot);
            if (result.success) {
              // Mark bot as manually stopped (should not auto-restart)
              await Bot.findByIdAndUpdate(botId, { shouldAutoRestart: false });
            }
            break;
          case 'delete':
            try {
              await discordBotService.stopBot(bot);
            } catch (e) {}
            await Bot.findByIdAndDelete(botId);
            result = { success: true };
            break;
        }

        results.push({
          botId,
          botName: bot.botName,
          userEmail: bot.userId?.email,
          success: true,
          result
        });

      } catch (error) {
        results.push({
          botId,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`📦 Admin performed bulk ${action} on ${botIds.length} bots - Reason: ${reason}`);

    res.json({
      success: true,
      message: `Bulk ${action} completed`,
      results
    });

  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
});

// ==== MAINTENANCE MODE ROUTES ====

// Get maintenance mode status
router.get('/maintenance/status', requireAdminAuth, async (req, res) => {
  try {
    const maintenanceMode = await MaintenanceMode.getInstance();
    res.json(maintenanceMode);
  } catch (error) {
    console.error('Error getting maintenance status:', error);
    res.status(500).json({ error: 'Failed to get maintenance status' });
  }
});

// Enable maintenance mode
router.post('/maintenance/enable', requireAdminAuth, async (req, res) => {
  try {
    const { message, estimatedEndTime, reason } = req.body;
    
    const maintenanceMode = await MaintenanceMode.enable({
      message: message || 'We are currently performing scheduled maintenance to improve your experience.',
      estimatedEndTime: estimatedEndTime ? new Date(estimatedEndTime) : null,
      enabledBy: 'Administrator',
      reason: reason || 'Scheduled maintenance'
    });
    
    console.log('🚨 MAINTENANCE MODE ENABLED by admin');
    console.log(`📝 Message: ${maintenanceMode.message}`);
    console.log(`⏰ End time: ${maintenanceMode.estimatedEndTime || 'Not specified'}`);
    
    res.json({
      success: true,
      message: 'Maintenance mode enabled successfully',
      maintenanceMode
    });
  } catch (error) {
    console.error('Error enabling maintenance mode:', error);
    res.status(500).json({ error: 'Failed to enable maintenance mode' });
  }
});

// Disable maintenance mode
router.post('/maintenance/disable', requireAdminAuth, async (req, res) => {
  try {
    const maintenanceMode = await MaintenanceMode.disable();
    
    console.log('✅ MAINTENANCE MODE DISABLED by admin');
    
    res.json({
      success: true,
      message: 'Maintenance mode disabled successfully',
      maintenanceMode
    });
  } catch (error) {
    console.error('Error disabling maintenance mode:', error);
    res.status(500).json({ error: 'Failed to disable maintenance mode' });
  }
});

// Update maintenance mode settings
router.put('/maintenance/update', requireAdminAuth, async (req, res) => {
  try {
    const { message, estimatedEndTime, reason } = req.body;
    
    const maintenanceMode = await MaintenanceMode.getInstance();
    
    if (message !== undefined) maintenanceMode.message = message;
    if (estimatedEndTime !== undefined) {
      maintenanceMode.estimatedEndTime = estimatedEndTime ? new Date(estimatedEndTime) : null;
    }
    if (reason !== undefined) maintenanceMode.reason = reason;
    
    await maintenanceMode.save();
    
    console.log('📝 Maintenance mode settings updated by admin');
    
    res.json({
      success: true,
      message: 'Maintenance mode updated successfully',
      maintenanceMode
    });
  } catch (error) {
    console.error('Error updating maintenance mode:', error);
    res.status(500).json({ error: 'Failed to update maintenance mode' });
  }
});

module.exports = router;
