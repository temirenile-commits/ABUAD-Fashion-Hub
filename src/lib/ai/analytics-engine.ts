import { supabaseAdmin } from '@/lib/supabase-admin';
import type { MilesContext } from '@/lib/ai/role-context';

export type MilesAnalysisType = 'vendor_sales' | 'product_performance' | 'reel_performance' | 'market_activity' | 'university_ranking' | 'order_trends';
export type MilesAnalysisResponse = { type: MilesAnalysisType; scope: string; metrics: Record<string, unknown>; source: 'mastercart_backend'; generatedAt: string; authorization: 'allowed' | 'denied'; reason?: string };

function periodStart(period: 'month' | 'last_month' | 'all' = 'month') { const now = new Date(); if (period === 'all') return new Date(0); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (period === 'last_month' ? 1 : 0), 1)); return start; }
function sum(rows: Array<Record<string, unknown>>, key: string) { return rows.reduce((total, row) => total + Number(row[key] || 0), 0); }
function denied(type: MilesAnalysisType, reason: string): MilesAnalysisResponse { return { type, scope: 'none', metrics: {}, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'denied', reason }; }

export async function analyzeMiles(context: MilesContext, type: MilesAnalysisType, options: { period?: 'month' | 'last_month' | 'all'; universityId?: string | null } = {}): Promise<MilesAnalysisResponse> {
  const period = options.period || 'month';
  if (options.universityId && context.universityIds !== null && !context.universityIds.includes(options.universityId)) return denied(type, 'The requested university is outside the authenticated scope.');
  if (type === 'university_ranking' && !context.isFullAdmin && !context.capabilities.includes('rankings') && !context.capabilities.includes('university_analytics')) return denied(type, 'University ranking analysis is outside the authenticated scope.');
  const start = periodStart(period).toISOString();
  if (type === 'vendor_sales' || type === 'order_trends') {
    if (!context.brandIds.length && !context.isFullAdmin) return denied(type, 'No authorized vendor or platform scope is available.');
    let query = supabaseAdmin.from('orders').select('id, brand_id, total_amount, vendor_earning, status, created_at, university_id').gte('created_at', start).limit(500);
    if (context.brandIds.length && !context.isFullAdmin) query = query.in('brand_id', context.brandIds);
    if (options.universityId) query = query.eq('university_id', options.universityId);
    const { data } = await query;
    const rows = data || [];
    return { type, scope: context.isFullAdmin ? 'platform' : 'vendor', metrics: { period, orderCount: rows.length, grossSales: sum(rows, 'total_amount'), vendorEarnings: sum(rows, 'vendor_earning'), statusCounts: rows.reduce((acc: Record<string, number>, row) => { const status = String(row.status || 'unknown'); acc[status] = (acc[status] || 0) + 1; return acc; }, {}) }, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'allowed' };
  }
  if (type === 'product_performance') {
    if (!context.brandIds.length && !context.isFullAdmin) return denied(type, 'Product performance is only available for an authorized vendor or platform scope.');
    let query = supabaseAdmin.from('products').select('id, brand_id, title, sales_count, views_count, stock_count, rating').limit(500);
    if (context.brandIds.length && !context.isFullAdmin) query = query.in('brand_id', context.brandIds);
    const { data } = await query;
    const products = (data || []).sort((a, b) => Number(b.sales_count || 0) - Number(a.sales_count || 0)).slice(0, 20);
    return { type, scope: context.isFullAdmin ? 'platform' : 'vendor', metrics: { period, productCount: products.length, topProducts: products.map((product) => ({ id: product.id, name: product.title, sales: Number(product.sales_count || 0), views: Number(product.views_count || 0), stock: Number(product.stock_count || 0), rating: Number(product.rating || 0) })) }, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'allowed' };
  }
  if (type === 'reel_performance') {
    if (!context.brandIds.length && !context.isFullAdmin) return denied(type, 'Reel performance is only available for an authorized vendor or platform scope.');
    let query = supabaseAdmin.from('reels').select('id, brand_id, title, views_count, likes_count, comments_count, shares_count, created_at').gte('created_at', start).limit(500);
    if (context.brandIds.length && !context.isFullAdmin) query = query.in('brand_id', context.brandIds);
    const { data } = await query;
    const reels = (data || []).sort((a, b) => Number(b.views_count || 0) - Number(a.views_count || 0)).slice(0, 20);
    return { type, scope: context.isFullAdmin ? 'platform' : 'vendor', metrics: { period, reelCount: reels.length, totalViews: sum(reels, 'views_count'), totalLikes: sum(reels, 'likes_count'), totalComments: sum(reels, 'comments_count'), topReels: reels.map((reel) => ({ id: reel.id, name: reel.title || 'Reel', views: Number(reel.views_count || 0), likes: Number(reel.likes_count || 0), comments: Number(reel.comments_count || 0), shares: Number(reel.shares_count || 0) })) }, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'allowed' };
  }
  if (type === 'market_activity') {
    if (!context.universityIds?.length && !context.isFullAdmin) return denied(type, 'Market analysis requires an authorized university scope.');
    let productQuery = supabaseAdmin.from('products').select('id, university_id, sales_count, views_count').limit(1000);
    let brandQuery = supabaseAdmin.from('brands').select('id, university_id').limit(1000);
    let orderQuery = supabaseAdmin.from('orders').select('id, university_id, total_amount').gte('created_at', start).limit(1000);
    if (options.universityId) { productQuery = productQuery.eq('university_id', options.universityId); brandQuery = brandQuery.eq('university_id', options.universityId); orderQuery = orderQuery.eq('university_id', options.universityId); }
    else if (context.universityIds !== null) { productQuery = productQuery.in('university_id', context.universityIds); brandQuery = brandQuery.in('university_id', context.universityIds); orderQuery = orderQuery.in('university_id', context.universityIds); }
    const [{ data: products }, { data: brands }, { data: orders }] = await Promise.all([productQuery, brandQuery, orderQuery]);
    return { type, scope: options.universityId || (context.universityIds || []).join(','), metrics: { period, productCount: products?.length || 0, vendorCount: brands?.length || 0, orderCount: orders?.length || 0, salesVolume: sum(orders || [], 'total_amount'), activityScore: (products?.length || 0) + (brands?.length || 0) + (orders?.length || 0) }, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'allowed' };
  }
  let universities = supabaseAdmin.from('universities').select('id, name').limit(100);
  if (context.universityIds !== null) universities = universities.in('id', context.universityIds.length ? context.universityIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: universityRows } = await universities;
  const rankings = await Promise.all((universityRows || []).map(async (university) => { const [{ count: products }, { count: vendors }, { count: orders }] = await Promise.all([supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('university_id', university.id), supabaseAdmin.from('brands').select('id', { count: 'exact', head: true }).eq('university_id', university.id), supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('university_id', university.id).gte('created_at', start)]); const score = Number(products || 0) + Number(vendors || 0) + Number(orders || 0); return { id: university.id, name: university.name, marketplaceActivity: Number(products || 0), vendorActivity: Number(vendors || 0), orderActivity: Number(orders || 0), score }; }));
  return { type, scope: context.isFullAdmin ? 'platform' : (context.universityIds || []).join(','), metrics: { period, rankings: rankings.sort((a, b) => b.score - a.score).map((row, index) => ({ ...row, rank: index + 1 })) }, source: 'mastercart_backend', generatedAt: new Date().toISOString(), authorization: 'allowed' };
}
