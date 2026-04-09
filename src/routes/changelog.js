const express = require('express');
const router = express.Router();
const Changelog = require('../models/Changelog');
const updateNotificationService = require('../services/updateNotificationService');

// Admin authentication middleware
const requireAdminAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Admin access required.' });
};

/**
 * @route   GET /api/changelog
 * @desc    Get all changelogs (public) - legacy endpoint
 * @access  Public
 */
router.get('/changelog', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const changelogs = await Changelog.find()
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      changelogs
    });
  } catch (error) {
    console.error('Error fetching changelogs:', error);
    res.status(500).json({ error: 'Failed to fetch changelogs' });
  }
});

/**
 * @route   GET /api/updates
 * @desc    Get all updates (public)
 * @access  Public
 */
router.get('/updates', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const changelogs = await Changelog.find()
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      changelogs
    });
  } catch (error) {
    console.error('Error fetching changelogs:', error);
    res.status(500).json({ error: 'Failed to fetch changelogs' });
  }
});

/**
 * @route   POST /api/admin/changelog
 * @desc    Create and publish a new changelog (admin only)
 * @access  Admin
 */
router.post('/admin/changelog', requireAdminAuth, async (req, res) => {
  try {
    const { version, title, updates, type } = req.body;

    // Validation
    if (!version || !title || !updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ 
        error: 'Version, title, and at least one update are required' 
      });
    }

    // Create changelog
    const changelog = new Changelog({
      version,
      title,
      updates,
      type: type || 'feature',
      publishedBy: 'Admin'
    });

    await changelog.save();

    // Send to Discord main channel only
    try {
      console.log('📢 Sending update to Discord main channel...');
      
      // Send to main changelog channel only
      const mainMessageId = await updateNotificationService.sendUpdateToMainChannel(changelog);
      changelog.discordMessageIds.push(mainMessageId);
      
      changelog.discordMessageSent = true;
      await changelog.save();

      console.log(`✅ Changelog published and sent to Discord main channel`);

      res.json({
        success: true,
        changelog,
        discord: {
          mainChannelMessageId: mainMessageId,
          channelId: '1432226164369522780'
        },
        message: 'Changelog published and sent to Discord main channel successfully'
      });
    } catch (discordError) {
      console.error('❌ Error sending to Discord:', discordError);
      
      // Still save the changelog even if Discord fails
      res.json({
        success: true,
        changelog,
        discord: {
          error: discordError.message,
          message: 'Changelog saved but Discord notification failed'
        },
        message: 'Changelog published but Discord notification failed'
      });
    }
  } catch (error) {
    console.error('Error creating changelog:', error);
    res.status(500).json({ error: 'Failed to create changelog' });
  }
});

/**
 * @route   DELETE /api/admin/changelog/:id
 * @desc    Delete a changelog (admin only)
 * @access  Admin
 */
router.delete('/admin/changelog/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const changelog = await Changelog.findByIdAndDelete(id);

    if (!changelog) {
      return res.status(404).json({ error: 'Changelog not found' });
    }

    res.json({
      success: true,
      message: 'Changelog deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting changelog:', error);
    res.status(500).json({ error: 'Failed to delete changelog' });
  }
});

/**
 * @route   GET /api/admin/changelog/stats
 * @desc    Get changelog statistics (admin only)
 * @access  Admin
 */
router.get('/admin/changelog/stats', requireAdminAuth, async (req, res) => {
  try {
    const totalChangelogs = await Changelog.countDocuments();
    const sentToDiscord = await Changelog.countDocuments({ discordMessageSent: true });
    const latestVersion = await Changelog.findOne().sort({ publishedAt: -1 }).select('version');

    res.json({
      success: true,
      stats: {
        totalChangelogs,
        sentToDiscord,
        latestVersion: latestVersion?.version || 'N/A'
      }
    });
  } catch (error) {
    console.error('Error fetching changelog stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
