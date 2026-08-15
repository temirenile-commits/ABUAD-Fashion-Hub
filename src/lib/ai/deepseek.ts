const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

import type { AIMessage } from '@/lib/ai/provider-types';

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function toDeepSeekMessages(messages: AIMessage[]): DeepSeekMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: typeof message.content === 'string'
      ? message.content
      : message.content.map((part) => part.type === 'text' ? part.text : `[Uploaded image: ${part.image_url.url}]`).join(' '),
  }));
}

export class DeepSeekProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number | 'timeout' | 'malformed',
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = 'DeepSeekProviderError';
  }
}

export async function deepseekChat(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number; preferMultimodal?: boolean }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new DeepSeekProviderError('DeepSeek is not configured on the server.', 500, 'AI_PROVIDER_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    let response: Response;
    try {
      response = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: toDeepSeekMessages(messages),
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 900,
          stream: false,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DeepSeekProviderError('DeepSeek timed out before returning a response.', 'timeout', 'AI_PROVIDER_TIMEOUT');
      }
      throw new DeepSeekProviderError('DeepSeek could not be reached.', 502, 'AI_PROVIDER_UNREACHABLE');
    }

    const rawBody = await response.text();
    let payload: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string; code?: string } } = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      throw new DeepSeekProviderError('DeepSeek returned a malformed response.', 'malformed', 'AI_PROVIDER_MALFORMED_RESPONSE');
    }

    if (!response.ok) {
      const providerCode = payload.error?.code;
      if (response.status === 402) {
        throw new DeepSeekProviderError('DeepSeek API balance is insufficient for this request.', 402, 'AI_PROVIDER_BALANCE');
      }
      if (response.status === 401 || response.status === 403) {
        throw new DeepSeekProviderError('DeepSeek rejected the server credential.', response.status, 'AI_PROVIDER_AUTH');
      }
      if (response.status === 429) {
        throw new DeepSeekProviderError('DeepSeek rate or usage limits were reached.', 429, 'AI_PROVIDER_RATE_LIMIT');
      }
      if (response.status >= 400 && response.status < 500) {
        throw new DeepSeekProviderError('DeepSeek rejected the request.', response.status, providerCode || 'AI_PROVIDER_REQUEST');
      }
      throw new DeepSeekProviderError('DeepSeek returned an upstream server error.', response.status, 'AI_PROVIDER_UPSTREAM');
    }

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new DeepSeekProviderError('DeepSeek returned an empty response.', 'malformed', 'AI_PROVIDER_EMPTY_RESPONSE');
    return { text, model: DEEPSEEK_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}
