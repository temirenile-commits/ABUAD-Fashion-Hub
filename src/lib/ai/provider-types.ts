export type AIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AIMessagePart[];
};

export type AIFailureType =
  | 'AUTHENTICATION'
  | 'INSUFFICIENT_BALANCE'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'UNKNOWN';

export type AIProviderName = 'deepseek' | 'openrouter' | 'openai' | 'gemini' | 'claude' | 'future';

export type AIProviderState = 'active' | 'inactive' | 'fallback' | 'disabled';

export type AIProviderResult = {
  text: string;
  model: string;
  provider: AIProviderName;
};

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProviderName,
    public readonly failureType: AIFailureType,
    public readonly retryable: boolean,
    public readonly fallbackAllowed: boolean,
    public readonly status?: number | 'timeout' | 'malformed',
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIOrchestrationError extends Error {
  constructor(public readonly failures: Array<Pick<AIProviderError, 'provider' | 'failureType'>>) {
    super('No eligible AI provider is currently available.');
    this.name = 'AIOrchestrationError';
  }
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string;
  generateResponse(messages: AIMessage[], options?: { temperature?: number; maxTokens?: number; preferMultimodal?: boolean }): Promise<AIProviderResult>;
}
