const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function deepseekChat(messages: DeepSeekMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured on the server.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 900,
        stream: false,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const providerStatus = response.status;
      console.error('[DEEPSEEK] Provider request failed with status', providerStatus);
      throw new Error('DeepSeek provider request failed.');
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('DeepSeek returned an empty response.');
    return { text, model: DEEPSEEK_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}
