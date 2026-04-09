const axios = require('axios');
const WebhookSettings = require('../models/WebhookSettings');

class WebhookService {
  constructor() {
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Send webhook notification with retry mechanism
   */
  async sendWebhook(webhookUrl, payload, retries = this.retryAttempts) {
    try {
      await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      console.log('✅ Webhook sent successfully');
      return true;
    } catch (error) {
      console.error(`❌ Webhook send failed (${retries} retries left):`, error.message);
      
      if (retries > 0) {
        console.log(`🔄 Retrying webhook in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.sendWebhook(webhookUrl, payload, retries - 1);
      }
      
      return false;
    }
  }

  /**
   * Get webhook settings for a user
   */
  async getWebhookSettings(userId) {
    try {
      const settings = await WebhookSettings.findOne({ userId, isActive: true });
      return settings;
    } catch (error) {
      console.error('Error fetching webhook settings:', error);
      return null;
    }
  }

  /**
   * Create Discord embed for bot status alerts
   */
  createBotStatusEmbed(event, botName, reason = '', additionalFields = []) {
    const embeds = {
      'bot_started': {
        title: '🟢 Bot Started',
        description: `**${botName}** has been manually started.`,
        color: 0x43B581, // Green
        emoji: '🟢'
      },
      'bot_stopped': {
        title: '🔴 Bot Stopped',
        description: `**${botName}** has been manually stopped.`,
        color: 0xF04747, // Red
        emoji: '🔴'
      },
      'bot_online': {
        title: '✅ Bot Online',
        description: `**${botName}** is now online and connected to Discord.`,
        color: 0x43B581, // Green
        emoji: '✅'
      },
      'bot_offline': {
        title: '⚠️ Bot Offline',
        description: `**${botName}** has gone offline or disconnected.`,
        color: 0xFAA61A, // Orange/Warning
        emoji: '⚠️'
      },
      'bot_error': {
        title: '❌ Bot Error',
        description: `**${botName}** encountered an error and may need attention.`,
        color: 0xF04747, // Red
        emoji: '❌'
      },
      'bot_restart': {
        title: '🔄 Bot Restart',
        description: `**${botName}** has been automatically restarted due to an issue.`,
        color: 0xFAA61A, // Orange
        emoji: '🔄'
      }
    };

    const embedConfig = embeds[event] || embeds['bot_error'];
    
    const fields = [
      {
        name: '🤖 Bot Name',
        value: botName,
        inline: true
      },
      {
        name: '⏰ Timestamp',
        value: new Date().toLocaleString(),
        inline: true
      },
      {
        name: '🔔 Event Type',
        value: embedConfig.title,
        inline: true
      }
    ];

    if (reason) {
      fields.push({
        name: '📋 Reason',
        value: reason,
        inline: false
      });
    }

    // Add any additional fields
    fields.push(...additionalFields);

    return {
      embeds: [{
        title: embedConfig.title,
        description: embedConfig.description,
        color: embedConfig.color,
        fields: fields,
        footer: {
          text: 'Opsicos Bot Monitoring System',
          icon_url: 'https://cdn.discordapp.com/attachments/1234567890/opsicos-icon.png'
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  /**
   * Send bot status alert to user's webhook
   */
  async sendBotStatusAlert(userId, event, botName, reason = '', additionalFields = []) {
    try {
      console.log(`🔔 Sending bot status alert: ${event} for ${botName}`);
      
      // Get user's webhook settings
      const webhookSettings = await this.getWebhookSettings(userId);
      
      if (!webhookSettings) {
        console.log('⚠️ No webhook configured for user:', userId);
        return false;
      }

      // Create embed payload
      const payload = this.createBotStatusEmbed(event, botName, reason, additionalFields);
      
      // Add a simple text content for better visibility
      const eventEmojis = {
        'bot_started': '🟢',
        'bot_stopped': '🔴', 
        'bot_online': '✅',
        'bot_offline': '⚠️',
        'bot_error': '❌',
        'bot_restart': '🔄'
      };
      
      payload.content = `${eventEmojis[event] || '📢'} **Bot Status Update: ${botName}**`;

      // Send webhook
      const success = await this.sendWebhook(webhookSettings.webhookUrl, payload);
      
      if (success) {
        console.log(`✅ Bot status alert sent successfully: ${event} - ${botName}`);
      } else {
        console.error(`❌ Failed to send bot status alert: ${event} - ${botName}`);
      }
      
      return success;
    } catch (error) {
      console.error('Error sending bot status alert:', error);
      return false;
    }
  }

  /**
   * Convenience methods for different bot events
   */
  async notifyBotStarted(userId, botName, reason = 'Manual start by user') {
    return this.sendBotStatusAlert(userId, 'bot_started', botName, reason);
  }

  async notifyBotStopped(userId, botName, reason = 'Manual stop by user') {
    return this.sendBotStatusAlert(userId, 'bot_stopped', botName, reason);
  }

  async notifyBotOnline(userId, botName, reason = 'Bot successfully connected to Discord') {
    return this.sendBotStatusAlert(userId, 'bot_online', botName, reason);
  }

  async notifyBotOffline(userId, botName, reason = 'Bot disconnected from Discord') {
    return this.sendBotStatusAlert(userId, 'bot_offline', botName, reason);
  }

  async notifyBotError(userId, botName, errorMessage = 'Unknown error occurred') {
    return this.sendBotStatusAlert(userId, 'bot_error', botName, errorMessage);
  }

  async notifyBotRestart(userId, botName, reason = 'Automatic restart due to health check failure') {
    return this.sendBotStatusAlert(userId, 'bot_restart', botName, reason);
  }

  /**
   * Send bulk notification for multiple bots (e.g., during force stop all)
   */
  async sendBulkBotAlert(userId, event, bots, reason = '') {
    try {
      const webhookSettings = await this.getWebhookSettings(userId);
      
      if (!webhookSettings || bots.length === 0) {
        return false;
      }

      const botList = bots.map(bot => `• ${bot}`).join('\n');
      
      const embed = {
        title: event === 'bulk_stop' ? '🛑 Bulk Bot Stop' : '🔄 Bulk Bot Action',
        description: `Multiple bots have been affected by a bulk operation.`,
        color: event === 'bulk_stop' ? 0xF04747 : 0xFAA61A,
        fields: [
          {
            name: '🤖 Affected Bots',
            value: botList.length > 1024 ? botList.substring(0, 1021) + '...' : botList,
            inline: false
          },
          {
            name: '📊 Total Count',
            value: bots.length.toString(),
            inline: true
          },
          {
            name: '⏰ Timestamp',
            value: new Date().toLocaleString(),
            inline: true
          }
        ],
        footer: {
          text: 'Opsicos Bot Monitoring System',
          icon_url: 'https://cdn.discordapp.com/attachments/1234567890/opsicos-icon.png'
        },
        timestamp: new Date().toISOString()
      };

      if (reason) {
        embed.fields.push({
          name: '📋 Reason',
          value: reason,
          inline: false
        });
      }

      const payload = {
        content: `🚨 **Bulk Bot Operation Alert**`,
        embeds: [embed]
      };

      return await this.sendWebhook(webhookSettings.webhookUrl, payload);
    } catch (error) {
      console.error('Error sending bulk bot alert:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new WebhookService();
