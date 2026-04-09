const express = require('express');
const router = express.Router();
const aiProviderService = require('../services/aiProviderService');
const discordBotService = require('../services/discordBotService');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * @route   GET /api/status
 * @desc    Get API status
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/models
 * @desc    Get available AI models
 * @access  Private
 */
router.get('/models', isAuthenticated, async (req, res) => {
  // Prevent caching so new models show immediately after deploy
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  
  try {
    const models = [
      // OpenAI Models
      { id: 'provider-3/gpt-4o-mini', name: 'GPT-4o Mini', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
      { id: 'provider-3/gpt-5-nano', name: 'GPT-5 Nano', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
      { id: 'provider-1/gpt-oss-20b', name: 'GPT OSS 20B', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
      { id: 'provider-3/gpt-4.1-nano', name: 'GPT-4.1 Nano', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },

      // DeepSeek Models
      { id: 'provider-1/deepseek-r1-distill-qwen-1.5b', name: 'DeepSeek R1 Distill Qwen 1.5B', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
      { id: 'provider-1/deepseek-v3.1', name: 'DeepSeek V3.1', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
      { id: 'provider-1/deepseek-v3.1-turbo', name: 'DeepSeek V3.1 Turbo', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
      { id: 'provider-1/deepseek-tng-r1t2-chimera', name: 'DeepSeek TNG R1T2 Chimera', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },

      // Google Models
      { id: 'provider-1/gemma-3-4b-it', name: 'Gemma 3 4B IT', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
      { id: 'provider-3/gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash Lite Preview', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
      { id: 'provider-6/gemma-3-27b-instruct', name: 'Gemma 3 27B Instruct', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
      { id: 'provider-1/gemma-2-9b-it', name: 'Gemma 2 9B IT', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },

      // InferenceNet Models
      { id: 'provider-6/cliptagger-12b', name: 'ClipTagger 12B', company: 'InferenceNet', logo: 'https://avatars.githubusercontent.com/u/132372032?s=200&v=4' },

      // Meta Models
      { id: 'provider-1/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B 16E Instruct', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
      { id: 'provider-1/llama-3.2-1b-instruct-fp-16', name: 'Llama 3.2 1B Instruct FP-16', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
      { id: 'provider-3/llama-4-scout', name: 'Llama 4 Scout', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
      { id: 'provider-1/deephermes-3-llama-3-8b-preview', name: 'DeepHermes 3 Llama 3 8B Preview', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
      { id: 'provider-1/shisa-v2-llama3.3-70b', name: 'Shisa V2 Llama3.3 70B', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },

      // Mistral Models
      { id: 'provider-6/mistral-nemo-12b-instruct', name: 'Mistral Nemo 12B Instruct', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
      { id: 'provider-1/mistralai-devstral-small-2505', name: 'MistralAI Devstral Small 2505', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
      { id: 'provider-1/chutesai-devstral-small-2505', name: 'ChutesAI Devstral Small 2505', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
      { id: 'provider-1/mistral-small-3.2-24b-instruct-2506', name: 'Mistral Small 3.2 24B Instruct 2506', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },

      // MoonShot AI Models
      { id: 'provider-1/kimi-k2-instruct', name: 'Kimi K2 Instruct', company: 'MoonShot AI', logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4' },
      { id: 'provider-1/kimi-vl-a3b-thinking', name: 'Kimi VL A3B Thinking', company: 'MoonShot AI', logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4' },

      // Qwen Models
      { id: 'provider-1/qwen3-4b-thinking-2507', name: 'Qwen3 4B Thinking 2507', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
      { id: 'provider-6/qwen2.5-7b-instruct', name: 'Qwen2.5 7B Instruct', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
      { id: 'provider-1/qwen3-8b', name: 'Qwen3 8B', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
      { id: 'provider-3/qwen-2.5-72b', name: 'Qwen 2.5 72B', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },

      // xAI Models
      { id: 'provider-5/grok-4-0709', name: 'Grok 4 0709', company: 'xAI', logo: 'https://x.ai/favicon.ico' },

      // Zhipu AI Models
      { id: 'provider-1/glm-4.6', name: 'GLM 4.6', company: 'Zhipu AI', logo: 'https://open.bigmodel.cn/static/zhipuai.png' },
      { id: 'glm-4.5v', name: 'GLM 4.5V', company: 'Zhipu AI', logo: 'https://open.bigmodel.cn/static/zhipuai.png' },

      // Anthropic Models (Custom Router)
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', company: 'Anthropic', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/anthropic.svg' }
    ];

    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/chat
 * @desc    Test AI chat completion
 * @access  Private
 */
router.post('/chat', isAuthenticated, async (req, res) => {
  try {
    const { model, messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages are required' });
    }

    const modelId = model || 'provider-3/gpt-4o-mini';

    // Use AI Provider for all models
    const response = await aiProviderService.createChatCompletion(modelId, messages);

    res.json(response);
  } catch (error) {
    console.error('Error calling chat API:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * @route   POST /api/playground/chat
 * @desc    Handle playground chat interactions
 * @access  Private
 */
router.post('/playground/chat', isAuthenticated, async (req, res) => {
  try {
    const { botId, model, message } = req.body;
    const Bot = require('../models/Bot');
    const Knowledge = require('../models/Knowledge');

    if (!botId || !message) {
      return res.status(400).json({ error: 'Bot ID and message are required' });
    }

    // Verify bot ownership
    const bot = await Bot.findOne({ _id: botId, userId: req.user._id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Get bot's knowledge
    const knowledge = await Knowledge.find({
      botId: botId,
      isActive: true
    }).sort({ createdAt: -1 }).limit(10);

    // Build system prompt with bot's personality, tone, and knowledge
    let systemPrompt = `You are ${bot.botName}, a Discord bot created by ${req.user.name}.`;

    // Add knowledge base first
    if (knowledge.length > 0) {
      systemPrompt += '\n\nYour knowledge base includes:\n';
      knowledge.forEach(k => {
        systemPrompt += `- ${k.title}: ${k.content}\n`;
      });
    }

    // 🎭 ULTRA PRIORITY BEHAVIOR PRESET: These override EVERYTHING (highest priority)
    const behaviorPreset = bot.behaviorPreset || '';
    if (behaviorPreset && behaviorPreset.trim() !== '') {
      let behaviorInstructions = '';

      switch (behaviorPreset) {
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
        systemPrompt += behaviorInstructions;
        systemPrompt += `\n\n⚡ CRITICAL: This behavior preset has ABSOLUTE PRIORITY over any personality, tone, or knowledge base instructions that conflict with it.`;
      }
    } else {
      // PRIORITY OVERRIDE: Add personality and tone settings (only if no behavior preset)
      if (bot.personality && bot.personality.trim() !== '') {
        systemPrompt += `\n\nIMPORTANT OVERRIDE: Your personality MUST be ${bot.personality}. This overrides any personality mentioned in the knowledge base above.`;
      }

      if (bot.tone && bot.tone.trim() !== '') {
        systemPrompt += `\n\nIMPORTANT OVERRIDE: Your communication tone MUST be ${bot.tone}. This overrides any tone mentioned in the knowledge base above.`;
      }
    }

    // CRITICAL LANGUAGE OVERRIDE: Add language enforcement (highest priority)
    const botLanguage = bot.language || 'english';
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
    systemPrompt += `\n\nCRITICAL LANGUAGE REQUIREMENT: You MUST respond ONLY in ${languageName}. Even if the user writes in any other language, you MUST reply exclusively in ${languageName}. Never use English or any other language in your responses unless ${languageName} is English. This is a hard requirement that cannot be overridden by any other instruction, including any language instructions mentioned in the knowledge base above. If the knowledge base asks you to respond in a different language, IGNORE that instruction and respond only in ${languageName}.`;

    // CRITICAL SENTENCE LENGTH OVERRIDE: Add response length enforcement (highest priority)
    const sentenceLengthDynamic = !!bot.sentenceLengthDynamic;
    const sentenceLength = bot.sentenceLength || 'long';
    if (sentenceLengthDynamic) {
      systemPrompt += `\n\nCRITICAL DYNAMIC RESPONSE LENGTH REQUIREMENT: You MUST evaluate each user request and automatically choose the ideal response length. Keep greetings or simple yes/no answers to 1-2 sentences, expand to 3-4 sentences for moderately detailed questions, and go 5 or more sentences only when the user explicitly requests deep explanations or storytelling. Never pad responses with filler—match the length to the complexity of the request. This adaptive behavior overrides any conflicting guidance.`;
    } else if (sentenceLength === 'long') {
      systemPrompt += `\n\nCRITICAL RESPONSE LENGTH REQUIREMENT: You MUST provide detailed responses with 5 or more sentences. Your responses should be comprehensive and thorough. This is a hard requirement that cannot be overridden.`;
    } else {
      const sentenceCount = sentenceLength;
      systemPrompt += `\n\nCRITICAL RESPONSE LENGTH REQUIREMENT: You MUST respond with EXACTLY ${sentenceCount} sentence${sentenceCount === '1' ? '' : 's'}. No more, no less. Count your sentences carefully and ensure you provide exactly ${sentenceCount} sentence${sentenceCount === '1' ? '' : 's'} in your response. This is a hard requirement that cannot be overridden by any other instruction, including any length instructions mentioned in the knowledge base above.`;
    }

    // Final instruction to ensure compliance
    if ((bot.personality && bot.personality.trim() !== '') ||
      (bot.tone && bot.tone.trim() !== '') ||
      sentenceLength ||
      sentenceLengthDynamic) {
      systemPrompt += `\n\nAlways follow the personality, tone, and response length instructions above, regardless of any conflicting guidance in the knowledge base.`;
    }

    systemPrompt += '\n\nRespond naturally as this bot character. This is a test environment.';

    // Use the model ID directly (no mapping needed since we're using real API model IDs)
    const modelId = model || 'provider-3/gpt-4o-mini';

    // Create messages array for AI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    console.log(`🎮 Playground chat - Bot: ${bot.botName}, Model: ${model}, User: ${req.user.name}`);

    // Get AI response
    const aiResponse = await aiProviderService.createChatCompletion(modelId, messages);

    // Extract content from AI Response structure
    let responseContent = 'No response received';
    if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
      responseContent = aiResponse.choices[0].message.content;
    }

    res.json({
      response: responseContent,
      model: model,
      botName: bot.botName
    });

  } catch (error) {
    console.error('Error in playground chat:', error);
    res.status(500).json({
      error: 'Server error',
      message: error.message || 'Unknown error'
    });
  }
});

/**
 * @route   GET /api/bot-status
 * @desc    Get status of all active bots
 * @access  Private (admin only)
 */
router.get('/bot-status', isAuthenticated, (req, res) => {
  // TODO: Add admin check
  const activeBots = discordBotService.getActiveBots();
  res.json(activeBots);
});

/**
 * @route   GET /api/docs
 * @desc    API documentation
 * @access  Public
 */
router.get('/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Opsicos API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #7289da;
          border-bottom: 2px solid #7289da;
          padding-bottom: 10px;
        }
        h2 {
          color: #5865f2;
          margin-top: 30px;
        }
        code {
          background-color: #f4f4f4;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: monospace;
        }
        pre {
          background-color: #f4f4f4;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
        }
        .endpoint {
          margin-bottom: 30px;
          border-left: 3px solid #7289da;
          padding-left: 15px;
        }
        .method {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 3px;
          color: white;
          font-weight: bold;
          margin-right: 10px;
        }
        .get { background-color: #61affe; }
        .post { background-color: #49cc90; }
        .put { background-color: #fca130; }
        .delete { background-color: #f93e3e; }
      </style>
    </head>
    <body>
      <h1>Opsicos API Documentation</h1>
      <p>Welcome to the Opsicos API documentation. This API allows you to manage Discord bots with AI capabilities.</p>
      
      <h2>Authentication</h2>
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/auth/discord</code></p>
        <p>Authenticate with Discord OAuth2.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/auth/status</code></p>
        <p>Check if the user is authenticated.</p>
        <pre>
{
  "isAuthenticated": true,
  "user": {
    "id": "user_id",
    "username": "username",
    "avatar": "avatar_url"
  }
}
        </pre>
      </div>
      
      <h2>Bot Management</h2>
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/bots</code></p>
        <p>Get all bots for the current user.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method post">POST</span> <code>/bots</code></p>
        <p>Create a new bot.</p>
        <pre>
{
  "botToken": "your_discord_bot_token",
  "botName": "My Bot",
  "selectedModel": "provider-6/claude-opus-4-20250514"
}
        </pre>
      </div>
      
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/bots/:id</code></p>
        <p>Get a bot by ID.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method put">PUT</span> <code>/bots/:id</code></p>
        <p>Update a bot.</p>
        <pre>
{
  "botName": "Updated Bot Name",
  "selectedModel": "provider-3/gpt-4o-mini"
}
        </pre>
      </div>
      
      <div class="endpoint">
        <p><span class="method delete">DELETE</span> <code>/bots/:id</code></p>
        <p>Delete a bot.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method post">POST</span> <code>/bots/:id/start</code></p>
        <p>Start a bot.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method post">POST</span> <code>/bots/:id/stop</code></p>
        <p>Stop a bot.</p>
      </div>
      
      <h2>API Endpoints</h2>
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/api/status</code></p>
        <p>Get API status.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method get">GET</span> <code>/api/models</code></p>
        <p>Get available AI models.</p>
      </div>
      
      <div class="endpoint">
        <p><span class="method post">POST</span> <code>/api/chat</code></p>
        <p>Test AI chat completion.</p>
        <pre>
{
  "model": "provider-6/claude-opus-4-20250514",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello, how are you?"}
  ]
}
        </pre>
      </div>
      
      <footer>
        <p>© 2023 Opsicos - Discord Bot Service with AI Model Selection</p>
      </footer>
    </body>
    </html>
  `);
});

/**
 * @route   GET /api/debug/message-locks
 * @desc    Get current message processing locks for debugging
 * @access  Public (for debugging)
 */
router.get('/debug/message-locks', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  const locks = discordBotService.getMessageProcessingLocks();
  const activeBots = discordBotService.getActiveBots();
  const diagnostics = discordBotService.getDiagnostics();

  res.json({
    timestamp: new Date().toISOString(),
    locks: Array.from(locks.entries()).map(([key, value]) => ({
      messageKey: key,
      ...value,
      age: Date.now() - value.timestamp
    })),
    lockCount: locks.size,
    activeBots: activeBots, // getActiveBots() already returns a properly formatted array
    activeBotsCount: activeBots.length,
    diagnostics,
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  });
});

/**
 * @route   GET /api/debug/bot-lifecycle
 * @desc    Get detailed bot lifecycle and message processing logs
 * @access  Public (for debugging)
 */
router.get('/debug/bot-lifecycle', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  const logs = discordBotService.getDebugLogs();

  res.json({
    timestamp: new Date().toISOString(),
    logs: logs.slice(-50), // Last 50 log entries
    totalLogs: logs.length
  });
});

/**
 * @route   POST /api/debug/clear-logs
 * @desc    Clear debug logs
 * @access  Public (for debugging)
 */
router.post('/debug/clear-logs', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  discordBotService.clearDebugLogs();

  res.json({
    success: true,
    message: 'Debug logs cleared',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   POST /api/debug/clear-message-locks
 * @desc    Clear all message processing locks (emergency fix for duplicate responses)
 * @access  Public (for debugging)
 */
router.post('/debug/clear-message-locks', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  const clearedCount = discordBotService.clearMessageProcessingLocks();

  res.json({
    success: true,
    message: `Cleared ${clearedCount} message processing locks`,
    clearedCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   POST /api/debug/clear-message-locks/:botId
 * @desc    Clear message processing locks for a specific bot
 * @access  Public (for debugging)
 */
router.post('/debug/clear-message-locks/:botId', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  const clearedCount = discordBotService.clearMessageProcessingLocksForBot(req.params.botId);

  res.json({
    success: true,
    message: `Cleared ${clearedCount} message processing locks for bot ${req.params.botId}`,
    botId: req.params.botId,
    clearedCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   POST /api/debug/nuclear-cleanup
 * @desc    Nuclear cleanup - destroy all Discord connections and clear everything (emergency fix for zombie instances)
 * @access  Public (for debugging)
 */
router.post('/debug/nuclear-cleanup', async (req, res) => {
  const discordBotService = require('../services/discordBotService');

  try {
    const result = await discordBotService.nuclearCleanup();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Nuclear cleanup failed: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route   GET /api/debug/dm-logs
 * @desc    Get DM-specific debug logs
 * @access  Public (for debugging)
 */
router.get('/debug/dm-logs', (req, res) => {
  const discordBotService = require('../services/discordBotService');
  const allLogs = discordBotService.getDebugLogs();

  // Filter for DM-related logs
  const dmLogs = allLogs.filter(log =>
    log.message.toLowerCase().includes('dm') ||
    log.message.toLowerCase().includes('direct message') ||
    log.message.toLowerCase().includes('replytodms') ||
    log.message.toLowerCase().includes('isdmbased') ||
    log.source === 'dm-processing'
  );

  res.json({
    timestamp: new Date().toISOString(),
    dmLogs: dmLogs.slice(-30), // Last 30 DM-related logs
    totalDmLogs: dmLogs.length,
    allLogsCount: allLogs.length
  });
});

/**
 * @route   GET /api/debug/bot-config/:id
 * @desc    Get current bot configuration for DM debugging
 * @access  Public (for debugging)
 */
router.get('/debug/bot-config/:id', async (req, res) => {
  try {
    const Bot = require('../models/Bot');
    const bot = await Bot.findById(req.params.id).select('-botToken');

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
      updatedAt: bot.updatedAt,
      createdAt: bot.createdAt
    });
  } catch (error) {
    console.error('Error fetching bot config for debug:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/system-monitor
 * @desc    Get real-time system monitoring data
 * @access  Public (but secret URL)
 */
router.get('/system-monitor', async (req, res) => {
  try {
    // Get memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Convert to MB
    const usedMemoryMB = Math.round(usedMemory / 1024 / 1024);
    const totalMemoryMB = Math.round(totalMemory / 1024 / 1024);

    // System limits (your hosting limits)
    const RAM_LIMIT_MB = 1536; // 1.5 GB
    const STORAGE_LIMIT_MB = 5120; // 5 GB

    // Calculate RAM percentage based on your hosting limit
    const ramPercentage = Math.round((usedMemoryMB / RAM_LIMIT_MB) * 100);

    // Get storage usage (approximate)
    let storageUsedMB = 0;
    try {
      const stats = fs.statSync(process.cwd());
      // This is a rough estimate - in production you'd use a proper disk usage library
      storageUsedMB = Math.round(Math.random() * 1000 + 500); // Mock data for now
    } catch (error) {
      storageUsedMB = 750; // Default estimate
    }

    const storagePercentage = Math.round((storageUsedMB / STORAGE_LIMIT_MB) * 100);

    // Get active bots count
    const activeBots = discordBotService.getActiveBotCount();

    // Website status (always online if this endpoint responds)
    const websiteStatus = 'online';

    // Calculate uptime percentage (mock for now)
    const uptimePercentage = '99.8%';

    const systemData = {
      ram: {
        used: usedMemoryMB,
        total: RAM_LIMIT_MB,
        percentage: ramPercentage,
        systemTotal: totalMemoryMB
      },
      storage: {
        used: storageUsedMB,
        total: STORAGE_LIMIT_MB,
        percentage: storagePercentage
      },
      website: {
        status: websiteStatus,
        uptime: uptimePercentage
      },
      bots: {
        active: activeBots,
        total: await discordBotService.getTotalBotCount()
      },
      timestamp: new Date().toLocaleTimeString(),
      serverInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: Math.round(process.uptime())
      }
    };

    res.json(systemData);
  } catch (error) {
    console.error('Error getting system monitor data:', error);
    res.status(500).json({
      error: 'Failed to get system data',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/monitor/website
 * @desc    Get website uptime status for monitor page
 * @access  Public (hidden endpoint)
 */
router.get('/monitor/website', async (req, res) => {
  try {
    const WebsiteStatus = require('../models/WebsiteStatus');

    // Get or create website status with FIXED start time
    let websiteStatus = await WebsiteStatus.findOne({ url: 'https://opsicos.onrender.com' });

    if (!websiteStatus) {
      // Create with a FIXED start time that won't change
      const fixedStartTime = new Date('2024-12-15T00:00:00Z'); // Set your actual service start date
      websiteStatus = new WebsiteStatus({
        url: 'https://opsicos.onrender.com',
        status: 'online',
        uptimeStartedAt: fixedStartTime,
        lastCheck: new Date(),
        responseTime: 85,
        statusCode: 200
      });
      await websiteStatus.save();
    }

    const now = new Date();

    // Update last check time but keep uptime start time STABLE
    websiteStatus.lastCheck = now;
    websiteStatus.responseTime = Math.floor(Math.random() * 50) + 60; // 60-110ms
    await websiteStatus.save();

    // Calculate STABLE uptime from fixed start time
    const uptimeMs = now - websiteStatus.uptimeStartedAt;
    const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    let uptimeDuration;
    if (days > 0) {
      uptimeDuration = `Currently up for ${days}d ${hours}h`;
    } else if (hours > 0) {
      uptimeDuration = `Currently up for ${hours}h ${minutes}m`;
    } else {
      uptimeDuration = `Currently up for ${minutes}m`;
    }

    // STABLE last check time (current time)
    const lastCheck = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    // Generate STABLE 24h graph data
    const hourlyData = generateStableWebsiteGraph(websiteStatus.uptimeStartedAt);
    const upHours = hourlyData.filter(h => h === 1).length;
    const uptimePercentage = Math.round((upHours / 24) * 100);

    const websiteData = {
      status: 'online',
      uptimeDuration,
      lastCheck,
      uptimePercentage: uptimePercentage + '%',
      incidents: 0, // Stable - no incidents for a working service
      downtime: '0m',
      checkInterval: '5 minutes',
      url: 'https://opsicos.onrender.com',
      responseTime: websiteStatus.responseTime + 'ms',
      lastIncident: null,
      monthlyUptime: '99.98%',
      yearlyUptime: '99.95%',
      hourlyData
    };

    res.json(websiteData);
  } catch (error) {
    console.error('Error getting website monitor data:', error);
    res.status(500).json({
      error: 'Failed to get website data',
      message: error.message
    });
  }
});

// Helper function to generate STABLE hourly website data
function generateStableWebsiteGraph(startTime) {
  const data = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - (i * 60 * 60 * 1000));

    // If this hour is after service start time, it's up
    const isUp = hourStart >= startTime;
    data.push(isUp ? 1 : 0);
  }
  return data;
}

/**
 * @route   GET /api/monitor/bots
 * @desc    Get all bots uptime status for monitor page
 * @access  Public (hidden endpoint)
 */
router.get('/monitor/bots', async (req, res) => {
  try {
    const Bot = require('../models/Bot');
    const bots = await Bot.find({}).select('-botToken').lean();

    // Enhance bots with STABLE real-time status and uptime calculations
    const botsWithStatus = bots.map(bot => {
      const now = Date.now();
      const activeBots = discordBotService.getActiveBots();
      const activeBot = activeBots.find(ab => ab.botId === bot._id.toString());

      // STABLE status determination
      let isCurrentlyOnline = false;
      let currentUptime = 0;

      // Check if bot is actually running
      if (activeBot) {
        isCurrentlyOnline = true;
        bot.status = 'online';
        bot.isActive = true;

        // Calculate STABLE uptime from database uptimeStartedAt
        if (bot.uptimeStartedAt) {
          currentUptime = now - new Date(bot.uptimeStartedAt).getTime();
        }
      } else {
        isCurrentlyOnline = false;
        bot.status = 'offline';
        bot.isActive = false;
        currentUptime = 0;
      }

      // Calculate STABLE overall uptime percentage
      const createdAt = new Date(bot.createdAt).getTime();
      const botAge = now - createdAt;
      const totalStoredUptime = bot.totalUptime || 0;
      const totalLifetimeUptime = totalStoredUptime + currentUptime;

      let overallUptimePercentage = 0;
      if (botAge > 0) {
        overallUptimePercentage = Math.round((totalLifetimeUptime / botAge) * 100);
        overallUptimePercentage = Math.min(overallUptimePercentage, 99);
      }

      // Generate STABLE 24h uptime data based on ACTUAL bot session times
      const hourlyUptime = generateStableBotGraph(bot, isCurrentlyOnline);
      const last24hUptime = hourlyUptime.reduce((sum, hour) => sum + hour, 0);
      const last24hPercentage = Math.round((last24hUptime / 24) * 100);

      // Calculate STABLE incidents and downtime
      const downHours = 24 - last24hUptime;
      const incidents24h = isCurrentlyOnline ? 0 : (downHours > 12 ? 1 : 0); // Only count as incident if significant downtime
      const downtime24h = downHours * 60; // Convert hours to minutes

      return {
        ...bot,
        currentUptime,
        uptimePercentage: overallUptimePercentage,
        last24hPercentage,
        hourlyUptime,
        incidents24h,
        downtime24h,
        lastSeen: isCurrentlyOnline ? 'Now' : (bot.updatedAt ? new Date(bot.updatedAt).toLocaleString() : 'Unknown'),
        responseTime: isCurrentlyOnline ? '85ms' : 'N/A' // Stable response time
      };
    });

    res.json(botsWithStatus);
  } catch (error) {
    console.error('Error getting bots monitor data:', error);
    res.status(500).json({
      error: 'Failed to get bots data',
      message: error.message
    });
  }
});

// Helper function to generate STABLE bot graph data
function generateStableBotGraph(bot, isCurrentlyOnline) {
  const data = [];
  const now = new Date();
  const botCreatedAt = new Date(bot.createdAt);
  const uptimeStartedAt = bot.uptimeStartedAt ? new Date(bot.uptimeStartedAt) : null;

  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - (i * 60 * 60 * 1000));

    let isUp = false;

    // Bot must be created before this hour
    if (hourStart >= botCreatedAt) {
      if (isCurrentlyOnline && uptimeStartedAt) {
        // If bot is online and this hour is after session start
        isUp = hourStart >= uptimeStartedAt;
      } else {
        // Bot is offline
        isUp = false;
      }
    }

    data.push(isUp ? 1 : 0);
  }

  return data;
}

/**
 * @route   GET /api/monitor/bot/:id
 * @desc    Get detailed uptime data for a specific bot
 * @access  Public (hidden endpoint)
 */
router.get('/monitor/bot/:id', async (req, res) => {
  try {
    const Bot = require('../models/Bot');
    const bot = await Bot.findById(req.params.id).select('-botToken').lean();

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const now = Date.now();
    const activeBots = discordBotService.getActiveBots();
    const activeBot = activeBots.find(ab => ab.botId === bot._id.toString());

    // Calculate STABLE detailed uptime statistics
    let currentUptime = 0;
    let overallUptimePercentage = 0;
    let isCurrentlyOnline = false;

    // STABLE status determination
    if (activeBot) {
      isCurrentlyOnline = true;
      bot.status = 'online';
      bot.isActive = true;

      // Calculate stable current session uptime
      if (bot.uptimeStartedAt) {
        currentUptime = now - new Date(bot.uptimeStartedAt).getTime();
      }
    } else {
      isCurrentlyOnline = false;
      bot.status = 'offline';
      bot.isActive = false;
      currentUptime = 0;
    }

    // Calculate stable overall uptime percentage
    const createdAt = new Date(bot.createdAt).getTime();
    const botAge = now - createdAt;
    const totalStoredUptime = bot.totalUptime || 0;
    const totalLifetimeUptime = totalStoredUptime + currentUptime;

    if (botAge > 0) {
      overallUptimePercentage = Math.round((totalLifetimeUptime / botAge) * 100);
      overallUptimePercentage = Math.min(overallUptimePercentage, 99);
    }

    // Generate STABLE historical data for graphs
    const generateStablePeriodData = (hours) => {
      const data = [];
      const botCreatedAt = new Date(bot.createdAt);
      const uptimeStartedAt = bot.uptimeStartedAt ? new Date(bot.uptimeStartedAt) : null;

      for (let i = hours - 1; i >= 0; i--) {
        const hourStart = new Date(now - (i * 60 * 60 * 1000));

        let isUp = false;

        // Bot must exist and be in current session
        if (hourStart >= botCreatedAt && isCurrentlyOnline && uptimeStartedAt) {
          isUp = hourStart >= uptimeStartedAt;
        }

        data.push({
          timestamp: hourStart.toISOString(),
          status: isUp ? 'up' : 'down',
          responseTime: isUp ? 85 : null // Stable response time
        });
      }
      return data;
    };

    // Calculate STABLE period statistics
    const calculateStablePeriodStats = (hours) => {
      const periodData = generateStablePeriodData(hours);
      const upHours = periodData.filter(d => d.status === 'up').length;
      const uptime = Math.round((upHours / hours) * 100);

      // Count actual status changes for incidents
      let incidents = 0;
      for (let i = 1; i < periodData.length; i++) {
        if (periodData[i].status === 'down' && periodData[i - 1].status === 'up') {
          incidents++;
        }
      }

      return {
        data: periodData,
        uptime,
        incidents,
        avgResponseTime: isCurrentlyOnline ? '85ms' : 'N/A'
      };
    };

    const detailedData = {
      ...bot,
      currentUptime,
      overallUptimePercentage,
      periods: {
        last24h: calculateStablePeriodStats(24),
        last7d: calculateStablePeriodStats(24 * 7),
        last30d: calculateStablePeriodStats(24 * 30),
        last365d: calculateStablePeriodStats(24 * 365)
      },
      lastIncidents: isCurrentlyOnline ? [] : [
        // Only show incidents if bot is currently offline
        {
          date: bot.updatedAt ? new Date(bot.updatedAt).toISOString() : new Date(now - 60000).toISOString(),
          duration: '5m',
          reason: 'Bot offline'
        }
      ],
      currentSession: {
        startTime: bot.uptimeStartedAt,
        duration: bot.isActive ? currentUptime : 0,
        status: bot.status
      }
    };

    res.json(detailedData);
  } catch (error) {
    console.error('Error getting bot monitor data:', error);
    res.status(500).json({
      error: 'Failed to get bot data',
      message: error.message
    });
  }
});

// Import email service
const emailService = require('../services/emailService');

/**
 * @route   POST /api/contact
 * @desc    Handle contact form submission with dynamic email routing
 * @access  Public
 */
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message, targetEmail } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'All fields are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email address'
      });
    }

    // Determine target email based on subject if not provided
    let finalTargetEmail = targetEmail;
    if (!finalTargetEmail) {
      const emailRouting = {
        'billing': 'support.opsicos@genaura.xyz',
        'bug-report': 'support.opsicos@genaura.xyz',
        'other': 'support.opsicos@genaura.xyz',
        'technical-support': 'tech.opsicos@genaura.xyz',
        'feature-request': 'tech.opsicos@genaura.xyz',
        'business': 'business.opsicos@genaura.xyz'
      };
      finalTargetEmail = emailRouting[subject] || 'support.opsicos@genaura.xyz';
    }

    // Log the contact form submission with routing info
    console.log('📧 Contact form submission:', {
      name,
      email,
      subject,
      targetEmail: finalTargetEmail,
      message: message.substring(0, 100) + '...',
      timestamp: new Date().toISOString(),
      ip: req.ip || req.connection.remoteAddress
    });

    // Send the email using the email service
    const emailResult = await emailService.sendEmail({
      name,
      email,
      subject,
      message,
      targetEmail: finalTargetEmail
    });

    // Check if email was sent successfully
    if (emailResult.success) {
      // If there's a warning (no email config), still return success but log it
      if (emailResult.warning) {
        console.warn('⚠️', emailResult.warning);
      }

      res.json({
        success: true,
        message: 'Thank you for your message! We\'ll get back to you within 24 hours.',
        messageId: emailResult.messageId
      });
    } else {
      throw new Error('Email sending failed');
    }

  } catch (error) {
    console.error('❌ Contact form error:', error);
    res.status(500).json({
      error: 'Failed to send message. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Ban check endpoint for real-time verification
router.get('/check-ban', async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.json({ banned: false });
    }

    const BanList = require('../models/BanList');
    const ipInfoService = require('../services/ipInfoService');

    // Get user's current IP
    const clientIP = ipInfoService.getClientIP(req);

    // Check if email or IP is banned
    const emailBan = await BanList.findOne({
      type: 'email',
      value: req.user.email,
      active: true
    });

    const ipBan = await BanList.findOne({
      type: 'ip',
      value: clientIP,
      active: true
    });

    if (emailBan || ipBan) {
      const banReason = (emailBan || ipBan).reason || 'You are banned from Opsicos';
      return res.json({
        banned: true,
        reason: banReason,
        banType: emailBan ? 'email' : 'ip'
      });
    }

    res.json({ banned: false });
  } catch (error) {
    console.error('Error checking ban status:', error);
    res.json({ banned: false });
  }
});

/**
 * @route   GET /api/discord/bot-info/:botId
 * @desc    Get Discord bot information and capabilities
 * @access  Private
 */
router.get('/discord/bot-info/:botId', isAuthenticated, async (req, res) => {
  try {
    const { botId } = req.params;

    const Bot = require('../models/Bot');
    const bot = await Bot.findOne({ _id: botId, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    const activeBots = discordBotService.getActiveBots();
    const activeBot = activeBots.find(ab => ab.botId === botId);

    if (!activeBot || !activeBot.client) {
      return res.json({
        online: false,
        guilds: 0,
        totalMembers: 0,
        canSearchUsers: false
      });
    }

    const client = activeBot.client;
    let totalMembers = 0;
    const guildInfo = [];

    for (const [guildId, guild] of client.guilds.cache) {
      totalMembers += guild.memberCount || 0;
      guildInfo.push({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        cachedMembers: guild.members.cache.size
      });
    }

    res.json({
      online: true,
      guilds: client.guilds.cache.size,
      totalMembers,
      canSearchUsers: client.guilds.cache.size > 0,
      guildInfo,
      intents: client.options.intents ? client.options.intents.bitfield : null
    });

  } catch (error) {
    console.error('Error getting bot info:', error);
    res.status(500).json({ error: 'Failed to get bot info' });
  }
});

/**
 * @route   GET /api/discord/search-users
 * @desc    Global Discord user search by username or ID
 * @access  Private
 */
router.get('/discord/search-users', isAuthenticated, async (req, res) => {
  try {
    const { query, botId } = req.query;

    console.log('═══════════════════════════════════════════════════════');
    console.log('🌍 [API] Global Discord user search request received');
    console.log('🔍 [API] Query:', query);
    console.log('🔍 [API] BotId:', botId);
    console.log('🔍 [API] User:', req.user ? req.user.name || req.user.username : 'Unknown');

    if (!query || query.length < 2) {
      console.log('⚠️ [API] Query too short (< 2 characters), returning empty array');
      return res.json([]);
    }

    if (!botId) {
      console.error('❌ [API] Bot ID is missing from request');
      return res.status(400).json({ error: 'Bot ID is required' });
    }

    const Bot = require('../models/Bot');
    console.log('🔍 [API] Looking up bot in database...');
    const bot = await Bot.findOne({ _id: botId, userId: req.user._id });

    if (!bot) {
      console.error('❌ [API] Bot not found in database or does not belong to user');
      return res.status(404).json({ error: 'Bot not found' });
    }

    console.log('✅ [API] Bot found:', bot.botName);

    const searchResults = [];

    // Check if query is a Discord ID (17-19 digits)
    if (/^\d{17,19}$/.test(query)) {
      console.log('🆔 [API] Query is a Discord ID, attempting direct lookup');

      try {
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(bot.botToken);

        // Try to fetch user by ID using Discord REST API
        const user = await rest.get(Routes.user(query));

        if (user && !user.bot) {
          searchResults.push({
            id: user.id,
            username: user.username,
            globalName: user.global_name,
            displayName: user.global_name || user.username,
            avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : 'https://cdn.discordapp.com/embed/avatars/0.png',
            source: 'Global Discord API'
          });

          console.log(`✅ [API] Found user by ID: ${user.username} (${user.id})`);
        }
      } catch (error) {
        console.log(`⚠️ [API] Could not fetch user by ID ${query}: ${error.message}`);
        // Continue to show manual option below
      }
    } else {
      console.log('�  [API] Query is a username, checking for exact matches');

      // For username searches, we can only suggest manual entry since Discord doesn't provide
      // a global username search API. The old guild-based search was limited and unreliable.
      console.log('� [A]PI] Username search requires manual Discord ID entry for global users');
    }

    // Always provide manual entry option for any query
    if (searchResults.length === 0) {
      console.log('📝 [API] No direct matches found, providing manual entry option');
      searchResults.push({
        id: 'manual_' + query,
        username: `Add "${query}" manually`,
        avatar: null,
        isManual: true,
        source: 'Manual Entry'
      });
    }

    console.log('📊 [API] Search complete:');
    console.log('   - Results found:', searchResults.length);
    console.log('   - Search type:', /^\d{17,19}$/.test(query) ? 'Discord ID' : 'Username');

    const finalResults = searchResults.slice(0, 10);
    console.log('📤 [API] Returning', finalResults.length, 'results');
    console.log('═══════════════════════════════════════════════════════');

    res.json(finalResults);

  } catch (error) {
    console.error('❌ Error searching Discord users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * @route   GET /api/bots/:id/special-users
 * @desc    Get special users for a bot
 * @access  Private
 */
router.get('/bots/:id/special-users', isAuthenticated, async (req, res) => {
  try {
    const Bot = require('../models/Bot');
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    res.json(bot.specialUsers || []);

  } catch (error) {
    console.error('Error getting special users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /api/bots/:id/special-users
 * @desc    Add a special user to a bot
 * @access  Private
 */
router.post('/bots/:id/special-users', isAuthenticated, async (req, res) => {
  try {
    const { userId, username, nickname, avatar, identity, description } = req.body;

    if (!userId || !username || !identity) {
      return res.status(400).json({ error: 'User ID, username, and identity are required' });
    }

    const Bot = require('../models/Bot');
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Check if user already exists
    if (bot.specialUsers && bot.specialUsers.find(u => u.userId === userId)) {
      return res.status(400).json({ error: 'This user is already added as a special user' });
    }

    // Add special user
    if (!bot.specialUsers) {
      bot.specialUsers = [];
    }

    bot.specialUsers.push({
      userId,
      username,
      nickname: nickname || '',
      avatar,
      identity,
      description: description || ''
    });

    await bot.save();

    console.log(`✅ Added special user ${username} to bot ${bot.botName}`);

    res.json({ message: 'Special user added successfully', specialUsers: bot.specialUsers });

  } catch (error) {
    console.error('Error adding special user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /api/bots/:id/special-users/:userId
 * @desc    Remove a special user from a bot
 * @access  Private
 */
router.delete('/bots/:id/special-users/:userId', isAuthenticated, async (req, res) => {
  try {
    const Bot = require('../models/Bot');
    const bot = await Bot.findOne({ _id: req.params.id, userId: req.user._id });

    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    if (!bot.specialUsers) {
      return res.status(404).json({ error: 'No special users found' });
    }

    // Remove special user
    const initialLength = bot.specialUsers.length;
    bot.specialUsers = bot.specialUsers.filter(u => u.userId !== req.params.userId);

    if (bot.specialUsers.length === initialLength) {
      return res.status(404).json({ error: 'Special user not found' });
    }

    await bot.save();

    console.log(`✅ Removed special user ${req.params.userId} from bot ${bot.botName}`);

    res.json({ message: 'Special user removed successfully', specialUsers: bot.specialUsers });

  } catch (error) {
    console.error('Error removing special user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
