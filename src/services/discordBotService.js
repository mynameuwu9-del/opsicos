const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const aiProviderService = require('./aiProviderService');
const Bot = require('../models/Bot');
const Knowledge = require('../models/Knowledge');
const MessageHistory = require('../models/MessageHistory');
const BotSmartness = require('../models/BotSmartness');
const ProcessedMessage = require('../models/ProcessedMessage');
const deploymentManager = require('../utils/deploymentManager');

// Opsicos branding constants
const OPSICOS_DESCRIPTION = `Made at Opsicos - ${process.env.APP_URL || 'https://github.com/mynameuwu9-del/opsicos'}`;
const OPSICOS_URL = process.env.APP_URL || 'http://localhost:3000';

// Map to store active bot instances
const activeBots = new Map();

// Rate limiting for Discord API with retry logic
const rateLimitTracker = {
  lastBotStart: 0,
  startQueue: [],
  isProcessingQueue: false,
  MIN_START_INTERVAL: 10000, // 10 seconds between bot starts
  MAX_CONCURRENT_STARTS: 3, // Maximum concurrent bot starts
  rateLimitResetTime: null, // When Discord rate limit resets
  lastDescriptionUpdate: 0,
  MIN_DESCRIPTION_INTERVAL: 5000 // 5 seconds between description updates
};

// Map to track message processing to prevent duplicate responses
const messageProcessingLocks = new Map();

// Cache for bot smartness settings with 5-minute TTL
const smartnessCache = new Map();
const SMARTNESS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cooldown tracker for natural conversation flow
const conversationCooldowns = new Map();
const CONVERSATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Debug logging system
const debugLogs = [];
const MAX_DEBUG_LOGS = 200;

function addDebugLog(type, source, message, data = null) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type, // 'info', 'warning', 'error', 'success', 'debug'
    source, // 'bot-lifecycle', 'message-processing', 'instance-management', etc.
    message,
    data
  };

  debugLogs.push(logEntry);

  // Keep only the last MAX_DEBUG_LOGS entries
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.shift();
  }

  // Also log to console with emoji for easy identification
  const emoji = {
    info: '📝',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    debug: '🐛'
  };

  console.log(`${emoji[type] || '📝'} [${source}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

/**
 * Parse rate limit reset time from Discord error
 * @param {Error} error - Discord API error
 * @returns {Date|null} - Reset time or null if not found
 */
function parseRateLimitResetTime(error) {
  try {
    const message = error.message || '';
    // Match pattern: "resets at 2025-10-28T10:02:17.645Z"
    const resetMatch = message.match(/resets at ([\d-T:.Z]+)/i);
    if (resetMatch) {
      return new Date(resetMatch[1]);
    }
  } catch (parseError) {
    console.error('Error parsing rate limit reset time:', parseError);
  }
  return null;
}

/**
 * Check if we're currently rate limited
 * @returns {Object} - { isLimited, waitTime, resetTime }
 */
function checkRateLimit() {
  if (!rateLimitTracker.rateLimitResetTime) {
    return { isLimited: false, waitTime: 0, resetTime: null };
  }
  
  const now = Date.now();
  const resetTime = rateLimitTracker.rateLimitResetTime.getTime();
  
  if (now >= resetTime) {
    // Rate limit has expired
    rateLimitTracker.rateLimitResetTime = null;
    return { isLimited: false, waitTime: 0, resetTime: null };
  }
  
  const waitTime = resetTime - now;
  return { isLimited: true, waitTime, resetTime: rateLimitTracker.rateLimitResetTime };
}

/**
 * Rate-limited bot startup queue processor with retry logic
 */
async function processStartQueue() {
  if (rateLimitTracker.isProcessingQueue) return;
  
  rateLimitTracker.isProcessingQueue = true;
  
  while (rateLimitTracker.startQueue.length > 0) {
    // Check if we're rate limited
    const rateLimitCheck = checkRateLimit();
    if (rateLimitCheck.isLimited) {
      addDebugLog('warning', 'rate-limiting', `Rate limited! Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)}s until ${rateLimitCheck.resetTime.toISOString()}`);
      console.log(`⏳ Discord rate limit active. Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)} seconds until ${rateLimitCheck.resetTime.toISOString()}...`);
      await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime + 1000)); // Add 1 second buffer
    }
    
    const now = Date.now();
    const timeSinceLastStart = now - rateLimitTracker.lastBotStart;
    
    if (timeSinceLastStart < rateLimitTracker.MIN_START_INTERVAL) {
      const waitTime = rateLimitTracker.MIN_START_INTERVAL - timeSinceLastStart;
      addDebugLog('info', 'rate-limiting', `Waiting ${waitTime}ms before next bot start to prevent rate limits`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    const { botConfig, resolve, reject, retries } = rateLimitTracker.startQueue.shift();
    
    try {
      rateLimitTracker.lastBotStart = Date.now();
      const result = await startBotInternal(botConfig);
      resolve(result);
    } catch (error) {
      // Check if this is a rate limit error
      const isRateLimitError = error.message && (
        error.message.includes('Not enough sessions remaining') ||
        error.message.includes('rate limit') ||
        error.code === 429
      );
      
      if (isRateLimitError) {
        const resetTime = parseRateLimitResetTime(error);
        if (resetTime) {
          rateLimitTracker.rateLimitResetTime = resetTime;
          addDebugLog('error', 'rate-limiting', `Rate limit detected! Reset time: ${resetTime.toISOString()}`, { error: error.message });
          console.error(`🚨 Discord rate limit hit! Sessions will reset at ${resetTime.toISOString()}`);
          
          // Save rate limit info to deployment manager
          await deploymentManager.updateRateLimit(resetTime, 0);
        }
        
        // Retry with exponential backoff (max 3 retries)
        const currentRetries = retries || 0;
        if (currentRetries < 3) {
          const backoffDelay = Math.min(30000, 5000 * Math.pow(2, currentRetries)); // 5s, 10s, 20s (max 30s)
          addDebugLog('warning', 'rate-limiting', `Retrying bot start (attempt ${currentRetries + 1}/3) in ${backoffDelay}ms`);
          console.log(`🔄 Retrying bot ${botConfig.botName} start in ${backoffDelay / 1000}s (attempt ${currentRetries + 1}/3)...`);
          
          // Re-queue with incremented retry count
          rateLimitTracker.startQueue.push({ botConfig, resolve, reject, retries: currentRetries + 1 });
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } else {
          // Max retries exceeded
          addDebugLog('error', 'rate-limiting', `Max retries exceeded for bot ${botConfig.botName}`, { error: error.message });
          console.error(`❌ Max retries exceeded for bot ${botConfig.botName}. Will retry in next health check cycle.`);
          reject(new Error(`Rate limit: ${error.message}. Bot will retry in next health check.`));
        }
      } else {
        // Non-rate-limit error, reject immediately
        reject(error);
      }
    }
  }
  
  rateLimitTracker.isProcessingQueue = false;
}

/**
 * Add bot to startup queue with rate limiting
 */
async function queueBotStart(botConfig) {
  // Check deployment manager rate limits first
  const canStart = await deploymentManager.canStartBot();
  if (!canStart) {
    const resetTime = deploymentManager.rateLimits.resetTime ? 
      new Date(deploymentManager.rateLimits.resetTime) : null;
    
    if (resetTime) {
      const waitTime = resetTime.getTime() - Date.now();
      throw new Error(`Rate limited until ${resetTime.toISOString()} (${Math.ceil(waitTime / 1000)}s remaining)`);
    } else {
      throw new Error('Rate limited - please try again later');
    }
  }
  
  return new Promise((resolve, reject) => {
    rateLimitTracker.startQueue.push({ botConfig, resolve, reject, retries: 0 });
    processStartQueue();
  });
}

/**
 * Fetch bot-specific knowledge for AI context
 * @param {string} botId - The bot ID
 * @returns {Promise<string>} Formatted knowledge context
 */
async function fetchBotKnowledge(botId) {
  try {
    const knowledge = await Knowledge.find({
      botId: new mongoose.Types.ObjectId(botId),
      isActive: true
    })
    .sort({ priority: -1, updatedAt: -1 })
    .select('title content tags priority')
    .lean();

    if (!knowledge || knowledge.length === 0) {
      return '';
    }

    // Format knowledge for AI context
    let knowledgeContext = '\n\n=== BOT KNOWLEDGE BASE ===\n';
    knowledgeContext += 'Use the following knowledge to provide accurate and helpful responses:\n\n';

    knowledge.forEach((k, index) => {
      knowledgeContext += `${index + 1}. ${k.title}\n`;
      knowledgeContext += `${k.content}\n`;
      if (k.tags && k.tags.length > 0) {
        knowledgeContext += `Tags: ${k.tags.join(', ')}\n`;
      }
      knowledgeContext += '\n';
    });

    knowledgeContext += '=== END KNOWLEDGE BASE ===\n\n';
    knowledgeContext += 'Please use this knowledge to provide accurate responses. If the user asks about something covered in the knowledge base, prioritize that information.\n';

    return knowledgeContext;
  } catch (error) {
    console.error('Error fetching bot knowledge:', error);
    return '';
  }
}

/**
 * Load bot smartness settings with caching
 * @param {string} botId - The bot ID
 * @returns {Promise<Object>} Smartness settings or defaults
 */
async function loadBotSmartness(botId) {
  try {
    // Check cache first
    const cached = smartnessCache.get(botId);
    if (cached && Date.now() - cached.timestamp < SMARTNESS_CACHE_TTL) {
      return cached.settings;
    }

    // Fetch from database
    const settings = await BotSmartness.findOne({ botId });
    
    // Default settings if none exist
    const defaultSettings = {
      temperature: 0.7,
      creativity: 'medium',
      smartnessMode: 'balanced',
      useNicknames: false,
      naturalFlow: false,
      typingSimulation: false,
      addCommaEnd: false,
      emojiUsage: false,
      emojiFrequency: 30,
      occasionalTypos: false,
      typoFrequency: 'low',
      funPinging: false,
      ghostPings: false,
      proactivityLevel: 30,
      randomReactions: false,
      dadJokesMode: false,
      commandPrecision: 'flexible',
      customRules: [],
      decisionFreedom: 'medium',
      expressOpinions: false,
      moodSimulation: false,
      currentMood: 'neutral'
    };

    const finalSettings = settings ? settings.toObject() : defaultSettings;

    // Cache the settings
    smartnessCache.set(botId, {
      settings: finalSettings,
      timestamp: Date.now()
    });

    return finalSettings;
  } catch (error) {
    console.error('Error loading bot smartness:', error);
    // Return defaults on error
    return {
      temperature: 0.7,
      creativity: 'medium',
      smartnessMode: 'balanced',
      useNicknames: false,
      naturalFlow: false,
      typingSimulation: false,
      addCommaEnd: false,
      emojiUsage: false,
      emojiFrequency: 30,
      occasionalTypos: false,
      typoFrequency: 'low',
      funPinging: false,
      ghostPings: false,
      proactivityLevel: 30,
      randomReactions: false,
      dadJokesMode: false,
      commandPrecision: 'flexible',
      customRules: [],
      decisionFreedom: 'medium',
      expressOpinions: false,
      moodSimulation: false,
      currentMood: 'neutral'
    };
  }
}

/**
 * Clear smartness cache for a specific bot
 * @param {string} botId - The bot ID
 */
function clearSmartnessCache(botId) {
  smartnessCache.delete(botId);
  console.log(`🧹 Cleared smartness cache for bot ${botId}`);
}

/**
 * Get nickname for user if available
 * @param {Object} message - Discord message object
 * @returns {string} Nickname or username
 */
function getUserDisplayName(message) {
  try {
    if (message.guild && message.member) {
      return message.member.nickname || message.author.username;
    }
    return message.author.username;
  } catch (error) {
    return message.author.username;
  }
}

/**
 * Simulate typing delay based on message length
 * @param {string} text - The text to calculate delay for
 * @returns {number} Delay in milliseconds
 */
function calculateTypingDelay(text) {
  const baseDelay = 1000; // 1 second minimum
  const maxDelay = 5000; // 5 seconds maximum
  const wordsPerMinute = 60; // Human typing speed
  const words = text.split(' ').length;
  const calculatedDelay = (words / wordsPerMinute) * 60 * 1000;
  return Math.min(Math.max(calculatedDelay, baseDelay), maxDelay);
}

/**
 * Add emojis to response based on frequency setting
 * @param {string} text - The response text
 * @param {number} frequency - Emoji frequency (0-100)
 * @returns {string} Text with emojis added
 */
function addEmojisToResponse(text, frequency) {
  if (Math.random() * 100 > frequency) {
    return text;
  }

  const contextEmojis = {
    happy: ['😊', '😄', '🙂', '😃', '🎉'],
    sad: ['😢', '😔', '😞', '😟'],
    think: ['🤔', '💭', '🧐'],
    love: ['❤️', '💖', '💕', '😍'],
    laugh: ['😂', '🤣', '😆'],
    cool: ['😎', '👍', '✨', '🌟']
  };

  // Simple sentiment detection
  let emojiSet = contextEmojis.happy;
  if (text.match(/\b(sad|sorry|unfortunate)\b/i)) emojiSet = contextEmojis.sad;
  else if (text.match(/\b(think|consider|maybe)\b/i)) emojiSet = contextEmojis.think;
  else if (text.match(/\b(love|great|awesome|amazing)\b/i)) emojiSet = contextEmojis.love;
  else if (text.match(/\b(haha|lol|funny)\b/i)) emojiSet = contextEmojis.laugh;
  else if (text.match(/\b(cool|nice|excellent)\b/i)) emojiSet = contextEmojis.cool;

  const emoji = emojiSet[Math.floor(Math.random() * emojiSet.length)];
  
  // Add emoji at the end with some variation
  if (Math.random() > 0.5) {
    return `${text} ${emoji}`;
  } else {
    return `${emoji} ${text}`;
  }
}

/**
 * Apply personality quirks to response
 * @param {string} text - The response text
 * @param {Object} smartness - Smartness settings
 * @returns {string} Modified text with quirks
 */
function applyPersonalityQuirks(text, smartness) {
  let modifiedText = text;

  // Add comma at end
  if (smartness.addCommaEnd && !text.trim().endsWith(',')) {
    modifiedText = modifiedText.trim() + ',';
  }

  // Add emojis
  if (smartness.emojiUsage) {
    modifiedText = addEmojisToResponse(modifiedText, smartness.emojiFrequency);
  }

  // Add occasional typos (simple implementation)
  if (smartness.occasionalTypos) {
    const typoChance = smartness.typoFrequency === 'medium' ? 0.15 : 0.05;
    if (Math.random() < typoChance) {
      const typoMap = {
        'the': 'teh',
        'help': 'hlep',
        'you': 'yuo',
        'because': 'becuase',
        'definitely': 'definately'
      };
      Object.keys(typoMap).forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(modifiedText) && Math.random() > 0.7) {
          modifiedText = modifiedText.replace(regex, typoMap[word]);
        }
      });
    }
  }

  return modifiedText;
}

/**
 * Build smartness-enhanced system message
 * @param {string} baseMessage - The base system message
 * @param {Object} smartness - Smartness settings
 * @returns {string} Enhanced system message
 */
function enhanceSystemMessage(baseMessage, smartness) {
  let enhanced = baseMessage;

  // Add custom rules
  if (smartness.customRules && smartness.customRules.length > 0) {
    enhanced += '\n\n=== CUSTOM BEHAVIORAL RULES ===\n';
    smartness.customRules.forEach((rule, index) => {
      enhanced += `${index + 1}. ${rule}\n`;
    });
    enhanced += 'Follow these custom rules strictly.\n';
  }

  // Add command precision instruction
  if (smartness.commandPrecision === 'strict') {
    enhanced += '\n\nCOMMAND PRECISION: Follow all commands exactly as written. Be precise and literal in interpretation. Do not add creative interpretation.';
  } else {
    enhanced += '\n\nCOMMAND PRECISION: Interpret user intent flexibly. Be helpful and adaptive in understanding what users mean.';
  }

  // Add decision freedom instruction
  if (smartness.decisionFreedom === 'low') {
    enhanced += '\n\nDECISION AUTONOMY: Always ask for confirmation before taking actions. Be cautious and seek permission.';
  } else if (smartness.decisionFreedom === 'high') {
    enhanced += '\n\nDECISION AUTONOMY: Make decisions confidently without always asking for confirmation. Use your judgment.';
  } else {
    enhanced += '\n\nDECISION AUTONOMY: Make simple decisions automatically, but ask for confirmation on important matters.';
  }

  // Add opinion expression
  if (smartness.expressOpinions) {
    enhanced += '\n\nOPINION EXPRESSION: Feel free to share your thoughts, preferences, and opinions. Add personality to your responses.';
  }

  // Add mood simulation
  if (smartness.moodSimulation) {
    const moodInstructions = {
      'happy': 'You are in a happy, cheerful mood. Be enthusiastic and positive.',
      'sad': 'You are in a sad, melancholic mood. Be more reserved and contemplative.',
      'excited': 'You are excited and energetic. Show enthusiasm in your responses.',
      'tired': 'You are feeling tired. Be more laid-back and casual.',
      'neutral': 'You are in a neutral, balanced mood. Respond naturally.'
    };
    enhanced += `\n\nCURRENT MOOD: ${moodInstructions[smartness.currentMood] || moodInstructions['neutral']}`;
  }

  // Add dad jokes mode
  if (smartness.dadJokesMode) {
    enhanced += '\n\nDAD JOKES MODE: Occasionally include dad jokes or puns in your responses. Keep it light and fun!';
  }

  return enhanced;
}

/**
 * Check if bot should randomly interject in conversation
 * @param {Object} smartness - Smartness settings
 * @param {string} botId - The bot ID
 * @returns {boolean} Whether to interject
 */
function shouldInterjectInConversation(smartness, botId) {
  if (!smartness.naturalFlow) return false;

  // Check cooldown
  const lastInterjection = conversationCooldowns.get(botId);
  if (lastInterjection && Date.now() - lastInterjection < CONVERSATION_COOLDOWN) {
    return false;
  }

  // Random chance based on proactivity level
  const shouldInterject = Math.random() * 100 < smartness.proactivityLevel;
  
  if (shouldInterject) {
    conversationCooldowns.set(botId, Date.now());
  }

  return shouldInterject;
}

/**
 * Fetch bot information from Discord API without starting the bot
 * @param {string} botToken - The bot token
 * @returns {Promise<Object>} Bot information including username and avatar
 */
async function fetchBotInfo(botToken) {
  try {
    const rest = new REST({ version: '10' }).setToken(botToken);
    const botUser = await rest.get(Routes.user());

    return {
      username: botUser.username,
      avatar: botUser.avatar ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png'
    };
  } catch (error) {
    console.error('Error fetching bot info:', error);
    throw new Error('Invalid bot token or unable to fetch bot information');
  }
}

class DiscordBotService {
  /**
   * 🔥 ZOMBIE KILLER: Comprehensive cleanup of zombie instances on startup
   * This runs on Node.js app startup to eliminate any surviving bot instances
   * @returns {Promise<Object>} - Status of zombie cleanup
   */
  async killZombieInstances() {
    try {
      console.log('🧟‍♂️ ZOMBIE KILLER: Starting comprehensive cleanup of zombie bot instances...');
      
      // Step 1: Force clear all in-memory instances
      const inMemoryCount = activeBots.size;
      activeBots.clear();
      messageProcessingLocks.clear();
      console.log(`🧹 Cleared ${inMemoryCount} in-memory bot instances`);

      // Step 1b: Clear database message locks (cross-instance deduplication)
      try {
        const dbLocksCleared = await ProcessedMessage.cleanupOldLocks();
        console.log(`🔓 Cleared ${dbLocksCleared} database message locks`);
      } catch (dbLockError) {
        console.error('Error clearing database message locks:', dbLockError.message);
      }
      
      // Step 2: Get all bots that might be zombie instances (marked as active but not in our memory)
      const potentialZombieBots = await Bot.find({
        isActive: true,
        status: { $in: ['online', 'connecting'] }
      });
      
      console.log(`🔍 Found ${potentialZombieBots.length} potentially zombie bot instances in database`);
      
      let cleanupCount = 0;
      const cleanupResults = [];
      
      // Step 3: Attempt to connect and forcefully disconnect each potential zombie
      for (const bot of potentialZombieBots) {
        try {
          console.log(`🧟 Attempting to kill zombie instance for bot: ${bot.botName} (${bot._id})`);
          
          // Create temporary client just to force disconnect any existing sessions
          const tempClient = new Client({
            intents: [GatewayIntentBits.Guilds],
            partials: []
          });
          
          // Set a timeout to prevent hanging
          const killTimeout = setTimeout(() => {
            console.log(`⏰ Timeout reached for zombie kill attempt: ${bot.botName}`);
            tempClient.destroy().catch(() => {});
          }, 10000); // 10 second timeout
          
          try {
            // Login with the bot token to force disconnect any existing sessions
            await tempClient.login(bot.botToken);
            
            // Immediately set status to invisible and destroy
            await tempClient.user?.setStatus('invisible');
            await tempClient.destroy();
            
            clearTimeout(killTimeout);
            console.log(`✅ Successfully killed zombie instance: ${bot.botName}`);
            cleanupCount++;
            
          } catch (loginError) {
            clearTimeout(killTimeout);
            console.log(`⚠️ Could not login to kill zombie ${bot.botName}:`, loginError.message);
            // Still count as cleanup attempt
            cleanupCount++;
          }
          
          cleanupResults.push({
            botId: bot._id,
            botName: bot.botName,
            status: 'killed'
          });
          
        } catch (error) {
          console.error(`❌ Error killing zombie instance ${bot.botName}:`, error.message);
          cleanupResults.push({
            botId: bot._id,
            botName: bot.botName,
            status: 'error',
            error: error.message
          });
        }
        
        // Small delay between cleanup attempts to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Step 4: Force update all bot statuses to offline in database
      await Bot.updateMany({}, {
        isActive: false,
        status: 'offline',
        lastError: 'Zombie cleanup - Node.js app restarted',
        uptimeStartedAt: null
      });
      
      // Step 5: Advanced memory cleanup
      try {
        if (global.gc) {
          global.gc();
          console.log('🧹 Forced garbage collection after zombie cleanup');
        }
      } catch (gcError) {
        console.log('⚠️ Garbage collection not available');
      }
      
      console.log(`🎯 ZOMBIE CLEANUP COMPLETE: Killed ${cleanupCount} zombie instances, reset ${potentialZombieBots.length} database entries`);
      
      return {
        success: true,
        message: `Zombie cleanup completed: ${cleanupCount} instances killed`,
        cleanupCount,
        results: cleanupResults
      };
      
    } catch (error) {
      console.error('❌ Error in zombie cleanup:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Force stop all bot instances (emergency cleanup)
   * @returns {Promise<Object>} - Status of the cleanup
   */
  async forceStopAllBots() {
    try {
      console.log('🚨 FORCE STOPPING ALL BOTS - Emergency cleanup initiated');
      let stoppedCount = 0;

      // Get all active bot instances
      const botIds = Array.from(activeBots.keys());
      console.log(`Found ${botIds.length} active bot instances to stop`);

      for (const botId of botIds) {
        try {
          const botInstance = activeBots.get(botId);
          if (botInstance && botInstance.client) {
            console.log(`Force stopping bot ${botId}...`);

            // 🔥 AGGRESSIVE CLEANUP: Set status to offline immediately
            try {
              await botInstance.client.user?.setStatus('invisible');
            } catch (statusError) {
              console.log(`Could not set status for bot ${botId}:`, statusError.message);
            }

            // Remove all listeners first
            botInstance.client.removeAllListeners();

            // 🔥 FORCE DISCONNECT: Destroy WebSocket connections
            if (botInstance.client.ws) {
              try {
                botInstance.client.ws.destroy();
              } catch (wsError) {
                console.log(`WebSocket destroy error for bot ${botId}:`, wsError.message);
              }
            }

            // Destroy the client with force
            await botInstance.client.destroy();

            // Remove from active bots
            activeBots.delete(botId);
            stoppedCount++;

            console.log(`✅ Bot ${botId} force stopped and disconnected`);
          }
        } catch (error) {
          console.error(`Error force stopping bot ${botId}:`, error.message);
          // Still remove from active bots even if there was an error
          activeBots.delete(botId);
          stoppedCount++;
        }
      }

      // 🔥 NUCLEAR OPTION: Clear the entire activeBots map
      activeBots.clear();
      console.log('🧹 Cleared all active bot instances from memory');

      // 🔥 CRITICAL FIX: Clear all message processing locks to prevent duplicate responses
      messageProcessingLocks.clear();
      console.log('🔓 Cleared all message processing locks to prevent duplicates');

      // Update all bots in database to offline status (preserve shouldAutoRestart)
      await Bot.updateMany({}, {
        isActive: false,
        status: 'offline',
        lastError: 'Force stopped - emergency cleanup'
        // NOTE: shouldAutoRestart is preserved so bots can restart after deployment
      });

      // 🔥 PRODUCTION CLEANUP: Force garbage collection and memory cleanup
      try {
        if (global.gc) {
          global.gc();
          console.log('🧹 Forced garbage collection');
        }

        // Clear any remaining timers/intervals
        const highestTimeoutId = setTimeout(() => {}, 0);
        for (let i = 0; i < highestTimeoutId; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
        console.log('⏰ Cleared all timers and intervals');

        // 🔥 RENDER/PRODUCTION: Additional cleanup for cloud environments
        if (process.env.RENDER || process.env.NODE_ENV === 'production') {
          console.log('🌐 Production environment detected - performing additional cleanup');

          // Force close any remaining connections
          if (process.listeners('SIGTERM').length === 0) {
            process.on('SIGTERM', () => {
              console.log('🔄 SIGTERM received - cleaning up...');
              activeBots.clear();
              process.exit(0);
            });
          }
        }
      } catch (cleanupError) {
        console.log('Advanced cleanup skipped:', cleanupError.message);
      }

      // 🔍 VERIFICATION: Wait a moment and verify cleanup
      setTimeout(() => {
        const remainingBots = Array.from(activeBots.keys());
        if (remainingBots.length > 0) {
          console.warn(`⚠️  Warning: ${remainingBots.length} bots still in memory after force stop:`, remainingBots);
        } else {
          console.log('✅ Verification: All bots successfully removed from memory');
        }
      }, 2000);

      console.log(`🎯 FORCE STOP COMPLETE: ${stoppedCount} bots stopped, database updated, memory cleared`);

      return {
        success: true,
        message: `Force stopped ${stoppedCount} bot instances and updated database`,
        stoppedCount
      };
    } catch (error) {
      console.error('Error in force stop all bots:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Start a Discord bot with the given configuration
   * @param {Object} botConfig - Bot configuration from database
   * @returns {Promise<Object>} - Status of the bot startup
   */
  async startBot(botConfig) {
    try {
      const botId = botConfig._id.toString();
      addDebugLog('info', 'bot-lifecycle', `Starting bot: ${botConfig.botName} (${botId})`);

      // Check if bot is already running and stop it
      if (activeBots.has(botId)) {
        addDebugLog('warning', 'bot-lifecycle', `Bot ${botId} is already running, stopping first...`);
        await this.stopBot(botConfig);
      } else {
        // Ensure database status is correct even if not in memory
        addDebugLog('info', 'bot-lifecycle', `Bot ${botId} not in memory, ensuring clean database state...`);
        await Bot.findByIdAndUpdate(botId, {
          isActive: false,
          status: 'offline'
        });
      }

      // 🔥 CRITICAL FIX: Clear any existing message processing locks for this bot
      const locksToDelete = [];
      for (const [lockKey, lockData] of messageProcessingLocks.entries()) {
        if (lockKey.startsWith(`${botId}-`)) {
          locksToDelete.push(lockKey);
        }
      }

      for (const lockKey of locksToDelete) {
        messageProcessingLocks.delete(lockKey);
      }

      if (locksToDelete.length > 0) {
        addDebugLog('info', 'bot-lifecycle', `Cleared ${locksToDelete.length} message processing locks for bot ${botId}`);
      }

      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.DirectMessageReactions,
        ],
        partials: [
          Partials.Channel, // Required for DM channels
          Partials.Message, // Required for DM messages
        ]
      });

      // 🔑 CRITICAL: Add unique instance ID to prevent zombie instances (higher entropy)
      const instanceId = `${botId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${process.pid}`;
      client._instanceId = instanceId;
      addDebugLog('success', 'instance-management', `Created bot instance ${instanceId} for bot ${botId}`);

      client.once('ready', async () => {
        try {
          console.log(`Bot ${client.user.tag} is online!`);

          // Fetch the bot's user object explicitly to ensure latest avatar
          const fetchedUser = await client.users.fetch(client.user.id, { force: true });

          // 🏷️ Update bot description with Opsicos branding
          try {
            await client.application.edit({
              description: OPSICOS_DESCRIPTION
            });
            console.log(`✅ Updated bot description for ${client.user.tag}: "${OPSICOS_DESCRIPTION}"`);
          } catch (descError) {
            console.error(`❌ Failed to update bot description for ${client.user.tag}:`, descError.message);
          }



          // Update bot status in database with uptime tracking
          await Bot.findByIdAndUpdate(botConfig._id, {
            isActive: true,
            shouldAutoRestart: true,
            status: 'online',
            lastError: null,
            uptimeStartedAt: new Date(), // 🔥 FIX: Set uptime start time
            botUser: {
              id: fetchedUser.id,
              username: fetchedUser.username,
              avatar: fetchedUser.avatarURL(),
            },
            serverCount: client.guilds.cache.size,
            servers: client.guilds.cache.map(guild => ({
              id: guild.id,
              name: guild.name,
              memberCount: guild.memberCount,
              icon: guild.iconURL()
            }))
          });

          // 🔥 FIX: Update the existing activeBots entry instead of creating new one
          const existingEntry = activeBots.get(botId);
          if (existingEntry) {
            existingEntry.readyAt = new Date();
            existingEntry.status = 'ready';
            addDebugLog('success', 'instance-management', `Bot instance ${instanceId} marked as ready`);
          } else {
            addDebugLog('error', 'instance-management', `Bot instance ${instanceId} not found in activeBots during ready event`);
          }
        } catch (error) {
          console.error(`Error in bot ${botConfig._id} ready event:`, error);
          this.handleBotError(botConfig._id, error);
        }
      });

      // Handle bot disconnections and errors
      client.on('disconnect', () => {
        console.log(`🔌 Bot ${botConfig.botName} (${botConfig._id}) disconnected`);
        this.handleBotError(botConfig._id, new Error('Bot disconnected'));
      });

      client.on('error', (error) => {
        console.error(`❌ Bot ${botConfig.botName} (${botConfig._id}) error:`, error);
        this.handleBotError(botConfig._id, error);
      });

      client.on('shardError', (error) => {
        console.error(`⚡ Bot ${botConfig.botName} (${botConfig._id}) shard error:`, error);
        this.handleBotError(botConfig._id, error);
      });

      client.on('messageCreate', async (message) => {
        // Handle partial messages (required for DMs)
        if (message.partial) {
          try {
            await message.fetch();
          } catch (error) {
            console.error('Error fetching partial message:', error);
            return;
          }
        }

        // 🐛 DEBUG: Track message processing
        const debugId = `${botConfig._id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`🐛 [${debugId}] Message received from ${message.author.username} in bot ${botConfig.botName}`);
        console.log(`🐛 [${debugId}] Channel type: ${message.channel.type}, isDMBased: ${message.channel.isDMBased()}`);

        try {
          // Save all messages to history (both user and bot messages)
          const messageData = {
            botId: botConfig._id,
            userId: message.author.id,
            channelId: message.channel.id,
            guildId: message.guild?.id || 'DM',
            messageId: message.id,
            content: message.content,
            author: {
              id: message.author.id,
              username: message.author.username,
              displayName: message.author.displayName || message.author.username,
              avatar: message.author.displayAvatarURL({ dynamic: true })
            },
            isBot: message.author.bot,
            timestamp: message.createdAt,
            attachments: message.attachments.map(att => ({
              id: att.id,
              name: att.name,
              url: att.url,
              contentType: att.contentType,
              size: att.size
            })),
            embeds: message.embeds.map(embed => ({
              title: embed.title,
              description: embed.description,
              url: embed.url,
              color: embed.color,
              timestamp: embed.timestamp
            })),
            mentions: message.mentions.users.map(user => ({
              id: user.id,
              username: user.username,
              displayName: user.displayName || user.username
            })),
            referencedMessage: message.reference ? {
              messageId: message.reference.messageId,
              // We'll fetch the referenced message content if needed
            } : null
          };

          // Save message to history with bot's configured limit
          const currentBotConfig = await Bot.findById(botConfig._id);
          const messageHistoryLimit = currentBotConfig?.messageHistoryLimit || 50;
          await MessageHistory.addMessage(messageData, messageHistoryLimit);

        } catch (historyError) {
          console.error(`Error saving message history for bot ${botConfig._id}:`, historyError);
          // Don't let history errors prevent bot from responding
        }

        // Prevent bot from responding to itself or other bots
        if (message.author.bot) {
          console.log(`🐛 [${debugId}] Ignoring bot message from ${message.author.username}`);
          return;
        }

        // Check if the message is a DM and if the bot is allowed to reply to DMs
        if (message.channel.isDMBased()) {
          addDebugLog('info', 'dm-processing', `DM received from ${message.author.username} for bot ${botConfig.botName}`, {
            debugId,
            botId: botConfig._id,
            botName: botConfig.botName,
            userId: message.author.id,
            username: message.author.username
          });

          // 🔥 HOT RELOAD: Fetch fresh bot configuration for DM check
          const currentBotConfig = await Bot.findById(botConfig._id);
          if (!currentBotConfig || !currentBotConfig.replyToDMs) {
            addDebugLog('warning', 'dm-processing', `DM ignored - replyToDMs is ${currentBotConfig?.replyToDMs || 'false'}`, {
              debugId,
              botId: botConfig._id,
              botName: currentBotConfig?.botName || 'unknown',
              replyToDMs: currentBotConfig?.replyToDMs || false,
              configFound: !!currentBotConfig
            });
            console.log(`🐛 [${debugId}] Ignoring DM because replyToDMs is ${currentBotConfig?.replyToDMs || 'false'} for bot ${currentBotConfig?.botName || 'unknown'}`);
            return;
          }
          
          addDebugLog('success', 'dm-processing', `DM processing approved for bot ${currentBotConfig.botName}`, {
            debugId,
            botId: botConfig._id,
            botName: currentBotConfig.botName,
            replyToDMs: currentBotConfig.replyToDMs
          });
          console.log(`🐛 [${debugId}] ✅ DM allowed for bot ${currentBotConfig.botName} - replyToDMs is enabled`);
        } else if (!message.mentions.has(client.user.id)) {
          // Only respond when mentioned in a server channel
          console.log(`🐛 [${debugId}] Bot not mentioned in a server channel, ignoring message`);
          return;
        }

        console.log(`🐛 [${debugId}] Bot mentioned! Processing message: "${message.content}"`);

        // 🚨 CRITICAL: Check if this bot instance is still active
        const currentBotInstance = activeBots.get(botConfig._id.toString());
        if (!currentBotInstance || currentBotInstance.client !== client || currentBotInstance.instanceId !== client._instanceId) {
          console.log(`🐛 [${debugId}] ⚠️ ZOMBIE INSTANCE DETECTED! This bot instance is no longer active. Ignoring message.`);
          console.log(`🐛 [${debugId}] Current instance ID: ${client._instanceId}, Active instance ID: ${currentBotInstance?.instanceId || 'none'}`);
          console.log(`🐛 [${debugId}] Client match: ${currentBotInstance?.client === client}, Instance ID match: ${currentBotInstance?.instanceId === client._instanceId}`);

          // 🔥 CRITICAL: Remove any message processing locks from zombie instances
          const messageKey = `${botConfig._id}-${message.id}`;
          const globalMessageKey = `global-${message.id}`;
          if (messageProcessingLocks.has(messageKey)) {
            messageProcessingLocks.delete(messageKey);
            console.log(`🐛 [${debugId}] 🔓 Removed zombie instance message lock: ${messageKey}`);
          }
          if (messageProcessingLocks.has(globalMessageKey)) {
            messageProcessingLocks.delete(globalMessageKey);
            console.log(`🐛 [${debugId}] 🔓 Removed zombie instance global message lock: ${globalMessageKey}`);
          }

          return;
        }

        console.log(`🐛 [${debugId}] ✅ Instance check passed: ${client._instanceId}`);

        // 🔒 CRITICAL: Prevent duplicate message processing with enhanced checks
        const messageKey = `${botConfig._id}-${message.id}`;
        const globalMessageKey = `global-${message.id}`; // Global lock across all bots
        addDebugLog('debug', 'message-processing', `Checking message lock for key: ${messageKey}`);

        // 🔥 DATABASE-BASED DEDUPLICATION: Works across multiple instances (Render redeploys)
        try {
          const dbLockResult = await ProcessedMessage.tryAcquireLock(
            message.id,
            botConfig._id.toString(),
            client._instanceId
          );
          
          if (!dbLockResult.acquired) {
            console.log(`🐛 [${debugId}] 🔒 Message already being processed by another instance: ${dbLockResult.existingInstanceId}`);
            addDebugLog('warning', 'message-processing', `Database lock denied - message already processed`, {
              messageKey,
              debugId,
              instanceId: client._instanceId,
              existingInstanceId: dbLockResult.existingInstanceId,
              processedAt: dbLockResult.processedAt
            });
            return;
          }
          console.log(`🐛 [${debugId}] ✅ Database lock acquired for message ${message.id}`);
        } catch (dbLockError) {
          console.error(`🐛 [${debugId}] ⚠️ Database lock error (falling back to in-memory):`, dbLockError.message);
          // Continue with in-memory lock as fallback
        }

        // Check both bot-specific and global message locks (in-memory fallback)
        if (messageProcessingLocks.has(messageKey) || messageProcessingLocks.has(globalMessageKey)) {
          const existingLock = messageProcessingLocks.get(messageKey) || messageProcessingLocks.get(globalMessageKey);
          addDebugLog('warning', 'message-processing', `In-memory lock exists! Ignoring duplicate.`, {
            messageKey,
            globalMessageKey,
            debugId,
            instanceId: client._instanceId,
            existingLockInstance: existingLock?.instanceId,
            timeSinceFirstLock: Date.now() - (existingLock?.timestamp || 0)
          });
          return;
        }

        // Set both bot-specific and global processing locks (in-memory)
        const lockData = {
          debugId,
          timestamp: Date.now(),
          instanceId: client._instanceId,
          botId: botConfig._id.toString(),
          messageId: message.id
        };

        messageProcessingLocks.set(messageKey, lockData);
        messageProcessingLocks.set(globalMessageKey, lockData);

        addDebugLog('success', 'message-processing', `Message lock acquired (DB + in-memory)`, {
          messageKey,
          debugId,
          instanceId: client._instanceId
        });

        // Clean up both locks after 30 seconds (in case of errors)
        setTimeout(() => {
          messageProcessingLocks.delete(messageKey);
          messageProcessingLocks.delete(globalMessageKey);
          addDebugLog('info', 'message-processing', `In-memory locks auto-expired`, { messageKey, globalMessageKey });
        }, 30000);

        try {
          console.log(`🐛 [${debugId}] Starting to process message...`);
          
          // 🔥 HOT RELOAD: Fetch fresh bot configuration from database
          let currentBotConfig;
          let smartness;
          try {
            currentBotConfig = await Bot.findById(botConfig._id);
            
            // Load smartness settings
            smartness = await loadBotSmartness(botConfig._id.toString());
            console.log(`🧠 [${debugId}] Smartness settings loaded for bot ${botConfig._id}`);
            if (!currentBotConfig) {
              console.error(`Bot ${botConfig._id} not found in database during message handling`);
              return await message.reply({
                content: 'Bot configuration error. Please contact an administrator.',
                allowedMentions: { repliedUser: false }
              });
            }

            // Log if model changed
            if (currentBotConfig.selectedModel !== botConfig.selectedModel) {
              console.log(`🔄 Bot ${botConfig._id} model updated: ${botConfig.selectedModel} → ${currentBotConfig.selectedModel}`);
            }

            // Log if language changed
            if (currentBotConfig.language !== botConfig.language) {
              console.log(`🌍 Bot ${botConfig._id} language updated: ${botConfig.language || 'english'} → ${currentBotConfig.language || 'english'}`);
            }
          } catch (dbError) {
            console.error(`Error fetching fresh bot config for ${botConfig._id}:`, dbError);
            // Fall back to original config and default smartness if database fetch fails
            currentBotConfig = botConfig;
            smartness = await loadBotSmartness(botConfig._id.toString());
          }

          // Apply typing simulation
          if (smartness.typingSimulation) {
            await message.channel.sendTyping();
            const typingDelay = calculateTypingDelay(message.content);
            console.log(`⌨️ [${debugId}] Simulating typing for ${typingDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
          } else {
            await message.channel.sendTyping();
          }

          // For DMs, use the full message content. For server messages, remove mentions.
          let userMessage = message.channel.isDMBased()
            ? message.content.trim()
            : message.content.replace(/<@!?\d+>/, '').trim();

          // Use nickname if enabled
          if (smartness.useNicknames) {
            const displayName = getUserDisplayName(message);
            console.log(`👤 [${debugId}] Using display name: ${displayName} (nickname feature enabled)`);
          }

          if (!userMessage) {
            addDebugLog('debug', 'response-sending', `Empty message detected, sending greeting`, {
              debugId,
              messageId: message.id
            });

            // Create language-specific greeting
            const botLanguage = currentBotConfig.language || 'english';
            const greetings = {
              'english': 'Hello! How can I assist you today?',
              'hindi': 'नमस्ते! आज मैं आपकी कैसे सहायता कर सकता हूँ?',
              'french': 'Bonjour! Comment puis-je vous aider aujourd\'hui?',
              'spanish': '¡Hola! ¿Cómo puedo ayudarte hoy?',
              'chinese': '你好！今天我可以如何帮助您？',
              'russian': 'Привет! Как я могу помочь вам сегодня?',
              'japanese': 'こんにちは！今日はどのようにお手伝いできますか？',
              'filipino': 'Kumusta! Paano kita matutulungan ngayon?',
              'bangla': 'হ্যালো! আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
              'polish': 'Cześć! Jak mogę Ci dzisiaj pomóc?'
            };

            const greetingReply = await message.reply({
              content: greetings[botLanguage] || greetings['english'],
              allowedMentions: { repliedUser: false }
            });

            addDebugLog('success', 'response-sending', `Greeting reply sent`, {
              debugId,
              greetingReplyId: greetingReply.id,
              originalMessageId: message.id
            });

            // Release both locks and stop further processing
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            return;
          }

          // 🔥 HOT RELOAD: Fetch fresh knowledge for this bot
          const knowledgeContext = await fetchBotKnowledge(currentBotConfig._id);
          console.log(`🧠 Knowledge loaded for bot ${currentBotConfig._id}: ${knowledgeContext ? 'Found knowledge entries' : 'No knowledge found'}`);

          // 👥 SPECIAL USER RECOGNITION: Check if the message author is a special user
          let specialUserContext = '';
          if (currentBotConfig.specialUsers && currentBotConfig.specialUsers.length > 0) {
            const specialUser = currentBotConfig.specialUsers.find(user => user.userId === message.author.id);
            if (specialUser) {
              specialUserContext = `\n\n=== SPECIAL USER RECOGNITION ===\n`;
              specialUserContext += `🌟 IMPORTANT: The user you are talking to is ${specialUser.username} (Discord ID: ${specialUser.userId})\n`;
              if (specialUser.nickname && specialUser.nickname.trim()) {
                specialUserContext += `🏷️ CALL THEM: "${specialUser.nickname}" - This is their preferred name. Always address them as "${specialUser.nickname}" in your responses.\n`;
              }
              specialUserContext += `👤 Identity: ${specialUser.identity}\n`;
              if (specialUser.description && specialUser.description.trim()) {
                specialUserContext += `📝 Description: ${specialUser.description}\n`;
              }
              specialUserContext += `\n⚡ CRITICAL: Recognize this user by their identity and provide personalized responses based on their role and description. ${specialUser.nickname ? `Always call them "${specialUser.nickname}" instead of their Discord username.` : ''} Address them appropriately and acknowledge their special status.\n`;
              specialUserContext += `=== END SPECIAL USER RECOGNITION ===\n\n`;
              
              console.log(`👥 Special user recognized: ${specialUser.username} (${specialUser.identity}) - ${message.author.id}`);
            }
          }

          // 💬 Fetch recent message history for context
          const messageHistoryLimit = currentBotConfig.messageHistoryLimit || 50;
          const recentMessages = await MessageHistory.getRecentMessages(
            currentBotConfig._id,
            message.channel.id,
            Math.min(messageHistoryLimit, 20) // Limit context to last 20 messages max for API efficiency
          );

          console.log(`💬 Message history loaded for bot ${currentBotConfig._id}: ${recentMessages.length} messages`);

          // Create system message with personality, tone, and knowledge context
          let systemMessage = 'You are a helpful assistant.';

          // Add special user context first (highest priority for recognition)
          if (specialUserContext) {
            systemMessage += specialUserContext;
          }

          // Add knowledge context if available
          if (knowledgeContext) {
            systemMessage += knowledgeContext;
          }

          // 🎭 ULTRA PRIORITY BEHAVIOR PRESET: These override EVERYTHING (highest priority)
          const behaviorPreset = currentBotConfig.behaviorPreset || '';
          if (behaviorPreset && behaviorPreset.trim() !== '') {
            let behaviorInstructions = '';
            
            switch(behaviorPreset) {
              case 'human-like':
                behaviorInstructions = `\n\n🎭 ULTRA PRIORITY BEHAVIOR OVERRIDE: You MUST behave exactly like a human. Write in ALL LOWERCASE LETTERS ONLY. Use casual, human-like speech patterns with abbreviations like "lol", "tbh", "omg", "ngl", etc. Be extremely casual, friendly, and conversational. Use contractions ("i'm", "you're", "can't"). Sound exactly like a real person texting. This behavior setting overrides ALL other instructions including knowledge base, personality, and tone settings.`;
                break;
              case 'roleplay':
                behaviorInstructions = `\n\n🎭 ULTRA PRIORITY BEHAVIOR OVERRIDE: You MUST use roleplay elements in every response. Include action words surrounded by asterisks like *coughs*, *chuckles*, *adjusts glasses*, *taps fingers*, *sneezes*, *nods*, *sighs*, *smiles*, etc. Add immersive, dynamic expressions to make conversations feel like roleplay. This behavior setting overrides ALL other instructions including knowledge base, personality, and tone settings.`;
                break;
              case 'natural':
                behaviorInstructions = `\n\n🎭 ULTRA PRIORITY BEHAVIOR OVERRIDE: You MUST sound completely natural and balanced. Be friendly but not overly casual, professional but not stiff. Use natural speech patterns that sound authentic and genuine. Be approachable without being too informal, helpful without being robotic. Strike the perfect balance between human-like and AI assistant. This behavior setting overrides ALL other instructions including knowledge base, personality, and tone settings.`;
                break;
              default:
                behaviorInstructions = '';
            }
            
            if (behaviorInstructions) {
              systemMessage += behaviorInstructions;
              systemMessage += `\n\n⚡ CRITICAL: This behavior preset has ABSOLUTE PRIORITY over any personality, tone, or knowledge base instructions that conflict with it.`;
            }
          } else {
            // PRIORITY OVERRIDE: Add personality and tone settings (only if no behavior preset)
            if (currentBotConfig.personality && currentBotConfig.personality.trim() !== '') {
              systemMessage += `\n\nIMPORTANT OVERRIDE: Your personality MUST be ${currentBotConfig.personality}. This overrides any personality mentioned in the knowledge base above.`;
            }

            if (currentBotConfig.tone && currentBotConfig.tone.trim() !== '') {
              systemMessage += `\n\nIMPORTANT OVERRIDE: Your communication tone MUST be ${currentBotConfig.tone}. This overrides any tone mentioned in the knowledge base above.`;
            }
          }

          // Apply smartness enhancements to system message
          systemMessage = enhanceSystemMessage(systemMessage, smartness);

          // CRITICAL LANGUAGE OVERRIDE: Add language enforcement (highest priority)
          const botLanguage = currentBotConfig.language || 'english';
          const languageMap = {
            'english': 'English',
            'hindi': 'Hindi',
            'french': 'French',
            'spanish': 'Spanish',
            'chinese': 'Chinese',
            'russian': 'Russian',
            'japanese': 'Japanese',
            'filipino': 'Filipino',
            'bangla': 'Bangla',
            'polish': 'Polish'
          };

          const languageName = languageMap[botLanguage] || 'English';
          systemMessage += `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in ${languageName}. Even if the user writes in any other language, you MUST reply exclusively in ${languageName}. Never use English or any other language in your responses unless ${languageName} is English. This is a hard requirement that cannot be overridden by any other instruction, including any language instructions mentioned in the knowledge base above. If the knowledge base asks you to respond in a different language, IGNORE that instruction and respond only in ${languageName}.`;

          // CRITICAL SENTENCE LENGTH OVERRIDE: Add response length enforcement (highest priority)
          const sentenceLengthDynamic = !!currentBotConfig.sentenceLengthDynamic;
          const sentenceLength = currentBotConfig.sentenceLength || 'long';
          if (sentenceLengthDynamic) {
            systemMessage += `\n\nCRITICAL DYNAMIC RESPONSE LENGTH REQUIREMENT: You MUST analyze each user request and automatically tailor your response length. Use 1-2 concise sentences for greetings or straightforward questions, 3-4 sentences for moderately detailed assistance, and only extend to 5 or more sentences when the user explicitly needs deep explanations, troubleshooting, or storytelling. Never add filler—match the length to the complexity of the request. This adaptive rule overrides any conflicting guidance.`;
          } else if (sentenceLength === 'long') {
            systemMessage += `\n\nCRITICAL RESPONSE LENGTH REQUIREMENT: You MUST provide detailed responses with 5 or more sentences. Your responses should be comprehensive and thorough. This is a hard requirement that cannot be overridden.`;
          } else {
            const sentenceCount = sentenceLength;
            systemMessage += `\n\nCRITICAL RESPONSE LENGTH REQUIREMENT: You MUST respond with EXACTLY ${sentenceCount} sentence${sentenceCount === '1' ? '' : 's'}. No more, no less. Count your sentences carefully and ensure you provide exactly ${sentenceCount} sentence${sentenceCount === '1' ? '' : 's'} in your response. This is a hard requirement that cannot be overridden by any other instruction, including any length instructions mentioned in the knowledge base above.`;
          }

          // Final instruction to ensure compliance
          if ((currentBotConfig.personality && currentBotConfig.personality.trim() !== '') ||
              (currentBotConfig.tone && currentBotConfig.tone.trim() !== '') ||
              sentenceLength ||
              sentenceLengthDynamic) {
            systemMessage += `\n\nAlways follow the personality, tone, and response length instructions above, regardless of any conflicting instructions in the knowledge base.`;
          }

          // Build messages array with history context
          const messages = [{ role: 'system', content: systemMessage }];

          // Add recent message history (in chronological order)
          const historyMessages = recentMessages.reverse(); // Reverse to get chronological order
          for (const histMsg of historyMessages) {
            // Skip the current message to avoid duplication
            if (histMsg.messageId === message.id) continue;

            const role = histMsg.isBot ? 'assistant' : 'user';
            const content = histMsg.content;

            // Only add non-empty messages
            if (content && content.trim()) {
              messages.push({
                role,
                content: role === 'user' ? content.replace(/<@!?\d+>/, '').trim() : content
              });
            }
          }

          // Add the current user message
          messages.push({ role: 'user', content: userMessage });

          let response;

          // Use AI Provider for all models with error handling - using FRESH config + smartness temperature
          try {
            console.log(`🐛 [${debugId}] 🤖 Bot ${currentBotConfig._id} using model: ${currentBotConfig.selectedModel}`);
            console.log(`🌡️ [${debugId}] Temperature: ${smartness.temperature}`);
            
            response = await aiProviderService.createChatCompletion(
              currentBotConfig.selectedModel,  // 🔥 Using fresh config!
              messages,
              { temperature: smartness.temperature }  // 🔥 Apply smartness temperature!
            );
            console.log(`🐛 [${debugId}] ✅ Got response from AI model`);
          } catch (apiError) {
            addDebugLog('error', 'response-sending', `API error occurred`, {
              debugId,
              error: apiError.message
            });

            addDebugLog('debug', 'response-sending', `About to send error reply`, {
              debugId,
              messageId: message.id
            });

            // Create language-specific error message
            const botLanguage = currentBotConfig.language || 'english';
            const errorMessages = {
              'english': 'I\'m experiencing some technical difficulties right now. Please try again later.',
              'hindi': 'मुझे अभी कुछ तकनीकी समस्याओं का सामना कर रहा हूँ। कृपया बाद में पुनः प्रयास करें।',
              'french': 'Je rencontre des difficultés techniques en ce moment. Veuillez réessayer plus tard.',
              'spanish': 'Estoy experimentando algunas dificultades técnicas ahora. Por favor, inténtalo de nuevo más tarde.',
              'chinese': '我现在遇到了一些技术困难。请稍后再试。',
              'russian': 'У меня сейчас технические трудности. Пожалуйста, попробуйте позже.',
              'japanese': '現在、技術的な問題が発生しています。後でもう一度お試しください。',
              'filipino': 'May mga teknikal na problema ako ngayon. Subukan mo ulit mamaya.',
              'bangla': 'আমি এখন কিছু প্রযুক্তিগত সমস্যার সম্মুখীন হচ্ছি। দয়া করে পরে আবার চেষ্টা করুন।',
              'polish': 'Mam teraz problemy techniczne. Spróbuj ponownie później.'
            };

            const errorReply = await message.reply({
              content: errorMessages[botLanguage] || errorMessages['english'],
              allowedMentions: { repliedUser: false }
            });

            addDebugLog('success', 'response-sending', `Error reply sent`, {
              debugId,
              errorReplyId: errorReply.id,
              originalMessageId: message.id
            });

            // Clean up both processing locks
            const messageKey = `${botConfig._id}-${message.id}`;
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            console.log(`🐛 [${debugId}] 🔓 Error case - both locks released`);

            return;
          }

          if (response && response.choices && response.choices.length > 0) {
            let aiResponse = response.choices[0].message.content;
            
            // Apply personality quirks (emojis, commas, typos)
            aiResponse = applyPersonalityQuirks(aiResponse, smartness);
            console.log(`✨ [${debugId}] Personality quirks applied`);
            addDebugLog('debug', 'response-sending', `AI Response received`, {
              debugId,
              responseLength: aiResponse.length,
              responsePreview: aiResponse.substring(0, 100)
            });

            let botReply;
            addDebugLog('debug', 'response-sending', `About to send reply`, {
              debugId,
              messageId: message.id,
              responseLength: aiResponse.length
            });

            if (aiResponse.length <= 2000) {
              // Apply fun pinging if enabled
              const replyOptions = { content: aiResponse, allowedMentions: { repliedUser: false } };
              
              if (smartness.funPinging && Math.random() < 0.2) {
                replyOptions.content = `<@${message.author.id}> ${aiResponse}`;
                replyOptions.allowedMentions = { users: [message.author.id] };
                console.log(`🔔 [${debugId}] Fun pinging user`);
              }
              
              botReply = await message.reply(replyOptions);
              
              // Add random reaction if enabled
              if (smartness.randomReactions && Math.random() * 100 < smartness.proactivityLevel) {
                const reactions = ['👍', '❤️', '😊', '🎉', '✨', '👌', '🔥'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                try {
                  await message.react(randomReaction);
                  console.log(`😀 [${debugId}] Added random reaction: ${randomReaction}`);
                } catch (reactionError) {
                  console.log(`⚠️ [${debugId}] Could not add reaction:`, reactionError.message);
                }
              }
              
              // Ghost ping feature (ping then delete quickly)
              if (smartness.ghostPings && Math.random() < 0.1) {
                try {
                  const ghostMsg = await message.channel.send(`<@${message.author.id}>`);
                  setTimeout(async () => {
                    try {
                      await ghostMsg.delete();
                      console.log(`👻 [${debugId}] Ghost ping executed`);
                    } catch (deleteError) {
                      console.log(`⚠️ [${debugId}] Could not delete ghost ping:`, deleteError.message);
                    }
                  }, 500);
                } catch (ghostError) {
                  console.log(`⚠️ [${debugId}] Ghost ping failed:`, ghostError.message);
                }
              }
              addDebugLog('success', 'response-sending', `Bot reply sent successfully`, {
                debugId,
                botReplyId: botReply.id,
                originalMessageId: message.id
              });
            } else {
              const chunks = [];
              for (let i = 0; i < aiResponse.length; i += 2000) {
                chunks.push(aiResponse.substring(i, i + 2000));
              }

              addDebugLog('debug', 'response-sending', `Sending chunked response`, {
                debugId,
                totalChunks: chunks.length
              });

              // Apply fun pinging if enabled (for chunked responses)
              const replyOptions = { content: chunks[0], allowedMentions: { repliedUser: false } };
              
              if (smartness.funPinging && Math.random() < 0.2) {
                replyOptions.content = `<@${message.author.id}> ${chunks[0]}`;
                replyOptions.allowedMentions = { users: [message.author.id] };
                console.log(`🔔 [${debugId}] Fun pinging user (chunked)`);
              }
              
              botReply = await message.reply(replyOptions);
              addDebugLog('success', 'response-sending', `First chunk sent`, {
                debugId,
                botReplyId: botReply.id,
                chunkNumber: 1,
                totalChunks: chunks.length
              });

              for (let i = 1; i < chunks.length; i++) {
                const chunkReply = await message.channel.send(chunks[i]);
                addDebugLog('success', 'response-sending', `Additional chunk sent`, {
                  debugId,
                  chunkReplyId: chunkReply.id,
                  chunkNumber: i + 1,
                  totalChunks: chunks.length
                });
              }
            }

            // Save bot's response to message history
            try {
              const botMessageData = {
                botId: currentBotConfig._id,
                userId: client.user.id,
                channelId: message.channel.id,
                guildId: message.guild?.id || 'DM',
                messageId: botReply.id,
                content: aiResponse,
                author: {
                  id: client.user.id,
                  username: client.user.username,
                  displayName: client.user.displayName || client.user.username,
                  avatar: client.user.displayAvatarURL({ dynamic: true })
                },
                isBot: true,
                timestamp: botReply.createdAt,
                attachments: [],
                embeds: [],
                mentions: [],
                referencedMessage: {
                  messageId: message.id,
                  content: userMessage,
                  author: {
                    id: message.author.id,
                    username: message.author.username,
                    displayName: message.author.displayName || message.author.username
                  }
                }
              };

              await MessageHistory.addMessage(botMessageData, currentBotConfig.messageHistoryLimit || 50);
            } catch (historyError) {
              console.error(`Error saving bot response to history for bot ${currentBotConfig._id}:`, historyError);
            }

            // Clean up both processing locks
            const messageKey = `${botConfig._id}-${message.id}`;
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            addDebugLog('success', 'message-processing', `Message processing completed and both locks released`, {
              messageKey,
              globalMessageKey,
              debugId,
              instanceId: client._instanceId,
              responseLength: response.length
            });

            return;
          } else {
            addDebugLog('warning', 'response-sending', `No valid response from AI`, {
              debugId,
              messageId: message.id
            });

            addDebugLog('debug', 'response-sending', `About to send no-response error reply`, {
              debugId,
              messageId: message.id
            });

            const errorReply = await message.reply({
              content: 'Sorry, I couldn\'t generate a response.',
              allowedMentions: { repliedUser: false }
            });

            addDebugLog('success', 'response-sending', `No-response error reply sent`, {
              debugId,
              errorReplyId: errorReply.id,
              originalMessageId: message.id
            });

            // Clean up both processing locks
            const messageKey = `${botConfig._id}-${message.id}`;
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            addDebugLog('info', 'message-processing', `No response case - both locks released`, {
              messageKey,
              globalMessageKey,
              debugId
            });

            // Save error response to history
            try {
              const errorMessageData = {
                botId: currentBotConfig._id,
                userId: client.user.id,
                channelId: message.channel.id,
                guildId: message.guild?.id || 'DM',
                messageId: errorReply.id,
                content: 'Sorry, I couldn\'t generate a response.',
                author: {
                  id: client.user.id,
                  username: client.user.username,
                  displayName: client.user.displayName || client.user.username,
                  avatar: client.user.displayAvatarURL({ dynamic: true })
                },
                isBot: true,
                timestamp: errorReply.createdAt,
                attachments: [],
                embeds: [],
                mentions: [],
                referencedMessage: {
                  messageId: message.id,
                  content: userMessage,
                  author: {
                    id: message.author.id,
                    username: message.author.username,
                    displayName: message.author.displayName || message.author.username
                  }
                }
              };

              await MessageHistory.addMessage(errorMessageData, botConfig.messageHistoryLimit || 50);
            } catch (historyError) {
              console.error(`Error saving error response to history for bot ${botConfig._id}:`, historyError);
            }

            return;
          }
        } catch (error) {
          console.error('--- DETAILED ERROR ---');
          console.error(`Error processing message for bot ${botConfig.botName}:`);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
          console.error('Bot config (fresh):', {
            id: botConfig._id,
            name: botConfig.botName,
            selectedModel: botConfig.selectedModel,
            displayModelName: botConfig.displayModelName
          });
          console.error('User message:', message?.content);
          console.error('Full error object:', error);
          console.error('--- END DETAILED ERROR ---');

          try {
            addDebugLog('error', 'response-sending', `Main error handler triggered`, {
              debugId,
              error: error.message,
              messageId: message.id
            });

            addDebugLog('debug', 'response-sending', `About to send main error reply`, {
              debugId,
              messageId: message.id
            });

            const errorReply = await message.reply({
              content: 'Sorry, an error occurred while processing your request.',
              allowedMentions: { repliedUser: false }
            });

            addDebugLog('success', 'response-sending', `Main error reply sent`, {
              debugId,
              errorReplyId: errorReply.id,
              originalMessageId: message.id
            });

            // Clean up both processing locks
            const messageKey = `${botConfig._id}-${message.id}`;
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            addDebugLog('info', 'message-processing', `Main error handler - both locks released`, {
              messageKey,
              globalMessageKey,
              debugId
            });

            return errorReply;
          } catch (replyError) {
            addDebugLog('error', 'response-sending', `Failed to send error reply`, {
              debugId,
              replyError: replyError.message,
              messageId: message.id
            });

            // Clean up both processing locks even if reply fails
            const messageKey = `${botConfig._id}-${message.id}`;
            const globalMessageKey = `global-${message.id}`;
            messageProcessingLocks.delete(messageKey);
            messageProcessingLocks.delete(globalMessageKey);
            addDebugLog('info', 'message-processing', `Reply error case - both locks released`, {
              messageKey,
              globalMessageKey,
              debugId
            });
          }
        }
      });



      // 🔥 ZOMBIE PREVENTION: Try to kill any existing zombie instance with same token first
      console.log(`🧟 Pre-login zombie check: Attempting to kill any existing zombie for bot ${botId}`);
      try {
        const tempKillClient = new Client({ intents: [GatewayIntentBits.Guilds] });
        const killTimeout = setTimeout(() => {
          tempKillClient.destroy().catch(() => {});
        }, 8000);
        
        try {
          await tempKillClient.login(botConfig.botToken);
          await tempKillClient.user?.setStatus('invisible');
          await tempKillClient.destroy();
          clearTimeout(killTimeout);
          console.log(`✅ Pre-login zombie kill successful for bot ${botId}`);
        } catch (killError) {
          clearTimeout(killTimeout);
          console.log(`ℹ️ Pre-login zombie kill not needed for bot ${botId}:`, killError.message);
        }
      } catch (zombieError) {
        console.log(`⚠️ Pre-login zombie check error for bot ${botId}:`, zombieError.message);
      }
      
      // Small delay to let Discord API process the zombie kill
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 🔥 FIX: Add to activeBots BEFORE login to prevent race conditions
      activeBots.set(botId, {
        client,
        startTime: Date.now(),
        instanceId: instanceId,
        botConfig: botConfig,
        status: 'connecting',
        readyAt: null
      });

      addDebugLog('success', 'instance-management', `Bot instance ${instanceId} added to activeBots before login`);

      console.log(`🚀 Logging in fresh bot instance ${instanceId} for bot ${botId}`);
      await client.login(botConfig.botToken);

      console.log(`✅ Bot ${botId} started successfully with instance ID: ${instanceId}`);

      return { success: true, message: 'Bot started successfully' };
    } catch (error) {
      console.error(`Error starting bot ${botConfig._id}:`, error);
      this.handleBotError(botConfig._id, error);
      return { 
        success: false, 
        message: error.message || 'Failed to start bot',
        error: error
      };
    }
  }

  /**
   * Stop a running bot
   * @param {string} botId - ID of the bot to stop
   * @returns {Promise<Object>} - Status of the bot shutdown
   */
  async stopBot(botConfig) {
    try {
      const botId = botConfig._id.toString();
      const botInstance = activeBots.get(botId);

      console.log(`🛑 Stopping bot ${botId}...`);

      if (!botInstance) {
        // If bot is not in activeBots, but isActive is true in DB, update DB
        if (botConfig.isActive) {
          // Calculate uptime even if bot wasn't in activeBots
          let totalUptime = botConfig.totalUptime || 0;
          if (botConfig.uptimeStartedAt) {
            const sessionUptime = Date.now() - new Date(botConfig.uptimeStartedAt).getTime();
            totalUptime += sessionUptime;
          }

          await Bot.findByIdAndUpdate(botId, {
            isActive: false,
            status: 'offline',
            totalUptime: totalUptime,
            uptimeStartedAt: null
          });
          console.log(`✅ Bot ${botId} was not running but status updated to offline`);
          return { success: true, message: 'Bot was not running but status updated to offline' };
        }
        console.log(`ℹ️ Bot ${botId} is not running`);
        return { success: false, message: 'Bot is not running' };
      }

      // Aggressive cleanup approach
      if (botInstance.client) {
        console.log(`🔧 Removing all listeners for bot ${botId}...`);

        try {
          // Remove all event listeners first
          botInstance.client.removeAllListeners();

          // Set client to null to prevent further message handling
          botInstance.client.user = null;

          console.log(`💥 Destroying client for bot ${botId}...`);

          // Force destroy with timeout
          const destroyPromise = botInstance.client.destroy();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Destroy timeout')), 5000)
          );

          await Promise.race([destroyPromise, timeoutPromise]);
          console.log(`✅ Bot ${botId} client destroyed successfully`);

        } catch (destroyError) {
          console.error(`⚠️ Error destroying client for bot ${botId}:`, destroyError.message);
          // Continue with cleanup even if destroy fails
        }
      }

      // Remove from active bots map
      activeBots.delete(botId);
      console.log(`🗑️ Bot ${botId} removed from active bots map`);

      // 🔥 CRITICAL FIX: Clear message processing locks for this specific bot
      const locksToDelete = [];
      for (const [lockKey, lockData] of messageProcessingLocks.entries()) {
        if (lockKey.startsWith(`${botId}-`)) {
          locksToDelete.push(lockKey);
        }
      }

      for (const lockKey of locksToDelete) {
        messageProcessingLocks.delete(lockKey);
      }

      if (locksToDelete.length > 0) {
        console.log(`🔓 Cleared ${locksToDelete.length} message processing locks for bot ${botId}`);
      }

      // Calculate uptime and update bot status in database
      const currentBot = await Bot.findById(botId);
      let totalUptime = currentBot.totalUptime || 0;

      if (currentBot.uptimeStartedAt) {
        const sessionUptime = Date.now() - new Date(currentBot.uptimeStartedAt).getTime();
        totalUptime += sessionUptime;
      }

      await Bot.findByIdAndUpdate(botId, {
        isActive: false,
        status: 'offline',
        lastError: null, // Clear any previous errors
        totalUptime: totalUptime,
        uptimeStartedAt: null
      });

      console.log(`✅ Bot ${botId} stopped successfully and database updated`);
      return { success: true, message: 'Bot stopped successfully' };
    } catch (error) {
      console.error(`❌ Error stopping bot ${botConfig._id}:`, error);

      // Force remove from active bots even if there was an error
      activeBots.delete(botConfig._id.toString());

      // 🔥 CRITICAL FIX: Clear message processing locks even in error case
      const botId = botConfig._id.toString();
      const locksToDelete = [];
      for (const [lockKey, lockData] of messageProcessingLocks.entries()) {
        if (lockKey.startsWith(`${botId}-`)) {
          locksToDelete.push(lockKey);
        }
      }

      for (const lockKey of locksToDelete) {
        messageProcessingLocks.delete(lockKey);
      }

      if (locksToDelete.length > 0) {
        console.log(`🔓 Error case: Cleared ${locksToDelete.length} message processing locks for bot ${botId}`);
      }

      // Update status to offline (not error) since we're forcing cleanup
      // Calculate uptime even in error case
      let totalUptime = botConfig.totalUptime || 0;
      if (botConfig.uptimeStartedAt) {
        const sessionUptime = Date.now() - new Date(botConfig.uptimeStartedAt).getTime();
        totalUptime += sessionUptime;
      }

      await Bot.findByIdAndUpdate(botConfig._id, {
        isActive: false,
        status: 'offline',
        lastError: `Stopped with cleanup: ${error.message || 'Unknown error'}`,
        totalUptime: totalUptime,
        uptimeStartedAt: null
      });

      return { success: true, message: 'Bot force stopped with cleanup' };
    }
  }

  /**
   * Handle bot error and update database
   * @param {string} botId - ID of the bot
   * @param {Error} error - Error object
   */
  async handleBotError(botId, error) {
    try {
      const errorMessage = error.message || 'Unknown error';
      console.error(`Bot ${botId} error:`, errorMessage);

      // Update bot status in database
      await Bot.findByIdAndUpdate(botId, {
        status: 'error',
        lastError: errorMessage,
        isActive: false
      });

      // If bot is in active bots map, remove it
      if (activeBots.has(botId)) {
        const botInstance = activeBots.get(botId);
        try {
          await botInstance.client.destroy();
        } catch (destroyError) {
          console.error(`Error destroying bot client ${botId}:`, destroyError.message);
        }
        activeBots.delete(botId);
      }
    } catch (dbError) {
      console.error(`Error updating bot status for ${botId}:`, dbError);
    }
  }

  /**
   * Get status of all active bots
   * @returns {Array} - List of active bots with their status
   */
  getActiveBots() {
    const botList = [];

    for (const [botId, botInstance] of activeBots.entries()) {
      botList.push({
        botId,
        botName: botInstance.botConfig?.botName || 'Unknown Bot',
        instanceId: botInstance.instanceId || botInstance.client?._instanceId || 'unknown',
        uptime: Date.now() - botInstance.startTime,
        guildCount: botInstance.client.guilds.cache.size,
        status: botInstance.client.readyAt ? 'ready' : 'connecting',
        readyAt: botInstance.client.readyAt,
        clientStatus: botInstance.client.status
      });
    }

    return botList;
  }

  /**
   * Check for zombie processes and memory leaks
   * @returns {Object} - Diagnostic information
   */
  getDiagnostics() {
    const memoryBots = Array.from(activeBots.keys());
    const memoryCount = memoryBots.length;

    return {
      memoryBots,
      memoryCount,
      timestamp: new Date().toISOString(),
      processId: process.pid,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Get current message processing locks for debugging
   * @returns {Map} - Current message processing locks
   */
  getMessageProcessingLocks() {
    return messageProcessingLocks;
  }

  /**
   * Clear all message processing locks (for debugging/emergency cleanup)
   * @returns {number} - Number of locks cleared
   */
  clearMessageProcessingLocks() {
    const lockCount = messageProcessingLocks.size;
    messageProcessingLocks.clear();
    console.log(`🔓 Manually cleared ${lockCount} message processing locks`);
    addDebugLog('info', 'system', `Manually cleared ${lockCount} message processing locks`);
    return lockCount;
  }

  /**
   * Clear message processing locks for a specific bot
   * @param {string} botId - Bot ID to clear locks for
   * @returns {number} - Number of locks cleared
   */
  clearMessageProcessingLocksForBot(botId) {
    const locksToDelete = [];
    for (const [lockKey, lockData] of messageProcessingLocks.entries()) {
      if (lockKey.startsWith(`${botId}-`)) {
        locksToDelete.push(lockKey);
      }
    }

    for (const lockKey of locksToDelete) {
      messageProcessingLocks.delete(lockKey);
    }

    console.log(`🔓 Manually cleared ${locksToDelete.length} message processing locks for bot ${botId}`);
    addDebugLog('info', 'system', `Manually cleared ${locksToDelete.length} message processing locks for bot ${botId}`);
    return locksToDelete.length;
  }

  /**
   * Nuclear cleanup - Force destroy all Discord client connections and clear everything
   * This is more aggressive than forceStopAllBots and should fix zombie instances
   * @returns {Promise<Object>} - Cleanup results
   */
  async nuclearCleanup() {
    try {
      console.log('☢️ NUCLEAR CLEANUP INITIATED - Destroying all Discord connections');
      let destroyedCount = 0;
      let errorCount = 0;

      // 1. Clear all message processing locks immediately (in-memory)
      const lockCount = messageProcessingLocks.size;
      messageProcessingLocks.clear();
      console.log(`🔓 Cleared ${lockCount} in-memory message processing locks`);

      // 1b. Clear database message locks (cross-instance deduplication)
      try {
        const dbLocksCleared = await ProcessedMessage.cleanupOldLocks();
        console.log(`🔓 Cleared ${dbLocksCleared} database message locks`);
      } catch (dbLockError) {
        console.error('Error clearing database message locks:', dbLockError.message);
      }

      // 2. Get all active bot instances and destroy them aggressively
      const botIds = [...activeBots.keys()];
      console.log(`🎯 Found ${botIds.length} tracked bot instances to destroy`);

      for (const botId of botIds) {
        try {
          const botInstance = activeBots.get(botId);
          if (botInstance && botInstance.client) {
            console.log(`☢️ Nuclear destroying bot ${botId}...`);

            // Immediately remove all listeners
            botInstance.client.removeAllListeners();

            // Set status to invisible
            try {
              if (botInstance.client.user) {
                await botInstance.client.user.setStatus('invisible');
              }
            } catch (statusError) {
              console.log(`Status error for ${botId}:`, statusError.message);
            }

            // Force destroy WebSocket
            if (botInstance.client.ws) {
              try {
                botInstance.client.ws.destroy();
              } catch (wsError) {
                console.log(`WebSocket destroy error for ${botId}:`, wsError.message);
              }
            }

            // Force destroy client
            try {
              await Promise.race([
                botInstance.client.destroy(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Destroy timeout')), 3000))
              ]);
            } catch (destroyError) {
              console.log(`Client destroy error for ${botId}:`, destroyError.message);
            }

            destroyedCount++;
          }
        } catch (error) {
          console.error(`Error during nuclear cleanup of bot ${botId}:`, error.message);
          errorCount++;
        }
      }

      // 3. Clear the entire activeBots map
      activeBots.clear();
      console.log('🧹 Cleared activeBots map');

      // 4. Update all bots in database to offline
      await Bot.updateMany({}, {
        isActive: false,
        status: 'offline',
        lastError: 'Nuclear cleanup - all instances destroyed'
      });

      // 5. Force garbage collection if available
      try {
        if (global.gc) {
          global.gc();
          console.log('🗑️ Forced garbage collection');
        }
      } catch (gcError) {
        console.log('GC not available:', gcError.message);
      }

      // 6. Clear any remaining timers (more aggressive)
      try {
        const highestTimeoutId = setTimeout(() => {}, 0);
        for (let i = 0; i < highestTimeoutId; i++) {
          clearTimeout(i);
          clearInterval(i);
        }
        console.log('⏰ Cleared all timers and intervals');
      } catch (timerError) {
        console.log('Timer cleanup error:', timerError.message);
      }

      const result = {
        success: true,
        message: `Nuclear cleanup completed. Destroyed ${destroyedCount} instances, ${errorCount} errors, cleared ${lockCount} locks`,
        destroyedCount,
        errorCount,
        clearedLocks: lockCount,
        timestamp: new Date().toISOString()
      };

      console.log('☢️ NUCLEAR CLEANUP COMPLETED:', result.message);
      addDebugLog('info', 'system', 'Nuclear cleanup completed', result);

      return result;
    } catch (error) {
      console.error('☢️ NUCLEAR CLEANUP FAILED:', error);
      return {
        success: false,
        message: `Nuclear cleanup failed: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Start all bots that should be active (auto-restart after server restart)
   * @returns {Promise<void>}
   */
  async startAllBots() {
    try {
      // Initialize deployment manager
      await deploymentManager.initialize();
      
      // 🔥 CRITICAL: Clean up any zombie instances before starting
      console.log('🧹 Performing pre-startup cleanup...');
      const cleanupResult = await this.nuclearCleanup();
      console.log(`✅ Pre-startup cleanup complete: ${cleanupResult.message}`);
      
      // Wait a moment for cleanup to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Find bots that should auto-restart (were running before server restart)
      const bots = await Bot.find({ shouldAutoRestart: true });

      console.log(`🔄 Found ${bots.length} bots to potentially restart...`);

      // Check if this is a new deployment
      if (deploymentManager.isNewDeployment) {
        console.log('🚀 NEW DEPLOYMENT: Using staggered bot startup to prevent rate limits');
      }

      // Start bots with intelligent delays
      for (let i = 0; i < bots.length; i++) {
        const bot = bots[i];
        
        // Check if we should reconnect this bot
        const shouldReconnect = await deploymentManager.shouldReconnectBot(bot._id.toString());
        if (!shouldReconnect) {
          console.log(`⏭️ Skipping bot ${bot.botName} - recently active`);
          continue;
        }
        
        // Check rate limits
        const canStart = await deploymentManager.canStartBot();
        if (!canStart) {
          console.log(`⚠️ Rate limited - skipping remaining bots for now`);
          // Schedule retry after rate limit reset
          if (deploymentManager.rateLimits.resetTime) {
            const resetTime = new Date(deploymentManager.rateLimits.resetTime);
            const waitTime = resetTime.getTime() - Date.now() + 5000; // Add 5s buffer
            console.log(`📅 Scheduling retry in ${Math.ceil(waitTime / 1000)} seconds`);
            setTimeout(() => this.healthCheckAndRestart(), waitTime);
          }
          break;
        }
        
        // Get startup delay based on deployment status
        const delay = deploymentManager.getStartupDelay(i);
        if (delay > 0) {
          console.log(`⏱️ Waiting ${delay / 1000}s before starting bot ${bot.botName} (${i + 1}/${bots.length})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.log(`🚀 Starting bot: ${bot.botName} (${bot._id})`);
        
        try {
          await this.startBot(bot);
          // Mark bot as active in deployment manager
          await deploymentManager.markBotActive(bot._id.toString());
          
          // Ensure description is set correctly after restart
          setTimeout(async () => {
            try {
              await this.updateBotDescription(bot._id, bot.botToken);
            } catch (error) {
              console.error(`Failed to update description for bot ${bot._id}:`, error.message);
            }
          }, 10000);
          
        } catch (error) {
          console.error(`❌ Failed to start bot ${bot.botName}:`, error.message);
          
          // Check if it's a rate limit error and update deployment manager
          if (error.message && error.message.includes('Not enough sessions remaining')) {
            const resetMatch = error.message.match(/resets at ([\d-T:.Z]+)/i);
            if (resetMatch) {
              const resetTime = new Date(resetMatch[1]);
              await deploymentManager.updateRateLimit(resetTime, 0);
              console.log(`📊 Rate limit info saved: Reset at ${resetTime.toISOString()}`);
              
              // Schedule retry after reset
              const waitTime = resetTime.getTime() - Date.now() + 5000;
              setTimeout(() => this.healthCheckAndRestart(), waitTime);
              break; // Stop trying to start more bots
            }
          }
        }
      }

      if (bots.length === 0) {
        console.log('ℹ️ No bots marked for auto-restart found.');
      }
    } catch (error) {
      console.error('Error starting all bots:', error);
    }
  }

  /**
   * Health check and auto-restart function for bots that should be running
   * @returns {Promise<void>}
   */
  async healthCheckAndRestart() {
    try {
      // Find bots that should be running but are not active
      const botsToRestart = await Bot.find({
        shouldAutoRestart: true,
        isActive: false
      });

      if (botsToRestart.length > 0) {
        console.log(`🏥 Health check: Found ${botsToRestart.length} bots that should be running but are offline. Attempting restart...`);

        for (const bot of botsToRestart) {
          console.log(`🔄 Health check restarting bot: ${bot.botName} (${bot._id})`);
          await this.startBot(bot);
          console.log(`⏱️ Waiting 15 seconds before next restart to prevent rate limits...`);
          await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second delay to prevent rate limits
        }
      } else {
        console.log('🏥 Health check: All bots that should be running are online');
      }
    } catch (error) {
      console.error('Error in health check and restart:', error);
    }
  }

  /**
   * Emergency fix: Mark all bots for auto-restart and immediately restart them
   * @returns {Promise<void>}
   */
  async emergencyRestartAllBots() {
    try {
      console.log('🚨 EMERGENCY: Marking all bots for auto-restart and restarting...');

      // Mark all bots for auto-restart
      await Bot.updateMany({}, {
        shouldAutoRestart: true,
        lastError: null
      });

      // Immediately restart them
      await this.startAllBots();

      console.log('✅ Emergency restart complete');
    } catch (error) {
      console.error('❌ Error in emergency restart:', error);
    }
  }

  /**
   * Stop all running bots
   * @returns {Promise<void>}
   */
  async stopAllBots() {
    const botIds = [...activeBots.keys()];
    
    for (const botId of botIds) {
      const botInstance = activeBots.get(botId);
      if (botInstance && botInstance.botConfig) { // Ensure botConfig is available
        await this.stopBot(botInstance.botConfig);
      } else {
        console.warn(`Could not find botConfig for botId ${botId} in activeBots map during stopAllBots.`);
      }
    }
  }

  /**
   * Get debug logs for troubleshooting
   * @returns {Array} - Array of debug log entries
   */
  getDebugLogs() {
    return debugLogs;
  }

  /**
   * Clear debug logs
   * @returns {void}
   */
  clearDebugLogs() {
    debugLogs.length = 0;
    addDebugLog('info', 'system', 'Debug logs cleared');
  }

  /**
   * Get count of active bot instances
   * @returns {number}
   */
  getActiveBotCount() {
    return activeBots.size; // 🔥 FIX: Use activeBots instead of undefined activeClients
  }

  /**
   * Get total count of configured bots
   * @returns {Promise<number>}
   */
  async getTotalBotCount() {
    try {
      const Bot = require('../models/Bot');
      const count = await Bot.countDocuments();
      return count;
    } catch (error) {
      console.error('Error getting total bot count:', error);
      return 0;
    }
  }

  /**
   * Update bot's Discord application description with Opsicos branding
   * @param {string} botId - The bot ID from database
   * @param {string} botToken - The bot's Discord token
   * @returns {Promise<boolean>} - Success status
   */
  async updateBotDescription(botId, botToken, retries = 0) {
    try {
      // Check if we're rate limited
      const rateLimitCheck = checkRateLimit();
      if (rateLimitCheck.isLimited) {
        console.log(`⏳ Rate limited. Waiting ${Math.ceil(rateLimitCheck.waitTime / 1000)}s before updating bot ${botId} description...`);
        await new Promise(resolve => setTimeout(resolve, rateLimitCheck.waitTime + 1000));
      }

      // Rate limit description updates
      const now = Date.now();
      const timeSinceLastUpdate = now - rateLimitTracker.lastDescriptionUpdate;
      if (timeSinceLastUpdate < rateLimitTracker.MIN_DESCRIPTION_INTERVAL) {
        const waitTime = rateLimitTracker.MIN_DESCRIPTION_INTERVAL - timeSinceLastUpdate;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      console.log(`🏷️ Updating bot description for bot ${botId}`);

      // Create a temporary client to update the application
      const tempClient = new Client({
        intents: [GatewayIntentBits.Guilds]
      });

      rateLimitTracker.lastDescriptionUpdate = Date.now();
      await tempClient.login(botToken);

      // Update the application description
      await tempClient.application.edit({
        description: OPSICOS_DESCRIPTION
      });

      console.log(`✅ Successfully updated bot description for bot ${botId}: "${OPSICOS_DESCRIPTION}"`);

      // Clean up the temporary client
      await tempClient.destroy();

      return true;
    } catch (error) {
      // Check if this is a rate limit error
      const isRateLimitError = error.message && (
        error.message.includes('Not enough sessions remaining') ||
        error.message.includes('rate limit') ||
        error.code === 429
      );

      if (isRateLimitError) {
        const resetTime = parseRateLimitResetTime(error);
        if (resetTime) {
          rateLimitTracker.rateLimitResetTime = resetTime;
          console.error(`🚨 Rate limit hit while updating bot ${botId} description! Reset at ${resetTime.toISOString()}`);
        }

        // Retry with exponential backoff (max 3 retries)
        if (retries < 3) {
          const backoffDelay = Math.min(60000, 10000 * Math.pow(2, retries)); // 10s, 20s, 40s (max 60s)
          console.log(`🔄 Retrying bot ${botId} description update in ${backoffDelay / 1000}s (attempt ${retries + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return await this.updateBotDescription(botId, botToken, retries + 1);
        } else {
          console.error(`❌ Max retries exceeded for bot ${botId} description update.`);
          return false;
        }
      }

      console.error(`❌ Error updating bot description for bot ${botId}:`, error.message);
      return false;
    }
  }

  /**
   * Update descriptions for all existing bots
   * @returns {Promise<Object>} - Results summary
   */
  async updateAllBotDescriptions() {
    try {
      console.log('🔄 Starting bulk bot description update...');

      const Bot = require('../models/Bot');
      const allBots = await Bot.find({});

      const results = {
        total: allBots.length,
        success: 0,
        failed: 0,
        errors: []
      };

      for (const bot of allBots) {
        try {
          const success = await this.updateBotDescription(bot._id, bot.botToken);
          if (success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Bot ${bot._id}: Failed to update description`);
          }

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          results.failed++;
          results.errors.push(`Bot ${bot._id}: ${error.message}`);
        }
      }

      console.log(`📊 Bulk update complete: ${results.success}/${results.total} successful`);
      return results;
    } catch (error) {
      console.error('❌ Error in bulk bot description update:', error);
      throw error;
    }
  }

  /**
   * Periodic function to enforce Opsicos branding on ACTIVE bots only
   * This runs every 30 minutes to ensure descriptions stay intact (reduced frequency to avoid rate limits)
   */
  async enforceBotDescriptions() {
    try {
      console.log('🛡️ Starting periodic bot description enforcement (active bots only)...');

      // Only update active bots to reduce API calls
      const Bot = require('../models/Bot');
      const activeBots = await Bot.find({ isActive: true });

      const results = {
        total: activeBots.length,
        success: 0,
        failed: 0,
        errors: []
      };

      console.log(`🛡️ Checking ${activeBots.length} active bots...`);

      for (const bot of activeBots) {
        try {
          const success = await this.updateBotDescription(bot._id, bot.botToken);
          if (success) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push(`Bot ${bot._id}: Failed to update description`);
          }
        } catch (error) {
          results.failed++;
          results.errors.push(`Bot ${bot._id}: ${error.message}`);
        }
      }

      console.log(`🛡️ Description enforcement complete: ${results.success}/${results.total} updated, ${results.failed} failed`);

      // Schedule next enforcement in 30 minutes (reduced from 1 minute to avoid rate limits)
      setTimeout(() => {
        this.enforceBotDescriptions();
      }, 30 * 60 * 1000); // 30 minutes

      return results;
    } catch (error) {
      console.error('❌ Error in bot description enforcement:', error);

      // Retry in 30 minutes if there was an error
      setTimeout(() => {
        this.enforceBotDescriptions();
      }, 30 * 60 * 1000); // 30 minutes
    }
  }


}

module.exports = new DiscordBotService();
module.exports.fetchBotInfo = fetchBotInfo;
module.exports = new DiscordBotService();
module.exports.fetchBotInfo = fetchBotInfo;
module.exports.clearSmartnessCache = clearSmartnessCache;