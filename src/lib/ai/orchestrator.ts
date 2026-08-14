import { deepseekChat, DeepSeekProviderError } from '@/lib/ai/deepseek';
import { configuredProviderPriority, MILES_AI_CONFIG } from '@/lib/ai/config';
import { OpenRouterProvider } from '@/lib/ai/openrouter';
import {
  AIOrchestrationError,
  AIProviderError,
  type AIMessage,
  type AIProviderName,
  type AIProviderResult,
} from '@/lib/ai/provider-types';

function normalizeDeepSeekError(error: DeepSeekProviderError): AIProviderError {
  const code = error.providerCode;
  const type = code === 'AI_PROVIDER_BALANCE'
    ? 'INSUFFICIENT_BALANCE'
    : code === 'AI_PROVIDER_AUTH'
      ? 'AUTHENTICATION'
      : code === 'AI_PROVIDER_RATE_LIMIT'
        ? 'RATE_LIMIT'
        : code === 'AI_PROVIDER_TIMEOUT'
          ? 'TIMEOUT'
          : code === 'AI_PROVIDER_REQUEST'
            ? 'INVALID_REQUEST'
            : code === 'AI_PROVIDER_NOT_CONFIGURED' || code === 'AI_PROVIDER_UNREACHABLE'
              ? 'PROVIDER_UNAVAILABLE'
              : 'UNKNOWN';
  const retryable = type !== 'AUTHENTICATION' && type !== 'INVALID_REQUEST';
  return new AIProviderError(error.message, 'deepseek', type, retryable, retryable, error.status);
}

function deepseekProvider() {
  return {
    name: 'deepseek' as const,
    model: 'deepseek-chat',
    async generateResponse(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<AIProviderResult> {
      try {
        const result = await deepseekChat(messages, options);
        return { ...result, provider: 'deepseek' };
      } catch (error) {
        if (error instanceof DeepSeekProviderError) throw normalizeDeepSeekError(error);
        throw new AIProviderError('DeepSeek failed unexpectedly.', 'deepseek', 'UNKNOWN', true, true);
      }
    },
  };
}

function providers(): Partial<Record<AIProviderName, { name: AIProviderName; model: string; generateResponse: (messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }) => Promise<AIProviderResult> }>> {
  return { deepseek: deepseekProvider(), openrouter: new OpenRouterProvider() };
}

export async function milesChat(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const available = providers();
  const failures: Array<Pick<AIProviderError, 'provider' | 'failureType'>> = [];

  const priority = configuredProviderPriority();
  for (const providerName of priority) {
    try {
      const provider = available[providerName];
      if (!provider) {
        failures.push({ provider: providerName, failureType: 'PROVIDER_UNAVAILABLE' });
        continue;
      }
      const result = await provider.generateResponse(messages, options);
      console.info('[AI_PROVIDER_SUCCESS]', { provider: providerName, fallbackAttempted: failures.length > 0 });
      return result;
    } catch (error) {
      const normalized = error instanceof AIProviderError
        ? error
        : new AIProviderError('Provider failed unexpectedly.', providerName, 'UNKNOWN', true, true);
      failures.push({ provider: providerName, failureType: normalized.failureType });
      console.error('[AI_PROVIDER_FAILURE]', {
        provider: providerName,
        failureType: normalized.failureType,
        fallbackAttempted: true,
        fallbackProvider: priority.find((candidate) => candidate !== providerName),
      });
      if (!normalized.fallbackAllowed || !MILES_AI_CONFIG.retryPolicy.fallbackOnRetryableFailure) break;
    }
  }

  throw new AIOrchestrationError(failures);
}
