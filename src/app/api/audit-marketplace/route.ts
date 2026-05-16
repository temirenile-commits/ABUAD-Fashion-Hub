import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Update NULL product_section to 'fashion'
    const { data: updatedRows, error: err1 } = await supabaseAdmin
      .from('products')
      .update({ product_section: 'fashion' })
      .is('product_section', null)
      .select('*');
    
    const nullCount = updatedRows?.length || 0;

    if (err1) throw err1;

    // 2. Cross-reference with brand marketplace_type
    const { data: brands } = await supabaseAdmin
      .from('brands')
      .select('id, marketplace_type');

    let correctedCount = 0;
    const mismatches: any[] = [];

    for (const brand of (brands || [])) {
      const brandType = brand.marketplace_type === 'delicacies' ? 'delicacies' : 'fashion';
      
      const { data: mismatchedProds } = await supabaseAdmin
        .from('products')
        .select('id, title, product_section')
        .eq('brand_id', brand.id)
        .neq('product_section', brandType);

      if (mismatchedProds && mismatchedProds.length > 0) {
        const ids = mismatchedProds.map(p => p.id);
        const { error: updErr } = await supabaseAdmin
          .from('products')
          .update({ product_section: brandType })
          .in('id', ids);
        
        if (!updErr) {
          correctedCount += ids.length;
          mismatches.push(...mismatchedProds.map(p => ({ ...p, correctedTo: brandType })));
        }
      }
    }

    return NextResponse.json({
      success: true,
      nullFixed: nullCount,
      mismatchFixed: correctedCount,
      details: mismatches
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
