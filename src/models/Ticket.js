const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['support', 'partnership'],
    required: true
  },
  categoryChannelId: {
    type: String,
    required: true
  },
  creator: {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    displayName: String,
    avatar: String
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
    index: true
  },
  closedBy: {
    userId: String,
    username: String,
    displayName: String
  },
  closeReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  closedAt: {
    type: Date,
    default: null
  },
  messages: [{
    messageId: String,
    content: String,
    author: {
      userId: String,
      username: String,
      displayName: String,
      avatar: String,
      isBot: Boolean
    },
    timestamp: Date,
    attachments: [{
      name: String,
      url: String
    }]
  }],
  transcriptUrl: {
    type: String,
    default: null
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
TicketSchema.index({ guildId: 1, status: 1, createdAt: -1 });
TicketSchema.index({ 'creator.userId': 1, status: 1 });
TicketSchema.index({ 'creator.username': 1, createdAt: -1 });
TicketSchema.index({ 'creator.displayName': 1, createdAt: -1 });

// Static method to generate unique ticket ID
TicketSchema.statics.generateTicketId = async function(guildId) {
  const count = await this.countDocuments({ guildId });
  return `ticket-${count + 1}`;
};

// Static method to add message to ticket
TicketSchema.statics.addMessage = async function(ticketId, messageData) {
  const ticket = await this.findOne({ ticketId });
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  
  ticket.messages.push({
    messageId: messageData.messageId,
    content: messageData.content,
    author: messageData.author,
    timestamp: messageData.timestamp || new Date(),
    attachments: messageData.attachments || []
  });
  
  await ticket.save();
  return ticket;
};

// Static method to close ticket
TicketSchema.statics.closeTicket = async function(ticketId, closedBy, reason = null) {
  const ticket = await this.findOne({ ticketId });
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  
  ticket.status = 'closed';
  ticket.closedBy = closedBy;
  ticket.closeReason = reason;
  ticket.closedAt = new Date();
  
  await ticket.save();
  return ticket;
};

// Static method to get open tickets for user
TicketSchema.statics.getUserOpenTickets = async function(guildId, userId) {
  return this.find({ 
    guildId, 
    'creator.userId': userId, 
    status: 'open' 
  });
};

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);