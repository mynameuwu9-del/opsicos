const mongoose = require('mongoose');

const BotSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  botToken: {
    type: String,
    required: true,
    unique: true
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
    enum: [
      'provider-3/gpt-4o-mini',
      'provider-3/gpt-5-nano',
      // DeepSeek
      'provider-1/deepseek-r1-distill-qwen-1.5b',
      'provider-1/deepseek-v3.1',
      'provider-1/deepseek-v3.1-turbo',
      'provider-1/deepseek-tng-r1t2-chimera',
      // Google
      'provider-1/gemma-3-4b-it',
      'provider-3/gemini-2.5-flash-lite-preview-09-2025',
      'provider-6/gemma-3-27b-instruct',
      'provider-1/gemma-2-9b-it',
      // InferenceNet
      'provider-6/cliptagger-12b',
      // Meta
      'provider-1/llama-4-scout-17b-16e-instruct',
      'provider-1/llama-3.2-1b-instruct-fp-16',
      'provider-3/llama-4-scout',
      'provider-1/deephermes-3-llama-3-8b-preview',
      'provider-1/shisa-v2-llama3.3-70b',
      // Mistral
      'provider-6/mistral-nemo-12b-instruct',
      'provider-1/mistralai-devstral-small-2505',
      'provider-1/chutesai-devstral-small-2505',
      'provider-1/mistral-small-3.2-24b-instruct-2506',
      // MoonShot AI
      'provider-1/kimi-k2-instruct',
      'provider-1/kimi-vl-a3b-thinking',
      // OpenAI
      'provider-1/gpt-oss-20b',
      'provider-3/gpt-4.1-nano',
      // Qwen
      'provider-1/qwen3-4b-thinking-2507',
      'provider-6/qwen2.5-7b-instruct',
      'provider-1/qwen3-8b',
      'provider-3/qwen-2.5-72b',
      // xAI
      'provider-5/grok-4-0709',
      // Zhipu AI
      'provider-1/glm-4.6'
    ],
    default: 'provider-3/gpt-4o-mini'
  },
  displayModelName: {
    type: String,
    enum: [
      'GPT-4o Mini',
      'GPT-5 Nano',
      // DeepSeek
      'DeepSeek R1 Distill Qwen 1.5B',
      'DeepSeek V3.1',
      'DeepSeek V3.1 Turbo',
      'DeepSeek TNG R1T2 Chimera',
      // Google
      'Gemma 3 4B IT',
      'Gemini 2.5 Flash Lite Preview',
      'Gemma 3 27B Instruct',
      'Gemma 2 9B IT',
      // InferenceNet
      'ClipTagger 12B',
      // Meta
      'Llama 4 Scout 17B 16E Instruct',
      'Llama 3.2 1B Instruct FP-16',
      'Llama 4 Scout',
      'DeepHermes 3 Llama 3 8B Preview',
      'Shisa V2 Llama3.3 70B',
      // Mistral
      'Mistral Nemo 12B Instruct',
      'MistralAI Devstral Small 2505',
      'ChutesAI Devstral Small 2505',
      'Mistral Small 3.2 24B Instruct 2506',
      // MoonShot AI
      'Kimi K2 Instruct',
      'Kimi VL A3B Thinking',
      // OpenAI
      'GPT OSS 20B',
      'GPT-4.1 Nano',
      // Qwen
      'Qwen3 4B Thinking 2507',
      'Qwen2.5 7B Instruct',
      'Qwen3 8B',
      'Qwen 2.5 72B',
      // xAI
      'Grok 4 0709',
      // Zhipu AI
      'GLM 4.6'
    ],
    default: 'GPT-4o Mini'
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
  // Enhanced uptime tracking
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
}, { timestamps: true });

module.exports = mongoose.models.Bot || mongoose.model('Bot', BotSchema); 