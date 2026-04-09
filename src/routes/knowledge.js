const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Knowledge = require('../models/Knowledge');
const Bot = require('../models/Bot');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

// Middleware to check if user owns the bot
const checkBotOwnership = async (req, res, next) => {
  try {
    const botId = req.params.botId || req.body.botId;

    console.log('🔍 Checking bot ownership:', { botId, userId: req.user._id });

    // Ensure botId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(botId)) {
      console.log('❌ Invalid bot ID in ownership check:', botId);
      return res.status(400).json({ error: 'Invalid bot ID format' });
    }

    const bot = await Bot.findOne({ _id: new mongoose.Types.ObjectId(botId), userId: req.user._id });

    if (!bot) {
      console.log('❌ Bot not found or access denied:', { botId, userId: req.user._id });
      return res.status(403).json({ error: 'Bot not found or access denied' });
    }

    console.log('✅ Bot ownership verified:', bot.botName);
    req.bot = bot;
    next();
  } catch (error) {
    console.error('Error checking bot ownership:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * @route   GET /knowledge/:botId
 * @desc    Get all knowledge entries for a specific bot
 * @access  Private
 */
router.get('/:botId', isAuthenticated, checkBotOwnership, async (req, res) => {
  try {
    const { botId } = req.params;
    const { page = 1, limit = 10, search = '', isActive = true } = req.query;



    console.log('🔍 Fetching knowledge for:', {
      botId,
      userId: req.user._id,
      page,
      limit,
      search,
      isActive
    });

    // Ensure botId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(botId)) {
      console.log('❌ Invalid bot ID format:', botId);
      return res.status(400).json({ error: 'Invalid bot ID format' });
    }

    // Convert isActive to boolean properly
    const isActiveBoolean = isActive === 'true' || isActive === true || isActive === 'True' || isActive === 1;

    const query = {
      botId: new mongoose.Types.ObjectId(botId),
      userId: req.user._id,
      isActive: isActiveBoolean
    };

    console.log('🔍 Database query:', query);
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [knowledge, total] = await Promise.all([
      Knowledge.find(query)
        .sort({ priority: -1, updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Knowledge.countDocuments(query)
    ]);

    console.log('📊 Query results:', {
      foundEntries: knowledge.length,
      totalCount: total,
      sampleEntry: knowledge[0] ? {
        id: knowledge[0]._id,
        title: knowledge[0].title,
        botId: knowledge[0].botId,
        userId: knowledge[0].userId
      } : 'No entries found'
    });

    res.json({
      knowledge,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   POST /knowledge/:botId
 * @desc    Create new knowledge entry for a bot
 * @access  Private
 */
router.post('/:botId', isAuthenticated, checkBotOwnership, async (req, res) => {
  try {
    const { botId } = req.params;
    const { title, content, tags = [], priority = 0 } = req.body;

    console.log('🔍 Creating knowledge entry:', {
      botId,
      userId: req.user._id,
      title,
      contentLength: content?.length,
      tags,
      priority
    });

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (content.length > 10000) {
      return res.status(400).json({ error: 'Content exceeds maximum length of 10,000 characters' });
    }

    const knowledge = new Knowledge({
      botId: new mongoose.Types.ObjectId(botId),
      userId: req.user._id,
      title: title.trim(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags.map(tag => tag.trim()).filter(tag => tag) : [],
      priority: Math.max(0, Math.min(10, parseInt(priority) || 0))
    });

    const savedKnowledge = await knowledge.save();
    console.log('✅ Knowledge saved successfully:', savedKnowledge._id);

    // 🔥 NEW: Sync knowledge to bot profile for future restoration
    try {
      const Bot = require('../models/Bot');
      const BotProfile = require('../models/BotProfile');

      const bot = await Bot.findById(botId);
      if (bot) {
        // Get all knowledge entries for this bot
        const allKnowledge = await Knowledge.find({
          botId: new mongoose.Types.ObjectId(botId),
          isActive: true
        }).select('title content tags priority isActive createdAt');

        // Update or create bot profile with current knowledge
        await BotProfile.findOneAndUpdate(
          { userId: req.user._id, botName: bot.botName },
          {
            userId: req.user._id,
            botName: bot.botName,
            personality: bot.personality,
            tone: bot.tone,
            messageHistoryLimit: bot.messageHistoryLimit,
            replyToDMs: bot.replyToDMs,
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
        console.log(`💾 Synced knowledge to bot profile for "${bot.botName}"`);
      }
    } catch (error) {
      console.error('Error syncing knowledge to profile:', error);
      // Don't fail knowledge creation if profile sync fails
    }

    res.status(201).json({
      message: 'Knowledge entry created successfully',
      knowledge: savedKnowledge
    });
  } catch (error) {
    console.error('Error creating knowledge:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   PUT /knowledge/:botId/:knowledgeId
 * @desc    Update knowledge entry
 * @access  Private
 */
router.put('/:botId/:knowledgeId', isAuthenticated, checkBotOwnership, async (req, res) => {
  try {
    const { botId, knowledgeId } = req.params;
    const { title, content, tags, priority, isActive } = req.body;
    
    const knowledge = await Knowledge.findOne({
      _id: knowledgeId,
      botId: new mongoose.Types.ObjectId(botId),
      userId: req.user._id
    });
    
    if (!knowledge) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }
    
    if (title !== undefined) knowledge.title = title.trim();
    if (content !== undefined) {
      if (content.length > 10000) {
        return res.status(400).json({ error: 'Content exceeds maximum length of 10,000 characters' });
      }
      knowledge.content = content.trim();
    }
    if (tags !== undefined) {
      knowledge.tags = Array.isArray(tags) ? tags.map(tag => tag.trim()).filter(tag => tag) : [];
    }
    if (priority !== undefined) {
      knowledge.priority = Math.max(0, Math.min(10, parseInt(priority) || 0));
    }
    if (isActive !== undefined) knowledge.isActive = Boolean(isActive);
    
    await knowledge.save();
    
    res.json({
      message: 'Knowledge entry updated successfully',
      knowledge
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   DELETE /knowledge/:botId/:knowledgeId
 * @desc    Delete knowledge entry
 * @access  Private
 */
router.delete('/:botId/:knowledgeId', isAuthenticated, checkBotOwnership, async (req, res) => {
  try {
    const { botId, knowledgeId } = req.params;
    
    const knowledge = await Knowledge.findOneAndDelete({
      _id: knowledgeId,
      botId: new mongoose.Types.ObjectId(botId),
      userId: req.user._id
    });
    
    if (!knowledge) {
      return res.status(404).json({ error: 'Knowledge entry not found' });
    }
    
    res.json({ message: 'Knowledge entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /knowledge/:botId/summary
 * @desc    Get knowledge summary for a bot (for AI context)
 * @access  Private (Internal use)
 */
router.get('/:botId/summary', async (req, res) => {
  try {
    const { botId } = req.params;
    
    const knowledge = await Knowledge.find({
      botId: new mongoose.Types.ObjectId(botId),
      isActive: true
    })
    .sort({ priority: -1, updatedAt: -1 })
    .select('title content tags priority')
    .lean();
    
    // Format knowledge for AI context
    const formattedKnowledge = knowledge.map(k => ({
      title: k.title,
      content: k.content,
      tags: k.tags,
      priority: k.priority
    }));
    
    res.json({ knowledge: formattedKnowledge });
  } catch (error) {
    console.error('Error fetching knowledge summary:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
