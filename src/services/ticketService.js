const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const TranscriptGenerator = require('../utils/transcriptGenerator');

// Ticket System Configuration
const TICKET_CONFIG = {
  SUPPORT_CATEGORY_ID: '1432353811711787148',
  PARTNERSHIP_CATEGORY_ID: '1432353914493341818',
  TRANSCRIPT_CHANNEL_ID: '1432358903366160394',
  THUMBNAIL_URL: 'https://cdn.discordapp.com/attachments/1363213202359451941/1432355459972595833/opsicos_circle.avif?ex=6900c079&is=68ff6ef9&hm=994399cb3bafbc370378251d50cfa4687de1c7aea8a1a6b2a3332fc341f44635&',
  IMAGE_URL: 'https://cdn.discordapp.com/attachments/1363213202359451941/1432355359326081095/opsicos_tickets.gif?ex=6900c061&is=68ff6ee1&hm=8543c894e728cc9248b3818bcdb71a0a5030fc561f845874bfb38f87c0932c8f&'
};

class TicketService {
  constructor(client) {
    this.client = client;
    // Rate limiting: Store last interaction time for each user
    this.userCooldowns = new Map();
    // Special user who can open unlimited tickets
    this.UNLIMITED_TICKET_USER = '1340207834108788759';
  }

  /**
   * Check if user is on cooldown for button interactions
   * @param {string} userId - Discord user ID
   * @param {number} cooldownMs - Cooldown duration in milliseconds
   * @returns {boolean} - True if user can interact, false if on cooldown
   */
  checkCooldown(userId, cooldownMs = 3000) {
    const now = Date.now();
    const lastInteraction = this.userCooldowns.get(userId);
    
    if (lastInteraction && (now - lastInteraction) < cooldownMs) {
      return false; // User is on cooldown
    }
    
    this.userCooldowns.set(userId, now);
    return true; // User can interact
  }

  async handleSetupTicketCommand(message) {
    try {
      // Check if user has admin permissions
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await message.reply('❌ Only administrators can use this command.');
        return;
      }

      // Create ticket setup embed
      const embed = new EmbedBuilder()
        .setTitle('🎫 Opsicos Support Tickets')
        .setDescription('Welcome to our support system! Select a category below to create a ticket and get assistance from our team.\n\n**Available Categories:**\n🔧 **Support** - Technical help and general inquiries\n🤝 **Partnership** - Business partnerships and collaborations')
        .setColor('#8B0000')
        .setThumbnail(TICKET_CONFIG.THUMBNAIL_URL)
        .setImage(TICKET_CONFIG.IMAGE_URL)
        .setFooter({ 
          text: 'Opsicos Ticket System • https://discord.gg/DM5h9JWyTZ',
          iconURL: TICKET_CONFIG.THUMBNAIL_URL
        })
        .setTimestamp();

      // Create dropdown menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_category')
        .setPlaceholder('🎫 Select a ticket category')
        .addOptions([
          {
            label: 'Support',
            description: 'Get technical help and support',
            value: 'support',
            emoji: '🔧'
          },
          {
            label: 'Partnership',
            description: 'Discuss partnership opportunities',
            value: 'partnership',
            emoji: '🤝'
          }
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await message.channel.send({
        embeds: [embed],
        components: [row]
      });

      // Delete the command message
      await message.delete().catch(() => {});

      console.log(`✅ Ticket setup created by ${message.author.username} in ${message.guild.name}`);
    } catch (error) {
      console.error('Error in handleSetupTicketCommand:', error);
      await message.reply('❌ Failed to setup ticket system. Please try again.').catch(() => {});
    }
  }

  async handleTicketCategorySelect(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const category = interaction.values[0]; // 'support' or 'partnership'
      const guild = interaction.guild;
      const member = interaction.member;

      // Check if user already has an open ticket (unless they're the special user)
      if (member.user.id !== this.UNLIMITED_TICKET_USER) {
        const existingTickets = await Ticket.getUserOpenTickets(guild.id, member.user.id);
        if (existingTickets.length > 0) {
          await interaction.editReply({
            content: `❌ You already have an open ticket: <#${existingTickets[0].channelId}>\nPlease close it before creating a new one.`
          });
          return;
        }
      }

      // Determine category channel ID
      const categoryChannelId = category === 'support' 
        ? TICKET_CONFIG.SUPPORT_CATEGORY_ID 
        : TICKET_CONFIG.PARTNERSHIP_CATEGORY_ID;

      // Generate ticket ID
      const ticketId = await Ticket.generateTicketId(guild.id);

      // Create channel name
      const channelName = `${category}-${member.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      // Create ticket channel
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryChannelId,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: member.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: this.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

      // Create ticket in database
      const ticket = new Ticket({
        ticketId,
        guildId: guild.id,
        channelId: ticketChannel.id,
        category,
        categoryChannelId,
        creator: {
          userId: member.user.id,
          username: member.user.username,
          displayName: member.displayName || member.user.username,
          avatar: member.user.displayAvatarURL()
        }
      });
      await ticket.save();

      // Create ticket embed
      const ticketEmbed = new EmbedBuilder()
        .setTitle(`🎫 ${category.charAt(0).toUpperCase() + category.slice(1)} Ticket`)
        .setDescription('Wait patiently till staffs come to assist you shortly.\n\nOur team will be with you as soon as possible!')
        .setColor(category === 'support' ? '#3b82f6' : '#8b5cf6')
        .setThumbnail(TICKET_CONFIG.THUMBNAIL_URL)
        .addFields(
          { name: '📋 Ticket ID', value: ticketId, inline: true },
          { name: '👤 Created By', value: `${member}`, inline: true },
          { name: '📅 Created At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setFooter({ 
          text: 'Use the buttons below to close this ticket',
          iconURL: TICKET_CONFIG.THUMBNAIL_URL
        })
        .setTimestamp();

      // Create buttons
      const closeButton = new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒');

      const closeWithReasonButton = new ButtonBuilder()
        .setCustomId('close_ticket_reason')
        .setLabel('Close with Reason')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📝');

      const buttonRow = new ActionRowBuilder().addComponents(closeButton, closeWithReasonButton);

      await ticketChannel.send({
        content: `${member} Welcome to your ${category} ticket!`,
        embeds: [ticketEmbed],
        components: [buttonRow]
      });

      await interaction.editReply({
        content: `✅ Your ticket has been created! ${ticketChannel}`
      });

      console.log(`✅ Ticket ${ticketId} created by ${member.user.username} in ${guild.name}`);
    } catch (error) {
      console.error('Error in handleTicketCategorySelect:', error);
      await interaction.editReply({
        content: '❌ Failed to create ticket. Please contact an administrator.'
      }).catch(() => {});
    }
  }

  async handleCloseTicket(interaction) {
    try {
      // Check rate limit
      if (!this.checkCooldown(interaction.user.id, 3000)) {
        await interaction.reply({
          content: '⚠️ Please wait a moment before using this button again.',
          ephemeral: true
        });
        return;
      }

      // Create confirmation buttons
      const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_close_yes')
        .setLabel('Yes, Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('✅');

      const cancelButton = new ButtonBuilder()
        .setCustomId('confirm_close_no')
        .setLabel('No, Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

      await interaction.reply({
        content: '⚠️ Are you sure you want to close this ticket?',
        components: [row],
        ephemeral: true
      });
    } catch (error) {
      console.error('Error in handleCloseTicket:', error);
    }
  }

  async handleCloseTicketWithReason(interaction) {
    try {
      // Check rate limit
      if (!this.checkCooldown(interaction.user.id, 3000)) {
        await interaction.reply({
          content: '⚠️ Please wait a moment before using this button again.',
          ephemeral: true
        });
        return;
      }

      // Create modal for reason input
      const modal = new ModalBuilder()
        .setCustomId('close_reason_modal')
        .setTitle('Close Ticket with Reason');

      const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Why are you closing this ticket?')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter the reason for closing this ticket...')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(500);

      const actionRow = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error in handleCloseTicketWithReason:', error);
    }
  }

  async handleConfirmClose(interaction, confirmed) {
    try {
      // Check rate limit
      if (!this.checkCooldown(interaction.user.id, 2000)) {
        await interaction.reply({
          content: '⚠️ Please wait a moment.',
          ephemeral: true
        });
        return;
      }

      if (!confirmed) {
        await interaction.update({
          content: '❌ Ticket closure cancelled.',
          components: []
        });
        return;
      }

      // Don't send any message in channel, just delete the confirmation message
      await interaction.update({
        content: '✅ Closing ticket...',
        components: []
      }).catch(() => {});

      await this.closeTicket(interaction.channel, interaction.user, null, interaction.id);
    } catch (error) {
      console.error('Error in handleConfirmClose:', error);
    }
  }

  async handleCloseReasonModal(interaction) {
    try {
      const reason = interaction.fields.getTextInputValue('close_reason');

      // Acknowledge the modal submission silently
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      await this.closeTicket(interaction.channel, interaction.user, reason, interaction.id);
    } catch (error) {
      console.error('Error in handleCloseReasonModal:', error);
    }
  }

  async closeTicket(channel, closedBy, reason = null, interactionId = null) {
    try {
      // Find ticket in database
      const ticket = await Ticket.findOne({ channelId: channel.id });
      if (!ticket) {
        console.error('Ticket not found in database');
        return;
      }

      // Prevent duplicate processing using interaction ID
      if (interactionId && ticket.closingInteractionId === interactionId) {
        console.log(`⚠️ Duplicate close attempt detected for ticket ${ticket.ticketId}, ignoring`);
        return;
      }

      // Mark ticket as being closed by this interaction
      if (interactionId) {
        ticket.closingInteractionId = interactionId;
        await ticket.save();
      }

      // Fetch all messages from the channel for transcript
      const messages = await channel.messages.fetch({ limit: 100 });
      const sortedMessages = Array.from(messages.values())
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .filter(msg => !msg.author.bot || msg.embeds.length > 0 || msg.content.length > 0);

      // Add messages to ticket
      for (const msg of sortedMessages) {
        await Ticket.addMessage(ticket.ticketId, {
          messageId: msg.id,
          content: msg.content,
          author: {
            userId: msg.author.id,
            username: msg.author.username,
            displayName: msg.member?.displayName || msg.author.username,
            avatar: msg.author.displayAvatarURL(),
            isBot: msg.author.bot
          },
          timestamp: msg.createdAt,
          attachments: msg.attachments.map(att => ({
            name: att.name,
            url: att.url
          }))
        });
      }

      // Close ticket in database
      await Ticket.closeTicket(ticket.ticketId, {
        userId: closedBy.id,
        username: closedBy.username,
        displayName: closedBy.displayName || closedBy.username
      }, reason);

      // Reload ticket with updated data
      const updatedTicket = await Ticket.findOne({ ticketId: ticket.ticketId });

      // Generate transcript
      const transcriptHTML = TranscriptGenerator.generateHTML(updatedTicket.toObject());
      const transcriptPath = await TranscriptGenerator.saveToFile(ticket.ticketId, transcriptHTML);
      const transcriptUrl = `https://opsicos.onrender.com${transcriptPath}`;

      // Update ticket with transcript URL
      updatedTicket.transcriptUrl = transcriptUrl;
      await updatedTicket.save();

      // Calculate duration
      const duration = updatedTicket.closedAt - updatedTicket.createdAt;
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

      // Create closure embed
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription('This ticket has been closed.')
        .setColor('#ef4444')
        .addFields(
          { name: '📋 Ticket ID', value: ticket.ticketId, inline: true },
          { name: '⏱️ Duration', value: `${hours}h ${minutes}m`, inline: true },
          { name: '👤 Ticket Creator', value: ticket.creator.displayName || ticket.creator.username, inline: false },
          { name: '🔒 Closed By', value: closedBy.displayName || closedBy.username, inline: false },
          { name: '📅 Created At', value: `<t:${Math.floor(updatedTicket.createdAt.getTime() / 1000)}:F>`, inline: true },
          { name: '📅 Closed At', value: `<t:${Math.floor(updatedTicket.closedAt.getTime() / 1000)}:F>`, inline: true }
        )
        .setFooter({ 
          text: 'Opsicos Ticket System',
          iconURL: TICKET_CONFIG.THUMBNAIL_URL
        })
        .setTimestamp();

      if (reason) {
        closeEmbed.addFields({ name: '📝 Close Reason', value: reason, inline: false });
      }

      closeEmbed.addFields({
        name: '📄 Ticket Transcript',
        value: `[Click here to view transcript](${transcriptUrl})`,
        inline: false
      });

      // Create "View Transcript" button for easy access
      const transcriptButton = new ButtonBuilder()
        .setLabel('View Transcript')
        .setStyle(ButtonStyle.Link)
        .setURL(transcriptUrl)
        .setEmoji('📄');

      const transcriptRow = new ActionRowBuilder().addComponents(transcriptButton);

      // Send closure message to ticket creator's DM (no fallback to channel)
      try {
        const creator = await channel.guild.members.fetch(ticket.creator.userId);
        await creator.send({ 
          embeds: [closeEmbed],
          components: [transcriptRow]
        });
        console.log(`✅ Close summary with transcript button sent to ${ticket.creator.username}'s DM`);
      } catch (dmError) {
        console.error(`⚠️ Failed to send DM to ticket creator: ${dmError.message}`);
        // No fallback - just log the error
      }

      // Send transcript to logging channel
      try {
        const logChannel = await channel.guild.channels.fetch(TICKET_CONFIG.TRANSCRIPT_CHANNEL_ID);
        if (logChannel) {
          await logChannel.send({ 
            embeds: [closeEmbed],
            components: [transcriptRow]
          });
          console.log(`✅ Transcript with button sent to logging channel for ticket ${ticket.ticketId}`);
        }
      } catch (error) {
        console.error('Error sending to logging channel:', error);
      }

      // Delete channel INSTANTLY with no delay
      try {
        await channel.delete('Ticket closed');
        console.log(`✅ Ticket channel deleted instantly: ${ticket.ticketId}`);
      } catch (error) {
        console.error('Error deleting ticket channel:', error);
      }

      console.log(`✅ Ticket ${ticket.ticketId} closed by ${closedBy.username}`);
    } catch (error) {
      console.error('Error in closeTicket:', error);
      await channel.send('❌ An error occurred while closing the ticket. Please contact an administrator.').catch(() => {});
    }
  }

  async trackTicketMessage(message) {
    try {
      // Find ticket by channel ID
      const ticket = await Ticket.findOne({ channelId: message.channel.id, status: 'open' });
      if (!ticket) return;

      // Add message to ticket
      await Ticket.addMessage(ticket.ticketId, {
        messageId: message.id,
        content: message.content,
        author: {
          userId: message.author.id,
          username: message.author.username,
          displayName: message.member?.displayName || message.author.username,
          avatar: message.author.displayAvatarURL(),
          isBot: message.author.bot
        },
        timestamp: message.createdAt,
        attachments: message.attachments.map(att => ({
          name: att.name,
          url: att.url
        }))
      });
    } catch (error) {
      console.error('Error tracking ticket message:', error);
    }
  }
}

module.exports = TicketService;