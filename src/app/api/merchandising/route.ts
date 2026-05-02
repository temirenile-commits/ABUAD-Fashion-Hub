import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const universityId = searchParams.get('university_id');

  try {
    // 1. Fetch active sections
    let query = supabaseAdmin
      .from('homepage_sections')
      .select('*')
      .eq('is_active', true)
      .or(`university_id.is.null,university_id.eq.${universityId}`)
      .order('priority', { ascending: true });

    // Handle scheduling
    const now = new Date().toISOString();
    query = query.or(`start_date.is.null,start_date.lte.${now}`);
    query = query.or(`end_date.is.null,end_date.gte.${now}`);

    const { data: sections, error: secError } = await query;
    if (secError) throw secError;

    // 2. Fetch products for each section
    const enrichedSections = await Promise.all((sections || []).map(async (section) => {
      let products: any[] = [];

      if (section.type === 'manual') {
        // Fetch manually assigned products
        const { data: spData } = await supabaseAdmin
          .from('section_products')
          .select('product_id, position, products(*, brands(*))')
          .eq('section_id', section.id)
          .order('position', { ascending: true });
        
        products = (spData || []).map(sp => sp.products).filter(Boolean);
      } else if (section.type === 'automated') {
        // Execute auto-rules
        const rule = section.auto_rule || {};
        let prodQuery = supabaseAdmin.from('products').select('*, brands(*)').eq('is_draft', false);

        // Scope to university if section is campus-specific
        if (section.university_id) {
          prodQuery = prodQuery.eq('university_id', section.university_id);
        }

        switch (rule.criteria) {
          case 'limited_stock':
            prodQuery = prodQuery.gt('stock_count', 0).lte('stock_count', rule.threshold || 5);
            break;
          case 'trending':
            // Simple trending: top views/sales
            prodQuery = prodQuery.order('views_count', { ascending: false });
            break;
          case 'top_sellers':
            prodQuery = prodQuery.order('sales_count', { ascending: false });
            break;
          case 'hot_deals':
            // Has original price and significant discount
            prodQuery = prodQuery.not('original_price', 'is', null).order('price', { ascending: true });
            break;
          case 'category':
            if (rule.category) prodQuery = prodQuery.eq('category', rule.category);
            break;
        }

        const { data: autoProds } = await prodQuery.limit(rule.limit || 12);
        products = autoProds || [];
      }

      return {
        ...section,
        products
      };
    }));

    return NextResponse.json({ sections: enrichedSections });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Tracking stats
export async function POST(req: NextRequest) {
  try {
    const { section_id, product_id, action } = await req.json(); // action: 'impression' | 'click' | 'conversion'
    
    if (!section_id || !product_id || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const column = action === 'impression' ? 'impressions' : 
                   action === 'click' ? 'clicks' : 'conversions';

    // Atomic increment
    const { error } = await supabaseAdmin.rpc('increment_merchandising_stat', {
      sec_id: section_id,
      prod_id: product_id,
      col_name: column
    });

    // Fallback if RPC doesn't exist (though RPC is safer)
    if (error) {
       // Manual upsert logic
       const { data: existing } = await supabaseAdmin
         .from('merchandising_stats')
         .select('*')
         .eq('section_id', section_id)
         .eq('product_id', product_id)
         .single();
       
       const updates: any = { section_id, product_id };
       updates[column] = (existing?.[column] || 0) + 1;
       
       await supabaseAdmin.from('merchandising_stats').upsert(updates);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
