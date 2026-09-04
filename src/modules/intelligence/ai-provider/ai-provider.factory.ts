import type { AIProvider } from '@/modules/intelligence/ai-provider/ai-provider.interface.js';
import { GeminiAIProvider } from '@/modules/intelligence/ai-provider/gemini.provider.js';
import { RuleBasedAIProvider } from '@/modules/intelligence/ai-provider/rule-based.provider.js';
import { env } from '@/config/env.js';
import { logger } from '@/utils/logger.js';

let cachedProvider: AIProvider | null = null;

/**
 * Gemini is the primary provider when an API key is configured.
 * Rule-based AI is only used inside GeminiAIProvider after a failed API call,
 * or when AI_PROVIDER=RULE_BASED (or no API key).
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = resolveAIProvider();
    logger.info('AI provider initialized', {
      provider: cachedProvider.config.provider,
      model: cachedProvider.config.modelName,
      geminiConfigured: Boolean(env.gemini.apiKey),
    });
  }
  return cachedProvider;
}

function resolveAIProvider(): AIProvider {
  const forceRulesOnly = env.aiProvider === 'RULE_BASED' || !env.gemini.apiKey;

  if (forceRulesOnly) {
    if (env.aiProvider === 'GEMINI' && !env.gemini.apiKey) {
      logger.warn('AI_PROVIDER=GEMINI but GEMINI_API_KEY is missing — using rule-based only');
    }
    return new RuleBasedAIProvider();
  }

  logger.info('Gemini AI enabled', { model: env.gemini.model });
  return new GeminiAIProvider();
}

export function resetAIProviderForTests(): void {
  cachedProvider = null;
}
