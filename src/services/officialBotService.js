const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const Bot = require('../models/Bot');
const User = require('../models/User');
const logger = require('../config/logger');

const OFFICIAL_BOT_TOKEN = process.env.OFFICIAL_BOT_TOKEN || '';
const OPSICOS_URL = process.env.APP_URL || 'http://localhost:3000';

class OfficialBotService {
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
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers
        ]
      });

      this.client.once('ready', async () => {
        logger.info(`Official Opsicos bot logged in as ${this.client.user.tag}`);
        this.isReady = true;
        await this.registerSlashCommands();
      });

      this.client.on('error', (error) => {
        logger.error('Official bot error', error);
        this.isReady = false;
      });

      // Handle slash command interactions
      this.client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        try {
          logger.info(`Official bot slash command: ${interaction.commandName} by ${interaction.user.username}`);

          if (interaction.commandName === 'web_url') {
            await this.handleWebUrlCommand(interaction);
          } else if (interaction.commandName === 'my_bot') {
            await this.handleMyBotCommand(interaction);
          } else if (interaction.commandName === 'status') {
            await this.handleStatusCommand(interaction);
          }
        } catch (error) {
          logger.error('Error handling official bot slash command', error);

          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Sorry, an error occurred while processing your command.',
                ephemeral: true
              });
            }
          } catch (replyError) {
            logger.error('Error sending error reply for official bot slash command', replyError);
          }
        }
      });

      await this.client.login(OFFICIAL_BOT_TOKEN);

      // Wait for ready state
      await new Promise((resolve) => {
        if (this.isReady) {
          resolve();
        } else {
          this.client.once('ready', resolve);
        }
      });

      logger.info('Official Opsicos bot service initialized');
    } catch (error) {
      logger.error('Failed to initialize official bot service', error);
      throw error;
    }
  }

  async registerSlashCommands() {
    const commands = [
      {
        name: 'web_url',
        description: 'Get the Opsicos website URL and information'
      },
      {
        name: 'my_bot',
        description: 'Get detailed information about your Opsicos bot'
      },
      {
        name: 'status',
        description: 'View Opsicos API status and uptime for the last 90 days'
      }
    ];

    try {
      const rest = new REST({ version: '10' }).setToken(OFFICIAL_BOT_TOKEN);

      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commands }
      );

      logger.info(`Registered ${commands.length} slash commands for official bot`);
    } catch (error) {
      logger.error('Failed to register official bot slash commands', error);
      throw error;
    }
  }

  async handleWebUrlCommand(interaction) {
    const embed = {
      title: '🌐 Opsicos - AI Bot Platform',
      description: 'Create and manage your own AI Discord bots with advanced features and intelligence!',
      url: OPSICOS_URL,
      color: 0x8B0000,
      fields: [
        {
          name: '🚀 Key Features',
          value: '• **Advanced AI Models** - GPT, Claude, Gemini\n• **Custom Personalities** - Unique bot behavior\n• **Smart Conversations** - Natural interactions\n• **Knowledge Base** - Custom bot knowledge',
          inline: false
        },
        {
          name: '🎯 Getting Started',
          value: '• Visit our website\n• Create your account\n• Build your first bot\n• Deploy instantly',
          inline: true
        },
        {
          name: '📊 Management',
          value: '• Real-time analytics\n• Bot performance monitoring\n• Server statistics\n• Advanced settings',
          inline: true
        },
        {
          name: '🔗 Quick Links',
          value: `[🏠 Homepage](${OPSICOS_URL})\n[📊 Dashboard](${OPSICOS_URL}/dashboard)\n[📚 Documentation](${OPSICOS_URL}/docs)\n[📢 Updates](${OPSICOS_URL}/updates)`,
          inline: false
        }
      ],
      footer: {
        text: 'Opsicos - Powering the next generation of AI bots',
      },
      timestamp: new Date().toISOString(),
    };

    await interaction.reply({ embeds: [embed] });
  }

  async handleMyBotCommand(interaction) {
    try {
      const user = await User.findOne({ oauthId: interaction.user.id });

      if (!user) {
        const embed = {
          title: '❌ Account Not Found',
          description: 'You need to be registered on Opsicos to use this command.',
          color: 0xef4444,
          fields: [
            {
              name: '🚀 Get Started',
              value: `Visit [Opsicos](${OPSICOS_URL}) to create your account and build your first AI bot!`,
              inline: false
            }
          ],
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const userBots = await Bot.find({ userId: user._id }).sort({ createdAt: -1 });

      if (!userBots || userBots.length === 0) {
        const embed = {
          title: '🤖 No Bots Found',
          description: `Hello ${user.name || interaction.user.username}! You haven't created any bots yet.`,
          color: 0xf59e0b,
          fields: [
            {
              name: '🎯 Create Your First Bot',
              value: `Visit your [Dashboard](${OPSICOS_URL}/dashboard) to create and customize your AI bot!`,
              inline: false
            }
          ],
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const mainBot = userBots[0];

      let uptimeText = 'Not available';
      if (mainBot.uptimeStartedAt) {
        const uptimeMs = Date.now() - new Date(mainBot.uptimeStartedAt).getTime();
        uptimeText = this.formatUptime(uptimeMs);
      }

      const statusColor = mainBot.status === 'online' ? 0x22c55e :
                           mainBot.status === 'connecting' ? 0xf59e0b : 0x6b7280;

      const embed = {
        title: `🤖 ${mainBot.botName}`,
        description: `**${user.name || interaction.user.username}'s** AI Discord Bot`,
        color: statusColor,
        fields: [
          { name: '🧠 AI Model', value: mainBot.displayModelName || mainBot.selectedModel || 'Unknown', inline: true },
          { name: '🌐 Servers', value: (mainBot.serverCount || 0).toString(), inline: true },
          { name: '📊 Status', value: mainBot.status === 'online' ? '🟢 Online' : mainBot.status === 'connecting' ? '🟡 Connecting' : '🔴 Offline', inline: true },
          { name: '👤 Owner', value: user.name || interaction.user.username, inline: true },
          { name: '📅 Created', value: new Date(mainBot.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), inline: true },
          { name: '⚡ Uptime', value: uptimeText, inline: true }
        ],
        footer: { text: `Manage at ${OPSICOS_URL}/dashboard | Total bots: ${userBots.length}` },
        timestamp: new Date().toISOString()
      };

      if (userBots.length > 1) {
        const otherBots = userBots.slice(1, 4);
        const otherBotsText = otherBots.map(bot =>
          `• **${bot.botName}** (${bot.status === 'online' ? '🟢' : '🔴'})`
        ).join('\n');

        embed.fields.push({
          name: `🤖 Other Bots (${userBots.length - 1} more)`,
          value: otherBotsText + (userBots.length > 4 ? '\n• *...and more*' : ''),
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in official bot handleMyBotCommand', error);

      const embed = {
        title: '❌ Error',
        description: 'An error occurred while fetching your bot information. Please try again later.',
        color: 0xef4444,
      };

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }

  async handleStatusCommand(interaction) {
    try {
      const statusUrl = `${OPSICOS_URL}/status`;

      const embed = {
        title: '📊 Opsicos System Status',
        description: 'View real-time status and uptime monitoring for all Opsicos services',
        color: 0x22c55e,
        fields: [
          { name: '🔗 Status Page', value: `[Click here to view detailed system status](${statusUrl})`, inline: false },
          { name: '📈 What You\'ll Find', value: '• **Service Uptime** - 90-day history for all APIs\n• **Visual Graphs** - Color-coded status indicators\n• **Response Times** - Performance metrics\n• **Incident Reports** - Recent service disruptions', inline: false },
          { name: '🎯 Monitored Services', value: '• Dashboard API\n• Website API\n• Platform API\n• REST API', inline: true },
          { name: '📊 Status Indicators', value: '🟢 Operational\n🟡 Degraded\n🔴 Outage', inline: true }
        ],
        footer: { text: 'Opsicos Status - Real-time monitoring' },
        timestamp: new Date().toISOString(),
      };

      const row = {
        type: 1,
        components: [
          { type: 2, style: 5, label: 'View Status Page', url: statusUrl, emoji: '📊' },
          { type: 2, style: 5, label: 'Dashboard', url: `${OPSICOS_URL}/dashboard`, emoji: '🎛️' },
        ]
      };

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error('Error in handleStatusCommand', error);

      const errorEmbed = {
        title: '❌ Error',
        description: 'Failed to process status command. Please try again later.',
        color: 0xef4444,
      };

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }

  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
      this.isReady = false;
      logger.info('Official bot service destroyed');
    }
  }
}

const officialBotService = new OfficialBotService();

module.exports = officialBotService;
