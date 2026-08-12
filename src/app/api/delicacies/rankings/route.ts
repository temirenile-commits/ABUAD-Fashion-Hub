import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');
    const weekStart = searchParams.get('weekStart'); // ISO date string e.g. "2026-05-12"

    const type = searchParams.get('type') || 'vendors';

    if (type === 'products') {
      if (!universityId) return NextResponse.json({ error: 'universityId required' }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
          id, title, price, sold, weekly_sold, avg_rating:rating, media_urls, award_history,
          brands:brands!products_brand_id_fkey ( id, name, logo_url, university_id )
        `)
        .eq('product_section', 'delicacies')
        .eq('university_id', universityId)
        .order('weekly_sold', { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ rankings: data || [] });
    }

    if (type === 'all_vendors') {
        if (!universityId) return NextResponse.json({ error: 'universityId required' }, { status: 400 });
        const { data, error } = await supabaseAdmin
            .from('brands')
            .select('id, name, logo_url, avg_rating, description')
            .eq('marketplace_type', 'delicacies')
            .eq('university_id', universityId)
            .order('name', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ vendors: data || [] });
    }

    // ISOLATION FIX: Require universityId for vendor rankings
    if (!universityId) {
      return NextResponse.json({ error: 'universityId is required for rankings' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('delicacy_vendor_rankings')
      .select(`
        id, rank, score, badge, orders_completed,
        avg_rating, complaints, reward_amount, week_start,
        brand_id,
        brands:brands!delicacy_vendor_rankings_brand_id_fkey (
          id, name, logo_url, avg_rating, university_id
        )
      `)
      .eq('university_id', universityId)
      .order('rank', { ascending: true })
      .limit(10);

    if (weekStart) query = query.eq('week_start', weekStart);

    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      // Fallback: real-time rankings scoped to this university
      const { data: realTime, error: rtError } = await supabaseAdmin
        .from('brands')
        .select('id, name, logo_url, avg_rating, weekly_orders, award_history, university_id')
        .eq('marketplace_type', 'delicacies')
        .eq('university_id', universityId)
        .order('weekly_orders', { ascending: false })
        .limit(10);
      
      if (rtError) throw rtError;

      // For real-time, we'll calculate a score based on avg_rating and simulated sales
      // In a real app, you'd aggregate orders here.
      const rankings = realTime.map((v, i) => ({
        id: v.id,
        rank: i + 1,
        score: (v.weekly_orders || 0) * 10 + (v.avg_rating || 0) * 5,
        avg_rating: v.avg_rating || 0,
        orders_completed: v.weekly_orders || 0, 
        award_history: v.award_history || [],
        brands: v
      })).sort((a, b) => b.score - a.score);

      return NextResponse.json({ rankings });
    }

    return NextResponse.json({ rankings: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
