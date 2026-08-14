const GREETING_WORDS = new Set(['hi', 'hello', 'hey', 'hiya', 'morning', 'afternoon', 'evening', 'yo']);

export function isSimpleGreeting(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  const words = normalized.split(' ');
  return words.length <= 4 && GREETING_WORDS.has(words[0]);
}

export function requiresVendorData(value: string): boolean {
  const normalized = value.toLowerCase();
  return /(store|shop|brand|business|profile|name|settings?|sales?|revenue|earning|income|wallet|balance|payout|withdraw|payment|order|delivery|product|inventory|stock|listing|service|promotion|promo|reel|likes?|views?|analytics|performance|customer|message|enquir|marketplace|university|visibility|show me|how many|which|last month|this month|today|yesterday|late|delayed|missing|disappeared|not showing|not visible|did .* publish)/i.test(normalized);
}

export function sanitizeMilesResponse(value: string): string {
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/```(?:analysis|reasoning)[\s\S]*?```/gi, '')
    .replace(/^\s*(here(?:'|’)s|this is)\s+(my|the)?\s*(thinking|analysis|reasoning|thought process)[\s\S]*?(?:\n\n|\n(?=[A-Z]))/i, '')
    .replace(/^\s*(step\s*\d+|analysis|reasoning|internal notes?)\s*[:\-].*$/gim, '')
    .replace(/^\s*(user|assistant|system)\s*[:\-]\s*/gim, '')
    .trim();
  if (!cleaned || /(?:here(?:'|’)s my thinking process|step 1: analyze user input|system prompt|internal reasoning)/i.test(cleaned)) {
    return "I'm here and ready to help. What would you like to work on?";
  }
  return cleaned;
}
