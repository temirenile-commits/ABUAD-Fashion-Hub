export type MilesIntent =
  | 'normal_conversation'
  | 'general_question'
  | 'product_search'
  | 'vendor_search'
  | 'product_info'
  | 'vendor_info'
  | 'order_query'
  | 'delivery_query'
  | 'reel_query'
  | 'review_query'
  | 'account_query'
  | 'analytics_query'
  | 'financial_query'
  | 'admin_query'
  | 'support_request'
  | 'troubleshooting'
  | 'navigation_request'
  | 'action_request'
  | 'media_request'
  | 'image_analysis'
  | 'mastercart_assistance'
  | 'operational_request'
  | 'unknown';

export type MilesIntentDecision = {
  intent: MilesIntent;
  query: string;
  requiresMarketplace: boolean;
  requiresVendorContext: boolean;
  requiresCustomerContext: boolean;
  requiresAdminContext: boolean;
  requiresMedia: boolean;
};

const NORMAL_PATTERNS = [/^(hi|hello|hey|good morning|good afternoon|good evening)\b/i, /^(thanks|thank you)\b/i, /how are you/i, /what can you help/i];
const MEDIA_PATTERNS = /\b(show|find|get|send|display|see|view)\b.*\b(picture|pictures|photo|photos|image|images|video|videos|media)\b|\b(picture|pictures|photo|photos|image|images|video|videos|media)\b.*\b(of|for|from)\b/i;
const VENDOR_PATTERNS = /\b(vendor|vendors|store|stores|shop|shops|seller|sellers|brand|brands)\b/i;
const NAMED_VENDOR_SEARCH = /\b(find|search|show|look for)\b\s+[a-z0-9&'’-]+(?:\s+[a-z0-9&'’-]+)?\s+(clothing|fashion|electronics|boutique|store|shop)\b/i;
const PRODUCT_PATTERNS = /\b(product|products|phone|phones|laptop|laptops|shoes|sneakers|dress|dresses|available|price|cost|stock|item|items)\b/i;
const SEARCH_PATTERNS = /\b(find|search|show|look for|what .* available|who sells|list|browse)\b/i;
const INFO_PATTERNS = /\b(tell me about|what is|what's|whats|how much|price|cost|available|in stock|does .* sell|store sell)\b/i;
const ASSISTANCE_PATTERNS = /\b(how do i|how can i|why (is|isn't|isnt)|upload|post a reel|account settings|order|checkout|delivery|change my)\b/i;
const OPERATIONAL_PATTERNS = /\b(update|change|edit|delete|remove|create|add|publish|unpublish|approve|reject|cancel|mark|set)\b/i;

function entityQuery(message: string) {
  return message.trim().slice(0, 160)
    .replace(/^(please\s+)?(show|find|search|get|display|send|tell me about|what is|what's|whats|look for)\s+(me\s+)?/i, '')
    .replace(/^(pictures?|photos?|images?|videos?|media)\s+(of|for)\s+/i, '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim() || message.trim().slice(0, 160);
}

export function classifyMilesIntent(message: string, hasUploadedImage = false, hasRecentCards = false): MilesIntentDecision {
  const query = entityQuery(message);
  const normalized = message.trim().toLowerCase();
  if (hasUploadedImage) return { intent: 'image_analysis', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (hasRecentCards && /\b(cheapest|lowest|least expensive|most expensive|best|which one|second|third|first|that vendor|who sells|is it verified)\b/i.test(normalized)) return { intent: /\b(vendor|seller|store|brand|who sells|verified)\b/i.test(normalized) ? 'vendor_info' : 'product_info', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (/\b(that thing i bought|what i bought|purchase|purchased|order|orders)\b/i.test(normalized)) return { intent: 'order_query', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: true, requiresAdminContext: false, requiresMedia: false };
  if (/\b(delivery|deliveries|shipping|shipped|delivered|tracking|dispatch)\b/i.test(normalized)) return { intent: 'delivery_query', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: true, requiresAdminContext: false, requiresMedia: false };
  if (/\b(reel|reels|video|videos)\b/i.test(normalized)) return { intent: 'reel_query', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: /\b(show|find|view|watch)\b/i.test(normalized) };
  if (/\b(review|reviews|rating|ratings)\b/i.test(normalized)) return { intent: 'review_query', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (/\b(account|profile|password|settings|university)\b/i.test(normalized)) return { intent: 'account_query', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: true, requiresAdminContext: false, requiresMedia: false };
  if (/\b(sales|analytics|trend|trends|performance|views|engagement|inventory|low stock)\b/i.test(normalized)) return { intent: 'analytics_query', query, requiresMarketplace: false, requiresVendorContext: true, requiresCustomerContext: false, requiresAdminContext: true, requiresMedia: false };
  if (/\b(wallet|balance|payout|payment|payments|financial|revenue|earnings)\b/i.test(normalized)) return { intent: 'financial_query', query, requiresMarketplace: false, requiresVendorContext: true, requiresCustomerContext: true, requiresAdminContext: true, requiresMedia: false };
  if (/\b(admin|administrator|university operations|platform operations)\b/i.test(normalized)) return { intent: 'admin_query', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: true, requiresMedia: false };
  if (/\b(support|help desk|complaint|issue with my order)\b/i.test(normalized)) return { intent: 'support_request', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: true, requiresAdminContext: false, requiresMedia: false };
  if (/\b(confused|not appearing|doesn't work|doesnt work|problem|trouble|error|why is my)\b/i.test(normalized)) return { intent: 'troubleshooting', query, requiresMarketplace: false, requiresVendorContext: true, requiresCustomerContext: true, requiresAdminContext: false, requiresMedia: false };
  if (NORMAL_PATTERNS.some((pattern) => pattern.test(normalized))) return { intent: 'normal_conversation', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (ASSISTANCE_PATTERNS.test(normalized) && !PRODUCT_PATTERNS.test(normalized) && !VENDOR_PATTERNS.test(normalized)) return { intent: 'mastercart_assistance', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: /\b(order|checkout|delivery)\b/i.test(normalized), requiresAdminContext: false, requiresMedia: false };
  if (OPERATIONAL_PATTERNS.test(normalized)) return { intent: 'action_request', query, requiresMarketplace: false, requiresVendorContext: true, requiresCustomerContext: true, requiresAdminContext: true, requiresMedia: false };
  if (MEDIA_PATTERNS.test(normalized)) return { intent: 'media_request', query, requiresMarketplace: true, requiresVendorContext: VENDOR_PATTERNS.test(normalized), requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: true };
  if ((VENDOR_PATTERNS.test(normalized) || NAMED_VENDOR_SEARCH.test(normalized) || (SEARCH_PATTERNS.test(normalized) && !PRODUCT_PATTERNS.test(normalized))) && !PRODUCT_PATTERNS.test(normalized)) return { intent: 'vendor_search', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (PRODUCT_PATTERNS.test(normalized) && SEARCH_PATTERNS.test(normalized)) return { intent: 'product_search', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (VENDOR_PATTERNS.test(normalized) && INFO_PATTERNS.test(normalized)) return { intent: 'vendor_info', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (PRODUCT_PATTERNS.test(normalized) && INFO_PATTERNS.test(normalized)) return { intent: 'product_info', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (/\b(what|why|how|when|can|should|help me|give me|explain|ideas|write|decide)\b/i.test(normalized)) return { intent: 'general_question', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  return { intent: 'unknown', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
}
