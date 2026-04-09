const express = require('express');
const router = express.Router();
const BotSmartness = require('../models/BotSmartness');
const Bot = require('../models/Bot');
const { isAuthenticated } = require('../middleware/auth');
const { clearSmartnessCache } = require('../services/discordBotService');

/**
 * Helper function to get default smartness settings
 */
const getDefaultSettings = () => ({
  // AI Intelligence Settings
  temperature: 0.7,
  creativity: 'medium',
  smartnessMode: 'balanced',

  // Human-Like Behavior
  useNicknames: false,
  naturalFlow: false,
  typingSimulation: false,
  addCommaEnd: false,
  emojiUsage: false,
  emojiFrequency: 30,
  occasionalTypos: false,
  typoFrequency: 'low',

  // Playful Interactions
  funPinging: false,
  ghostPings: false,
  proactivityLevel: 30,
  randomReactions: false,
  dadJokesMode: false,

  // Behavioral Rules
  commandPrecision: 'flexible',
  customRules: [],

  // Free Will & Autonomy
  decisionFreedom: 'medium',
  expressOpinions: false,
  moodSimulation: false,
  currentMood: 'neutral'
});

/**
 * Helper function to validate bot ownership
 */
const validateBotOwnership = async (botId, userId) => {
  const bot = await Bot.findOne({ _id: botId, userId: userId });
  if (!bot) {
    return { valid: false, bot: null };
  }
  return { valid: true, bot };
};

/**
 * @route   GET /api/smartness/:botId
 * @desc    Fetch smartness settings for a bot
 * @access  Private
 */
router.get('/api/smartness/:botId', isAuthenticated, async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify user owns the bot
    const { valid, bot } = await validateBotOwnership(botId, req.user._id);
    if (!valid) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Try to find existing smartness settings
    let smartnessSettings = await BotSmartness.findOne({ botId });

    // If no settings exist, return default values
    if (!smartnessSettings) {
      console.log(`📋 No smartness settings found for bot ${botId}, returning defaults`);
      return res.status(200).json({
        botId,
        botName: bot.botName,
        ...getDefaultSettings(),
        isDefault: true
      });
    }

    console.log(`✅ Smartness settings retrieved for bot ${botId}`);
    res.status(200).json({
      ...smartnessSettings.toObject(),
      botName: bot.botName,
      isDefault: false
    });
  } catch (error) {
    console.error('Error fetching smartness settings:', error);
    res.status(500).json({ error: 'Server error while fetching smartness settings' });
  }
});

/**
 * @route   PUT /api/smartness/:botId
 * @desc    Update smartness settings
 * @access  Private
 */
router.put('/api/smartness/:botId', isAuthenticated, async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify user owns the bot
    const { valid, bot } = await validateBotOwnership(botId, req.user._id);
    if (!valid) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Validate input fields
    const {
      temperature,
      creativity,
      smartnessMode,
      useNicknames,
      naturalFlow,
      typingSimulation,
      addCommaEnd,
      emojiUsage,
      emojiFrequency,
      occasionalTypos,
      typoFrequency,
      funPinging,
      ghostPings,
      proactivityLevel,
      randomReactions,
      dadJokesMode,
      commandPrecision,
      customRules,
      decisionFreedom,
      expressOpinions,
      moodSimulation,
      currentMood
    } = req.body;

    // Validate temperature
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return res.status(400).json({ error: 'Temperature must be between 0 and 2' });
    }

    // Validate creativity
    if (creativity !== undefined && !['low', 'medium', 'high', 'maximum'].includes(creativity)) {
      return res.status(400).json({ error: 'Invalid creativity level' });
    }

    // Validate smartnessMode
    if (smartnessMode !== undefined && !['quick', 'balanced', 'deep', 'expert'].includes(smartnessMode)) {
      return res.status(400).json({ error: 'Invalid smartness mode' });
    }

    // Validate emojiFrequency
    if (emojiFrequency !== undefined && (emojiFrequency < 0 || emojiFrequency > 100)) {
      return res.status(400).json({ error: 'Emoji frequency must be between 0 and 100' });
    }

    // Validate typoFrequency
    if (typoFrequency !== undefined && !['low', 'medium'].includes(typoFrequency)) {
      return res.status(400).json({ error: 'Invalid typo frequency' });
    }

    // Validate proactivityLevel
    if (proactivityLevel !== undefined && (proactivityLevel < 0 || proactivityLevel > 100)) {
      return res.status(400).json({ error: 'Proactivity level must be between 0 and 100' });
    }

    // Validate commandPrecision
    if (commandPrecision !== undefined && !['strict', 'flexible'].includes(commandPrecision)) {
      return res.status(400).json({ error: 'Invalid command precision' });
    }

    // Validate decisionFreedom
    if (decisionFreedom !== undefined && !['low', 'medium', 'high'].includes(decisionFreedom)) {
      return res.status(400).json({ error: 'Invalid decision freedom level' });
    }

    // Validate customRules
    if (customRules !== undefined && !Array.isArray(customRules)) {
      return res.status(400).json({ error: 'Custom rules must be an array' });
    }

    // Prepare update data
    const updateData = {};
    if (temperature !== undefined) updateData.temperature = temperature;
    if (creativity !== undefined) updateData.creativity = creativity;
    if (smartnessMode !== undefined) updateData.smartnessMode = smartnessMode;
    if (useNicknames !== undefined) updateData.useNicknames = useNicknames;
    if (naturalFlow !== undefined) updateData.naturalFlow = naturalFlow;
    if (typingSimulation !== undefined) updateData.typingSimulation = typingSimulation;
    if (addCommaEnd !== undefined) updateData.addCommaEnd = addCommaEnd;
    if (emojiUsage !== undefined) updateData.emojiUsage = emojiUsage;
    if (emojiFrequency !== undefined) updateData.emojiFrequency = emojiFrequency;
    if (occasionalTypos !== undefined) updateData.occasionalTypos = occasionalTypos;
    if (typoFrequency !== undefined) updateData.typoFrequency = typoFrequency;
    if (funPinging !== undefined) updateData.funPinging = funPinging;
    if (ghostPings !== undefined) updateData.ghostPings = ghostPings;
    if (proactivityLevel !== undefined) updateData.proactivityLevel = proactivityLevel;
    if (randomReactions !== undefined) updateData.randomReactions = randomReactions;
    if (dadJokesMode !== undefined) updateData.dadJokesMode = dadJokesMode;
    if (commandPrecision !== undefined) updateData.commandPrecision = commandPrecision;
    if (customRules !== undefined) updateData.customRules = customRules;
    if (decisionFreedom !== undefined) updateData.decisionFreedom = decisionFreedom;
    if (expressOpinions !== undefined) updateData.expressOpinions = expressOpinions;
    if (moodSimulation !== undefined) updateData.moodSimulation = moodSimulation;
    if (currentMood !== undefined) updateData.currentMood = currentMood;

    // Create new settings if none exist, otherwise update
    let smartnessSettings = await BotSmartness.findOneAndUpdate(
      { botId },
      { botId, ...updateData },
      { new: true, upsert: true, runValidators: true }
    );

    // Clear cache after update
    clearSmartnessCache(botId);
    console.log(`✅ Smartness settings updated for bot ${botId}`);
    
    res.status(200).json({
      message: 'Smartness settings updated successfully',
      settings: smartnessSettings
    });
  } catch (error) {
    console.error('Error updating smartness settings:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Server error while updating smartness settings' });
  }
});

/**
 * @route   POST /api/smartness/:botId/reset
 * @desc    Reset to default settings
 * @access  Private
 */
router.post('/api/smartness/:botId/reset', isAuthenticated, async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify user owns the bot
    const { valid, bot } = await validateBotOwnership(botId, req.user._id);
    if (!valid) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Reset all settings to defaults
    const defaultSettings = getDefaultSettings();
    
    const smartnessSettings = await BotSmartness.findOneAndUpdate(
      { botId },
      { botId, ...defaultSettings },
      { new: true, upsert: true, runValidators: true }
    );

    // Clear cache after reset
    clearSmartnessCache(botId);
    console.log(`🔄 Smartness settings reset to defaults for bot ${botId}`);
    
    res.status(200).json({
      message: 'Smartness settings reset to defaults successfully',
      settings: smartnessSettings
    });
  } catch (error) {
    console.error('Error resetting smartness settings:', error);
    res.status(500).json({ error: 'Server error while resetting smartness settings' });
  }
});

/**
 * @route   POST /api/smartness/:botId/test
 * @desc    Test current configuration
 * @access  Private
 */
router.post('/api/smartness/:botId/test', isAuthenticated, async (req, res) => {
  try {
    const { botId } = req.params;

    // Verify user owns the bot
    const { valid, bot } = await validateBotOwnership(botId, req.user._id);
    if (!valid) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get current smartness settings or use defaults
    let smartnessSettings = await BotSmartness.findOne({ botId });
    if (!smartnessSettings) {
      smartnessSettings = getDefaultSettings();
    }

    // Generate a sample response based on current settings
    const sampleResponse = {
      botName: bot.botName,
      currentSettings: {
        intelligence: {
          temperature: smartnessSettings.temperature || 0.7,
          creativity: smartnessSettings.creativity || 'medium',
          mode: smartnessSettings.smartnessMode || 'balanced'
        },
        humanBehavior: {
          useNicknames: smartnessSettings.useNicknames || false,
          naturalFlow: smartnessSettings.naturalFlow || false,
          typingSimulation: smartnessSettings.typingSimulation || false,
          emojiUsage: smartnessSettings.emojiUsage || false,
          occasionalTypos: smartnessSettings.occasionalTypos || false
        },
        playfulness: {
          funPinging: smartnessSettings.funPinging || false,
          ghostPings: smartnessSettings.ghostPings || false,
          proactivityLevel: smartnessSettings.proactivityLevel || 30,
          randomReactions: smartnessSettings.randomReactions || false,
          dadJokesMode: smartnessSettings.dadJokesMode || false
        },
        autonomy: {
          decisionFreedom: smartnessSettings.decisionFreedom || 'medium',
          expressOpinions: smartnessSettings.expressOpinions || false,
          moodSimulation: smartnessSettings.moodSimulation || false,
          currentMood: smartnessSettings.currentMood || 'neutral'
        }
      },
      sampleBehavior: {
        responseStyle: generateResponseStyle(smartnessSettings),
        personalityTraits: generatePersonalityTraits(smartnessSettings),
        exampleMessage: generateExampleMessage(smartnessSettings, bot.botName)
      },
      testTimestamp: new Date().toISOString()
    };

    console.log(`🧪 Test configuration generated for bot ${botId}`);
    res.status(200).json(sampleResponse);
  } catch (error) {
    console.error('Error testing smartness configuration:', error);
    res.status(500).json({ error: 'Server error while testing configuration' });
  }
});

/**
 * Helper function to generate response style description
 */
function generateResponseStyle(settings) {
  const styles = [];
  
  if (settings.smartnessMode === 'quick') {
    styles.push('Quick and concise responses');
  } else if (settings.smartnessMode === 'deep') {
    styles.push('Detailed and thorough responses');
  } else if (settings.smartnessMode === 'expert') {
    styles.push('Expert-level comprehensive responses');
  } else {
    styles.push('Balanced and well-rounded responses');
  }
  
  if (settings.creativity === 'high' || settings.creativity === 'maximum') {
    styles.push('Creative and imaginative');
  }
  
  if (settings.naturalFlow) {
    styles.push('Natural conversation flow');
  }
  
  if (settings.emojiUsage) {
    styles.push(`Emoji usage at ${settings.emojiFrequency}% frequency`);
  }
  
  return styles;
}

/**
 * Helper function to generate personality traits
 */
function generatePersonalityTraits(settings) {
  const traits = [];
  
  if (settings.expressOpinions) {
    traits.push('Expresses opinions freely');
  }
  
  if (settings.dadJokesMode) {
    traits.push('Enjoys making dad jokes');
  }
  
  if (settings.moodSimulation) {
    traits.push(`Currently in ${settings.currentMood} mood`);
  }
  
  if (settings.decisionFreedom === 'high') {
    traits.push('High autonomy and decision-making freedom');
  } else if (settings.decisionFreedom === 'low') {
    traits.push('Follows instructions strictly');
  } else {
    traits.push('Balanced autonomy');
  }
  
  if (settings.commandPrecision === 'strict') {
    traits.push('Precise command interpretation');
  } else {
    traits.push('Flexible command interpretation');
  }
  
  return traits;
}

/**
 * Helper function to generate example message
 */
function generateExampleMessage(settings, botName) {
  let message = `Hi! I'm ${botName}. `;
  
  if (settings.naturalFlow) {
    message += `I'll chat with you naturally and keep our conversation flowing smoothly. `;
  } else {
    message += `I'm here to help you with your questions. `;
  }
  
  if (settings.emojiUsage && settings.emojiFrequency > 50) {
    message += `😊 `;
  }
  
  if (settings.dadJokesMode) {
    message += `By the way, why don't scientists trust atoms? Because they make up everything! `;
  }
  
  if (settings.expressOpinions) {
    message += `I love having thoughtful discussions and sharing my perspective on things. `;
  }
  
  if (settings.occasionalTypos && Math.random() > 0.7) {
    message = message.replace('help', 'hlep'); // Intentional typo for demo
  }
  
  if (settings.addCommaEnd) {
    message = message.trim() + ',';
  }
  
  return message.trim();
}

module.exports = router;