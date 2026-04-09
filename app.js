// Load environment variables from .env file (optional)
try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded from .env file');
} catch (error) {
  console.log('ℹ️ No .env file found or dotenv not available, using system environment variables');
}

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./src/config/passport');
const connectToDatabase = require('./src/config/database');
const discordBotService = require('./src/services/discordBotService');
const useragent = require('express-useragent');
const cors = require('cors');
const { checkBanned } = require('./src/middleware/auth');
const instanceManager = require('./src/utils/instanceManager');
const path = require('path');

// Configuration from environment variables
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

// Validate required environment variables
const requiredEnvVars = ['SESSION_SECRET', 'MONGODB_URI', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('   Please copy .env.example to .env and fill in your values.');
  process.exit(1);
}

// Import routes
const authRoutes = require('./src/routes/auth');
const botRoutes = require('./src/routes/bots');
const knowledgeRoutes = require('./src/routes/knowledge');
const settingsRoutes = require('./src/routes/settings');
const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');
const adminRoutes = require('./src/routes/admin');
const smartnessRoutes = require('./src/routes/smartness');
const notificationRoutes = require('./src/routes/notifications');
const changelogRoutes = require('./src/routes/changelog');

const app = express();
const http = require('http');
const socketIo = require('socket.io');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: (process.env.CORS_ORIGINS || 'http://localhost:3000,https://discord.com,https://discordapp.com').split(',').map(s => s.trim()),
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Initialize the app
async function initializeApp() {
  try {
    // Environment detection - cPanel only
    console.log('🔍 Environment Detection:');
    console.log('- PASSENGER_APP_ENV:', !!process.env.PASSENGER_APP_ENV);
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- Process PID:', process.pid);

    // 🔐 CRITICAL: Check for duplicate instances (file-based lock first)
    console.log('🔐 Checking for duplicate instances (file-based)...');

    // First, try to force kill any existing instance if in cPanel environment
    if (process.env.PASSENGER_APP_ENV || process.env.NODE_ENV === 'production') {
      console.log('🔍 cPanel/Production environment detected - checking for zombie instances...');
      await instanceManager.forceKillExistingInstance();
      // Wait a moment for the old instance to die
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try to acquire file-based lock first
    const fileLockAcquired = await instanceManager.acquireLock(false);

    if (!fileLockAcquired) {
      console.log('❌ DUPLICATE INSTANCE DETECTED (file lock)!');
      console.log('Another instance is already running. This instance will exit to prevent duplicates.');

      const existingInfo = instanceManager.getCurrentInstanceInfo();
      if (existingInfo) {
        console.log('Existing instance info:', existingInfo);
      }

      // Exit this instance since another is already running
      process.exit(0);
    }

    console.log('✅ File-based lock acquired. Connecting to database...');

    // 1. Await the single, shared database connection and get the client.
    const mongoClient = await connectToDatabase();

    // 1.5 Now try to acquire database lock for extra protection
    console.log('🔐 Acquiring database lock for additional protection...');
    try {
      const InstanceLock = require('./src/models/InstanceLock');

      // Clear any stale locks first
      await InstanceLock.forceReleaseAllLocks();

      // Now acquire our lock
      const dbLockResult = await InstanceLock.acquireLock(process.pid, instanceManager.instanceId);

      if (!dbLockResult.success) {
        console.log('⚠️ Could not acquire database lock, but continuing with file lock');
      } else {
        console.log('✅ Database lock acquired successfully');
        instanceManager.dbLock = dbLockResult.lock;
        instanceManager.startHeartbeat();
      }
    } catch (dbLockError) {
      console.error('Database lock error:', dbLockError.message);
      console.log('⚠️ Continuing with file-based lock only');
    }

    // 2. Configure middleware.
    app.set('trust proxy', 1);

    // Remove X-Powered-By header for security
    app.disable('x-powered-by');

    // Add security headers
    app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // CORS configuration from environment
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,https://discord.com,https://discordapp.com')
      .split(',').map(s => s.trim());

    app.use(cors({
      origin: function (origin, callback) {
        console.log('CORS Origin check:', origin);
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
          console.log('CORS blocked origin:', origin);
          const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }
        return callback(null, true);
      },
      credentials: true,
      optionsSuccessStatus: 200 // For legacy browser support
    }));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(useragent.express());

    // Serve static files from the 'public' directory
    app.use(express.static('public'));

    // 3. Configure session store to use the shared DB client.
    app.use(session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoClient,
        ttl: 60 * 60 * 24 * 365, // 1 year
      }),
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 31536000000, // 1 year
        sameSite: 'lax',
        domain: process.env.COOKIE_DOMAIN || undefined
      },
      name: 'opsicos_session',
      proxy: true, // Trust proxy headers
    }));

    // 4. Add request logging
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });

    // 5. Initialize Passport.
    app.use(passport.initialize());
    app.use(passport.session());

    // 5.5. Check if user is banned on every request
    app.use(checkBanned);

    // 5.6. Check maintenance mode (but allow exempt Discord user)
    const maintenanceModeMiddleware = require('./src/middleware/maintenanceMode');
    app.use(maintenanceModeMiddleware);

    // 6. Health check endpoint for Render and UptimeRobot
    app.get('/health', (req, res) => {
      const timestamp = new Date().toISOString();
      const userAgent = req.get('user-agent') || 'Unknown';
      
      // Log UptimeRobot pings
      if (userAgent.includes('UptimeRobot') || userAgent.includes('uptimerobot')) {
        console.log(`✅ [${timestamp}] UptimeRobot ping received successfully`);
      } else {
        console.log(`📡 [${timestamp}] Health check from: ${userAgent}`);
      }
      
      res.status(200).json({ 
        status: 'OK', 
        timestamp: timestamp,
        uptime: process.uptime(),
        message: 'Server is alive and running'
      });
    });
    
    // Alternative ping endpoint specifically for UptimeRobot
    app.get('/ping', (req, res) => {
      const timestamp = new Date().toISOString();
      console.log(`🏓 [${timestamp}] Ping received from UptimeRobot - Server is alive!`);
      res.status(200).send('pong');
    });

    // Public documentation route (not protected)
    app.get('/docs', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'docs.html'));
    });

    // All other routes are managed by the page routes module with proper authentication

    // 6.5. Setup Socket.io authentication and connection handling
    io.on('connection', (socket) => {
      console.log('Socket.io: New client connected:', socket.id);

      // Listen for authentication
      socket.on('authenticate', async (userId) => {
        try {
          if (userId) {
            // Join user-specific room
            socket.join(`user_${userId}`);
            socket.userId = userId;
            console.log(`Socket.io: User ${userId} authenticated and joined room`);
            socket.emit('authenticated', { success: true });
          }
        } catch (error) {
          console.error('Socket.io authentication error:', error);
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
        }
      });

      socket.on('disconnect', () => {
        console.log('Socket.io: Client disconnected:', socket.id);
      });
    });

    // 7. Setup API routes.
    app.use('/auth', authRoutes);
    app.use('/bots', botRoutes);
    app.use('/knowledge', knowledgeRoutes);
    app.use('/settings', settingsRoutes);
    app.use('/api', apiRoutes);
    app.use('/admin', adminRoutes);
    app.use('/api', notificationRoutes);
    app.use('/api', changelogRoutes);
    app.use('/', smartnessRoutes);
    app.use('/', pageRoutes);

    // 7. Server startup - Handle both cPanel/Passenger and Render
    const PORT = process.env.PORT || 3000;

    // Only start listening if not in cPanel/Passenger environment
    if (!process.env.PASSENGER_APP_ENV) {
      server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🔌 Socket.io server is ready`);
      });
    } else {
      console.log(`🚀 Server configuration complete (cPanel/Passenger)`);
      console.log(`🔌 Socket.io server is ready (cPanel/Passenger)`);
    }
    console.log(`🌐 Environment: production`);

    // 8. 🔥 CRITICAL: Only start bots if we're the main instance
    if (instanceManager.isMain()) {
      console.log('☢️ STEP 1: NUCLEAR CLEANUP - Destroying all existing bot instances...');
      const nuclearResult = await discordBotService.nuclearCleanup();
      console.log(`✅ Nuclear cleanup complete: ${nuclearResult.message}`);

      console.log('🧟‍♂️ STEP 2: Additional zombie cleanup...');
      const zombieCleanupResult = await discordBotService.killZombieInstances();
      console.log(`✅ Zombie cleanup complete: ${zombieCleanupResult.message}`);

      // Wait longer for Discord API to process all cleanups
      console.log('⏱️ Waiting 10 seconds for Discord API to process all cleanups...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Now start fresh bot instances
      console.log('🚀 STEP 3: Starting fresh bot instances...');
      discordBotService.startAllBots().catch(err => console.error('Error starting bots:', err));
    } else {
      console.log(`⚠️ Not the main instance - skipping bot initialization`);
    }

    // 9. Start periodic health check (every 2 minutes) - only if main instance
    if (instanceManager.isMain()) {
      setInterval(() => {
        // 🔒 ENHANCED: Verify we still own the lock before proceeding
        if (instanceManager.isMain() && instanceManager.verifyLockOwnership()) {
          discordBotService.healthCheckAndRestart().catch(err => console.error('Error in health check:', err));
        } else if (instanceManager.isMain()) {
          console.warn('⚠️ Lost lock ownership, stopping health checks for this instance');
        }
      }, 2 * 60 * 1000); // 2 minutes
    }

    console.log('✅ App initialized successfully with bot auto-restart system');
    console.log('🏥 Bot health check system started (runs every 2 minutes)');

    // Initialize update notification service
    if (instanceManager.isMain()) {
      const updateNotificationService = require('./src/services/updateNotificationService');
      updateNotificationService.initialize().catch(err => {
        console.error('⚠️ Failed to initialize update notification service:', err);
      });

      // Initialize official bot service for slash commands and ticket system
      const officialBotService = require('./src/services/officialBotService');
      console.log('🤖 Attempting to initialize official Opsicos bot service...');
      officialBotService.initialize().then(() => {
        console.log('✅ Official Opsicos bot service initialized successfully');
      }).catch(err => {
        console.error('❌ CRITICAL: Failed to initialize official bot service:', err);
        console.error('Error stack:', err.stack);
      });
    }

    // 🏷️ Start periodic bot description enforcement (runs every 30 minutes) - only if main instance
    if (instanceManager.isMain()) {
      console.log('🏷️ Starting bot description enforcement system (every 30 minutes for active bots)...');
      setTimeout(() => {
        // 🔒 ENHANCED: Verify we still own the lock before proceeding
        if (instanceManager.isMain() && instanceManager.verifyLockOwnership()) {
          discordBotService.enforceBotDescriptions();
        }
      }, 10 * 60 * 1000); // Start after 10 minutes to let all bots settle and avoid initial rate limits
    }

  } catch (error) {
    console.error('Failed to initialize server setup:', error);
    process.exit(1);
  }
}

// Initialize the app immediately
initializeApp();

// 🔥 CRITICAL: Graceful shutdown handler to prevent zombie bot instances
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 ${signal} signal received: Initiating graceful shutdown...`);

  try {
    // 1. Save bot sessions for faster restart after deployment
    if (instanceManager.isMain()) {
      console.log('💾 Saving bot sessions for next deployment...');
      const deploymentManager = require('./src/utils/deploymentManager');
      
      // Get all active bots and save their session info
      const activeBotsList = discordBotService.getActiveBots();
      for (const bot of activeBotsList) {
        if (bot.isReady) {
          await deploymentManager.saveBotSession(bot.botId, {
            status: 'online',
            lastActive: Date.now(),
            wasRunning: true,
            botName: bot.botName
          });
          console.log(`✅ Saved session for bot ${bot.botName} (${bot.botId})`);
        }
      }
      
      console.log('🤖 Stopping all running bots...');
      const stopResult = await discordBotService.forceStopAllBots();
      console.log(`✅ Bot shutdown complete: ${stopResult.message}`);
    }

    // 2. Release instance lock
    console.log('🔓 Releasing instance lock...');
    instanceManager.releaseLock();

    // 3. Give a moment for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Exit cleanly
    console.log('👋 Graceful shutdown complete. Exiting...');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    // Try to release lock even on error
    instanceManager.releaseLock();
    // Force exit after error
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit on unhandled rejection, just log it
});

// Export the server for cPanel's Passenger (includes Socket.io)
module.exports = server;
