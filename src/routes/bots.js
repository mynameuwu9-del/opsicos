const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Bot = require('../models/Bot');
const discordBotService = require('../services/discordBotService');
const webhookService = require('../services/webhookService');
const aiProviderService = require('../services/aiProviderService');

// Debug endpoint to get status of all bots
router.get('/status', async (req, res) => {
    try {
        const bots = await Bot.find({});
        const activeBots = discordBotService.getActiveBots();
        
        const botsWithStatus = bots.map(bot => {
            const botId = bot._id.toString();
            const isActive = activeBots.some(activeBot => activeBot.botId === botId);
            
            // Calculate current uptime
            let currentUptime = bot.totalUptime || 0;
            if (isActive && bot.uptimeStartedAt) {
                const sessionUptime = Date.now() - new Date(bot.uptimeStartedAt).getTime();
                currentUptime += sessionUptime;
            }
            
            return {
                _id: bot._id,
                botName: bot.botName,
                isActive,
                status: isActive ? 'online' : 'offline',
                selectedModel: bot.selectedModel,
                serverCount: bot.serverCount || 0,
                lastError: bot.lastError || null,
                uptime: currentUptime,
                uptimeFormatted: formatUptime(currentUptime)
            };
        });
        
        res.json(botsWithStatus);
    } catch (error) {
        console.error('Error getting bot status:', error);
        res.status(500).json({ error: 'Failed to get bot status' });
    }
});

// Helper function to format uptime
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`;
}

// 🔥 REMOVED: Duplicate stop route - using the one below with proper shouldAutoRestart handling

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * @route   GET /bots
 * @desc    Get all bots for the current user with real-time status
 * @access  Private
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    console.log('🔍 Loading bots for user:', req.user._id);
    const bots = await Bot.find({ userId: req.user._id });
    console.log('🤖 Found', bots.length, 'bots for user');

    // 🔥 FIX: Improved real-time status synchronization
    const botsWithRealTimeStatus = bots.map(bot => {
      const botId = bot._id.toString();
      const activeBots = discordBotService.getActiveBots();
      const activeBot = activeBots.find(ab => ab.botId === botId);

      // Calculate current uptime
      let currentUptime = bot.totalUptime || 0;
      if (bot.isActive && bot.uptimeStartedAt) {
        const sessionUptime = Date.now() - new Date(bot.uptimeStartedAt).getTime();
        currentUptime += sessionUptime;
      }

      // 🔥 FIX: More robust status determination
      let actualStatus = 'offline';
      let actualIsActive = false;

      if (activeBot) {
        // Bot is definitely running in memory
        actualStatus = activeBot.status === 'ready' ? 'online' : 'connecting';
        actualIsActive = true;

        // Update database if it's out of sync (async, don't wait)
        if (bot.status !== actualStatus || bot.isActive !== actualIsActive) {
          Bot.findByIdAndUpdate(botId, {
            status: actualStatus,
            isActive: actualIsActive,
            uptimeStartedAt: bot.uptimeStartedAt || new Date() // Ensure uptime tracking
          }).catch(console.error);
        }
      } else {
        // Bot is not in memory
        actualStatus = 'offline';
        actualIsActive = false;

        // Update database if it thinks bot is online (async, don't wait)
        if (bot.status === 'online' || bot.isActive === true) {
          Bot.findByIdAndUpdate(botId, {
            status: 'offline',
            isActive: false,
            uptimeStartedAt: null
          }).catch(console.error);
        }
      }

      // Return bot with corrected status
      return {
        ...bot.toObject(),
        status: actualStatus,
        isActive: actualIsActive,
        currentUptime: currentUptime,
        instanceId: activeBot?.instanceId || null,
        lastSyncCheck: new Date().toISOString()
      };
    });

    console.log('✅ Returning', botsWithRealTimeStatus.length, 'bots to frontend');
    res.json(botsWithRealTimeStatus);
  } catch (error) {
    console.error('❌ Error fetching bots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /bots
 * @desc    Create a new bot
 * @access  Private
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { botToken, botName, selectedModel } = req.body;
    
    if (!botToken) {
      return res.status(400).json({ error: 'Bot token is required' });
    }

    // Check if user already has 2 bots
    const userBotCount = await Bot.countDocuments({ userId: req.user._id });
    if (userBotCount >= 2) {
      return res.status(403).json({ error: 'You can only add a maximum of 2 bots per account.' });
    }

    // Check if this specific bot token already exists for the current user
    const existingBotForUser = await Bot.findOne({ userId: req.user._id, botToken });
    if (existingBotForUser) {
      return res.status(409).json({ error: 'You already have a bot with this token.' });
    }
    
    // Check if model is valid
    const modelId = selectedModel || 'claude-opus-4';
    
    // Map model IDs to display names
    const modelDisplayMap = {
      'provider-3/gpt-4o-mini': 'GPT-4o Mini',
      'provider-3/gpt-5-nano': 'GPT-5 Nano',
      // DeepSeek
      'provider-1/deepseek-r1-distill-qwen-1.5b': 'DeepSeek R1 Distill Qwen 1.5B',
      'provider-1/deepseek-v3.1': 'DeepSeek V3.1',
      'provider-1/deepseek-v3.1-turbo': 'DeepSeek V3.1 Turbo',
      'provider-1/deepseek-tng-r1t2-chimera': 'DeepSeek TNG R1T2 Chimera',
      // Google
      'provider-1/gemma-3-4b-it': 'Gemma 3 4B IT',
      'provider-3/gemini-2.5-flash-lite-preview-09-2025': 'Gemini 2.5 Flash Lite Preview',
      'provider-6/gemma-3-27b-instruct': 'Gemma 3 27B Instruct',
      'provider-1/gemma-2-9b-it': 'Gemma 2 9B IT',
      // InferenceNet
      'provider-6/cliptagger-12b': 'ClipTagger 12B',
      // Meta
      'provider-1/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B 16E Instruct',
      'provider-1/llama-3.2-1b-instruct-fp-16': 'Llama 3.2 1B Instruct FP-16',
      'provider-3/llama-4-scout': 'Llama 4 Scout',
      'provider-1/deephermes-3-llama-3-8b-preview': 'DeepHermes 3 Llama 3 8B Preview',
      'provider-1/shisa-v2-llama3.3-70b': 'Shisa V2 Llama3.3 70B',
      // Mistral
      'provider-6/mistral-nemo-12b-instruct': 'Mistral Nemo 12B Instruct',
      'provider-1/mistralai-devstral-small-2505': 'MistralAI Devstral Small 2505',
      'provider-1/chutesai-devstral-small-2505': 'ChutesAI Devstral Small 2505',
      'provider-1/mistral-small-3.2-24b-instruct-2506': 'Mistral Small 3.2 24B Instruct 2506',
      // MoonShot AI
      'provider-1/kimi-k2-instruct': 'Kimi K2 Instruct',
      'provider-1/kimi-vl-a3b-thinking': 'Kimi VL A3B Thinking',
      // OpenAI
      'provider-1/gpt-oss-20b': 'GPT OSS 20B',
      'provider-3/gpt-4.1-nano': 'GPT-4.1 Nano',
      // Qwen
      'provider-1/qwen3-4b-thinking-2507': 'Qwen3 4B Thinking 2507',
      'provider-6/qwen2.5-7b-instruct': 'Qwen2.5 7B Instruct',
      'provider-1/qwen3-8b': 'Qwen3 8B',
      'provider-3/qwen-2.5-72b': 'Qwen 2.5 72B',
      // xAI
      'provider-5/grok-4-0709': 'Grok 4 0709',
      // Zhipu AI
      'provider-1/glm-4.6': 'GLM 4.6',
      'glm-4.5v': 'GLM 4.5V',
      // Anthropic (Custom Router)
      'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet'
    };
    
    const displayModelName = modelDisplayMap[modelId] || 'Unknown Model';

    // Fetch bot information from Discord
    let botInfo;
    try {
      botInfo = await discordBotService.fetchBotInfo(botToken);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid bot token. Please check your token and try again.' });
    }

    const finalBotName = botName || botInfo.username || 'Opsicos Bot';

    // 🔥 NEW: Check for existing bot profile to restore data
    const BotProfile = require('../models/BotProfile');
    let restoredData = {};
    let existingProfile = null;

    try {
      existingProfile = await BotProfile.findOne({
        userId: req.user._id,
        botName: finalBotName
      });

      if (existingProfile) {
        console.log(`🔄 Found existing profile for "${finalBotName}", restoring data...`);
        restoredData = {
          personality: existingProfile.personality,
          tone: existingProfile.tone,
          messageHistoryLimit: existingProfile.messageHistoryLimit,
          replyToDMs: existingProfile.replyToDMs
        };

        // Update the profile's last used timestamp
        await existingProfile.touch();
      }
    } catch (error) {
      console.error('Error checking for bot profile:', error);
      // Continue with creation even if profile check fails
    }

    // Create new bot with restored data
    const newBot = new Bot({
      userId: req.user._id,
      botToken,
      botName: finalBotName,
      botAvatar: botInfo.avatar,
      selectedModel: modelId,
      displayModelName,
      ...restoredData // Spread restored personality, tone, etc.
    });

    await newBot.save();

    // 🔥 NEW: Restore knowledge entries from profile if any existed
    if (existingProfile && existingProfile.knowledgeEntries.length > 0) {
      try {
        const Knowledge = require('../models/Knowledge');

        // Create new knowledge entries for this bot from the profile
        const knowledgePromises = existingProfile.knowledgeEntries
          .filter(entry => entry.isActive)
          .map(entry => {
            const newKnowledge = new Knowledge({
              botId: newBot._id,
              userId: req.user._id,
              title: entry.title,
              content: entry.content,
              tags: entry.tags || [],
              priority: entry.priority || 0,
              isActive: entry.isActive
            });
            return newKnowledge.save();
          });

        await Promise.all(knowledgePromises);
        console.log(`🧠 Restored ${knowledgePromises.length} knowledge entries to new bot from profile`);
      } catch (error) {
        console.error('Error restoring knowledge from profile:', error);
        // Don't fail bot creation if knowledge restoration fails
      }
    }
    
    res.status(201).json(newBot);
  } catch (error) {
    // Handle duplicate key error (botToken unique constraint)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.botToken) {
      return res.status(409).json({ error: 'This bot token is already in use by another account.' });
    }
    console.error('Error creating bot:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

/**
 * @route   GET /bots/:id
 * @desc    Get a bot by ID
 * @access  Private
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    res.json(bot);
  } catch (error) {
    console.error('Error fetching bot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /bots/:id
 * @desc    Update a bot
 * @access  Private
 */
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { botName, selectedModel, replyToDMs } = req.body;
    const updateData = {};
    
    if (botName) updateData.botName = botName;
    if (replyToDMs !== undefined) updateData.replyToDMs = replyToDMs;
    
    if (selectedModel) {
      updateData.selectedModel = selectedModel;
      
      // Map model IDs to display names
      const modelDisplayMap = {
        'provider-3/gpt-4o-mini': 'GPT-4o Mini',
        'provider-3/gpt-5-nano': 'GPT-5 Nano',
        // DeepSeek
        'provider-1/deepseek-r1-distill-qwen-1.5b': 'DeepSeek R1 Distill Qwen 1.5B',
        'provider-1/deepseek-v3.1': 'DeepSeek V3.1',
        'provider-1/deepseek-v3.1-turbo': 'DeepSeek V3.1 Turbo',
        'provider-1/deepseek-tng-r1t2-chimera': 'DeepSeek TNG R1T2 Chimera',
        // Google
        'provider-1/gemma-3-4b-it': 'Gemma 3 4B IT',
        'provider-3/gemini-2.5-flash-lite-preview-09-2025': 'Gemini 2.5 Flash Lite Preview',
        'provider-6/gemma-3-27b-instruct': 'Gemma 3 27B Instruct',
        'provider-1/gemma-2-9b-it': 'Gemma 2 9B IT',
        // InferenceNet
        'provider-6/cliptagger-12b': 'ClipTagger 12B',
        // Meta
        'provider-1/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B 16E Instruct',
        'provider-1/llama-3.2-1b-instruct-fp-16': 'Llama 3.2 1B Instruct FP-16',
        'provider-3/llama-4-scout': 'Llama 4 Scout',
        'provider-1/deephermes-3-llama-3-8b-preview': 'DeepHermes 3 Llama 3 8B Preview',
        'provider-1/shisa-v2-llama3.3-70b': 'Shisa V2 Llama3.3 70B',
        // Mistral
        'provider-6/mistral-nemo-12b-instruct': 'Mistral Nemo 12B Instruct',
        'provider-1/mistralai-devstral-small-2505': 'MistralAI Devstral Small 2505',
        'provider-1/chutesai-devstral-small-2505': 'ChutesAI Devstral Small 2505',
        'provider-1/mistral-small-3.2-24b-instruct-2506': 'Mistral Small 3.2 24B Instruct 2506',
        // MoonShot AI
        'provider-1/kimi-k2-instruct': 'Kimi K2 Instruct',
        'provider-1/kimi-vl-a3b-thinking': 'Kimi VL A3B Thinking',
        // OpenAI
        'provider-1/gpt-oss-20b': 'GPT OSS 20B',
        'provider-3/gpt-4.1-nano': 'GPT-4.1 Nano',
        // Qwen
        'provider-1/qwen3-4b-thinking-2507': 'Qwen3 4B Thinking 2507',
        'provider-6/qwen2.5-7b-instruct': 'Qwen2.5 7B Instruct',
        'provider-1/qwen3-8b': 'Qwen3 8B',
        'provider-3/qwen-2.5-72b': 'Qwen 2.5 72B',
        // xAI
        'provider-5/grok-4-0709': 'Grok 4 0709',
        // Zhipu AI
        'provider-1/glm-4.6': 'GLM 4.6',
        'glm-4.5v': 'GLM 4.5V',
        // Anthropic (Custom Router)
        'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet'
      };
      
      updateData.displayModelName = modelDisplayMap[selectedModel] || 'Unknown Model';
    }
    
    const bot = await Bot.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // 🔥 HOT RELOAD: Log configuration update for running bots
    const activeBots = discordBotService.getActiveBots();
    const isRunning = activeBots.find(ab => ab.botId === req.params.id);

    if (isRunning) {
      console.log(`🔄 Bot ${req.params.id} configuration updated while running - changes will take effect on next message`);
      if (selectedModel) {
        console.log(`📝 Model changed to: ${selectedModel} (${updateData.displayModelName})`);
      }
    }

    res.json(bot);
  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /bots/:id
 * @desc    Delete a bot
 * @access  Private
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    // First find the bot to ensure user owns it
    const botToDelete = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!botToDelete) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Stop bot if it's running
    if (botToDelete.isActive) {
      console.log(`Stopping bot ${botToDelete.botName} before deletion`);
      await discordBotService.stopBot(botToDelete);
    }

    // 🔥 NEW: Save bot profile before deletion for future restoration
    try {
      const BotProfile = require('../models/BotProfile');
      const Knowledge = require('../models/Knowledge');

      // Get all knowledge entries for this bot
      const allKnowledge = await Knowledge.find({
        botId: new mongoose.Types.ObjectId(req.params.id),
        isActive: true
      }).select('title content tags priority isActive createdAt');

      // Save or update bot profile
      await BotProfile.findOneAndUpdate(
        { userId: req.user._id, botName: botToDelete.botName },
        {
          userId: req.user._id,
          botName: botToDelete.botName,
          personality: botToDelete.personality,
          tone: botToDelete.tone,
          messageHistoryLimit: botToDelete.messageHistoryLimit,
          replyToDMs: botToDelete.replyToDMs,
          knowledgeEntries: allKnowledge.map(k => ({
            title: k.title,
            content: k.content,
            tags: k.tags || [],
            priority: k.priority || 0,
            isActive: k.isActive,
            createdAt: k.createdAt
          })),
          lastUsedAt: new Date()
        },
        { upsert: true, new: true }
      );
      console.log(`💾 Saved bot profile for "${botToDelete.botName}" before deletion`);
    } catch (error) {
      console.error('Error saving bot profile before deletion:', error);
      // Continue with deletion even if profile saving fails
    }

    // Delete bot from database
    await Bot.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bot deleted successfully' });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /bots/:id/start
 * @desc    Start a bot
 * @access  Private
 */
router.post('/:id/start', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const result = await discordBotService.startBot(bot);
    
    if (result.success) {
      const updatedBot = await Bot.findById(req.params.id); // Fetch updated bot
      
      // 🔔 Send webhook notification for bot started
      webhookService.notifyBotStarted(req.user._id, bot.botName, 'Bot manually started by user').catch(error => {
        console.error('Error sending bot started webhook:', error);
      });
      
      res.json(updatedBot);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error starting bot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /bots/:id/stop
 * @desc    Stop a bot
 * @access  Private
 */
router.post('/:id/stop', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const result = await discordBotService.stopBot(bot);

    if (result.success) {
      // Mark bot as manually stopped (should not auto-restart)
      await Bot.findByIdAndUpdate(req.params.id, { shouldAutoRestart: false });
      const updatedBot = await Bot.findById(req.params.id); // Fetch updated bot
      
      // 🔔 Send webhook notification for bot stopped
      webhookService.notifyBotStopped(req.user._id, bot.botName, 'Bot manually stopped by user').catch(error => {
        console.error('Error sending bot stopped webhook:', error);
      });
      
      res.json(updatedBot);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error stopping bot:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /bots/:id/features
 * @desc    Update bot features (message history limit, etc.)
 * @access  Private
 */
router.put('/:id/features', isAuthenticated, async (req, res) => {
  try {
    const { messageHistoryLimit, personality, tone, replyToDMs, language, sentenceLength, sentenceLengthDynamic } = req.body;
    const updateData = {};

    // Validate message history limit
    if (messageHistoryLimit !== undefined) {
      const validLimits = [20, 50, 80, 100, 150, 200];
      if (!validLimits.includes(parseInt(messageHistoryLimit))) {
        return res.status(400).json({ error: 'Invalid message history limit. Must be one of: 20, 50, 80, 100, 150, 200' });
      }
      updateData.messageHistoryLimit = parseInt(messageHistoryLimit);
    }

    // Validate personality (optional)
    if (personality !== undefined) {
      const validPersonalities = ['', 'friendly', 'professional', 'chill', 'enthusiastic', 'sarcastic', 'helpful', 'witty', 'serious', 'playful', 'rude'];
      if (!validPersonalities.includes(personality)) {
        return res.status(400).json({ error: 'Invalid personality. Must be one of: ' + validPersonalities.filter(p => p !== '').join(', ') + ', or empty for none' });
      }
      updateData.personality = personality;
    }

    // Validate tone (optional)
    if (tone !== undefined) {
      const validTones = ['', 'casual', 'formal', 'confident', 'humble', 'energetic', 'calm', 'direct', 'diplomatic', 'quirky', 'authoritative'];
      if (!validTones.includes(tone)) {
        return res.status(400).json({ error: 'Invalid tone. Must be one of: ' + validTones.filter(t => t !== '').join(', ') + ', or empty for none' });
      }
      updateData.tone = tone;
    }

    // Validate replyToDMs (optional)
    if (replyToDMs !== undefined) {
      updateData.replyToDMs = !!replyToDMs;
    }

    if (req.body.replyToDMs !== undefined) {
      updateData.replyToDMs = !!req.body.replyToDMs;
    }

    // Validate language (optional)
    if (language !== undefined) {
      const validLanguages = ['english', 'hindi', 'french', 'spanish', 'chinese', 'russian', 'japanese', 'filipino', 'bangla', 'polish'];
      if (!validLanguages.includes(language)) {
        return res.status(400).json({ error: 'Invalid language. Must be one of: ' + validLanguages.join(', ') });
      }
      updateData.language = language;
    }

    // Validate sentenceLength (optional)
    if (sentenceLength !== undefined) {
      const validSentenceLengths = ['1', '2', '3', '4', 'long'];
      if (!validSentenceLengths.includes(sentenceLength)) {
        return res.status(400).json({ error: 'Invalid sentence length. Must be one of: 1, 2, 3, 4, or long' });
      }
      updateData.sentenceLength = sentenceLength;
    }

    if (sentenceLengthDynamic !== undefined) {
      if (typeof sentenceLengthDynamic === 'string') {
        const normalizedValue = sentenceLengthDynamic.toLowerCase();
        if (!['true', 'false'].includes(normalizedValue)) {
          return res.status(400).json({ error: 'Invalid sentence length mode. Must be true or false.' });
        }
        updateData.sentenceLengthDynamic = normalizedValue === 'true';
      } else {
        updateData.sentenceLengthDynamic = Boolean(sentenceLengthDynamic);
      }
    }

    const bot = await Bot.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    console.log(`🔧 Bot ${req.params.id} features updated:`, updateData);

    // 🔥 NEW: Update or create bot profile for future restoration
    try {
      const BotProfile = require('../models/BotProfile');

      // Check if any profile-relevant data was updated
      const profileFields = ['personality', 'tone', 'messageHistoryLimit', 'replyToDMs', 'language', 'sentenceLength', 'sentenceLengthDynamic'];
      const hasProfileUpdates = profileFields.some(field => updateData.hasOwnProperty(field));

      if (hasProfileUpdates) {
        await BotProfile.findOneAndUpdate(
          { userId: req.user._id, botName: bot.botName },
          {
            userId: req.user._id,
            botName: bot.botName,
            personality: bot.personality,
            tone: bot.tone,
            messageHistoryLimit: bot.messageHistoryLimit,
            replyToDMs: bot.replyToDMs,
            language: bot.language,
            sentenceLength: bot.sentenceLength,
            sentenceLengthDynamic: bot.sentenceLengthDynamic,
            lastUsedAt: new Date()
          },
          { upsert: true, new: true }
        );
        console.log(`💾 Updated bot profile for "${bot.botName}"`);
      }
    } catch (error) {
      console.error('Error updating bot profile:', error);
      // Don't fail the update if profile saving fails
    }

    res.json({
      message: 'Bot features updated successfully',
      bot: bot
    });
  } catch (error) {
    console.error('Error updating bot features:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /bots/:id/behavior
 * @desc    Update bot behavior preset
 * @access  Private
 */
router.put('/:id/behavior', isAuthenticated, async (req, res) => {
  try {
    const { behaviorPreset } = req.body;
    const updateData = {};

    // Validate behaviorPreset (optional)
    if (behaviorPreset !== undefined) {
      const validBehaviorPresets = ['', 'human-like', 'roleplay', 'robotic', 'natural'];
      if (!validBehaviorPresets.includes(behaviorPreset)) {
        return res.status(400).json({ error: 'Invalid behavior preset. Must be one of: human-like, roleplay, robotic, natural, or empty for none' });
      }
      updateData.behaviorPreset = behaviorPreset;
    }

    const bot = await Bot.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true }
    );

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    console.log(`🎭 Bot ${req.params.id} behavior preset updated:`, updateData);

    res.json({
      message: 'Bot behavior preset updated successfully',
      bot: bot
    });
  } catch (error) {
    console.error('Error updating bot behavior preset:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /bots/:id/invite
 * @desc    Generate Discord OAuth2 invite URL for a bot
 * @access  Private
 */
router.get('/:id/invite', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    // Get application info from Discord API to get the client ID
    const axios = require('axios');
    let clientId;
    
    try {
      const response = await axios.get('https://discord.com/api/v10/applications/@me', {
        headers: {
          'Authorization': `Bot ${bot.botToken}`
        }
      });
      
      clientId = response.data.id; // This is the BOT's client ID
    } catch (apiError) {
      console.error('Error fetching application info:', apiError);
      return res.status(400).json({ error: 'Invalid bot token or unable to fetch application info' });
    }
    
    // Use the BOT's client ID for the invite, not your app's
    // Add CREATE_INSTANT_INVITE (1) permission for "Join servers for you" functionality
    const botPermissions = '328565073921'; // Original 328565073920 + CREATE_INSTANT_INVITE (1)
    const botScope = 'bot applications.commands';

    // Generate a standard Discord bot invite URL (no OAuth2 callback needed)
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${botPermissions}&scope=${encodeURIComponent(botScope)}`;

    console.log('Generated bot invite URL for bot:', clientId);

    res.json({ inviteUrl });
  } catch (error) {
    console.error('Error generating invite URL:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /bots/test-invite
 * @desc    Test invite URL generation (for debugging)
 * @access  Private
 */
router.get('/test-invite', isAuthenticated, (req, res) => {
  try {
    // Hardcoded Discord application credentials
    const DISCORD_CLIENT_ID = '1399388755647008929';
    const DISCORD_CALLBACK_URL = 'https://opsicos.onrender.com/auth/discord/callback';
    // Add CREATE_INSTANT_INVITE (1) permission for "Join servers for you" functionality
    const botPermissions = '328565073921'; // Original 328565073920 + CREATE_INSTANT_INVITE (1)
    const botScope = 'bot applications.commands';

    // Test state
    const state = JSON.stringify({ botId: 'test-bot-id', userId: req.user._id });
    const encodedState = Buffer.from(state).toString('base64');

    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&permissions=${botPermissions}&scope=${encodeURIComponent(botScope)}&state=${encodedState}&redirect_uri=${encodeURIComponent(DISCORD_CALLBACK_URL)}&response_type=code&disable_guild_select=false`;

    res.json({
      success: true,
      inviteUrl,
      clientId: DISCORD_CLIENT_ID,
      callbackUrl: DISCORD_CALLBACK_URL,
      message: 'Invite URL generated successfully with hardcoded values'
    });
  } catch (error) {
    console.error('Error in test invite URL generation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /bots/force-stop-all
 * @desc    Force stop all bot instances (emergency cleanup) - ADMIN ONLY
 * @access  Private (Admin only)
 */
router.post('/force-stop-all', isAuthenticated, async (req, res) => {
  try {
    // ADMIN CHECK - Only allow specific Discord user ID
    const ADMIN_DISCORD_ID = '1340207834108788759';

    if (req.user.oauthId !== ADMIN_DISCORD_ID) {
      console.log(`🚫 Unauthorized force stop attempt by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    console.log(`🚨 ADMIN Force stop all bots requested by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
    const result = await discordBotService.forceStopAllBots();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        stoppedCount: result.stoppedCount
      });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error in force stop all endpoint:', error);
    res.status(500).json({ error: 'Server error during force stop' });
  }
});

/**
 * @route   POST /bots/emergency-restart-all
 * @desc    Emergency restart all bots (mark for auto-restart and start) - ADMIN ONLY
 * @access  Private (Admin only)
 */
router.post('/emergency-restart-all', isAuthenticated, async (req, res) => {
  try {
    // ADMIN CHECK - Only allow specific Discord user ID
    const ADMIN_DISCORD_ID = '1399388755647008929'; // Replace with your Discord user ID

    if (req.user.oauthId !== ADMIN_DISCORD_ID) {
      console.log(`🚫 Unauthorized emergency restart attempt by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    console.log(`🚨 ADMIN Emergency restart all bots requested by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
    await discordBotService.emergencyRestartAllBots();

    res.json({
      success: true,
      message: 'Emergency restart initiated. All bots marked for auto-restart and restarting now.'
    });
  } catch (error) {
    console.error('Error in emergency restart all bots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /bots/models
 * @desc    Get available AI models
 * @access  Private
 */
router.get('/models', isAuthenticated, (req, res) => {
  // Prevent caching so new models show immediately after deploy
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  
  const models = [
    // OpenAI Models
    {
      id: 'provider-3/gpt-4o-mini',
      name: 'GPT-4o Mini',
      company: 'OpenAI',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg'
    },
    {
      id: 'provider-3/gpt-5-nano',
      name: 'GPT-5 Nano',
      company: 'OpenAI',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg'
    },
    {
      id: 'provider-1/gpt-oss-20b',
      name: 'GPT OSS 20B',
      company: 'OpenAI',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg'
    },
    {
      id: 'provider-3/gpt-4.1-nano',
      name: 'GPT-4.1 Nano',
      company: 'OpenAI',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg'
    },

    // DeepSeek Models
    {
      id: 'provider-1/deepseek-r1-distill-qwen-1.5b',
      name: 'DeepSeek R1 Distill Qwen 1.5B',
      company: 'DeepSeek',
      logo: 'https://deepseek.com/favicon.ico'
    },
    {
      id: 'provider-1/deepseek-v3.1',
      name: 'DeepSeek V3.1',
      company: 'DeepSeek',
      logo: 'https://deepseek.com/favicon.ico'
    },
    {
      id: 'provider-1/deepseek-v3.1-turbo',
      name: 'DeepSeek V3.1 Turbo',
      company: 'DeepSeek',
      logo: 'https://deepseek.com/favicon.ico'
    },
    {
      id: 'provider-1/deepseek-tng-r1t2-chimera',
      name: 'DeepSeek TNG R1T2 Chimera',
      company: 'DeepSeek',
      logo: 'https://deepseek.com/favicon.ico'
    },

    // Google Models
    {
      id: 'provider-1/gemma-3-4b-it',
      name: 'Gemma 3 4B IT',
      company: 'Google',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg'
    },
    {
      id: 'provider-3/gemini-2.5-flash-lite-preview-09-2025',
      name: 'Gemini 2.5 Flash Lite Preview',
      company: 'Google',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg'
    },
    {
      id: 'provider-6/gemma-3-27b-instruct',
      name: 'Gemma 3 27B Instruct',
      company: 'Google',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg'
    },
    {
      id: 'provider-1/gemma-2-9b-it',
      name: 'Gemma 2 9B IT',
      company: 'Google',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg'
    },

    // InferenceNet Models
    {
      id: 'provider-6/cliptagger-12b',
      name: 'ClipTagger 12B',
      company: 'InferenceNet',
      logo: 'https://avatars.githubusercontent.com/u/132372032?s=200&v=4'
    },

    // Meta Models
    {
      id: 'provider-1/llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout 17B 16E Instruct',
      company: 'Meta',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg'
    },
    {
      id: 'provider-1/llama-3.2-1b-instruct-fp-16',
      name: 'Llama 3.2 1B Instruct FP-16',
      company: 'Meta',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg'
    },
    {
      id: 'provider-3/llama-4-scout',
      name: 'Llama 4 Scout',
      company: 'Meta',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg'
    },
    {
      id: 'provider-1/deephermes-3-llama-3-8b-preview',
      name: 'DeepHermes 3 Llama 3 8B Preview',
      company: 'Meta',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg'
    },
    {
      id: 'provider-1/shisa-v2-llama3.3-70b',
      name: 'Shisa V2 Llama3.3 70B',
      company: 'Meta',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg'
    },

    // Mistral Models
    {
      id: 'provider-6/mistral-nemo-12b-instruct',
      name: 'Mistral Nemo 12B Instruct',
      company: 'Mistral',
      logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp'
    },
    {
      id: 'provider-1/mistralai-devstral-small-2505',
      name: 'MistralAI Devstral Small 2505',
      company: 'Mistral',
      logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp'
    },
    {
      id: 'provider-1/chutesai-devstral-small-2505',
      name: 'ChutesAI Devstral Small 2505',
      company: 'Mistral',
      logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp'
    },
    {
      id: 'provider-1/mistral-small-3.2-24b-instruct-2506',
      name: 'Mistral Small 3.2 24B Instruct 2506',
      company: 'Mistral',
      logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp'
    },

    // MoonShot AI Models
    {
      id: 'provider-1/kimi-k2-instruct',
      name: 'Kimi K2 Instruct',
      company: 'MoonShot AI',
      logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4'
    },
    {
      id: 'provider-1/kimi-vl-a3b-thinking',
      name: 'Kimi VL A3B Thinking',
      company: 'MoonShot AI',
      logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4'
    },

    // Qwen Models
    {
      id: 'provider-1/qwen3-4b-thinking-2507',
      name: 'Qwen3 4B Thinking 2507',
      company: 'Qwen',
      logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg'
    },
    {
      id: 'provider-6/qwen2.5-7b-instruct',
      name: 'Qwen2.5 7B Instruct',
      company: 'Qwen',
      logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg'
    },
    {
      id: 'provider-1/qwen3-8b',
      name: 'Qwen3 8B',
      company: 'Qwen',
      logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg'
    },
    {
      id: 'provider-3/qwen-2.5-72b',
      name: 'Qwen 2.5 72B',
      company: 'Qwen',
      logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg'
    },

    // xAI Models
    {
      id: 'provider-5/grok-4-0709',
      name: 'Grok 4 0709',
      company: 'xAI',
      logo: 'https://x.ai/favicon.ico'
    },

    // Zhipu AI Models
    {
      id: 'provider-1/glm-4.6',
      name: 'GLM 4.6',
      company: 'Zhipu AI',
      logo: 'https://open.bigmodel.cn/static/zhipuai.png'
    },
    {
      id: 'glm-4.5v',
      name: 'GLM 4.5V',
      company: 'Zhipu AI',
      logo: 'https://open.bigmodel.cn/static/zhipuai.png'
    },

    // Anthropic Models (Custom Router)
    {
      id: 'claude-3-7-sonnet-20250219',
      name: 'Claude 3.7 Sonnet',
      company: 'Anthropic',
      logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/anthropic.svg'
    }
  ];

  res.json(models);
});

/**
 * @route   POST /bots/admin/update-descriptions
 * @desc    Update all bot descriptions with Opsicos branding (Admin only)
 * @access  Private
 */
router.post('/admin/update-descriptions', isAuthenticated, async (req, res) => {
  try {
    // Simple admin check - you can enhance this with proper admin roles
    const adminEmails = ['admin@opsicos.com', 'tawsif@opsicos.com']; // Add your admin emails
    if (!adminEmails.includes(req.user.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log(`🔧 Admin ${req.user.email} initiated bulk bot description update`);

    const results = await discordBotService.updateAllBotDescriptions();

    res.json({
      message: 'Bot description update completed',
      results: results
    });
  } catch (error) {
    console.error('Error in admin bot description update:', error);
    res.status(500).json({ error: 'Server error' });
  }
});



/**
 * @route   GET /bots/:id/status
 * @desc    Get real-time bot status for dashboard sync
 * @access  Private
 */
router.get('/:id/status', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const activeBots = discordBotService.getActiveBots();
    const activeBot = activeBots.find(ab => ab.botId === req.params.id);

    // 🔥 FIX: Real-time status determination
    let actualStatus = 'offline';
    let actualIsActive = false;

    if (activeBot) {
      actualStatus = activeBot.status === 'ready' ? 'online' : 'connecting';
      actualIsActive = true;
    }

    res.json({
      botId: bot._id,
      botName: bot.botName,
      status: actualStatus,
      isActive: actualIsActive,
      isRunningInMemory: !!activeBot,
      instanceId: activeBot?.instanceId || null,
      uptime: activeBot ? (Date.now() - activeBot.startTime) : 0,
      guildCount: activeBot?.guildCount || 0,
      lastCheck: new Date().toISOString(),
      databaseStatus: bot.status,
      databaseIsActive: bot.isActive,
      syncRequired: (bot.status !== actualStatus || bot.isActive !== actualIsActive)
    });
  } catch (error) {
    console.error('Error fetching bot status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /bots/:id/debug
 * @desc    Debug bot configuration (DM settings, etc.)
 * @access  Private
 */
router.get('/:id/debug', isAuthenticated, async (req, res) => {
  try {
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const activeBots = discordBotService.getActiveBots();
    const isRunning = activeBots.find(ab => ab.botId === req.params.id);

    res.json({
      botId: bot._id,
      botName: bot.botName,
      replyToDMs: bot.replyToDMs,
      isActive: bot.isActive,
      status: bot.status,
      isRunningInMemory: !!isRunning,
      selectedModel: bot.selectedModel,
      displayModelName: bot.displayModelName,
      personality: bot.personality,
      tone: bot.tone,
      messageHistoryLimit: bot.messageHistoryLimit,
      lastError: bot.lastError,
      updatedAt: bot.updatedAt
    });
  } catch (error) {
    console.error('Error fetching bot debug info:', error);
    res.status(500).json({ error: 'Server error' });
  };
});

/**
 * @route   POST /bots/admin/kill-zombies
 * @desc    Manually trigger zombie instance cleanup (Admin only)
 * @access  Private (Admin only)
 */
router.post('/admin/kill-zombies', isAuthenticated, async (req, res) => {
  try {
    // ADMIN CHECK - Only allow specific Discord user ID
    const ADMIN_DISCORD_ID = '1340207834108788759';

    if (req.user.oauthId !== ADMIN_DISCORD_ID) {
      console.log(`🚫 Unauthorized zombie cleanup attempt by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    console.log(`🧟‍♂️ ADMIN Manual zombie cleanup requested by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
    const result = await discordBotService.killZombieInstances();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        cleanupCount: result.cleanupCount,
        results: result.results
      });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error in manual zombie cleanup endpoint:', error);
    res.status(500).json({ error: 'Server error during zombie cleanup' });
  }
});

/**
 * @route   POST /bots/admin/nuclear-cleanup
 * @desc    Nuclear cleanup - destroy all bot connections (Admin only)
 * @access  Private (Admin only)
 */
router.post('/admin/nuclear-cleanup', isAuthenticated, async (req, res) => {
  try {
    // ADMIN CHECK - Only allow specific Discord user ID
    const ADMIN_DISCORD_ID = '1340207834108788759';

    if (req.user.oauthId !== ADMIN_DISCORD_ID) {
      console.log(`🚫 Unauthorized nuclear cleanup attempt by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    console.log(`☢️ ADMIN Nuclear cleanup requested by user ${req.user._id} (Discord ID: ${req.user.oauthId})`);
    const result = await discordBotService.nuclearCleanup();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        destroyedCount: result.destroyedCount,
        errorCount: result.errorCount,
        clearedLocks: result.clearedLocks
      });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error in nuclear cleanup endpoint:', error);
    res.status(500).json({ error: 'Server error during nuclear cleanup' });
  }
});

module.exports = router;
