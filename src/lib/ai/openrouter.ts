import { MILES_AI_CONFIG } from '@/lib/ai/config';
import { AIProviderError, type AIMessage, type AIProvider, type AIProviderResult } from '@/lib/ai/provider-types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = MILES_AI_CONFIG.freeRouter;

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter' as const;
  readonly model = OPENROUTER_MODEL;

  async generateResponse(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number; preferMultimodal?: boolean }): Promise<AIProviderResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new AIProviderError('OpenRouter is not configured.', this.name, 'PROVIDER_UNAVAILABLE', false, false, 500);
    }

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
      if (!response.ok || payload.error) {
        if (response.status === 401 || response.status === 403 || /auth|invalid.*key|unauthorized/i.test(upstreamMessage)) {
          throw new AIProviderError('OpenRouter authentication failed.', this.name, 'AUTHENTICATION', false, false, response.status);
        }
        if (response.status === 402 || /credit|balance|free.*usage|quota/i.test(`${upstreamCode} ${upstreamMessage}`)) {
          throw new AIProviderError(`OpenRouter free usage is unavailable${upstreamMessage ? `: ${upstreamMessage}` : '.'}`, this.name, 'INSUFFICIENT_BALANCE', true, true, response.status || 402);
        }
        if (response.status === 429 || /rate.?limit|too many/i.test(`${upstreamCode} ${upstreamMessage}`)) {
          throw new AIProviderError('OpenRouter free usage is rate limited.', this.name, 'RATE_LIMIT', true, true, response.status);
        }
        if (response.status === 400 || response.status === 404 || /model|endpoint|not found|unsupported/i.test(`${upstreamCode} ${upstreamMessage}`)) {
          throw new AIProviderError(`OpenRouter model request was rejected${upstreamMessage ? `: ${upstreamMessage}` : '.'}`, this.name, 'MODEL_UNAVAILABLE', true, true, response.status || 400);
        }
        throw new AIProviderError(`OpenRouter returned an upstream error${upstreamMessage ? `: ${upstreamMessage}` : '.'}`, this.name, 'PROVIDER_UNAVAILABLE', true, true, response.status || 502);
      }

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
}
