// Rate limiting configuration for Discord bot management
module.exports = {
  // Discord session limits
  discord: {
    // Time between bot starts to avoid rate limits
    minStartInterval: process.env.BOT_START_INTERVAL ? parseInt(process.env.BOT_START_INTERVAL) : 15000, // 15 seconds default
    
    // Maximum concurrent bot starts
    maxConcurrentStarts: process.env.MAX_CONCURRENT_STARTS ? parseInt(process.env.MAX_CONCURRENT_STARTS) : 2,
    
    // Time between description updates
    minDescriptionInterval: 5000, // 5 seconds
    
    // Retry configuration
    maxRetries: 3,
    retryBackoff: [5000, 10000, 20000], // 5s, 10s, 20s
  },
  
  // Deployment configuration
  deployment: {
    // Base delay for first bot on new deployment
    baseStartupDelay: process.env.BASE_STARTUP_DELAY ? parseInt(process.env.BASE_STARTUP_DELAY) : 10000, // 10 seconds
    
    // Incremental delay per bot on new deployment
    incrementalDelay: process.env.INCREMENTAL_DELAY ? parseInt(process.env.INCREMENTAL_DELAY) : 10000, // 10 seconds per bot
    
    // Maximum time to consider a bot session valid
    sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
    
    // Time before considering a bot inactive
    inactivityThreshold: 5 * 60 * 1000, // 5 minutes
  },
  
  // Health check configuration
  healthCheck: {
    // Interval between health checks
    interval: process.env.HEALTH_CHECK_INTERVAL ? parseInt(process.env.HEALTH_CHECK_INTERVAL) : 5 * 60 * 1000, // 5 minutes
    
    // Delay between bot restarts in health check
    restartDelay: 20000, // 20 seconds
  },
  
  // Render.com specific settings
  render: {
    // Whether to use aggressive rate limiting (for free tier)
    useConservativeLimits: process.env.RENDER_FREE_TIER === 'true' || !process.env.RENDER_PAID_TIER,
    
    // Free tier adjustments
    freeTeir: {
      minStartInterval: 30000, // 30 seconds between bot starts
      baseStartupDelay: 20000, // 20 seconds base delay
      incrementalDelay: 15000, // 15 seconds per bot
    }
  }
};
