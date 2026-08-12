import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DEFAULT_UNIVERSITY_ID = '00000000-0000-0000-0000-000000000001';

async function logDiscoveryDiagnostics(scopeId: string, returnedProducts: number, categories: string[]) {
  if (process.env.NODE_ENV !== 'development') return;

  const [total, draft, locked, nonFashion, invalidVisibility, outOfScopeUniversity, missingVendor, eligible] = await Promise.all([
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('is_draft', true),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('locked', true),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).neq('product_section', 'fashion'),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).not('visibility_type', 'in', '(global,university)'),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('visibility_type', 'university').not('university_id', 'is', null).neq('university_id', scopeId),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).is('brand_id', null),
    supabaseAdmin.from('products').select('id', { count: 'exact', head: true }).eq('is_draft', false).eq('locked', false).eq('product_section', 'fashion').or(`visibility_type.eq.global,university_id.eq.${scopeId}`),
  ]);

  console.info('[DISCOVERY DIAGNOSTICS]', {
    scopeId,
    categories,
    totalDatabaseProducts: total.count || 0,
    productsReturned: returnedProducts,
    filteredByDraft: draft.count || 0,
    filteredByVisibility: (invalidVisibility.count || 0) + (outOfScopeUniversity.count || 0),
    filteredByLocked: locked.count || 0,
    filteredBySection: nonFashion.count || 0,
    filteredByVendor: missingVendor.count || 0,
    eligibleAfterCoreFilters: eligible.count || 0,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  try {
    let userUniId: string | undefined;
    const categories = new Set<string>();

    if (userId) {
      const [{ data: wishlist }, { data: orders }, { data: profile }] = await Promise.all([
        supabaseAdmin.from('wishlists').select('products:products!wishlists_product_id_fkey(category)').eq('user_id', userId),
        supabaseAdmin.from('orders').select('products:products!orders_product_id_fkey(category)').eq('customer_id', userId),
        supabaseAdmin.from('users').select('university_id').eq('id', userId).maybeSingle(),
      ]);

      wishlist?.forEach((item: any) => item.products?.category && categories.add(item.products.category));
      orders?.forEach((item: any) => item.products?.category && categories.add(item.products.category));
      userUniId = profile?.university_id || undefined;
    }

    const scopeId = userUniId || DEFAULT_UNIVERSITY_ID;
    const applyScope = (query: any) => userUniId
      ? query.or(`visibility_type.eq.global,university_id.eq.${userUniId}`)
      : query.or('visibility_type.eq.global,university_id.is.null');

    let targetedQuery = supabaseAdmin
      .from('products')
      .select('*, brands(name, logo_url)')
      .eq('locked', false)
      .eq('is_draft', false)
      .eq('product_section', 'fashion');
    targetedQuery = applyScope(targetedQuery);

    if (categories.size > 0) {
      targetedQuery = targetedQuery.in('category', Array.from(categories));
    }

    const { data: targeted } = await targetedQuery
      .order('boost_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    let products = targeted || [];
    if (products.length < 10) {
      let trendQuery = supabaseAdmin
        .from('products')
        .select('*, brands(name, logo_url)')
        .eq('locked', false)
        .eq('is_draft', false)
        .eq('product_section', 'fashion');
      trendQuery = applyScope(trendQuery);

      const { data: trending } = await trendQuery
        .order('views_count', { ascending: false })
        .order('sales_count', { ascending: false })
        .limit(20);

      const combined = [...products, ...(trending || [])];
      products = Array.from(new Map(combined.map((product) => [product.id, product])).values());
    }

    await logDiscoveryDiagnostics(scopeId, products.length, Array.from(categories));
    return NextResponse.json({ products });
  } catch (error) {
    console.error('[DISCOVERY API] Failed to fetch targeted feed:', error);
    return NextResponse.json({ error: 'Failed to fetch targeted feed' }, { status: 500 });
  }
}
