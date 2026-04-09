const MaintenanceMode = require('../models/MaintenanceMode');

const EXEMPT_DISCORD_ID = '1340207834108788759';

const maintenanceModeMiddleware = async (req, res, next) => {
  try {
    // Skip maintenance check for static assets, maintenance page, and API endpoints needed for maintenance
    if (req.path.startsWith('/public/') || 
        req.path.startsWith('/images/') ||
        req.path.startsWith('/css/') ||
        req.path.startsWith('/js/') ||
        req.path === '/maintenance' ||
        req.path.startsWith('/admin/maintenance') ||
        req.path.startsWith('/auth/') ||
        req.path === '/favicon.ico') {
      return next();
    }

    const maintenanceStatus = await MaintenanceMode.getInstance();
    
    // Auto-disable maintenance mode if estimated end time has passed
    if (maintenanceStatus.enabled && maintenanceStatus.estimatedEndTime) {
      const now = new Date();
      if (now >= new Date(maintenanceStatus.estimatedEndTime)) {
        console.log('🕐 Maintenance mode auto-disabled: estimated end time reached');
        console.log('🔄 This will trigger automatic bot restart...');
        await MaintenanceMode.disable(); // This will automatically restart bots
        return next();
      }
    }
    
    if (!maintenanceStatus.enabled) {
      return next();
    }

    // Check if user is the exempt Discord user
    if (req.user && req.user.discordId === EXEMPT_DISCORD_ID) {
      return next();
    }

    // Serve maintenance page
    const maintenanceData = {
      message: maintenanceStatus.message,
      startTime: maintenanceStatus.startTime,
      estimatedEndTime: maintenanceStatus.estimatedEndTime,
      reason: maintenanceStatus.reason
    };

    // If it's an API request, return JSON
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: maintenanceStatus.message,
        maintenanceMode: true
      });
    }

    // Serve HTML maintenance page
    res.status(503).send(generateMaintenancePage(maintenanceData));
  } catch (error) {
    console.error('Error in maintenance mode middleware:', error);
    next();
  }
};

function generateMaintenancePage(data) {
  const timeRemaining = data.estimatedEndTime ? 
    Math.max(0, Math.floor((new Date(data.estimatedEndTime).getTime() - Date.now()) / 1000)) : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Opsicos Maintenance - We'll Be Right Back</title>
    <meta name="robots" content="noindex, nofollow">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔧</text></svg>">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a0000 0%, #330000 25%, #000000 50%, #1a0000 75%, #330000 100%);
            background-size: 400% 400%;
            background-attachment: fixed;
            animation: gradientShift 15s ease infinite;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ff3333;
            overflow-x: hidden;
            overflow-y: auto;
            position: relative;
            padding: 20px 0;
        }
        
        @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .maintenance-container {
            text-align: center;
            padding: 3rem;
            max-width: 800px;
            width: 90%;
            z-index: 10;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 25px;
            box-shadow: 0 0 60px rgba(255, 51, 51, 0.4), inset 0 0 50px rgba(255, 51, 51, 0.1);
            border: 2px solid #ff3333;
            animation: glow 4s ease-in-out infinite alternate;
            backdrop-filter: blur(10px);
            margin: auto;
            position: relative;
        }
        
        @keyframes glow {
            from { 
                box-shadow: 0 0 60px rgba(255, 51, 51, 0.4), inset 0 0 50px rgba(255, 51, 51, 0.1);
                border-color: #ff3333;
            }
            to { 
                box-shadow: 0 0 100px rgba(255, 51, 51, 0.8), inset 0 0 80px rgba(255, 51, 51, 0.2);
                border-color: #ff6666;
            }
        }

        .opsicos-logo {
            margin-bottom: 2rem;
            animation: logoFloat 6s ease-in-out infinite;
        }

        @keyframes logoFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        .opsicos-logo h2 {
            font-size: 2.2rem;
            font-weight: 900;
            background: linear-gradient(45deg, #ff3333, #ff6666, #ff3333);
            background-size: 200% 200%;
            animation: gradientText 3s ease infinite;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 0 30px rgba(255, 51, 51, 0.5);
            letter-spacing: 2px;
        }

        @keyframes gradientText {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        .icon-container {
            width: 160px;
            height: 160px;
            margin: 0 auto 2.5rem;
            background: radial-gradient(circle, #ff3333 0%, #990000 70%, #660000 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 3s infinite;
            border: 4px solid #ff6666;
            position: relative;
            overflow: hidden;
        }

        .icon-container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: conic-gradient(transparent, rgba(255, 51, 51, 0.4), transparent 30%);
            animation: rotate 4s linear infinite;
        }

        @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
        }
        
        .icon-container svg {
            width: 90px;
            height: 90px;
            fill: #ffffff;
            filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.7));
            z-index: 2;
            position: relative;
        }
        
        h1 {
            font-size: 3.5rem;
            margin-bottom: 1.5rem;
            font-weight: 900;
            text-shadow: 0 0 30px rgba(255, 51, 51, 0.8);
            letter-spacing: -2px;
            background: linear-gradient(45deg, #ffffff, #ffcccc, #ffffff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .maintenance-status {
            font-size: 1.8rem;
            color: #ff6666;
            font-weight: 700;
            margin-bottom: 1rem;
            text-transform: uppercase;
            letter-spacing: 3px;
            text-shadow: 0 0 20px rgba(255, 102, 102, 0.6);
        }
        
        .subtitle {
            font-size: 1.4rem;
            margin-bottom: 2.5rem;
            opacity: 0.95;
            line-height: 1.7;
            color: #ffdddd;
            font-weight: 400;
        }
        
        .status-bar {
            background: rgba(255, 51, 51, 0.3);
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            margin: 2.5rem 0;
            border: 2px solid #ff3333;
            position: relative;
        }

        .status-bar::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        .status-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff3333, #ff6666, #ff9999, #ff6666, #ff3333);
            background-size: 300% 100%;
            border-radius: 6px;
            width: 0%;
            animation: statusPulse 3s ease-in-out infinite;
        }
        
        @keyframes statusPulse {
            0% { 
                width: 0%; 
                background-position: 0% 50%;
            }
            50% { 
                width: 85%; 
                background-position: 100% 50%;
            }
            100% { 
                width: 0%; 
                background-position: 200% 50%;
            }
        }
        
        .info-panel {
            background: linear-gradient(135deg, rgba(255, 51, 51, 0.15), rgba(255, 51, 51, 0.05));
            border: 2px solid rgba(255, 51, 51, 0.6);
            border-radius: 20px;
            padding: 2.5rem;
            margin: 2.5rem 0;
            backdrop-filter: blur(5px);
        }
        
        .info-text {
            font-size: 1.1rem;
            opacity: 0.95;
            line-height: 1.7;
            margin-bottom: 1.5rem;
            color: #ffdddd;
            font-weight: 300;
        }

        .info-highlight {
            background: rgba(255, 51, 51, 0.2);
            padding: 1rem 1.5rem;
            border-radius: 12px;
            border-left: 4px solid #ff3333;
            margin: 1.5rem 0;
            font-size: 1rem;
            color: #ffeeee;
        }

        .bot-notice {
            background: rgba(255, 102, 102, 0.2);
            border: 1px solid rgba(255, 102, 102, 0.5);
            border-radius: 15px;
            padding: 2rem;
            margin: 2rem 0;
            text-align: left;
        }

        .bot-notice h4 {
            color: #ff6666;
            font-size: 1.3rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .bot-notice p {
            color: #ffdddd;
            line-height: 1.6;
            margin-bottom: 0.8rem;
        }
        
        .timer-section {
            margin: 2.5rem 0;
        }
        
        .timer-display {
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            margin: 2rem 0;
        }
        
        .timer-unit {
            background: linear-gradient(135deg, rgba(255, 51, 51, 0.3), rgba(255, 51, 51, 0.1));
            border: 2px solid #ff3333;
            border-radius: 15px;
            padding: 1.5rem;
            min-width: 90px;
            position: relative;
            overflow: hidden;
        }

        .timer-unit::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            animation: timerShine 3s infinite;
        }

        @keyframes timerShine {
            0% { left: -100%; }
            100% { left: 100%; }
        }
        
        .timer-number {
            font-size: 2.4rem;
            font-weight: 900;
            color: #ff3333;
            text-shadow: 0 0 15px rgba(255, 51, 51, 0.8);
            position: relative;
            z-index: 2;
        }
        
        .timer-label {
            font-size: 0.9rem;
            color: #ffcccc;
            margin-top: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            position: relative;
            z-index: 2;
        }
        
        .contact-info {
            margin-top: 2.5rem;
            font-size: 1rem;
            color: #ffcccc;
            padding: 1.5rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 12px;
            border: 1px solid rgba(255, 51, 51, 0.3);
        }
        
        .contact-info a {
            color: #ff6666;
            text-decoration: none;
            border-bottom: 2px dotted #ff6666;
            transition: all 0.3s ease;
            font-weight: 600;
        }
        
        .contact-info a:hover {
            color: #ff3333;
            border-bottom-color: #ff3333;
            text-shadow: 0 0 10px rgba(255, 51, 51, 0.8);
        }
        
        .background-pattern {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.08;
            background-image: 
                radial-gradient(circle at 25% 25%, #ff3333 3px, transparent 3px),
                radial-gradient(circle at 75% 75%, #ff3333 2px, transparent 2px),
                radial-gradient(circle at 50% 50%, #ff6666 1px, transparent 1px);
            background-size: 120px 120px, 80px 80px, 40px 40px;
            animation: patternMove 25s linear infinite;
        }
        
        @keyframes patternMove {
            0% { transform: translate(0, 0) rotate(0deg); }
            100% { transform: translate(60px, 60px) rotate(360deg); }
        }
        
        @media (max-width: 768px) {
            .maintenance-container { padding: 2rem; margin: 1rem; }
            h1 { font-size: 2.5rem; }
            .opsicos-logo h2 { font-size: 1.8rem; }
            .maintenance-status { font-size: 1.4rem; }
            .subtitle { font-size: 1.1rem; }
            .timer-display { flex-wrap: wrap; gap: 1rem; }
            .timer-unit { min-width: 70px; padding: 1.2rem; }
            .timer-number { font-size: 2rem; }
            .icon-container { width: 120px; height: 120px; }
            .icon-container svg { width: 70px; height: 70px; }
        }

        @media (max-width: 480px) {
            .maintenance-container { padding: 1.5rem; margin: 0.5rem; }
            h1 { font-size: 2rem; }
            .opsicos-logo h2 { font-size: 1.5rem; letter-spacing: 1px; }
            .maintenance-status { font-size: 1.2rem; letter-spacing: 2px; }
            .subtitle { font-size: 1rem; }
            .info-text { font-size: 1rem; }
            .timer-unit { min-width: 60px; padding: 1rem; }
            .timer-number { font-size: 1.8rem; }
        }
    </style>
</head>
<body>
    <div class="background-pattern"></div>
    
    <div class="maintenance-container">
        <div class="opsicos-logo">
            <h2>OPSICOS</h2>
        </div>
        
        <div class="icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4zM6.7 8.8c-.7.7-1.9.7-2.6 0-.7-.7-.7-1.9 0-2.6.7-.7 1.9-.7 2.6 0 .7.7.7 1.9 0 2.6z"/>
            </svg>
        </div>
        
        <h1>OPSICOS</h1>
        <div class="maintenance-status">Under Maintenance</div>
        <p class="subtitle">${data.message}</p>
        
        <div class="status-bar">
            <div class="status-fill"></div>
        </div>
        
        <div class="info-panel">
            <div class="info-highlight">
                <strong>🚧 Our team is performing essential system maintenance to enhance performance, security, and reliability.</strong>
            </div>
            
            <p class="info-text">
                <strong>🔧 Maintenance Type:</strong> ${data.reason || 'Scheduled System Maintenance'}
            </p>
            <p class="info-text">
                <strong>⏰ Started:</strong> ${new Date(data.startTime).toLocaleString()}
            </p>
            
            <div class="bot-notice">
                <h4>🤖 Discord Bot Status</h4>
                <p>• All Discord bots have been automatically stopped during maintenance</p>
                <p>• Bots will automatically restart once maintenance is completed</p>
                <p>• No action is required from bot owners</p>
                <p>• All bot configurations and data remain safe and secure</p>
            </div>
            ${data.estimatedEndTime ? `
                <div class="timer-section">
                    <p class="info-text"><strong>⌛ Estimated completion:</strong></p>
                    <div class="timer-display" id="countdown">
                        <div class="timer-unit">
                            <div class="timer-number" id="hours">00</div>
                            <div class="timer-label">Hours</div>
                        </div>
                        <div class="timer-unit">
                            <div class="timer-number" id="minutes">00</div>
                            <div class="timer-label">Minutes</div>
                        </div>
                        <div class="timer-unit">
                            <div class="timer-number" id="seconds">00</div>
                            <div class="timer-label">Seconds</div>
                        </div>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="contact-info">
            🆘 Need immediate assistance? Contact us at 
            <a href="mailto:support@opsicos.com">support@opsicos.com</a>
        </div>
    </div>
    
    <script>
        ${data.estimatedEndTime ? `
            const endTime = new Date('${data.estimatedEndTime}').getTime();
            
            function updateCountdown() {
                const now = new Date().getTime();
                const timeLeft = endTime - now;
                
                if (timeLeft <= 0) {
                    location.reload();
                    return;
                }
                
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                
                document.getElementById('hours').textContent = String(hours).padStart(2, '0');
                document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
                document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
            }
            
            updateCountdown();
            setInterval(updateCountdown, 1000);
        ` : ''}
        
        // Auto-refresh every 30 seconds to check if maintenance is over
        setTimeout(function() {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
  `;
}

module.exports = maintenanceModeMiddleware;
