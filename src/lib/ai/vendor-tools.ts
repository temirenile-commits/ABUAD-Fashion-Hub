import { supabaseAdmin } from '@/lib/supabase-admin';

const ELIGIBLE_ORDER_STATUSES = ['paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received'];

type Brand = { id: string; owner_id: string; name: string; verification_status: string | null; subscription_tier: string | null; university_id: string | null; marketplace_type?: string | null };

export async function getVendorProfile(ownerId: string, requestedBrandId?: string | null) {
  let query = supabaseAdmin
    .from('brands')
    .select('id, owner_id, name, verification_status, subscription_tier, university_id, marketplace_type')
    .eq('owner_id', ownerId);
  if (requestedBrandId) query = query.eq('id', requestedBrandId);
  const { data, error } = await query.order('created_at', { ascending: true }).maybeSingle();
  if (error) throw new Error('Unable to load your vendor profile.');
  return data as Brand | null;
}

export async function getVendorProducts(brandId: string) {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, title, price, stock_count, sales_count, views_count, category')
    .eq('brand_id', brandId)
    .limit(100);
  if (error) throw new Error('Unable to load vendor products.');
  return data || [];
}

export async function getVendorOrders(brandId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, total_amount, vendor_earning, created_at, expires_at, confirmed_at, customer_id')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error('Unable to load vendor orders.');
  return data || [];
}

export async function getVendorWallet(brandId: string) {
  const { data, error } = await supabaseAdmin
    .from('wallets')
    .select('available_balance, pending_balance, total_earnings, total_withdrawn')
    .eq('brand_id', brandId)
    .maybeSingle();
  if (error) throw new Error('Unable to load vendor wallet.');
  return data || null;
}

export async function getVendorFinancialSummary(brandId: string) {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin.rpc('get_vendor_financial_summary', {
    p_brand_id: brandId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) throw new Error('Unable to load vendor financial summary.');
  return data || {};
}

export async function getVendorReels(brandId: string) {
  const { data, error } = await supabaseAdmin
    .from('reels')
    .select('id, caption, video_url, created_at, views_count, likes_count, comments_count')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Unable to load vendor Reels.');
  return data || [];
}

export function getPendingOrders<T extends { status: string }>(orders: T[]) {
  return orders.filter((order) => ['pending', 'paid', 'preparing'].includes(order.status));
}

export function getOverdueOrders(orders: Array<{ status: string; expires_at?: string | null; created_at: string }>) {
  const now = Date.now();
  return getPendingOrders(orders).filter((order) => {
    const expiry = order.expires_at ? new Date(order.expires_at).getTime() : new Date(order.created_at).getTime() + 24 * 60 * 60 * 1000;
    return expiry < now;
  });
}

export function getLowStockProducts(products: Array<{ title?: string | null; stock_count?: number | null }>) {
  return products.filter((product) => Number(product.stock_count) >= 0 && Number(product.stock_count) <= 3);
}

export function getEligibleOrderStatuses() {
  return [...ELIGIBLE_ORDER_STATUSES];
}
