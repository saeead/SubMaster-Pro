import { AIProvider, TranslationSpeedMode, UserAPIKey } from '../types';
import { RATE_LIMIT_CONFIG } from '../constants';

export interface AdaptiveDelayInput {
  provider: AIProvider;
  speedMode?: TranslationSpeedMode;
  consecutiveSuccesses?: number;
  wasRateLimited?: boolean;
  wasOverloaded?: boolean;
}

/** Compute inter-batch wait. Returns 0 when no wait is useful (e.g. local). */
export function getAdaptiveBatchDelay(input: AdaptiveDelayInput): number {
  const {
    provider,
    speedMode = 'quality',
    consecutiveSuccesses = 0,
    wasRateLimited = false,
    wasOverloaded = false,
  } = input;

  if (wasOverloaded) return RATE_LIMIT_CONFIG.overloadBackoffMs;
  if (wasRateLimited) return RATE_LIMIT_CONFIG.rateLimitBackoffMs;
  if (provider === 'lm_studio') return RATE_LIMIT_CONFIG.localSuccessMs;

  const fast = speedMode === 'fast';
  if (provider === 'openai_compatible') {
    const min = fast ? RATE_LIMIT_CONFIG.fastSuccessMinMs : RATE_LIMIT_CONFIG.openAiSuccessMinMs;
    const max = fast ? RATE_LIMIT_CONFIG.fastSuccessMaxMs : RATE_LIMIT_CONFIG.openAiSuccessMaxMs;
    const t = Math.min(1, consecutiveSuccesses / 6);
    return Math.round(max - t * (max - min));
  }

  const min = fast ? RATE_LIMIT_CONFIG.fastSuccessMinMs : RATE_LIMIT_CONFIG.successMinMs;
  const max = fast ? RATE_LIMIT_CONFIG.fastSuccessMaxMs : RATE_LIMIT_CONFIG.successMaxMs;
  const t = Math.min(1, consecutiveSuccesses / 8);
  return Math.round(max - t * (max - min));
}

/** Max parallel in-file batches; capped by available Gemini keys. */
export function getBatchConcurrency(provider: AIProvider, apiKeys: UserAPIKey[]): number {
  const cap = RATE_LIMIT_CONFIG.maxConcurrency;
  if (provider === 'lm_studio') return 1;
  if (provider === 'openai_compatible') return Math.min(2, cap);
  const available = apiKeys.filter(k => k.isValid && !k.isRateLimited).length;
  if (available <= 1) return 1;
  return Math.min(cap, available);
}
