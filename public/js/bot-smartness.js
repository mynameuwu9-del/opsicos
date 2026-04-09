
/**
 * Bot Smartness Configuration - Frontend Logic
 * Handles all bot intelligence and personality settings
 */

class BotSmartnessManager {
  constructor() {
    this.currentUser = null;
    this.selectedBotId = null;
    this.currentSettings = null;
    this.isDirty = false;
    this.autoSaveTimer = null;
    this.draftKey = 'bot_smartness_draft';
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('🧠 Initializing Bot Smartness Manager...');
    console.log('📍 Current URL:', window.location.href);
    console.log('🍪 Cookies:', document.cookie);
    
    // Check authentication
    const isAuthenticated = await this.checkAuth();
    if (!isAuthenticated) {
      console.warn('⚠️ Not authenticated, redirecting to login...');
      window.location.href = '/login';
      return;
    }

    // Set up event listeners
    this.setupEventListeners();
    
    // Load user's bots
    await this.loadBots();
    
    // Restore draft if exists
    this.restoreDraft();
    
    // Start auto-save
    this.startAutoSave();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    console.log('✅ Bot Smartness Manager initialized');
  }

  /**
   * Check authentication status
   */
  async checkAuth() {
    try {
      console.log('🔐 Checking authentication...');
      const response = await fetch('/auth/status', { credentials: 'include' });
      
      if (!response.ok) {
        console.error('❌ Auth check failed with status:', response.status);
        return false;
      }
      
      const data = await response.json();
      console.log('✅ Auth response:', data);
      
      if (!data.isAuthenticated) {
        console.warn('⚠️ User not authenticated');
        return false;
      }
      
      this.currentUser = data.user;
      this.updateUserInfo(data.user);
      console.log('✅ Authentication successful for user:', data.user.username);
      return true;
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      return false;
    }
  }

  /**
   * Update user info in header
   */
  updateUserInfo(user) {
    const usernameEl = document.getElementById('username');
    const avatarEl = document.getElementById('userAvatar');
    
    if (usernameEl) {
      usernameEl.textContent = user.username;
    }
    
    if (avatarEl && user.avatar) {
      avatarEl.src = user.avatar;
      avatarEl.style.display = 'block';
    }
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Bot selection
    const botSelect = document.getElementById('botSelect');
    if (botSelect) {
      botSelect.addEventListener('change', (e) => this.handleBotSelection(e.target.value));
    }

    // Temperature slider
    const tempSlider = document.getElementById('temperature');
    if (tempSlider) {
      tempSlider.addEventListener('input', (e) => {
        document.getElementById('tempValue').textContent = e.target.value;
        this.markDirty();
      });
    }

    // Emoji frequency slider
    const emojiSlider = document.getElementById('emojiFrequency');
    if (emojiSlider) {
      emojiSlider.addEventListener('input', (e) => {
        document.getElementById('emojiFreqValue').textContent = e.target.value + '%';
        this.markDirty();
      });
    }

    // Proactivity slider
    const proactivitySlider = document.getElementById('proactivityLevel');
    if (proactivitySlider) {
      proactivitySlider.addEventListener('input', (e) => {
        document.getElementById('proactivityValue').textContent = e.target.value + '%';
        this.markDirty();
      });
    }

    // All checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.markDirty());
    });

    // Smartness mode dropdown
    const smartnessMode = document.getElementById('smartnessMode');
    if (smartnessMode) {
      smartnessMode.addEventListener('change', () => this.markDirty());
    }

    // Radio buttons
    const radios = document.querySelectorAll('input[type="radio"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => this.markDirty());
    });

    // Custom rules textarea
    const customRules = document.getElementById('customRules');
    if (customRules) {
      customRules.addEventListener('input', () => {
        this.markDirty();
        this.updateCharacterCount();
      });
    }

    // Action buttons are set up via onclick in HTML
    // But we can also add them programmatically for better control
    this.setupActionButtons();
  }

  /**
   * Setup action buttons
   */
  setupActionButtons() {
    // These are defined globally in the HTML, but we can enhance them
    window.saveSettings = () => this.saveSettings();
    window.resetToDefault = () => this.resetToDefault();
    window.testConfiguration = () => this.testConfiguration();
    window.setCreativity = (level) => this.setCreativity(level);
    window.setDecision = (level) => this.setDecisionFreedom(level);
    window.toggleSection = (id) => this.toggleExpandableSection(id);
    window.logout = () => this.logout();
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (this.selectedBotId) {
          this.saveSettings();
        }
      }
    });
  }

  /**
   * Load user's bots into dropdown
   */
  async loadBots() {
    try {
      this.showLoading(true);
      console.log('🤖 Fetching bots from /bots endpoint...');
      
      const response = await fetch('/bots', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Add status checking
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Bot fetch failed:', response.status, errorText);
        
        // If authentication failed, redirect to login
        if (response.status === 401) {
          console.warn('⚠️ Unauthorized - redirecting to login');
          this.showNotification('Session expired. Redirecting to login...', 'error');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
          return;
        }
        
        throw new Error(`Failed to load bots (${response.status}): ${errorText}`);
      }
      
      const bots = await response.json();
      console.log('✅ Received bots:', bots);
      
      // Validate response is an array
      if (!Array.isArray(bots)) {
        console.error('❌ Invalid response type:', bots);
        throw new Error('Invalid response format from server');
      }
      
      console.log(`✅ Successfully loaded ${bots.length} bots`);
      this.populateBotDropdown(bots);
    } catch (error) {
      console.error('❌ Error loading bots:', error);
      this.showNotification(`Failed to load bots: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Populate bot dropdown
   */
  populateBotDropdown(bots) {
    const select = document.getElementById('botSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select a bot...</option>';
    
    if (bots.length === 0) {
      select.innerHTML += '<option value="" disabled>No bots available</option>';
      return;
    }
    
    bots.forEach(bot => {
      const option = document.createElement('option');
      option.value = bot._id;
      option.textContent = bot.botName;
      select.appendChild(option);
    });
  }

  /**
   * Handle bot selection
   */
  async handleBotSelection(botId) {
    if (!botId) {
      this.hideConfigSections();
      this.selectedBotId = null;
      return;
    }
    
    // Check for unsaved changes
    if (this.isDirty) {
      const confirm = window.confirm('You have unsaved changes. Do you want to discard them?');
      if (!confirm) {
        // Restore previous selection
        const select = document.getElementById('botSelect');
        select.value = this.selectedBotId || '';
        return;
      }
    }
    
    this.selectedBotId = botId;
    await this.loadBotSettings(botId);
  }

  /**
   * Load bot smartness settings
   */
  async loadBotSettings(botId) {
    this.showLoading(true);
    
    try {
      const response = await fetch(`/api/smartness/${botId}`, { 
        credentials: 'include' 
      });
      
      if (response.status === 404) {
        this.showNotification('Bot not found', 'error');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      const settings = await response.json();
      this.currentSettings = settings;
      this.populateForm(settings);
      this.showConfigSections();
      this.isDirty = false;
      
      if (settings.isDefault) {
        this.showNotification('Using default settings. Customize and save to create your own configuration.', 'info');
      }
      
    } catch (error) {
      console.error('Error loading bot settings:', error);
      this.showNotification('Failed to load bot configuration', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Populate form with settings
   */
  populateForm(settings) {
    this.setSliderValue('temperature', 'tempValue', settings.temperature || 1.0);
    this.setActiveButton('creativityLevel', settings.creativity || 'medium');
    this.setSelectValue('smartnessMode', settings.smartnessMode || 'balanced');
    this.setCheckbox('useNicknames', settings.useNicknames !== false);
    this.setCheckbox('naturalFlow', settings.naturalFlow !== false);
    this.setCheckbox('typingSimulation', settings.typingSimulation || false);
    this.setCheckbox('useEmojis', settings.emojiUsage !== false);
    this.setSliderValue('emojiFrequency', 'emojiFreqValue', settings.emojiFrequency || 30, '%');
    this.setCheckbox('funPinging', settings.funPinging || false);
    this.setSliderValue('proactivityLevel', 'proactivityValue', settings.proactivityLevel || 20, '%');
    this.setCheckbox('randomReactions', settings.randomReactions || false);
    this.setRadio('commandPrecision', settings.commandPrecision || 'flexible');
    this.setTextarea('customRules', settings.customRules || []);
    this.setActiveButton('decisionFreedom', settings.decisionFreedom || 'medium');
    this.setCheckbox('expressOpinions', settings.expressOpinions || false);
    this.setCheckbox('moodSimulation', settings.moodSimulation || false);
  }

  setSliderValue(sliderId, displayId, value, suffix = '') {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider) slider.value = value;
    if (display) display.textContent = value + suffix;
  }

  setSelectValue(selectId, value) {
    const select = document.getElementById(selectId);
    if (select) select.value = value;
  }

  setCheckbox(checkboxId, checked) {
    const checkbox = document.getElementById(checkboxId);
    if (checkbox) checkbox.checked = checked;
  }

  setRadio(name, value) {
    const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (radio) radio.checked = true;
  }

  setTextarea(textareaId, value) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    textarea.value = Array.isArray(value) ? value.join('\n') : (value || '');
    this.updateCharacterCount();
  }

  setActiveButton(groupId, value) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const buttons = group.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.toLowerCase().trim() === value.toLowerCase()) {
        btn.classList.add('active');
      }
    });
  }

  setCreativity(level) {
    this.setActiveButton('creativityLevel', level);
    this.markDirty();
  }

  setDecisionFreedom(level) {
    this.setActiveButton('decisionFreedom', level);
    this.markDirty();
  }

  gatherFormData() {
    const customRulesText = document.getElementById('customRules').value;
    const customRulesArray = customRulesText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    return {
      temperature: parseFloat(document.getElementById('temperature').value),
      creativity: this.getActiveButtonValue('creativityLevel'),
      smartnessMode: document.getElementById('smartnessMode').value,
      useNicknames: document.getElementById('useNicknames').checked,
      naturalFlow: document.getElementById('naturalFlow').checked,
      typingSimulation: document.getElementById('typingSimulation').checked,
      emojiUsage: document.getElementById('useEmojis').checked,
      emojiFrequency: parseInt(document.getElementById('emojiFrequency').value),
      funPinging: document.getElementById('funPinging').checked,
      proactivityLevel: parseInt(document.getElementById('proactivityLevel').value),
      randomReactions: document.getElementById('randomReactions').checked,
      commandPrecision: document.querySelector('input[name="commandPrecision"]:checked').value,
      customRules: customRulesArray,
      decisionFreedom: this.getActiveButtonValue('decisionFreedom'),
      expressOpinions: document.getElementById('expressOpinions').checked,
      moodSimulation: document.getElementById('moodSimulation').checked
    };
  }

  getActiveButtonValue(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return null;
    const activeBtn = group.querySelector('.btn.active');
    return activeBtn ? activeBtn.textContent.toLowerCase().trim() : null;
  }

  validateForm(data) {
    const errors = [];
    if (data.temperature < 0 || data.temperature > 2) errors.push('Temperature must be between 0 and 2');
    if (!['low', 'medium', 'high', 'maximum'].includes(data.creativity)) errors.push('Invalid creativity level');
    if (!['quick', 'balanced', 'deep', 'expert'].includes(data.smartnessMode)) errors.push('Invalid smartness mode');
    if (data.emojiFrequency < 0 || data.emojiFrequency > 100) errors.push('Emoji frequency must be between 0 and 100');
    if (data.proactivityLevel < 0 || data.proactivityLevel > 100) errors.push('Proactivity level must be between 0 and 100');
    if (!['strict', 'flexible'].includes(data.commandPrecision)) errors.push('Invalid command precision');
    if (!['low', 'medium', 'high'].includes(data.decisionFreedom)) errors.push('Invalid decision freedom level');
    return errors;
  }

  async saveSettings() {
    if (!this.selectedBotId) {
      this.showNotification('Please select a bot first', 'warning');
      return;
    }

    const data = this.gatherFormData();
    const errors = this.validateForm(data);
    if (errors.length > 0) {
      this.showNotification('Validation errors: ' + errors.join(', '), 'error');
      return;
    }

    const saveBtn = document.querySelector('button[onclick*="saveSettings"]');
    const originalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '💾 Saving...';
    }

    try {
      const response = await fetch(`/api/smartness/${this.selectedBotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const result = await response.json();
      this.currentSettings = result.settings;
      this.isDirty = false;
      this.clearDraft();
      this.showNotification('✅ Settings saved successfully!', 'success');
      this.showSuccessPopup();
      
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showNotification('❌ Failed to save settings: ' + error.message, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  }

  async resetToDefault() {
    if (!this.selectedBotId) {
      this.showNotification('Please select a bot first', 'warning');
      return;
    }

    const confirmed = window.confirm('⚠️ Are you sure you want to reset all settings to defaults?\n\nThis will permanently erase your custom configuration.');
    if (!confirmed) return;

    this.showLoading(true);

    try {
      const response = await fetch(`/api/smartness/${this.selectedBotId}/reset`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to reset settings');

      const result = await response.json();
      this.currentSettings = result.settings;
      this.populateForm(result.settings);
      this.isDirty = false;
      this.clearDraft();
      this.showNotification('🔄 Settings reset to defaults successfully!', 'success');
      
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showNotification('❌ Failed to reset settings: ' + error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async testConfiguration() {
    if (!this.selectedBotId) {
      this.showNotification('Please select a bot first', 'warning');
      return;
    }

    const testBtn = document.querySelector('button[onclick*="testConfiguration"]');
    const originalText = testBtn ? testBtn.textContent : '';
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = '🧪 Testing...';
    }

    const resultsSection = document.getElementById('testResults');
    const sampleResponse = document.getElementById('sampleResponse');
    
    if (resultsSection) {
      resultsSection.style.display = 'block';
      sampleResponse.innerHTML = '<p style="color: var(--text-secondary);">⏳ Generating test response...</p>';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const response = await fetch(`/api/smartness/${this.selectedBotId}/test`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to test configuration');

      const testData = await response.json();
      this.displayTestResults(testData);
      
    } catch (error) {
      console.error('Error testing configuration:', error);
      this.showNotification('❌ Failed to test configuration: ' + error.message, 'error');
      if (sampleResponse) {
        sampleResponse.innerHTML = '<p style="color: var(--danger);">Failed to generate test response</p>';
      }
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = originalText;
      }
    }
  }

  displayTestResults(testData) {
    const sampleResponse = document.getElementById('sampleResponse');
    if (!sampleResponse) return;

    let html = '<div style="animation: fadeIn 0.5s;">';
    html += `<h4 style="color: var(--text-primary); margin-bottom: 1rem;">🤖 ${testData.botName}</h4>`;
    html += `<div style="background: var(--darker); padding: 1rem; border-radius: 4px; border-left: 3px solid var(--primary); margin-bottom: 1rem;">`;
    html += `<strong style="color: var(--text-primary);">Sample Message:</strong><br>`;
    html += `<p style="color: var(--text-secondary); margin: 0.5rem 0;">"${testData.sampleBehavior.exampleMessage}"</p>`;
    html += `</div>`;
    
    html += `<div style="margin-bottom: 1rem;">`;
    html += `<strong style="color: var(--text-primary);">Response Style:</strong><ul style="margin: 0.5rem 0;">`;
    testData.sampleBehavior.responseStyle.forEach(style => {
      html += `<li style="color: var(--text-secondary);">${style}</li>`;
    });
    html += `</ul></div>`;
    
    if (testData.sampleBehavior.personalityTraits.length > 0) {
      html += `<div>`;
      html += `<strong style="color: var(--text-primary);">Personality Traits:</strong><ul style="margin: 0.5rem 0;">`;
      testData.sampleBehavior.personalityTraits.forEach(trait => {
        html += `<li style="color: var(--text-secondary);">${trait}</li>`;
      });
      html += `</ul></div>`;
    }
    
    html += `</div>`;
    sampleResponse.innerHTML = html;
  }

  toggleExpandableSection(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + 'Icon');
    if (content) {
      content.classList.toggle('show');
      if (icon) {
        icon.textContent = content.classList.contains('show') ? '▲' : '▼';
      }
    }
  }

  showConfigSections() {
    const sections = ['configSection', 'humanBehaviorSection', 'playfulSection', 'rulesSection', 'autonomySection', 'actionButtons'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === 'actionButtons' ? 'flex' : 'block';
    });
  }

  hideConfigSections() {
    const sections = ['configSection', 'humanBehaviorSection', 'playfulSection', 'rulesSection', 'autonomySection', 'actionButtons', 'testResults'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
    container.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    
    setTimeout(() => {
      container.innerHTML = '';
    }, 5000);
  }

  showSuccessPopup() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'success-popup-overlay';
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'success-popup';
    popup.innerHTML = `
      <div class="success-popup-icon"></div>
      <h2 class="success-popup-title">Settings Saved!</h2>
      <p class="success-popup-message">Your bot configuration has been updated successfully.</p>
    `;
    
    // Add to DOM
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    // Trigger animation
    setTimeout(() => {
      overlay.classList.add('show');
      popup.classList.add('show');
    }, 10);
    
    // Auto-dismiss after 2.5 seconds
    setTimeout(() => {
      overlay.classList.remove('show');
      popup.classList.remove('show');
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (popup.parentNode) popup.remove();
      }, 300);
    }, 2500);
    
    // Allow clicking overlay to dismiss
    overlay.addEventListener('click', () => {
      overlay.classList.remove('show');
      popup.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) overlay.remove();
        if (popup.parentNode) popup.remove();
      }, 300);
    });
  }

  showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
      loader.classList.toggle('show', show);
    }
  }

  markDirty() {
    this.isDirty = true;
  }

  updateCharacterCount() {
    const textarea = document.getElementById('customRules');
    if (!textarea) return;
    
    const lines = textarea.value.split('\n').filter(line => line.trim().length > 0);
    const count = lines.length;
    
    // Add character count display if needed
    console.log(`Custom rules: ${count} rules`);
  }

  startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      if (this.isDirty && this.selectedBotId) {
        this.saveDraft();
      }
    }, 30000); // Auto-save every 30 seconds
  }

  saveDraft() {
    if (!this.selectedBotId) return;
    
    try {
      const data = this.gatherFormData();
      const draft = {
        botId: this.selectedBotId,
        data: data,
        timestamp: Date.now()
      };
      localStorage.setItem(this.draftKey, JSON.stringify(draft));
      console.log('💾 Draft auto-saved');
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  }

  restoreDraft() {
    try {
      const draftStr = localStorage.getItem(this.draftKey);
      if (!draftStr) return;
      
      const draft = JSON.parse(draftStr);
      const age = Date.now() - draft.timestamp;
      
      // Only restore if less than 24 hours old
      if (age > 24 * 60 * 60 * 1000) {
        this.clearDraft();
        return;
      }
      
      // If we have a draft for the current bot, ask user
      if (draft.botId && age < 60 * 60 * 1000) { // Less than 1 hour old
        console.log('📋 Draft found from', new Date(draft.timestamp).toLocaleString());
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
  }

  clearDraft() {
    try {
      localStorage.removeItem(this.draftKey);
      console.log('🗑️ Draft cleared');
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }

  logout() {
    window.location.href = '/auth/logout';
  }
}

// Initialize the manager
const botSmartnessManager = new BotSmartnessManager();

// CSS for fade-in animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);