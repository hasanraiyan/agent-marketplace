// Provider type-aware setup: each native type maps to a dedicated LangChain
// chat model in agent.factory.js `_buildLLM`, and to its own model-listing
// strategy in provider.service.js. 'custom' preserves the original
// generic OpenAI-compatible Base URL flow unchanged.
export const PROVIDER_TYPES = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom'];

// Canonical base URL per native type, auto-filled server-side when a
// non-custom provider is created/updated without an explicit baseURL.
// 'custom' has no preset — the user must supply their own baseURL.
export const PROVIDER_TYPE_PRESETS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com',
  custom: null,
};
