/**
 * Theme Loader - Applies saved theme on all pages
 * This runs on every page to ensure consistent theming
 */

(function() {
  // Load theme from localStorage
  function loadTheme() {
    try {
      const savedTheme = localStorage.getItem('opsicos_theme');
      return savedTheme && ['red', 'blue', 'green'].includes(savedTheme) ? savedTheme : 'red';
    } catch (e) {
      return 'red';
    }
  }

  // Apply theme immediately
  function applyTheme(theme) {
    // Set data-theme attribute on both html and body
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const colors = {
        red: '#8B0000',
        blue: '#0066CC',
        green: '#00AA44'
      };
      metaThemeColor.setAttribute('content', colors[theme]);
    }

    // Apply CSS variables directly to root for immediate effect
    const root = document.documentElement;
    const themeColors = {
      red: {
        primary: '#8B0000',
        primaryDark: '#660000',
        primaryLight: '#AA0000',
        accent: '#FF4444',
        cardBorder: 'rgba(139, 0, 0, 0.3)',
        cardGlow: 'rgba(139, 0, 0, 0.5)'
      },
      blue: {
        primary: '#0066CC',
        primaryDark: '#004499',
        primaryLight: '#0088FF',
        accent: '#0088FF',
        cardBorder: 'rgba(0, 102, 204, 0.3)',
        cardGlow: 'rgba(0, 102, 204, 0.5)'
      },
      green: {
        primary: '#00AA44',
        primaryDark: '#007733',
        primaryLight: '#00CC55',
        accent: '#00CC55',
        cardBorder: 'rgba(0, 170, 68, 0.3)',
        cardGlow: 'rgba(0, 170, 68, 0.5)'
      }
    };

    const colors = themeColors[theme];
    
    // Set all possible CSS variable names used across different pages
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-dark', colors.primaryDark);
    root.style.setProperty('--primary-light', colors.primaryLight);
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--secondary-color', colors.primaryDark);
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--accent', colors.primary);
    root.style.setProperty('--accent-hover', colors.primaryDark);
    root.style.setProperty('--card-border', colors.cardBorder);
    root.style.setProperty('--card-glow', colors.cardGlow);
    
    console.log(`Theme applied: ${theme} with primary color: ${colors.primary}`);
  }

  // Update logos based on theme
  function updateLogos(theme) {
    const logoMap = {
      red: '/images/opsicos_circle.avif',
      blue: '/images/opsicos_blue.avif',
      green: '/images/opsicos_green.avif'
    };

    const newLogoSrc = logoMap[theme];

    // Find all logo images and update their src
    const logoImages = document.querySelectorAll('img[src*="opsicos"]');
    logoImages.forEach(img => {
      if (img.src.includes('opsicos_circle.avif') || 
          img.src.includes('opsicos_blue.avif') || 
          img.src.includes('opsicos_green.avif')) {
        img.src = newLogoSrc;
      }
    });
  }

  // Apply theme immediately (before DOM loads)
  const currentTheme = loadTheme();
  applyTheme(currentTheme);

  // Re-apply theme and update logos when DOM is ready to ensure it overrides inline styles
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyTheme(currentTheme);
      updateLogos(currentTheme);
    });
  } else {
    applyTheme(currentTheme);
    updateLogos(currentTheme);
  }

  // Also re-apply after window loads (for any late-loading styles)
  window.addEventListener('load', () => {
    applyTheme(currentTheme);
    updateLogos(currentTheme);
  });

  // Listen for storage changes (when theme changes in another tab/page)
  window.addEventListener('storage', (e) => {
    if (e.key === 'opsicos_theme' && e.newValue) {
      const newTheme = e.newValue;
      if (['red', 'blue', 'green'].includes(newTheme)) {
        applyTheme(newTheme);
        updateLogos(newTheme);
      }
    }
  });
})();
