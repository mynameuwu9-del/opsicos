const mongoose = require('mongoose');
const { MODEL_IDS, MODEL_DISPLAY_NAMES, DEFAULT_MODEL_ID, DEFAULT_MODEL_NAME } = require('../config/models');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

const BotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  botToken: {
    type: String,
    required: true,
    unique: true,
    set(value) {
      // Encrypt token before storing — skip if already encrypted
      if (value && !isEncrypted(value) && process.env.ENCRYPTION_KEY) {
        return encrypt(value);
      }
      return value;
    },
    get(value) {
      // Decrypt token when reading — skip if not encrypted
      if (value && isEncrypted(value) && process.env.ENCRYPTION_KEY) {
        try {
          return decrypt(value);
        } catch {
          return value; // Return raw if decryption fails (e.g. key changed)
        }
      }
      return value;
    }
  },
  botName: {
    type: String,
    default: 'Opsicos Bot'
  },
  botAvatar: {
    type: String,
    default: null
  },
  selectedModel: {
    type: String,
    enum: MODEL_IDS,
    default: DEFAULT_MODEL_ID
  },
  displayModelName: {
    type: String,
    enum: MODEL_DISPLAY_NAMES,
    default: DEFAULT_MODEL_NAME
  },
  isActive: {
    type: Boolean,
    default: false
  },
  shouldAutoRestart: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['offline', 'online', 'error'],
    default: 'offline'
  },
  lastError: {
    type: String,
    default: null
  },
  guilds: {
    type: [String],
    default: []
  },
  serverCount: {
    type: Number,
    default: 0
  },
  servers: {
    type: Array,
    default: []
  },
  uptimeStartedAt: {
    type: Date,
    default: null
  },
  totalUptime: {
    type: Number,
    default: 0
  },
  uptimeHistory: [{
    startTime: Date,
    endTime: Date,
    duration: Number,
    status: {
      type: String,
      enum: ['online', 'offline', 'error'],
      default: 'offline'
    }
  }],
  lastDowntime: {
    type: Date,
    default: null
  },
  downtimeReason: {
    type: String,
    default: null
  },
  totalDowntime: {
    type: Number,
    default: 0
  },
  incidentCount: {
    type: Number,
    default: 0
  },
  lastIncident: {
    date: Date,
    duration: Number,
    reason: String
  },
  responseTimeHistory: [{
    timestamp: Date,
    responseTime: Number
  }],
  avgResponseTime: {
    type: Number,
    default: 0
  },
  messageHistoryLimit: {
    type: Number,
    enum: [20, 50, 80, 100, 150, 200],
    default: 50
  },
  personality: {
    type: String,
    enum: ['', 'friendly', 'professional', 'chill', 'enthusiastic', 'sarcastic', 'helpful', 'witty', 'serious', 'playful', 'rude'],
    default: ''
  },
  tone: {
    type: String,
    enum: ['', 'casual', 'formal', 'confident', 'humble', 'energetic', 'calm', 'direct', 'diplomatic', 'quirky', 'authoritative'],
    default: ''
  },
  replyToDMs: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    enum: ['english', 'hindi', 'french', 'spanish', 'chinese', 'russian', 'japanese', 'filipino', 'bangla', 'polish'],
    default: 'english'
  },
  sentenceLength: {
    type: String,
    enum: ['1', '2', '3', '4', 'long'],
    default: 'long'
  },
  sentenceLengthDynamic: {
    type: Boolean,
    default: false
  },
  behaviorPreset: {
    type: String,
    enum: ['', 'human-like', 'roleplay', 'robotic', 'natural'],
    default: ''
  },
  specialUsers: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    nickname: {
      type: String,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    identity: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.models.Bot || mongoose.model('Bot', BotSchema);
