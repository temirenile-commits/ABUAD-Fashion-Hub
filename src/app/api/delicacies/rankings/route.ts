import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');
    const weekStart = searchParams.get('weekStart'); // ISO date string e.g. "2026-05-12"

    const type = searchParams.get('type') || 'vendors';

    if (type === 'products') {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select(`
          id, title, price, sold, weekly_sold, avg_rating, media_urls, award_history,
          brands ( id, name, logo_url )
        `)
        .eq('product_section', 'delicacies')
        .order('weekly_sold', { ascending: false })
        .limit(20);
      if (error) throw error;
      return NextResponse.json({ rankings: data || [] });
    }

    if (type === 'all_vendors') {
        const { data, error } = await supabaseAdmin
            .from('brands')
            .select('id, name, logo_url, avg_rating, description')
            .eq('marketplace_type', 'delicacies')
            .order('name', { ascending: true });
        if (error) throw error;
        return NextResponse.json({ vendors: data || [] });
    }

    let query = supabaseAdmin
      .from('delicacy_vendor_rankings')
      .select(`
        id, rank, score, badge, orders_completed,
        avg_rating, complaints, reward_amount, week_start,
        brand_id,
        brands (
          id, name, logo_url, avg_rating, university_id
        )
      `)
      .order('rank', { ascending: true })
      .limit(10);

    if (universityId) query = query.eq('university_id', universityId);
    if (weekStart) query = query.eq('week_start', weekStart);

    const { data, error } = await query;
    
    if (error || !data || data.length === 0) {
      // Fallback to real-time rankings based on products sold
      const { data: realTime, error: rtError } = await supabaseAdmin
        .from('brands')
        .select('id, name, logo_url, avg_rating, weekly_orders, award_history')
        .eq('marketplace_type', 'delicacies')
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
