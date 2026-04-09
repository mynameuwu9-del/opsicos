const express = require('express');
const path = require('path');
const router = express.Router();
const { isAuthenticated, isNotAuthenticated } = require('../middleware/auth');

/**
 * @route   GET /
 * @desc    Home page
 * @access  Public
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

/**
 * @route   GET /login
 * @desc    Login page
 * @access  Public (only for non-authenticated users)
 */
router.get('/login', isNotAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/login.html'));
});

/**
 * @route   GET /terms
 * @desc    Terms of Service page
 * @access  Public
 */
router.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/terms.html'));
});

/**
 * @route   GET /privacy
 * @desc    Privacy Policy page
 * @access  Public
 */
router.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/privacy.html'));
});

/**
 * @route   GET /aboutus
 * @desc    About Us page
 * @access  Public (only for non-authenticated users)
 */
router.get('/aboutus', isNotAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/aboutus.html'));
});

/**
 * @route   GET /contact
 * @desc    Contact Us page
 * @access  Public
 */
router.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/contact.html'));
});

/**
 * @route   GET /dashboard
 * @desc    Dashboard page
 * @access  Private
 */
router.get('/dashboard', isAuthenticated, (req, res) => {
  console.log('Dashboard accessed - Auth status:', req.isAuthenticated());
  if (req.user) {
    console.log('User:', req.user.name);
  }
  res.sendFile(path.join(__dirname, '../../public/dashboard.html'));
});


/**
 * @route   GET /edit-bot/:id
 * @desc    Edit Bot page
 * @access  Private
 */
router.get('/edit-bot/:id', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/edit-bot.html'));
});

/**
 * @route   GET /features
 * @desc    Features page
 * @access  Private
 */
router.get('/features', isAuthenticated, (req, res) => {
  console.log('=== FEATURES PAGE ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('✅ Features page served successfully');
  res.sendFile(path.join(__dirname, '../../public/features.html'));
});

/**
 * @route   GET /behavior
 * @desc    Bot Behavior page
 * @access  Private
 */
router.get('/behavior', isAuthenticated, (req, res) => {
  console.log('=== BEHAVIOR PAGE ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('✅ Behavior page served successfully');
  res.sendFile(path.join(__dirname, '../../public/behavior.html'));
});

/**
 * @route   GET /bot-smartness
 * @desc    Bot Smartness page
 * @access  Private
 */
router.get('/bot-smartness', isAuthenticated, (req, res) => {
  console.log('=== BOT SMARTNESS PAGE ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('✅ Bot Smartness page served successfully');
  res.sendFile(path.join(__dirname, '../../public/bot-smartness.html'));
});

/**
 * @route   GET /settings
 * @desc    Settings page
 * @access  Private
 */
router.get('/settings', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/settings.html'));
});

/**
 * @route   GET /knowledge
 * @desc    Knowledge Management page
 * @access  Private
 */
router.get('/knowledge', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/knowledge.html'));
});

/**
 * @route   GET /stored-knowledge
 * @desc    Stored Knowledge page
 * @access  Private
 */
router.get('/stored-knowledge', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/stored-knowledge.html'));
});

/**
 * @route   GET /uptime-status
 * @desc    Bot Uptime Status page
 * @access  Private
 */
router.get('/uptime-status', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/uptime-status.html'));
});

/**
 * @route   GET /playground
 * @desc    Playground page for testing bots
 * @access  Private
 */
router.get('/playground', isAuthenticated, (req, res) => {
  console.log('=== PLAYGROUND ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('✅ Playground page served successfully');
  res.sendFile(path.join(__dirname, '../../public/playground.html'));
});

/**
 * @route   GET /special-users
 * @desc    Special Users Management page
 * @access  Private
 */
router.get('/special-users', isAuthenticated, (req, res) => {
  console.log('=== SPECIAL USERS PAGE ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  console.log('✅ Special Users page served successfully');
  res.sendFile(path.join(__dirname, '../../public/special-users.html'));
});

/**
 * @route   GET /updates
 * @desc    Updates page
 * @access  Public
 */
router.get('/updates', (req, res) => {
  console.log('=== UPDATES PAGE ACCESS ===');
  console.log('IP:', req.ip);
  console.log('User Agent:', req.get('User-Agent'));
  res.sendFile(path.join(__dirname, '../../public/updates.html'));
});

/**
 * @route   GET /status
 * @desc    System Status page - API uptime and monitoring
 * @access  Public
 */
router.get('/status', (req, res) => {
  console.log('=== STATUS PAGE ACCESS ===');
  console.log('IP:', req.ip);
  console.log('User Agent:', req.get('User-Agent'));
  console.log('Timestamp:', new Date().toISOString());
  res.sendFile(path.join(__dirname, '../../public/status.html'));
});

/**
 * @route   GET /debug-dashboard
 * @desc    Debug Dashboard page
 * @access  Public (for debugging)
 */
router.get('/debug-dashboard', (req, res) => {
  console.log('=== DEBUG DASHBOARD ACCESS ===');
  console.log('Session ID:', req.sessionID);
  console.log('Is Authenticated:', req.isAuthenticated());
  console.log('User:', req.user ? req.user.name : 'No user');
  res.sendFile(path.join(__dirname, '../../public/debug-dashboard.html'));
});

/**
 * @route   GET /opsicos-monitor
 * @desc    Opsicos Monitor page (hidden, accessible only by URL)
 * @access  Public (hidden page)
 */
router.get('/opsicos-monitor', (req, res) => {
  console.log('=== OPSICOS MONITOR ACCESS ===');
  console.log('IP:', req.ip);
  console.log('User Agent:', req.get('User-Agent'));
  console.log('Timestamp:', new Date().toISOString());
  res.sendFile(path.join(__dirname, '../../public/opsicos-monitor.html'));
});

/**
 * @route   GET /opsicos-monitor/bot/:id
 * @desc    Individual Bot Monitor page
 * @access  Public (hidden page)
 */
router.get('/opsicos-monitor/bot/:id', (req, res) => {
  console.log('=== BOT MONITOR ACCESS ===');
  console.log('Bot ID:', req.params.id);
  console.log('IP:', req.ip);
  console.log('Timestamp:', new Date().toISOString());
  res.sendFile(path.join(__dirname, '../../public/bot-monitor.html'));
});

/**
 * @route   GET /admin
 * @desc    Admin Panel page
 * @access  Public (protected by session-based password auth)
 */
router.get('/admin', (req, res) => {
  console.log('=== ADMIN PANEL ACCESS ===');
  console.log('IP:', req.ip);
  console.log('Session:', req.session?.isAdmin);
  console.log('Timestamp:', new Date().toISOString());
  res.sendFile(path.join(__dirname, '../../public/admin.html'));
});

module.exports = router;