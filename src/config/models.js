/**
 * Centralized AI model registry — single source of truth.
 * When adding a new model, ONLY this file needs to be updated.
 */

const AI_MODELS = [
  // OpenAI
  { id: 'provider-3/gpt-4o-mini', name: 'GPT-4o Mini', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
  { id: 'provider-3/gpt-5-nano', name: 'GPT-5 Nano', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
  { id: 'provider-1/gpt-oss-20b', name: 'GPT OSS 20B', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },
  { id: 'provider-3/gpt-4.1-nano', name: 'GPT-4.1 Nano', company: 'OpenAI', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/openai.svg' },

  // DeepSeek
  { id: 'provider-1/deepseek-r1-distill-qwen-1.5b', name: 'DeepSeek R1 Distill Qwen 1.5B', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
  { id: 'provider-1/deepseek-v3.1', name: 'DeepSeek V3.1', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
  { id: 'provider-1/deepseek-v3.1-turbo', name: 'DeepSeek V3.1 Turbo', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },
  { id: 'provider-1/deepseek-tng-r1t2-chimera', name: 'DeepSeek TNG R1T2 Chimera', company: 'DeepSeek', logo: 'https://deepseek.com/favicon.ico' },

  // Google
  { id: 'provider-1/gemma-3-4b-it', name: 'Gemma 3 4B IT', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
  { id: 'provider-3/gemini-2.5-flash-lite-preview-09-2025', name: 'Gemini 2.5 Flash Lite Preview', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
  { id: 'provider-6/gemma-3-27b-instruct', name: 'Gemma 3 27B Instruct', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },
  { id: 'provider-1/gemma-2-9b-it', name: 'Gemma 2 9B IT', company: 'Google', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/google.svg' },

  // InferenceNet
  { id: 'provider-6/cliptagger-12b', name: 'ClipTagger 12B', company: 'InferenceNet', logo: 'https://avatars.githubusercontent.com/u/132372032?s=200&v=4' },

  // Meta
  { id: 'provider-1/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B 16E Instruct', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
  { id: 'provider-1/llama-3.2-1b-instruct-fp-16', name: 'Llama 3.2 1B Instruct FP-16', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
  { id: 'provider-3/llama-4-scout', name: 'Llama 4 Scout', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
  { id: 'provider-1/deephermes-3-llama-3-8b-preview', name: 'DeepHermes 3 Llama 3 8B Preview', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },
  { id: 'provider-1/shisa-v2-llama3.3-70b', name: 'Shisa V2 Llama3.3 70B', company: 'Meta', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/meta.svg' },

  // Mistral
  { id: 'provider-6/mistral-nemo-12b-instruct', name: 'Mistral Nemo 12B Instruct', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
  { id: 'provider-1/mistralai-devstral-small-2505', name: 'MistralAI Devstral Small 2505', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
  { id: 'provider-1/chutesai-devstral-small-2505', name: 'ChutesAI Devstral Small 2505', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },
  { id: 'provider-1/mistral-small-3.2-24b-instruct-2506', name: 'Mistral Small 3.2 24B Instruct 2506', company: 'Mistral', logo: 'https://mistral.ai/images/logo_hubc88c4ece131b91c7cb753f40e9e1cc5_2589_256x0_resize_q97_h2_lanczos_3.webp' },

  // MoonShot AI
  { id: 'provider-1/kimi-k2-instruct', name: 'Kimi K2 Instruct', company: 'MoonShot AI', logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4' },
  { id: 'provider-1/kimi-vl-a3b-thinking', name: 'Kimi VL A3B Thinking', company: 'MoonShot AI', logo: 'https://avatars.githubusercontent.com/u/142705063?s=200&v=4' },

  // Qwen
  { id: 'provider-1/qwen3-4b-thinking-2507', name: 'Qwen3 4B Thinking 2507', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
  { id: 'provider-6/qwen2.5-7b-instruct', name: 'Qwen2.5 7B Instruct', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
  { id: 'provider-1/qwen3-8b', name: 'Qwen3 8B', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },
  { id: 'provider-3/qwen-2.5-72b', name: 'Qwen 2.5 72B', company: 'Qwen', logo: 'https://qianwen-res.oss-cn-beijing.aliyuncs.com/Qwen-VL/assets/logo.jpeg' },

  // xAI
  { id: 'provider-5/grok-4-0709', name: 'Grok 4 0709', company: 'xAI', logo: 'https://x.ai/favicon.ico' },

  // Zhipu AI
  { id: 'provider-1/glm-4.6', name: 'GLM 4.6', company: 'Zhipu AI', logo: 'https://open.bigmodel.cn/static/zhipuai.png' },
  { id: 'glm-4.5v', name: 'GLM 4.5V', company: 'Zhipu AI', logo: 'https://open.bigmodel.cn/static/zhipuai.png' },

  // Anthropic (Custom Router)
  { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', company: 'Anthropic', logo: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/anthropic.svg' },
];

/** All valid model IDs for schema validation */
const MODEL_IDS = AI_MODELS.map(m => m.id);

/** All valid display names for schema validation */
const MODEL_DISPLAY_NAMES = AI_MODELS.map(m => m.name);

/** Map of model ID -> display name */
const MODEL_ID_TO_NAME = Object.fromEntries(AI_MODELS.map(m => [m.id, m.name]));

/** Map of display name -> model ID */
const MODEL_NAME_TO_ID = Object.fromEntries(AI_MODELS.map(m => [m.name, m.id]));

/** Default model ID */
const DEFAULT_MODEL_ID = 'provider-3/gpt-4o-mini';

/** Default display name */
const DEFAULT_MODEL_NAME = 'GPT-4o Mini';

module.exports = {
  AI_MODELS,
  MODEL_IDS,
  MODEL_DISPLAY_NAMES,
  MODEL_ID_TO_NAME,
  MODEL_NAME_TO_ID,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_NAME,
};
