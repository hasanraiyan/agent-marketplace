import config from './index.js';

export function getAiRuntimeConfig() {
  return config.ai;
}

export function assertProviderApiKey(provider) {
  const aiConfig = getAiRuntimeConfig();

  if (provider === 'openai' && !aiConfig.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required to run the OpenAI-backed AI examples.');
  }

  if (provider === 'anthropic' && !aiConfig.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to run the Anthropic-backed AI examples.');
  }

  return aiConfig;
}

const aiConfig = {
  ...config.ai,
  getAiRuntimeConfig,
  assertProviderApiKey,
};

export default aiConfig;
