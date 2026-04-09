const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Bot = require('../../../src/models/Bot');
const User = require('../../../src/models/User');
const Knowledge = require('../../../src/models/Knowledge');

// Generate or use existing API key
const API_KEY = process.env.MOBILE_API_KEY || 'osk_personal_' + crypto.randomBytes(32).toString('hex');

// Store API usage stats
let apiStats = {
    totalCalls: 0,
    dailyCalls: 0,
    lastReset: new Date().toDateString(),
    downloads: 0,
    activeUsers: new Set()
};

// Middleware for API authentication
const authenticateAPI = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false,
            error: 'Missing or invalid authorization header' 
        });
    }
    
    const apiKey = authHeader.split(' ')[1];
    
    if (apiKey !== API_KEY) {
        return res.status(401).json({ 
            success: false,
            error: 'Invalid API key' 
        });
    }
    
    // Track API usage
    apiStats.totalCalls++;
    apiStats.dailyCalls++;
    
    // Reset daily counter if needed
    const today = new Date().toDateString();
    if (apiStats.lastReset !== today) {
        apiStats.dailyCalls = 1;
        apiStats.lastReset = today;
        apiStats.activeUsers.clear();
    }
    
    // Track active user
    const userId = req.headers['x-user-id'] || 'anonymous';
    apiStats.activeUsers.add(userId);
    
    req.userId = process.env.ADMIN_USER_ID || 'admin';
    next();
};

// Bot management endpoints
router.get('/bots', authenticateAPI, async (req, res) => {
    try {
        const bots = await Bot.find({ userId: req.userId });
        
        const botsWithStatus = bots.map(bot => ({
            id: bot._id,
            name: bot.name,
            token: bot.token ? '***' + bot.token.slice(-4) : null,
            status: bot.status || 'offline',
            commandPrefix: bot.commandPrefix,
            model: bot.model,
            personality: bot.personality,
            createdAt: bot.createdAt,
            stats: {
                messagesProcessed: bot.messagesProcessed || 0,
                commandsExecuted: bot.commandsExecuted || 0,
                uptime: bot.uptime || 0
            }
        }));
        
        res.json({
            success: true,
            data: botsWithStatus
        });
    } catch (error) {
        console.error('Mobile API - Error fetching bots:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch bots' 
        });
    }
});

router.post('/bots', authenticateAPI, async (req, res) => {
    try {
        const { name, token, commandPrefix, model, personality } = req.body;
        
        if (!name || !token) {
            return res.status(400).json({ 
                success: false,
                error: 'Bot name and token are required' 
            });
        }
        
        const bot = new Bot({
            userId: req.userId,
            name,
            token,
            commandPrefix: commandPrefix || '!',
            model: model || 'gpt-3.5-turbo',
            personality: personality || 'helpful',
            status: 'offline',
            createdAt: new Date()
        });
        
        await bot.save();
        
        res.status(201).json({
            success: true,
            data: {
                id: bot._id,
                name: bot.name,
                status: bot.status
            }
        });
    } catch (error) {
        console.error('Mobile API - Error creating bot:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create bot' 
        });
    }
});

router.put('/bots/:botId', authenticateAPI, async (req, res) => {
    try {
        const { botId } = req.params;
        const updates = req.body;
        
        const bot = await Bot.findOneAndUpdate(
            { _id: botId, userId: req.userId },
            { $set: updates },
            { new: true }
        );
        
        if (!bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }
        
        res.json({
            success: true,
            data: bot
        });
    } catch (error) {
        console.error('Mobile API - Error updating bot:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to update bot' 
        });
    }
});

router.delete('/bots/:botId', authenticateAPI, async (req, res) => {
    try {
        const { botId } = req.params;
        
        const bot = await Bot.findOneAndDelete({ 
            _id: botId, 
            userId: req.userId 
        });
        
        if (!bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }
        
        res.json({
            success: true,
            message: 'Bot deleted successfully'
        });
    } catch (error) {
        console.error('Mobile API - Error deleting bot:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to delete bot' 
        });
    }
});

// Bot control endpoints
router.post('/bots/:botId/start', authenticateAPI, async (req, res) => {
    try {
        const { botId } = req.params;
        
        const bot = await Bot.findOne({ _id: botId, userId: req.userId });
        
        if (!bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }
        
        // Trigger bot start (this would integrate with your existing bot manager)
        bot.status = 'online';
        await bot.save();
        
        res.json({
            success: true,
            message: 'Bot started successfully',
            status: 'online'
        });
    } catch (error) {
        console.error('Mobile API - Error starting bot:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to start bot' 
        });
    }
});

router.post('/bots/:botId/stop', authenticateAPI, async (req, res) => {
    try {
        const { botId } = req.params;
        
        const bot = await Bot.findOne({ _id: botId, userId: req.userId });
        
        if (!bot) {
            return res.status(404).json({ 
                success: false,
                error: 'Bot not found' 
            });
        }
        
        // Trigger bot stop
        bot.status = 'offline';
        await bot.save();
        
        res.json({
            success: true,
            message: 'Bot stopped successfully',
            status: 'offline'
        });
    } catch (error) {
        console.error('Mobile API - Error stopping bot:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to stop bot' 
        });
    }
});

// Chat/Playground endpoints
router.post('/chat', authenticateAPI, async (req, res) => {
    try {
        const { message, model = 'gpt-3.5-turbo', context = [] } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                success: false,
                error: 'Message is required' 
            });
        }
        
        // This would integrate with your existing AI model handlers
        // For now, returning a mock response
        const response = {
            success: true,
            data: {
                message: message,
                response: `This is a response from ${model} model`,
                model: model,
                timestamp: new Date().toISOString()
            }
        };
        
        res.json(response);
    } catch (error) {
        console.error('Mobile API - Error in chat:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to process chat message' 
        });
    }
});

// Models endpoint
router.get('/models', authenticateAPI, async (req, res) => {
    try {
        // List of all available models
        const models = [
            { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', category: 'Advanced' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', category: 'Standard' },
            { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', category: 'Advanced' },
            { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', category: 'Standard' },
            { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', category: 'Standard' },
            { id: 'llama-3-70b', name: 'Llama 3 70B', provider: 'Meta', category: 'Open Source' },
            { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral', category: 'Open Source' },
            // Add all 35+ models here
        ];
        
        res.json({
            success: true,
            data: models
        });
    } catch (error) {
        console.error('Mobile API - Error fetching models:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch models' 
        });
    }
});

// Knowledge base endpoints
router.get('/knowledge', authenticateAPI, async (req, res) => {
    try {
        const knowledgeBases = await Knowledge.find({ userId: req.userId });
        
        res.json({
            success: true,
            data: knowledgeBases
        });
    } catch (error) {
        console.error('Mobile API - Error fetching knowledge bases:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch knowledge bases' 
        });
    }
});

// Analytics endpoints
router.get('/analytics', authenticateAPI, async (req, res) => {
    try {
        const bots = await Bot.find({ userId: req.userId });
        
        const analytics = {
            totalBots: bots.length,
            activeBots: bots.filter(b => b.status === 'online').length,
            totalMessages: bots.reduce((sum, bot) => sum + (bot.messagesProcessed || 0), 0),
            totalCommands: bots.reduce((sum, bot) => sum + (bot.commandsExecuted || 0), 0),
            apiUsage: {
                today: apiStats.dailyCalls,
                total: apiStats.totalCalls
            }
        };
        
        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Mobile API - Error fetching analytics:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch analytics' 
        });
    }
});

// App version check
router.get('/version', (req, res) => {
    res.json({
        success: true,
        data: {
            currentVersion: '1.0.0',
            minVersion: '1.0.0',
            updateUrl: '/android-app/downloads/opsicos-latest.apk',
            releaseNotes: 'Initial release with full bot management capabilities'
        }
    });
});

// Track downloads
router.post('/track-download', async (req, res) => {
    apiStats.downloads++;
    
    res.json({
        success: true,
        message: 'Download tracked'
    });
});

// Admin stats endpoint (for admin panel)
router.get('/admin/stats', authenticateAPI, async (req, res) => {
    try {
        res.json({
            totalDownloads: apiStats.downloads,
            activeUsers: apiStats.activeUsers.size,
            currentVersion: '1.0.0',
            apiCalls: apiStats.dailyCalls
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch stats' 
        });
    }
});

// API key info endpoint
router.get('/api-key', authenticateAPI, (req, res) => {
    res.json({
        success: true,
        data: {
            key: API_KEY,
            createdAt: new Date().toISOString(),
            usage: {
                today: apiStats.dailyCalls,
                total: apiStats.totalCalls
            }
        }
    });
});

module.exports = router;
