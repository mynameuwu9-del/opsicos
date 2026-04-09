const express = require('express');
const router = express.Router();
const WebhookSettings = require('../models/WebhookSettings');
const axios = require('axios');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * @route   GET /settings/webhook
 * @desc    Get user's webhook settings
 * @access  Private
 */
router.get('/webhook', isAuthenticated, async (req, res) => {
  try {
    const webhookSettings = await WebhookSettings.findOne({ userId: req.user._id });
    
    if (!webhookSettings) {
      return res.json({ webhookUrl: null, isActive: false });
    }

    res.json({
      webhookUrl: webhookSettings.webhookUrl,
      isActive: webhookSettings.isActive,
      lastTestDate: webhookSettings.lastTestDate,
      createdAt: webhookSettings.createdAt,
      updatedAt: webhookSettings.updatedAt
    });
  } catch (error) {
    console.error('Error fetching webhook settings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /settings/webhook
 * @desc    Save/Update webhook settings
 * @access  Private
 */
router.post('/webhook', isAuthenticated, async (req, res) => {
  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ error: 'Invalid webhook URL. Must be a Discord webhook URL.' });
    }

    // Test the webhook URL before saving
    try {
      await axios.post(webhookUrl, {
        content: '🔧 **Opsicos Webhook Test**\n\nYour webhook is configured successfully! You will now receive bot status alerts in this channel.',
        embeds: [{
          title: '⚙️ Webhook Configuration Complete',
          description: 'This is a test message to verify your webhook is working correctly.',
          color: 0x8B0000, // Opsicos red color
          footer: {
            text: 'Opsicos Bot Monitoring System',
            icon_url: 'https://cdn.discordapp.com/attachments/1234567890/opsicos-icon.png'
          },
          timestamp: new Date().toISOString()
        }]
      });
    } catch (webhookError) {
      console.error('Webhook test failed:', webhookError.message);
      return res.status(400).json({ 
        error: 'Invalid webhook URL or webhook is not accessible. Please check your webhook URL.' 
      });
    }

    // Save or update webhook settings
    const webhookSettings = await WebhookSettings.findOneAndUpdate(
      { userId: req.user._id },
      { 
        webhookUrl,
        isActive: true,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true 
      }
    );

    res.json({
      message: 'Webhook settings saved successfully',
      webhookUrl: webhookSettings.webhookUrl,
      isActive: webhookSettings.isActive
    });
  } catch (error) {
    console.error('Error saving webhook settings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /settings/webhook/test
 * @desc    Test webhook by sending a test message
 * @access  Private
 */
router.post('/webhook/test', isAuthenticated, async (req, res) => {
  try {
    const webhookSettings = await WebhookSettings.findOne({ userId: req.user._id });
    
    if (!webhookSettings || !webhookSettings.webhookUrl) {
      return res.status(400).json({ error: 'No webhook configured. Please save a webhook URL first.' });
    }

    // Send test message
    await axios.post(webhookSettings.webhookUrl, {
      content: `🧪 **Test Alert from ${req.user.name || 'User'}**`,
      embeds: [{
        title: '🔔 Webhook Test Message',
        description: 'This is a test message from your Opsicos dashboard. Your webhook is working correctly!',
        color: 0x8B0000,
        fields: [
          {
            name: '📊 Status',
            value: '✅ Webhook Active',
            inline: true
          },
          {
            name: '⏰ Test Time',
            value: new Date().toLocaleString(),
            inline: true
          },
          {
            name: '👤 User',
            value: req.user.name || 'Unknown',
            inline: true
          }
        ],
        footer: {
          text: 'Opsicos Bot Monitoring System',
          icon_url: 'https://cdn.discordapp.com/attachments/1234567890/opsicos-icon.png'
        },
        timestamp: new Date().toISOString()
      }]
    });

    // Update last test date
    webhookSettings.lastTestDate = new Date();
    await webhookSettings.save();

    res.json({ message: 'Test message sent successfully' });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ 
      error: 'Failed to send test message. Please check your webhook URL.' 
    });
  }
});

/**
 * @route   DELETE /settings/webhook
 * @desc    Delete webhook settings
 * @access  Private
 */
router.delete('/webhook', isAuthenticated, async (req, res) => {
  try {
    await WebhookSettings.deleteOne({ userId: req.user._id });
    
    res.json({ message: 'Webhook settings removed successfully' });
  } catch (error) {
    console.error('Error deleting webhook settings:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /settings/language
 * @desc    Get user's language preference
 * @access  Private
 */
router.get('/language', isAuthenticated, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      language: user.language || 'english'
    });
  } catch (error) {
    console.error('Error fetching language preference:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /settings/language
 * @desc    Save user's language preference
 * @access  Private
 */
router.post('/language', isAuthenticated, async (req, res) => {
  try {
    const { language } = req.body;

    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    // Validate language
    const supportedLanguages = [
      'english', 'french', 'indian', 'urdu', 'nepalese',
      'spanish', 'portuguese', 'japanese', 'chinese',
      'italian', 'polish', 'arabic', 'srilankan', 'bangla'
    ];

    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, {
      language: language
    });

    res.json({
      message: 'Language preference saved successfully',
      language: language
    });
  } catch (error) {
    console.error('Error saving language preference:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
