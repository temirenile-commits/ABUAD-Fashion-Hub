import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Targeted Discovery API
 * Returns products based on user's past orders and wishlist categories.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    // Return trending products if no user ID
    const { data } = await supabaseAdmin
      .from('products')
      .select('*, brands(name, logo_url)')
      .eq('locked', false)
      .eq('product_section', 'fashion')
      .order('views_count', { ascending: false })
      .limit(20);
    return NextResponse.json({ products: data });
  }

  try {
    // 1. Get user's wishlist categories
    const { data: wishlist } = await supabaseAdmin
      .from('wishlist')
      .select('products(category)')
      .eq('user_id', userId);

    // 2. Get user's past order categories
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('products(category)')
      .eq('customer_id', userId);

    const categories = new Set<string>();
    wishlist?.forEach((w: any) => w.products?.category && categories.add(w.products.category));
    orders?.forEach((o: any) => o.products?.category && categories.add(o.products.category));

    // 0. Get user's university scope
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('university_id')
      .eq('id', userId)
      .single();
    
    const userUniId = profile?.university_id;

    let query = supabaseAdmin
      .from('products')
      .select('*, brands(name, logo_url)')
      .eq('locked', false)
      .eq('product_section', 'fashion');

    // Apply university filter
    if (userUniId) {
      // University users see their campus products + global ones
      query = query.or(`visibility_type.eq.global,university_id.eq.${userUniId}`);
    } else {
      // General users see ONLY global products
      query = query.eq('visibility_type', 'global');
    }

    if (categories.size > 0) {
      // Prioritize these categories
      query = query.in('category', Array.from(categories));
    }

    const { data: targeted } = await query
      .order('boost_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    // If targeted results are few, fill with other relevant products
    if (!targeted || targeted.length < 10) {
      let trendQuery = supabaseAdmin
        .from('products')
        .select('*, brands(name, logo_url)')
        .eq('locked', false)
        .eq('product_section', 'fashion');
      
      if (userUniId) {
        trendQuery = trendQuery.or(`visibility_type.eq.global,university_id.eq.${userUniId}`);
      } else {
        trendQuery = trendQuery.eq('visibility_type', 'global');
      }

      const { data: trending } = await trendQuery
        .order('views_count', { ascending: false })
        .limit(20);
      
      const combined = [...(targeted || []), ...(trending || [])];
      // Deduplicate by ID
      const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
      return NextResponse.json({ products: unique });
    }

    return NextResponse.json({ products: targeted });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch targeted feed' }, { status: 500 });
  }
}
