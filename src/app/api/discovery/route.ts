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

    let query = supabaseAdmin
      .from('products')
      .select('*, brands(name, logo_url)')
      .eq('locked', false);

    if (categories.size > 0) {
      // Prioritize these categories
      query = query.in('category', Array.from(categories));
    }

    const { data: targeted } = await query
      .order('boost_level', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);

    // If targeted results are few, fill with other trending products
    if (!targeted || targeted.length < 10) {
      const { data: trending } = await supabaseAdmin
        .from('products')
        .select('*, brands(name, logo_url)')
        .eq('locked', false)
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
