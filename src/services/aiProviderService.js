const axios = require('axios');

class AIProviderService {
  constructor() {
    // Primary API credentials from environment variables
    this.primaryApiKey = process.env.PRIMARY_API_KEY || '';
    this.backupApiKey = process.env.BACKUP_API_KEY || '';
    this.currentApiKey = this.primaryApiKey;
    this.baseUrl = process.env.PRIMARY_BASE_URL || 'https://api.openai.com/v1';

    // Custom model providers with their own API configs
    this.customProviders = {
      'glm-4.5v': {
        baseUrl: process.env.ZHIPU_API_BASE_URL || 'https://api.z.ai/api/coding/paas/v4',
        apiKey: process.env.ZHIPU_API_KEY || '',
        type: 'openai'
      },
      'claude-3-7-sonnet-20250219': {
        baseUrl: process.env.ANTHROPIC_ROUTER_BASE_URL || '',
        apiKey: process.env.ANTHROPIC_ROUTER_API_KEY || '',
        type: 'anthropic'
      }
    };

    if (!this.primaryApiKey) {
      console.warn('⚠️ PRIMARY_API_KEY not set. AI model requests will fail.');
    }
  }

  /**
   * Switch to backup API key when primary key hits limits
   */
  switchToBackupKey() {
    if (this.currentApiKey === this.primaryApiKey) {
      console.log('Switching to backup API key due to rate limits');
      this.currentApiKey = this.backupApiKey;
    }
  }

  /**
   * Reset to primary API key
   */
  resetToPrimaryKey() {
    this.currentApiKey = this.primaryApiKey;
  }

  /**
   * Make API request with automatic fallback to backup key and model fallback
   * @param {Function} apiCall - The API call function to execute
   * @param {string} originalModel - The original model requested (for fallback)
   * @returns {Promise<Object>} - The API response
   */
  async makeApiRequest(apiCall, originalModel = null) {
    try {
      return await apiCall(this.currentApiKey);
    } catch (error) {
      console.error('API Error:', error.response?.status, error.response?.data);

      // Check if it's a rate limit error and we're using primary key
      if (error.response?.status === 429 && this.currentApiKey === this.primaryApiKey) {
        console.log('Rate limit hit on primary API key, switching to backup');
        this.switchToBackupKey();
        return await apiCall(this.currentApiKey);
      }

      // Check if it's a 403 error and we have a fallback model
      if (error.response?.status === 403 && originalModel && this.fallbackModels[originalModel]) {
        console.log(`Model ${originalModel} not accessible, trying fallback: ${this.fallbackModels[originalModel]}`);
        // Try with fallback model
        return await apiCall(this.currentApiKey, this.fallbackModels[originalModel]);
      }

      throw error;
    }
  }

  /**
   * Get available models from API
   * @returns {Promise<Array>} List of available models
   */
  async getModels() {
    return this.makeApiRequest(async (apiKey) => {
      const response = await axios.get(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.data;
    });
  }

  /**
   * Send a chat completion request to API or custom provider
   * @param {string} model - The model ID to use
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<Object>} - The API response
   */
  async createChatCompletion(model, messages, options = {}) {
    // Check if this model uses a custom provider
    if (this.customProviders[model]) {
      return this.createCustomProviderCompletion(model, messages, options);
    }

    return this.makeApiRequest(async (apiKey) => {
      const payload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 500,
        stream: options.stream || false,
        ...options
      };

      try {
        const response = await axios.post(`${this.baseUrl}/chat/completions`, payload, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        return response.data;
      } catch (error) {
        console.error('API Error:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        throw error;
      }
    });
  }

  /**
   * Send a chat completion request to a custom provider
   * @param {string} model - The model ID to use
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<Object>} - The API response
   */
  async createCustomProviderCompletion(model, messages, options = {}) {
    const provider = this.customProviders[model];
    
    // Handle Anthropic API format
    if (provider.type === 'anthropic') {
      return this.createAnthropicCompletion(model, messages, options, provider);
    }
    
    // Default: OpenAI-compatible format
    // Cap temperature for Zhipu AI (max 0.99)
    let temperature = options.temperature || 0.7;
    if (model.startsWith('glm-')) {
      temperature = Math.min(temperature, 0.99);
    }
    
    const payload = {
      model,
      messages,
      temperature,
      max_tokens: options.max_tokens || 500,
      stream: options.stream || false
    };

    try {
      const response = await axios.post(`${provider.baseUrl}/chat/completions`, payload, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Custom Provider (${model}) API Error:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Send a chat completion request to Anthropic API
   * @param {string} model - The model ID to use
   * @param {Array} messages - Array of message objects (OpenAI format)
   * @param {Object} options - Additional options for the API call
   * @param {Object} provider - Provider config
   * @returns {Promise<Object>} - The API response in OpenAI format
   */
  async createAnthropicCompletion(model, messages, options, provider) {
    // Convert OpenAI messages format to Anthropic format
    // Extract system message if present
    let systemPrompt = '';
    const anthropicMessages = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    const payload = {
      model,
      max_tokens: options.max_tokens || 1024,
      messages: anthropicMessages
    };

    // Add system prompt if present
    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    // Add temperature if not default (Anthropic default is 1.0)
    if (options.temperature !== undefined) {
      payload.temperature = Math.min(options.temperature, 1.0); // Anthropic max is 1.0
    }

    try {
      const response = await axios.post(`${provider.baseUrl}/v1/messages`, payload, {
        headers: {
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });

      // Convert Anthropic response to OpenAI format for compatibility
      const anthropicResponse = response.data;
      
      return {
        id: anthropicResponse?.id || 'unknown',
        object: 'chat.completion',
        created: Date.now(),
        model: anthropicResponse?.model || model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: anthropicResponse?.content?.[0]?.text || anthropicResponse?.content || ''
          },
          finish_reason: anthropicResponse?.stop_reason === 'end_turn' ? 'stop' : (anthropicResponse?.stop_reason || 'stop')
        }],
        usage: {
          prompt_tokens: anthropicResponse?.usage?.input_tokens || 0,
          completion_tokens: anthropicResponse?.usage?.output_tokens || 0,
          total_tokens: (anthropicResponse?.usage?.input_tokens || 0) + (anthropicResponse?.usage?.output_tokens || 0)
        }
      };
    } catch (error) {
      console.error(`Anthropic API (${model}) Error:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Get model display name from internal model ID
   * @param {string} modelId - The internal model ID
   * @returns {string} - The display name for the model
   */
  getModelDisplayName(modelId) {
    const modelMap = {
      'claude-opus-4': 'Claude Opus 4',
      'claude-sonnet-4': 'Claude Sonnet 4',
      'provider-6/claude-opus-4-20250514': 'Claude Opus 4',
      'provider-3/gpt-4o-mini': 'GPT-4o Mini',
      'provider-3/gpt-5-nano': 'GPT-5 Nano',
      // DeepSeek
      'provider-1/deepseek-r1-distill-qwen-1.5b': 'DeepSeek R1 Distill Qwen 1.5B',
      'provider-1/deepseek-v3.1': 'DeepSeek V3.1',
      'provider-1/deepseek-v3.1-turbo': 'DeepSeek V3.1 Turbo',
      'provider-1/deepseek-tng-r1t2-chimera': 'DeepSeek TNG R1T2 Chimera',
      // Google
      'provider-1/gemma-3-4b-it': 'Gemma 3 4B IT',
      'provider-3/gemini-2.5-flash-lite-preview-09-2025': 'Gemini 2.5 Flash Lite Preview',
      'provider-6/gemma-3-27b-instruct': 'Gemma 3 27B Instruct',
      'provider-1/gemma-2-9b-it': 'Gemma 2 9B IT',
      // InferenceNet
      'provider-6/cliptagger-12b': 'ClipTagger 12B',
      // Meta
      'provider-1/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B 16E Instruct',
      'provider-1/llama-3.2-1b-instruct-fp-16': 'Llama 3.2 1B Instruct FP-16',
      'provider-3/llama-4-scout': 'Llama 4 Scout',
      'provider-1/deephermes-3-llama-3-8b-preview': 'DeepHermes 3 Llama 3 8B Preview',
      'provider-1/shisa-v2-llama3.3-70b': 'Shisa V2 Llama3.3 70B',
      // Mistral
      'provider-6/mistral-nemo-12b-instruct': 'Mistral Nemo 12B Instruct',
      'provider-1/mistralai-devstral-small-2505': 'MistralAI Devstral Small 2505',
      'provider-1/chutesai-devstral-small-2505': 'ChutesAI Devstral Small 2505',
      'provider-1/mistral-small-3.2-24b-instruct-2506': 'Mistral Small 3.2 24B Instruct 2506',
      // MoonShot AI
      'provider-1/kimi-k2-instruct': 'Kimi K2 Instruct',
      'provider-1/kimi-vl-a3b-thinking': 'Kimi VL A3B Thinking',
      // OpenAI
      'provider-1/gpt-oss-20b': 'GPT OSS 20B',
      'provider-3/gpt-4.1-nano': 'GPT-4.1 Nano',
      // Qwen
      'provider-1/qwen3-4b-thinking-2507': 'Qwen3 4B Thinking 2507',
      'provider-6/qwen2.5-7b-instruct': 'Qwen2.5 7B Instruct',
      'provider-1/qwen3-8b': 'Qwen3 8B',
      'provider-3/qwen-2.5-72b': 'Qwen 2.5 72B',
      // xAI
      'provider-5/grok-4-0709': 'Grok 4 0709',
      // Zhipu AI
      'provider-1/glm-4.6': 'GLM 4.6',
      'glm-4.5v': 'GLM 4.5V',
      // Anthropic (Custom Router)
      'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet'
    };
    
    return modelMap[modelId] || 'Unknown Model';
  }

  /**
   * Get internal model ID from display name
   * @param {string} displayName - The display name
   * @returns {string} - The internal model ID
   */
  getModelIdFromDisplayName(displayName) {
    const displayNameMap = {
      'Claude Opus 4': 'claude-opus-4',
      'Claude Sonnet 4': 'claude-sonnet-4',
      'GPT-4o Mini': 'provider-3/gpt-4o-mini',
      'GPT-5 Nano': 'provider-3/gpt-5-nano',
      // DeepSeek
      'DeepSeek R1 Distill Qwen 1.5B': 'provider-1/deepseek-r1-distill-qwen-1.5b',
      'DeepSeek V3.1': 'provider-1/deepseek-v3.1',
      'DeepSeek V3.1 Turbo': 'provider-1/deepseek-v3.1-turbo',
      'DeepSeek TNG R1T2 Chimera': 'provider-1/deepseek-tng-r1t2-chimera',
      // Google
      'Gemma 3 4B IT': 'provider-1/gemma-3-4b-it',
      'Gemini 2.5 Flash Lite Preview': 'provider-3/gemini-2.5-flash-lite-preview-09-2025',
      'Gemma 3 27B Instruct': 'provider-6/gemma-3-27b-instruct',
      'Gemma 2 9B IT': 'provider-1/gemma-2-9b-it',
      // InferenceNet
      'ClipTagger 12B': 'provider-6/cliptagger-12b',
      // Meta
      'Llama 4 Scout 17B 16E Instruct': 'provider-1/llama-4-scout-17b-16e-instruct',
      'Llama 3.2 1B Instruct FP-16': 'provider-1/llama-3.2-1b-instruct-fp-16',
      'Llama 4 Scout': 'provider-3/llama-4-scout',
      'DeepHermes 3 Llama 3 8B Preview': 'provider-1/deephermes-3-llama-3-8b-preview',
      'Shisa V2 Llama3.3 70B': 'provider-1/shisa-v2-llama3.3-70b',
      // Mistral
      'Mistral Nemo 12B Instruct': 'provider-6/mistral-nemo-12b-instruct',
      'MistralAI Devstral Small 2505': 'provider-1/mistralai-devstral-small-2505',
      'ChutesAI Devstral Small 2505': 'provider-1/chutesai-devstral-small-2505',
      'Mistral Small 3.2 24B Instruct 2506': 'provider-1/mistral-small-3.2-24b-instruct-2506',
      // MoonShot AI
      'Kimi K2 Instruct': 'provider-1/kimi-k2-instruct',
      'Kimi VL A3B Thinking': 'provider-1/kimi-vl-a3b-thinking',
      // OpenAI
      'GPT OSS 20B': 'provider-1/gpt-oss-20b',
      'GPT-4.1 Nano': 'provider-3/gpt-4.1-nano',
      // Qwen
      'Qwen3 4B Thinking 2507': 'provider-1/qwen3-4b-thinking-2507',
      'Qwen2.5 7B Instruct': 'provider-6/qwen2.5-7b-instruct',
      'Qwen3 8B': 'provider-1/qwen3-8b',
      'Qwen 2.5 72B': 'provider-3/qwen-2.5-72b',
      // xAI
      'Grok 4 0709': 'provider-5/grok-4-0709',
      // Zhipu AI
      'GLM 4.6': 'provider-1/glm-4.6',
      'GLM 4.5V': 'glm-4.5v',
      // Anthropic (Custom Router)
      'Claude 3.7 Sonnet': 'claude-3-7-sonnet-20250219'
    };
    
    return displayNameMap[displayName] || displayName;
  }
}

module.exports = new AIProviderService();