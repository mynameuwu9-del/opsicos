const { Client, GatewayIntentBits } = require('discord.js');
const Bot = require('../models/Bot');

const UPDATE_BOT_TOKEN = process.env.OFFICIAL_BOT_TOKEN || '';
const CHANGELOG_CHANNEL_ID = process.env.CHANGELOG_CHANNEL_ID || '';

class UpdateNotificationService {
  constructor() {
    this.client = null;
    this.isReady = false;
  }

  async initialize() {
    if (this.client && this.isReady) {
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages
        ]
      });

      this.client.once('ready', () => {
        console.log(`✅ Update notification bot logged in as ${this.client.user.tag}`);
        this.isReady = true;
      });

      this.client.on('error', (error) => {
        console.error('❌ Update bot error:', error);
        this.isReady = false;
      });

      await this.client.login(UPDATE_BOT_TOKEN);
      
      // Wait for ready state
      await new Promise((resolve) => {
        if (this.isReady) {
          resolve();
        } else {
          this.client.once('ready', resolve);
        }
      });

      console.log('✅ Update notification service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize update notification service:', error);
      throw error;
    }
  }

  async sendUpdateToMainChannel(changelog) {
    try {
      if (!this.isReady) {
        await this.initialize();
      }

      const channel = await this.client.channels.fetch(CHANGELOG_CHANNEL_ID);
      
      if (!channel) {
        throw new Error('Changelog channel not found');
      }

      // Format the message
      const message = this.formatUpdateMessage(changelog);

      // Send the message
      const sentMessage = await channel.send(message);

      console.log(`✅ Update sent to main changelog channel: ${sentMessage.id}`);
      return sentMessage.id;
    } catch (error) {
      console.error('❌ Error sending update to main channel:', error);
      throw error;
    }
  }

  async sendUpdateToAllBotServers(changelog) {
    // This function is now disabled - updates only go to the main channel
    console.log('ℹ️ Bot server broadcast is disabled. Updates only sent to main channel.');
    return [];
  }

  formatUpdateMessage(changelog) {
    const typeLabels = {
      feature: 'NEW FEATURE',
      bugfix: 'BUG FIX',
      improvement: 'IMPROVEMENT',
      security: 'SECURITY UPDATE'
    };

    const typeLabel = typeLabels[changelog.type] || 'UPDATE';
    
    let message = `**OPSICOS ${typeLabel} - VERSION ${changelog.version}**\n`;
    message += `**${changelog.title}**\n\n`;
    
    message += `**What's New:**\n\n`;
    
    changelog.updates.forEach((update, index) => {
      message += `${index + 1}. ${update}\n\n`;
    });

    const date = new Date(changelog.publishedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    message += `**Release Date:** ${date}\n`;
    message += `**Published by:** Opsicos Team`;

    return message;
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
      console.log('✅ Update notification service destroyed');
    }
  }
}

// Singleton instance
const updateNotificationService = new UpdateNotificationService();

module.exports = updateNotificationService;
