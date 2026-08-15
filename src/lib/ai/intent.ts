export type MilesIntent =
  | 'normal_conversation'
  | 'product_search'
  | 'vendor_search'
  | 'product_info'
  | 'vendor_info'
  | 'media_request'
  | 'image_analysis'
  | 'mastercart_assistance'
  | 'operational_request';

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

export function classifyMilesIntent(message: string, hasUploadedImage = false): MilesIntentDecision {
  const query = entityQuery(message);
  const normalized = message.trim().toLowerCase();
  if (hasUploadedImage) return { intent: 'image_analysis', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (NORMAL_PATTERNS.some((pattern) => pattern.test(normalized))) return { intent: 'normal_conversation', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (ASSISTANCE_PATTERNS.test(normalized) && !PRODUCT_PATTERNS.test(normalized) && !VENDOR_PATTERNS.test(normalized)) return { intent: 'mastercart_assistance', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: /\b(order|checkout|delivery)\b/i.test(normalized), requiresAdminContext: false, requiresMedia: false };
  if (OPERATIONAL_PATTERNS.test(normalized)) return { intent: 'operational_request', query, requiresMarketplace: false, requiresVendorContext: true, requiresCustomerContext: true, requiresAdminContext: true, requiresMedia: false };
  if (MEDIA_PATTERNS.test(normalized)) return { intent: 'media_request', query, requiresMarketplace: true, requiresVendorContext: VENDOR_PATTERNS.test(normalized), requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: true };
  if (VENDOR_PATTERNS.test(normalized) && SEARCH_PATTERNS.test(normalized)) return { intent: 'vendor_search', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (PRODUCT_PATTERNS.test(normalized) && SEARCH_PATTERNS.test(normalized)) return { intent: 'product_search', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (VENDOR_PATTERNS.test(normalized) && INFO_PATTERNS.test(normalized)) return { intent: 'vendor_info', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  if (PRODUCT_PATTERNS.test(normalized) && INFO_PATTERNS.test(normalized)) return { intent: 'product_info', query, requiresMarketplace: true, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
  return { intent: 'mastercart_assistance', query, requiresMarketplace: false, requiresVendorContext: false, requiresCustomerContext: false, requiresAdminContext: false, requiresMedia: false };
}
