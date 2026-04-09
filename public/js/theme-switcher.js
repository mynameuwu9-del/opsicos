/**
 * Theme Switcher for Opsicos
 * Allows switching between Red (default), Blue, and Green themes
 * Background always remains black
 */

class ThemeSwitcher {
  constructor() {
    this.themes = ['red', 'blue', 'green'];
    this.defaultTheme = 'red';
    this.currentTheme = this.loadTheme();
    this.init();
  }

  init() {
    // Apply saved theme on page load
    this.applyTheme(this.currentTheme);
    
    // Create theme switcher UI
    this.createSwitcherUI();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  createSwitcherUI() {
    // Check if switcher already exists
    if (document.querySelector('.theme-switcher')) {
      return;
    }

    // Create container for positioning
    const container = document.createElement('div');
    container.className = 'theme-switcher-container';

    const switcher = document.createElement('div');
    switcher.className = 'theme-switcher';
    switcher.innerHTML = `
      <button class="theme-btn theme-btn-red ${this.currentTheme === 'red' ? 'active' : ''}" 
              data-theme="red" 
              title="Red Theme"
              aria-label="Switch to Red Theme">
      </button>
      <button class="theme-btn theme-btn-blue ${this.currentTheme === 'blue' ? 'active' : ''}" 
              data-theme="blue" 
              title="Blue Theme"
              aria-label="Switch to Blue Theme">
      </button>
      <button class="theme-btn theme-btn-green ${this.currentTheme === 'green' ? 'active' : ''}" 
              data-theme="green" 
              title="Green Theme"
              aria-label="Switch to Green Theme">
      </button>
    `;

    container.appendChild(switcher);
    
    // Insert at the beginning of body to appear at top
    document.body.insertBefore(container, document.body.firstChild);
  }

  setupEventListeners() {
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme');
        this.switchTheme(theme);
      });
    });
  }

  switchTheme(theme) {
    if (!this.themes.includes(theme)) {
      console.error(`Invalid theme: ${theme}`);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    this.saveTheme(theme);
    this.updateActiveButton(theme);
  }

  applyTheme(theme) {
    // Set data-theme attribute on html element
    document.documentElement.setAttribute('data-theme', theme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const colors = {
        red: '#8B0000',
        blue: '#0066CC',
        green: '#00AA44'
      };
      metaThemeColor.setAttribute('content', colors[theme]);
    }

    // Apply CSS variables directly to root
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

    // Update logos based on theme
    this.updateLogos(theme);

    console.log(`Theme switched to: ${theme}`);
  }

  updateLogos(theme) {
    // Define logo paths for each theme
    const logoMap = {
      red: '/images/opsicos_circle.avif',
      blue: '/images/opsicos_blue.avif',
      green: '/images/opsicos_green.avif'
    };

    const newLogoSrc = logoMap[theme];

    // Find all logo images and update their src
    const logoImages = document.querySelectorAll('img[src*="opsicos"]');
    logoImages.forEach(img => {
      // Only update if it's one of the main logos (not other opsicos images)
      if (img.src.includes('opsicos_circle.avif') || 
          img.src.includes('opsicos_blue.avif') || 
          img.src.includes('opsicos_green.avif')) {
        img.src = newLogoSrc;
      }
    });

    console.log(`Logos updated to: ${newLogoSrc}`);
  }

  updateActiveButton(theme) {
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(button => {
      if (button.getAttribute('data-theme') === theme) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  saveTheme(theme) {
    try {
      localStorage.setItem('opsicos_theme', theme);
    } catch (e) {
      console.error('Failed to save theme to localStorage:', e);
    }
  }

  loadTheme() {
    try {
      const savedTheme = localStorage.getItem('opsicos_theme');
      if (savedTheme && this.themes.includes(savedTheme)) {
        return savedTheme;
      }
    } catch (e) {
      console.error('Failed to load theme from localStorage:', e);
    }
    return this.defaultTheme;
  }
}

// Initialize theme switcher when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeSwitcher = new ThemeSwitcher();
  });
} else {
  window.themeSwitcher = new ThemeSwitcher();
}
