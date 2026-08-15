const GREETING_WORDS = new Set(['hi', 'hello', 'hey', 'hiya', 'morning', 'afternoon', 'evening', 'yo']);

const SENSITIVE_KEY = /(^|_)(id|ids|uuid|token|secret|key|scope|permissions?|admin_permissions|owner_id|user_id|customer_id|brand_id|product_id|service_id|university_id)(_|$)/i;
const INTERNAL_LANGUAGE = /(?:system prompt|developer message|internal reasoning|chain of thought|thinking process|current (?:user|scope|permissions)\s*[:=]|user_id\s*[:=]|owner_id\s*[:=]|admin_permissions\s*[:=]|access token\s*[:=]|api key\s*[:=]|deepseek\s+(?:balance|key|error)|openrouter\s+(?:key|error)|provider\s+(?:failed|error|name)\s*[:=]|stack trace)/i;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

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

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEY.test(key) || normalized.endsWith('id') || normalized.endsWith('ids') || normalized.includes('permission') || normalized.includes('scope');
}

/**
 * Keep the model useful while preventing raw authorization topology and database identifiers
 * from entering the prompt. This is defense-in-depth; backend tools still authorize every read.
 */
export function redactMilesModelContext(value: unknown, key = ''): unknown {
  if (isSensitiveKey(key)) return undefined;
  if (Array.isArray(value)) return value.map((item) => redactMilesModelContext(item)).filter((item) => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([childKey]) => !isSensitiveKey(childKey) && !['permissionNote', 'generatedFrom'].includes(childKey))
    .map(([childKey, childValue]) => [childKey, redactMilesModelContext(childValue, childKey)])
    .filter(([, childValue]) => childValue !== undefined));
}

export function safeMilesAuthorization(context: { roles: string[]; capabilities: string[]; scope: { kind: string }; isFullAdmin: boolean }) {
  return {
    roleCategories: context.roles.map((role) => role === 'vendor' ? 'vendor' : ['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff'].includes(role) ? 'administrator' : role === 'customer_support_agent' ? 'support' : 'customer'),
    capabilityCategories: context.capabilities.map((capability) => capability.split(':')[0]).filter(Boolean),
    scopeLevel: context.scope.kind,
    fullAdmin: context.isFullAdmin,
  };
}

export function sanitizeMilesResponse(value: string): string {
  let cleaned = String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/```(?:analysis|reasoning)[\s\S]*?```/gi, '')
    .replace(/^\s*(here(?:'|’)s|this is)\s+(my|the)?\s*(thinking|analysis|reasoning|thought process)\s*:[\s\S]*$/i, '')
    .replace(/^\s*(step\s*\d+|analysis|reasoning|internal notes?)\s*[:\-].*$/gim, '')
    .replace(/^\s*(user|assistant|system)\s*[:\-]\s*/gim, '')
    .replace(UUID, '[private identifier]')
    .trim();

  const internalStart = cleaned.search(/(?:here(?:'|’)s my thinking process|internal reasoning|system prompt|developer message|chain of thought)/i);
  if (internalStart >= 0) cleaned = cleaned.slice(0, internalStart).trim();
  if (!cleaned || INTERNAL_LANGUAGE.test(cleaned) || /(?:^|\n)\s*\d+\.\s+(?:analyze|check context|let's look|user says)/i.test(cleaned)) {
    return "I can help with MasterCart operations and explain how the system works. What would you like me to check or explain?";
  }
  return cleaned;
}
