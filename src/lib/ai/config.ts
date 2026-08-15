import type { AIProviderName, AIProviderState } from '@/lib/ai/provider-types';

export const MILES_AI_CONFIG = {
  gateway: 'server-provider-router',
  defaultRoute: 'openrouter' as AIProviderName,
  freeRouter: (process.env.OPENROUTER_MODEL || 'openrouter/free').trim(),
  fallbackRoutes: ['deepseek'] as AIProviderName[],
  enabledProviders: ['deepseek', 'openrouter'] as AIProviderName[],
  providerStates: {
    deepseek: 'fallback',
    openrouter: 'active',
    openai: 'inactive',
    gemini: 'inactive',
    claude: 'inactive',
    future: 'inactive',
  } as Record<AIProviderName, AIProviderState>,
  capabilities: {
    readOnlyContext: true,
    roleAwareTools: true,
    scopeAwareTools: true,
    confirmationGatedMutations: true,
    vendorScopedTools: false,
    toolsAreMutationFree: false,
  },
  timeoutMs: 25_000,
  retryPolicy: {
    providerAttempts: 1,
    retrySameProvider: false,
    fallbackOnRetryableFailure: true,
  },
  costPolicy: {
    allowPaidOpenRouterModels: false,
    allowAutomaticPurchases: false,
    allowAutomaticBilling: false,
  },
} as const;

export function configuredProviderPriority(): AIProviderName[] {
  const configured = (process.env.AI_PROVIDER_PRIORITY || [MILES_AI_CONFIG.defaultRoute, ...MILES_AI_CONFIG.fallbackRoutes].join(','))
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AIProviderName => (MILES_AI_CONFIG.enabledProviders as readonly string[]).includes(value));
  const requested = configured.length ? configured : [MILES_AI_CONFIG.defaultRoute, ...MILES_AI_CONFIG.fallbackRoutes];
  return [MILES_AI_CONFIG.defaultRoute, ...new Set(requested.filter((provider) => provider !== MILES_AI_CONFIG.defaultRoute))];
}
