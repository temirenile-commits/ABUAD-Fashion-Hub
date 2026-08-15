import { supabaseAdmin } from '@/lib/supabase-admin';
import { canUseMilesTool, type MilesContext } from '@/lib/ai/role-context';

export type SearchDomain = 'products' | 'vendors' | 'stores' | 'reels' | 'orders' | 'users' | 'help' | 'features' | 'marketplace' | 'my_data';
export type SearchMode = 'retrieve' | 'navigate';

export type MilesSearchResult = {
  type: 'product' | 'vendor' | 'reel' | 'order' | 'user' | 'help' | 'feature';
  id: string;
  name: string;
  description?: string;
  thumbnail?: string | null;
  imageUrl?: string | null;
  price?: number;
  vendor?: string | null;
  university?: string | null;
  verified?: boolean;
  status?: string | null;
  route?: string | null;
  action?: string | null;
  metadata: Record<string, unknown>;
  confidence: number;
};

export type MilesSearchResponse = {
  query: string;
  domain: SearchDomain;
  mode: SearchMode;
  results: MilesSearchResult[];
  total: number;
  authorization: 'allowed' | 'denied';
  reason?: string;
  ambiguous: boolean;
  observability: { requestId: string; durationMs: number };
};

export type MilesSearchRequest = { query: string; domain: SearchDomain; mode?: SearchMode; limit?: number; universityId?: string | null; vendorId?: string | null; ownerOnly?: boolean; priceMax?: number; availability?: boolean };

type RankedRow = { row: Record<string, unknown>; confidence: number };

const MAX_LIMIT = 20;
const PRIVATE_DOMAINS = new Set<SearchDomain>(['orders', 'users', 'my_data']);
const DOMAIN_PERMISSION: Partial<Record<SearchDomain, string>> = { products: 'product_discovery', vendors: 'product_discovery', stores: 'product_discovery', reels: 'reels_guidance', orders: 'customer_orders', users: 'user_management_guidance', help: 'search_guidance', features: 'navigation_assistance', marketplace: 'marketplace_guidance', my_data: 'personalized_assistance' };

function clean(value: unknown, max = 160) { return typeof value === 'string' ? value.replace(/[<>\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max) : ''; }
function tokens(value: string) { return clean(value, 160).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 2); }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function slug(value: string) { return normalize(value).replace(/\s+/g, '-'); }
function editDistance(a: string, b: string) { const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j; for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) matrix[i][j] = a[i - 1] === b[j - 1] ? matrix[i - 1][j - 1] : Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1); return matrix[a.length][b.length]; }
function relevance(query: string, haystack: string) { const q = normalize(query); const h = normalize(haystack); if (!q || !h) return 0.15; if (h === q) return 1; if (h.startsWith(q)) return 0.92; if (h.includes(q)) return 0.82; const queryTokens = tokens(query); const hayTokens = tokens(haystack); const overlap = queryTokens.filter((token) => hayTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate) || editDistance(token, candidate) <= Math.max(1, Math.floor(token.length / 4)))).length; return Math.min(0.78, 0.18 + (overlap / Math.max(1, queryTokens.length)) * 0.6); }
function rank(query: string, rows: Array<Record<string, unknown>>, fields: string[]) { return rows.map((row) => { const haystack = fields.map((field) => String(row[field] || '')).join(' '); return { row, confidence: relevance(query, haystack) }; }).filter((item) => item.confidence >= 0.18).sort((a, b) => b.confidence - a.confidence); }
function scopedUniversity(context: MilesContext, requested?: string | null) { if (requested && context.universityIds !== null && !context.universityIds.includes(requested)) return null; return requested || undefined; }
function deny(requestId: string, startedAt: number, query: string, domain: SearchDomain, reason: string): MilesSearchResponse { console.info('[MILES_SEARCH_DENIED]', { requestId, domain, queryLength: query.length, reason }); return { query, domain, mode: 'retrieve', results: [], total: 0, authorization: 'denied', reason, ambiguous: false, observability: { requestId, durationMs: Date.now() - startedAt } }; }
function allowed(context: MilesContext, domain: SearchDomain) { const permission = DOMAIN_PERMISSION[domain]; if (!permission) return true; if (context.isFullAdmin) return true; if (PRIVATE_DOMAINS.has(domain)) return context.capabilities.some((capability) => capability === permission || capability.startsWith(`${domain === 'orders' ? 'vendor_' : ''}`)) || (domain === 'orders' && context.capabilities.includes('customer_orders')); return canUseMilesTool(context, permission); }

export async function searchMiles(context: MilesContext, request: MilesSearchRequest): Promise<MilesSearchResponse> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const query = clean(request.query, 160);
  const domain = request.domain;
  const mode = request.mode || 'retrieve';
  const limit = Math.min(MAX_LIMIT, Math.max(1, request.limit || 10));
  if (!allowed(context, domain)) return deny(requestId, startedAt, query, domain, 'This search is outside the authenticated user scope.');
  const universityId = scopedUniversity(context, request.universityId);
  if (request.universityId && universityId === null) return deny(requestId, startedAt, query, domain, 'The requested university is outside the authenticated scope.');
  if (domain === 'marketplace') {
    const [products, vendors, reels] = await Promise.all([
      searchMiles(context, { ...request, query, domain: 'products', universityId, limit: Math.ceil(limit / 2) }),
      searchMiles(context, { ...request, query, domain: 'vendors', universityId, limit: Math.ceil(limit / 2) }),
      searchMiles(context, { ...request, query, domain: 'reels', universityId, limit: Math.ceil(limit / 2) }),
    ]);
    const results = [...products.results, ...vendors.results, ...reels.results].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
    return { query, domain, mode, results, total: results.length, authorization: 'allowed', ambiguous: results.length > 1 && results[0].confidence - results[1].confidence < 0.08, observability: { requestId, durationMs: Date.now() - startedAt } };
  }
  try {
    const ranked = await retrieveDomain(context, { ...request, query, domain, limit, universityId });
    const results = ranked.slice(0, limit).map(({ row, confidence }) => normalizeResult(domain, row, confidence, mode));
    if (!results.length) console.info('[MILES_SEARCH_ZERO]', { requestId, domain, queryLength: query.length });
    if (results.length > 1 && results[0].confidence - results[1].confidence < 0.08) console.info('[MILES_SEARCH_AMBIGUOUS]', { requestId, domain, resultCount: results.length });
    return { query, domain, mode, results, total: ranked.length, authorization: 'allowed', ambiguous: results.length > 1 && results[0].confidence - results[1].confidence < 0.08, observability: { requestId, durationMs: Date.now() - startedAt } };
  } catch (error) {
    console.error('[MILES_SEARCH_FAILED]', { requestId, domain, queryLength: query.length, message: error instanceof Error ? error.message : 'Unknown error' });
    return { query, domain, mode, results: [], total: 0, authorization: 'allowed', reason: 'The search service could not verify results right now.', ambiguous: false, observability: { requestId, durationMs: Date.now() - startedAt } };
  }
}

async function retrieveDomain(context: MilesContext, request: MilesSearchRequest): Promise<RankedRow[]> {
  const { query, domain, limit, universityId } = request;
  const safe = query.replace(/[%_]/g, '').slice(0, 120);
  if (domain === 'features' || domain === 'help') return rank(query, registryRows(domain, context), ['name', 'description', 'keywords', 'roles']);
  if (domain === 'users') {
    if (!context.isFullAdmin && !context.capabilities.includes('user_management_guidance')) return [];
    let users = supabaseAdmin.from('users').select('id, name, email, role, university_id, status').limit(limit!);
    if (safe) users = users.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,role.ilike.%${safe}%`);
    if (universityId) users = users.eq('university_id', universityId);
    const { data } = await users; return rank(query, data || [], ['name', 'email', 'role']);
  }
  if (domain === 'orders' || domain === 'my_data') {
    let orders = supabaseAdmin.from('orders').select('id, customer_id, brand_id, product_id, total_amount, status, created_at, university_id, tracking_number').limit(limit!);
    if (context.brandIds.length && (context.roles.includes('vendor') || context.capabilities.includes('vendor_orders'))) orders = orders.in('brand_id', context.brandIds);
    else orders = orders.eq('customer_id', context.userId);
    if (universityId) orders = orders.eq('university_id', universityId);
    const { data } = await orders.order('created_at', { ascending: false }); return rank(query, data || [], ['id', 'status', 'tracking_number']);
  }
  if (domain === 'vendors' || domain === 'stores' || domain === 'marketplace') {
    let vendors = supabaseAdmin.from('brands').select('id, name, description, logo_url, cover_url, verification_status, verified, university_id, category, owner_id').limit(limit!);
    if (request.ownerOnly) { if (!context.brandIds.length) return []; vendors = vendors.in('id', context.brandIds); }
    else if (universityId) vendors = vendors.eq('university_id', universityId);
    if (safe) vendors = vendors.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`);
    const { data } = await vendors;
    const rows = (data || []).filter((row) => row.owner_id !== context.userId || context.brandIds.includes(row.id));
    return rank(query, rows, ['name', 'description', 'category']);
  }
  if (domain === 'reels') {
    let reels = supabaseAdmin.from('reels').select('id, brand_id, title, caption, thumbnail_url, cover_url, video_url, views_count, likes_count, comments_count, shares_count, university_id, status').neq('status', 'deleted').limit(limit!);
    if (context.brandIds.length && (context.roles.includes('vendor') || context.capabilities.includes('vendor_reels'))) reels = reels.in('brand_id', context.brandIds);
    else if (universityId) reels = reels.eq('university_id', universityId);
    if (safe) reels = reels.or(`title.ilike.%${safe}%,caption.ilike.%${safe}%`);
    const { data } = await reels; return rank(query, data || [], ['title', 'caption']);
  }
  let products = supabaseAdmin.from('products').select('id, brand_id, title, description, category, price, stock_count, image_url, media_urls, video_url, university_id, visibility_type, sku, tags').eq('is_draft', false).limit(limit!);
  if (request.vendorId) { if (!context.brandIds.includes(request.vendorId) && !context.isFullAdmin) return []; products = products.eq('brand_id', request.vendorId); }
  else if (request.ownerOnly) { if (!context.brandIds.length) return []; products = products.in('brand_id', context.brandIds); }
  if (universityId && !request.ownerOnly && !request.vendorId) products = products.or(`visibility_type.eq.global,university_id.eq.${universityId}`);
  if (request.priceMax !== undefined) products = products.lte('price', request.priceMax);
  if (request.availability) products = products.gt('stock_count', 0);
  if (safe) products = products.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%,sku.ilike.%${safe}%`);
  const { data } = await products;
  const rows = data || [];
  const brandIds = [...new Set(rows.map((row) => row.brand_id).filter(Boolean) as string[])];
  const { data: brands } = brandIds.length ? await supabaseAdmin.from('brands').select('id, name').in('id', brandIds).limit(50) : { data: [] as Array<{ id: string; name: string }> };
  const brandNames = new Map((brands || []).map((brand) => [brand.id, brand.name]));
  return rank(query, rows.map((row) => ({ ...row, vendor_name: brandNames.get(String(row.brand_id || '')) || null })), ['title', 'description', 'category', 'sku', 'tags', 'vendor_name']);
}

function normalizeResult(domain: SearchDomain, row: Record<string, unknown>, confidence: number, mode: SearchMode): MilesSearchResult {
  if (domain === 'products' || domain === 'marketplace') return { type: 'product', id: String(row.id), name: String(row.title || 'Product'), description: clean(row.description, 220), thumbnail: typeof row.image_url === 'string' ? row.image_url : Array.isArray(row.media_urls) ? String(row.media_urls[0] || '') || null : null, imageUrl: typeof row.image_url === 'string' ? row.image_url : null, price: Number(row.price || 0), vendor: row.vendor_name ? String(row.vendor_name) : null, university: row.university_id ? String(row.university_id) : null, status: Number(row.stock_count || 0) > 0 ? 'available' : 'out_of_stock', route: `/product/${row.id}`, action: mode === 'navigate' ? 'open_product' : null, metadata: { category: row.category || null, stockCount: Number(row.stock_count || 0) }, confidence };
  if (domain === 'vendors' || domain === 'stores') return { type: 'vendor', id: String(row.id), name: String(row.name || 'Store'), description: clean(row.description, 220), thumbnail: typeof row.logo_url === 'string' ? row.logo_url : typeof row.cover_url === 'string' ? row.cover_url : null, imageUrl: typeof row.logo_url === 'string' ? row.logo_url : null, university: row.university_id ? String(row.university_id) : null, verified: Boolean(row.verified || row.verification_status === 'verified'), route: `/vendor/${slug(String(row.name || 'store'))}?id=${row.id}`, action: mode === 'navigate' ? 'open_store' : null, metadata: { category: row.category || null }, confidence };
  if (domain === 'reels') return { type: 'reel', id: String(row.id), name: String(row.title || 'Reel'), description: clean(row.caption, 220), thumbnail: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : typeof row.cover_url === 'string' ? row.cover_url : null, imageUrl: typeof row.thumbnail_url === 'string' ? row.thumbnail_url : null, route: `/reels?reel=${row.id}`, action: mode === 'navigate' ? 'open_reel' : null, metadata: { brandId: row.brand_id || null, views: Number(row.views_count || 0), likes: Number(row.likes_count || 0) }, confidence };
  if (domain === 'orders' || domain === 'my_data') return { type: 'order', id: String(row.id), name: `Order ${String(row.id).slice(0, 8)}`, status: row.status ? String(row.status) : null, route: `/track/${row.id}`, action: mode === 'navigate' ? 'open_order' : null, metadata: { amount: Number(row.total_amount || 0), createdAt: row.created_at || null }, confidence };
  if (domain === 'users') return { type: 'user', id: String(row.id), name: String(row.full_name || row.email || 'User'), status: row.status ? String(row.status) : null, metadata: { role: row.role || null, universityId: row.university_id || null }, confidence };
  const type = domain === 'features' ? 'feature' : 'help'; return { type, id: String(row.id), name: String(row.name), description: clean(row.description, 400), route: row.route ? String(row.route) : null, action: row.action ? String(row.action) : null, metadata: { keywords: row.keywords || [], roles: row.roles || [] }, confidence };
}

function registryRows(domain: 'help' | 'features', context: MilesContext) {
  const rows = domain === 'features' ? FEATURE_REGISTRY : HELP_REGISTRY;
  return rows.filter((row) => row.roles.includes('*') || row.roles.some((role) => context.roles.includes(role as any)));
}

export const FEATURE_REGISTRY = [
  { id: 'vendor-products', name: 'Product Management', description: 'Manage your products, prices, inventory, images and listings.', route: '/dashboard/vendor?tab=inventory', action: 'open_product_management', keywords: ['products', 'manage products', 'add product', 'edit product', 'price', 'inventory', 'listing'], roles: ['vendor'] },
  { id: 'vendor-store-profile', name: 'Store Profile Settings', description: 'Change your store name, description, profile image and store information.', route: '/dashboard/vendor?tab=settings', action: 'open_store_profile', keywords: ['store name', 'store information', 'store profile', 'brand settings'], roles: ['vendor'] },
  { id: 'vendor-orders', name: 'Orders and Fulfillment', description: 'Review orders, fulfillment status and delivery workflows.', route: '/dashboard/vendor?tab=orders', action: 'open_vendor_orders', keywords: ['orders', 'fulfillment', 'delivery'], roles: ['vendor'] },
  { id: 'account-settings', name: 'Account Settings', description: 'Manage your profile, account preferences and Miles settings.', route: '/settings', action: 'open_account_settings', keywords: ['account', 'profile', 'settings', 'Miles settings'], roles: ['*'] },
  { id: 'admin-miles', name: 'Miles Configuration', description: 'Manage authorized Miles scopes, permissions and audit history.', route: '/admin/miles', action: 'open_miles_configuration', keywords: ['Miles configuration', 'permissions', 'audit', 'assistant settings'], roles: ['super_admin', 'admin', 'university_admin', 'university_staff'] },
];
export const HELP_REGISTRY = [
  { id: 'help-add-product', name: 'How to add a product', description: 'Open Product Management, choose Add Product, complete the listing details, then save.', keywords: ['add product', 'upload product', 'create listing', 'sell product'], roles: ['vendor'] },
  { id: 'help-reels-product', name: 'Attach a product to a Reel', description: 'Open Reels creation, select the product attachment option, choose an authorized listing, and publish after review.', keywords: ['attach product Reel', 'product Reel', 'post Reel'], roles: ['*'] },
  { id: 'help-withdraw', name: 'Withdraw vendor earnings', description: 'Use Wallet and Payouts to review available balance and submit a payout request through the protected workflow.', keywords: ['withdraw money', 'payout', 'wallet', 'earnings'], roles: ['vendor'] },
  { id: 'help-order-delivery', name: 'Order delivery guidance', description: 'Open your order details to review the latest delivery and tracking status.', keywords: ['order not arrived', 'delivery', 'tracking', 'shipping'], roles: ['*'] },
];

export function isVendorContext(context: MilesContext) { return context.brandIds.length > 0 || context.roles.includes('vendor'); }

export const searchProducts = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'products' });
export const searchVendors = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'vendors' });
export const searchStores = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'stores' });
export const searchReels = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'reels' });
export const searchOrders = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'orders' });
export const searchUsers = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'users' });
export const searchHelp = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'help' });
export const searchFeatures = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'features', mode: 'navigate' });
export const searchMarketplace = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'marketplace' });
export const searchMyData = (context: MilesContext, query: string, options: Omit<MilesSearchRequest, 'query' | 'domain'> = {}) => searchMiles(context, { ...options, query, domain: 'my_data' });
