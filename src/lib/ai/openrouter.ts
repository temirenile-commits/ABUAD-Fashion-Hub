import { MILES_AI_CONFIG } from '@/lib/ai/config';
import { AIProviderError, type AIMessage, type AIProvider, type AIProviderResult } from '@/lib/ai/provider-types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = MILES_AI_CONFIG.freeRouter;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const AUTH_COOLDOWN_MS = 6 * 60 * 60 * 1_000;
const TRANSIENT_COOLDOWN_MS = 60 * 1_000;

type KeyHealth = { failures: number; disabledUntil: number; lastFailureType?: string };
const keyHealth = new Map<number, KeyHealth>();
let rotationCursor = 0;

function configuredKeys() {
  const raw = [process.env.OPENROUTER_API_KEYS, process.env.OPENROUTER_API_KEY]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .flatMap((value) => value.split(/[\n,;]+/).map((key) => key.trim()).filter(Boolean));
  return [...new Set(raw)];
}

function cooldownFor(failureType: string) {
  if (failureType === 'INSUFFICIENT_BALANCE' || failureType === 'RATE_LIMIT') return DAILY_COOLDOWN_MS;
  if (failureType === 'AUTHENTICATION') return AUTH_COOLDOWN_MS;
  return TRANSIENT_COOLDOWN_MS;
}

function failureFromUpstream(status: number, upstreamCode: string, upstreamMessage: string) {
  const detail = upstreamMessage ? `: ${upstreamMessage}` : '.';
  if (status === 401 || status === 403 || /auth|invalid.*key|unauthorized/i.test(upstreamMessage)) {
    return new AIProviderError('OpenRouter authentication failed.', 'openrouter', 'AUTHENTICATION', false, true, status);
  }
  if (status === 402 || /credit|balance|free.*usage|quota/i.test(`${upstreamCode} ${upstreamMessage}`)) {
    return new AIProviderError(`OpenRouter quota is unavailable${detail}`, 'openrouter', 'INSUFFICIENT_BALANCE', true, true, status || 402);
  }
  if (status === 429 || /rate.?limit|too many/i.test(`${upstreamCode} ${upstreamMessage}`)) {
    return new AIProviderError(`OpenRouter rate limit reached${detail}`, 'openrouter', 'RATE_LIMIT', true, true, status || 429);
  }
  if (status === 400 || status === 404 || /model|endpoint|not found|unsupported/i.test(`${upstreamCode} ${upstreamMessage}`)) {
    return new AIProviderError(`OpenRouter model request was rejected${detail}`, 'openrouter', 'MODEL_UNAVAILABLE', true, true, status || 400);
  }
  return new AIProviderError(`OpenRouter returned an upstream error${detail}`, 'openrouter', 'PROVIDER_UNAVAILABLE', true, true, status || 502);
}

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter' as const;
  readonly model = OPENROUTER_MODEL;

  private async requestWithKey(apiKey: string, messages: AIMessage[], options?: { temperature?: number; maxTokens?: number; preferMultimodal?: boolean }): Promise<AIProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MILES_AI_CONFIG.timeoutMs);
    try {
      let response: Response;
      try {
        response = await fetch(OPENROUTER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://master-cart-reshuffled.vercel.app',
            'X-Title': 'MasterCart Miles',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            temperature: options?.temperature ?? 0.2,
            max_tokens: options?.maxTokens ?? 900,
            stream: false,
            reasoning: { exclude: true },
          }),
          signal: controller.signal,
          cache: 'no-store',
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new AIProviderError('OpenRouter timed out.', this.name, 'TIMEOUT', true, true, 'timeout');
        }
        throw new AIProviderError('OpenRouter could not be reached.', this.name, 'PROVIDER_UNAVAILABLE', true, true, 502);
      }

      const rawBody = await response.text();
      let payload: { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>; error?: { code?: string | number; message?: string } } = {};
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        throw new AIProviderError('OpenRouter returned malformed data.', this.name, 'UNKNOWN', true, true, 'malformed');
      }

      const upstreamCode = String(payload.error?.code || '').toLowerCase();
      const upstreamMessage = typeof payload.error?.message === 'string' ? payload.error.message.slice(0, 240) : '';
      if (!response.ok || payload.error) throw failureFromUpstream(response.status, upstreamCode, upstreamMessage);

      const rawContent = payload.choices?.[0]?.message?.content;
      const text = typeof rawContent === 'string'
        ? rawContent.trim()
        : Array.isArray(rawContent)
          ? rawContent.map((part) => typeof part?.text === 'string' ? part.text : '').join('').trim()
          : '';
      if (!text) throw new AIProviderError('OpenRouter returned an empty response.', this.name, 'UNKNOWN', true, true, 'malformed');
      return { text, model: this.model, provider: this.name };
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateResponse(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number; preferMultimodal?: boolean }): Promise<AIProviderResult> {
    const keys = configuredKeys();
    if (!keys.length) throw new AIProviderError('OpenRouter is not configured on the server.', this.name, 'PROVIDER_UNAVAILABLE', false, true, 500);

    const now = Date.now();
    const start = rotationCursor % keys.length;
    const failures: AIProviderError[] = [];
    for (let offset = 0; offset < keys.length; offset += 1) {
      const index = (start + offset) % keys.length;
      const health = keyHealth.get(index);
      if (health && health.disabledUntil > now) continue;
      try {
        const result = await this.requestWithKey(keys[index], messages, options);
        rotationCursor = (index + 1) % keys.length;
        keyHealth.set(index, { failures: 0, disabledUntil: 0 });
        console.info('[OPENROUTER_KEY_SUCCESS]', { keyIndex: index, keyCount: keys.length, model: this.model });
        return result;
      } catch (error) {
        const failure = error instanceof AIProviderError
          ? error
          : new AIProviderError('OpenRouter key request failed.', this.name, 'UNKNOWN', true, true);
        failures.push(failure);
        keyHealth.set(index, { failures: (health?.failures || 0) + 1, disabledUntil: Date.now() + cooldownFor(failure.failureType), lastFailureType: failure.failureType });
        console.warn('[OPENROUTER_KEY_FAILURE]', { keyIndex: index, keyCount: keys.length, failureType: failure.failureType, status: failure.status, cooldownMs: cooldownFor(failure.failureType) });
      }
    }

    const lastFailure = failures[failures.length - 1];
    throw new AIProviderError(
      `OpenRouter key rotation exhausted after ${keys.length} configured key${keys.length === 1 ? '' : 's'}${lastFailure ? `; last failure: ${lastFailure.message.slice(0, 180)}` : ''}`,
      this.name,
      lastFailure?.failureType || 'PROVIDER_UNAVAILABLE',
      true,
      true,
      lastFailure?.status || 502,
    );
  }
}

export function getConfiguredOpenRouterKeyCount() {
  return configuredKeys().length;
}
