const mongoose = require('mongoose');

const botSmartnessSchema = new mongoose.Schema({
  // AI Intelligence Settings
  botId: {
    type: String,
    required: true,
    ref: 'Bot'
  },
  temperature: {
    type: Number,
    default: 0.7,
    min: 0,
    max: 2
  },
  creativity: {
    type: String,
    enum: ['low', 'medium', 'high', 'maximum'],
    default: 'medium'
  },
  smartnessMode: {
    type: String,
    enum: ['quick', 'balanced', 'deep', 'expert'],
    default: 'balanced'
  },

  // Human-Like Behavior
  useNicknames: {
    type: Boolean,
    default: false
  },
  naturalFlow: {
    type: Boolean,
    default: false
  },
  typingSimulation: {
    type: Boolean,
    default: false
  },
  addCommaEnd: {
    type: Boolean,
    default: false
  },
  emojiUsage: {
    type: Boolean,
    default: false
  },
  emojiFrequency: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  occasionalTypos: {
    type: Boolean,
    default: false
  },
  typoFrequency: {
    type: String,
    enum: ['low', 'medium'],
    default: 'low'
  },

  // Playful Interactions
  funPinging: {
    type: Boolean,
    default: false
  },
  ghostPings: {
    type: Boolean,
    default: false
  },
  proactivityLevel: {
    type: Number,
    default: 30,
    min: 0,
    max: 100
  },
  randomReactions: {
    type: Boolean,
    default: false
  },
  dadJokesMode: {
    type: Boolean,
    default: false
  },

  // Behavioral Rules
  commandPrecision: {
    type: String,
    enum: ['strict', 'flexible'],
    default: 'flexible'
  },
  customRules: {
    type: [String],
    default: []
  },

  // Free Will & Autonomy
  decisionFreedom: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  expressOpinions: {
    type: Boolean,
    default: false
  },
  moodSimulation: {
    type: Boolean,
    default: false
  },
  currentMood: {
    type: String,
    default: 'neutral'
  }
}, {
  timestamps: true
});

// Add index on botId for fast lookups
botSmartnessSchema.index({ botId: 1 });

const BotSmartness = mongoose.model('BotSmartness', botSmartnessSchema);

module.exports = BotSmartness;