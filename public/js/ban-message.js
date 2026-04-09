// Check for ban message in URL parameters
function checkBanMessage() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const reason = urlParams.get('reason');

    if ((error === 'banned' || error === 'security_violation') && reason) {
        showBanMessage(reason);
    }
}

// Show ban message to user
function showBanMessage(reason) {
    // Determine if this is a security violation or ban
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const isSecurityViolation = error === 'security_violation';
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create message box
    const messageBox = document.createElement('div');
    messageBox.style.cssText = `
        background: linear-gradient(135deg, #1a1a1a, #2a2a2a);
        border: 2px solid #ef4444;
        border-radius: 15px;
        padding: 40px;
        max-width: 500px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(239, 68, 68, 0.3);
        animation: slideIn 0.5s ease;
    `;
    
    messageBox.innerHTML = `
        <div style="margin-bottom: 20px;">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#ef4444"/>
            </svg>
        </div>
        <h2 style="color: #ef4444; margin-bottom: 20px; font-size: 28px;">${isSecurityViolation ? 'Security Violation' : 'Access Denied'}</h2>
        <p style="color: #fff; font-size: 18px; margin-bottom: 30px; line-height: 1.6;">
            ${reason}
        </p>
        <button onclick="closeBanMessage()" style="
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            Understood
        </button>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    
    // Add styles for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { 
                opacity: 0;
                transform: translateY(-50px);
            }
            to { 
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Clean URL after showing message
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

// Close ban message
function closeBanMessage() {
    const overlay = document.querySelector('div[style*="position: fixed"]');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }
}

// Add fadeOut animation
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(fadeOutStyle);

// Periodically check for ban status
function startBanChecker() {
  let banCheckInterval;
  
  const checkBan = async () => {
    try {
      const response = await fetch('/api/check-ban', {
        credentials: 'include' // Include cookies
      });
      
      if (!response.ok) {
        // If we get 401, user might not be logged in, stop checking
        if (response.status === 401) {
          if (banCheckInterval) {
            clearInterval(banCheckInterval);
          }
          return;
        }
        return;
      }
      
      const data = await response.json();
      
      if (data.banned) {
        // Clear the interval first
        if (banCheckInterval) {
          clearInterval(banCheckInterval);
        }
        
        // User is banned, show message and force logout
        showBanMessage(data.reason || 'You are banned from Opsicos');
        
        // Force logout after showing message
        setTimeout(() => {
          // Try to logout via API first
          fetch('/auth/logout', {
            method: 'GET',
            credentials: 'include'
          }).finally(() => {
            // Redirect to home page
            window.location.href = '/';
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking ban status:', error);
    }
  };
  
  // Start checking immediately and then every 15 seconds
  checkBan();
  banCheckInterval = setInterval(checkBan, 15000);
  
  return banCheckInterval;
}

// Function to check if user is authenticated
function isUserAuthenticated() {
  // Check for session cookie
  if (document.cookie.includes('opsicos_session')) {
    return true;
  }
  
  // Check if we're on a page that requires authentication
  const authPages = ['/dashboard', '/settings', '/bots', '/knowledge', '/behavior'];
  const currentPath = window.location.pathname;
  return authPages.some(page => currentPath.includes(page));
}

// Check for ban/security violation message on page load
document.addEventListener('DOMContentLoaded', function() {
  checkBanMessage();
});

// Also check immediately in case DOMContentLoaded already fired
checkBanMessage();

// Start the ban checker if the user is logged in
if (isUserAuthenticated()) {
  // Wait a bit for the page to load, then start checking
  setTimeout(() => {
    startBanChecker();
  }, 1000);
}
