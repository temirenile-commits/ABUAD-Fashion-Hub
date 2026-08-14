import { supabaseAdmin } from '@/lib/supabase-admin';
import { canUseMilesTool, type MilesContext } from '@/lib/ai/role-context';

const limit = 50;

function text(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function numeric(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }

export async function getCustomerMilesContext(context: MilesContext, query: string) {
  const [ordersResult, walletResult, transactionsResult, reviewsResult, notificationsResult] = await Promise.all([
    supabaseAdmin.from('orders').select('id, brand_id, product_id, service_id, total_amount, status, payment_system, manual_payment_status, created_at, confirmed_at, tracking_number, delivered_at, in_transit_at, picked_up_at, delivery_scope, delivery_code').eq('customer_id', context.userId).order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('financial_ledger').select('id, type, amount, status, description, created_at, reference').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('transactions').select('id, order_id, type, amount, status, description, created_at, payment_reference, payment_type').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('product_reviews').select('id, product_id, rating, comment, vendor_reply, is_public, created_at').eq('customer_id', context.userId).order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('notifications').select('id, type, title, content, link, is_read, created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, brand_id, title, description, price, original_price, category, rating, reviews_count, stock_count, visibility_type, university_id, product_section, image_url, variants')
    .or(`title.ilike.%${query.replace(/[%_]/g, '')}%,description.ilike.%${query.replace(/[%_]/g, '')}%,category.ilike.%${query.replace(/[%_]/g, '')}%`)
    .limit(20);

  return {
    customer: { id: context.userId, universityIds: context.universityIds },
    orders: ordersResult.data || [],
    walletTransactions: walletResult.data || [],
    paymentHistory: transactionsResult.data || [],
    reviews: reviewsResult.data || [],
    notifications: notificationsResult.data || [],
    productMatches: products || [],
  };
}

export async function getUniversityAdminMilesContext(context: MilesContext) {
  const universityIds = context.universityIds;
  const scoped = (query: any) => {
    if (universityIds === null) return query;
    if (!universityIds.length) return query.eq('university_id', '00000000-0000-0000-0000-000000000000');
    return query.in('university_id', universityIds);
  };

  const [vendors, products, orders, users, reels, support] = await Promise.all([
    scoped(supabaseAdmin.from('brands').select('id, name, owner_id, verified, verification_status, university_id, rating, avg_rating, sales_count, weekly_orders, last_active')).limit(limit),
    scoped(supabaseAdmin.from('products').select('id, brand_id, title, price, stock_count, sales_count, views_count, rating, university_id, visibility_type')).limit(limit),
    scoped(supabaseAdmin.from('orders').select('id, customer_id, brand_id, total_amount, status, created_at, university_id')).order('created_at', { ascending: false }).limit(limit),
    scoped(supabaseAdmin.from('users').select('id, role, status, university_id, created_at, last_active')).limit(limit),
    scoped(supabaseAdmin.from('reels').select('id, brand_id, title, caption, views_count, likes_count, comments_count, shares_count, created_at, university_id')).limit(limit),
    scoped(supabaseAdmin.from('notifications').select('id, type, title, content, created_at, university_id')).order('created_at', { ascending: false }).limit(20),
  ]);
  return { scope: universityIds, vendors: vendors.data || [], products: products.data || [], orders: orders.data || [], users: users.data || [], reels: reels.data || [], supportSignals: support.data || [] };
}

export async function getPlatformAdminMilesContext(context: MilesContext) {
  const [users, brands, products, orders, reels, universities, notifications] = await Promise.all([
    supabaseAdmin.from('users').select('id, role, status, university_id, created_at, last_active').limit(limit),
    supabaseAdmin.from('brands').select('id, name, owner_id, verified, verification_status, university_id, rating, avg_rating, sales_count, weekly_orders, last_active').limit(limit),
    supabaseAdmin.from('products').select('id, brand_id, title, price, stock_count, sales_count, views_count, rating, university_id').limit(limit),
    supabaseAdmin.from('orders').select('id, customer_id, brand_id, total_amount, status, created_at, university_id').order('created_at', { ascending: false }).limit(limit),
    supabaseAdmin.from('reels').select('id, brand_id, title, views_count, likes_count, comments_count, shares_count, created_at, university_id').limit(limit),
    supabaseAdmin.from('universities').select('id, name, is_active, created_at').limit(limit),
    supabaseAdmin.from('notifications').select('id, type, title, content, created_at, university_id').order('created_at', { ascending: false }).limit(20),
  ]);
  return { users: users.data || [], vendors: brands.data || [], products: products.data || [], orders: orders.data || [], reels: reels.data || [], universities: universities.data || [], operationalAlerts: notifications.data || [], permissionNote: context.isFullAdmin ? 'Platform scope is authorized by the current full-admin role.' : 'Only data returned by the configured sub-admin scope is included.' };
}

export async function getPublicMarketplaceMilesContext(query: string, universityIds: string[] | null) {
  const safeQuery = query.replace(/[%_]/g, '').slice(0, 120);
  let productsQuery = supabaseAdmin.from('products').select('id, brand_id, title, description, price, original_price, category, rating, reviews_count, stock_count, visibility_type, university_id, product_section, image_url').eq('is_draft', false).limit(20);
  if (safeQuery) productsQuery = productsQuery.or(`title.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%`);
  if (universityIds?.length) productsQuery = productsQuery.or(`visibility_type.eq.global,university_id.in.(${universityIds.join(',')})`);
  const [products, vendors, reels] = await Promise.all([
    productsQuery,
    supabaseAdmin.from('brands').select('id, name, description, logo_url, verified, rating, avg_rating, university_id, category').limit(20),
    supabaseAdmin.from('reels').select('id, brand_id, title, caption, views_count, likes_count, comments_count, shares_count, university_id').limit(20),
  ]);
  return { products: products.data || [], publicVendors: vendors.data || [], publicReels: reels.data || [] };
}

export async function getSupportMilesContext(context: MilesContext) {
  if (!canUseMilesTool(context, 'support')) return { supportAccess: false, cases: [] };
  const query = supabaseAdmin.from('notifications').select('id, user_id, type, title, content, link, is_read, created_at, university_id').order('created_at', { ascending: false }).limit(50);
  const scoped = context.universityIds === null || !context.universityIds.length ? query : query.in('university_id', context.universityIds);
  const { data } = await scoped;
  return { supportAccess: true, cases: data || [] };
}

export function summarizeValidatedAnalytics(context: MilesContext, data: any) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const products = Array.isArray(data.products) ? data.products : [];
  const reels = Array.isArray(data.reels) ? data.reels : [];
  const statusCounts = orders.reduce((acc: Record<string, number>, order: any) => { const key = text(order.status) || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
  return {
    scope: context.scope,
    orderCount: orders.length,
    orderStatusCounts: statusCounts,
    productCount: products.length,
    productSales: products.reduce((sum: number, item: any) => sum + numeric(item.sales_count), 0),
    reelCount: reels.length,
    reelViews: reels.reduce((sum: number, item: any) => sum + numeric(item.views_count), 0),
    generatedFrom: 'validated MasterCart records',
  };
}
