import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUniversityId = searchParams.get('universityId');
    const universityId = rawUniversityId && rawUniversityId !== 'null' && rawUniversityId !== 'undefined' ? rawUniversityId : null;
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '40');

    // Fetch only delicacies products for this university or global ones
    let query = supabaseAdmin
      .from('products')
      .select(`
        id, title, description, price, original_price,
        delicacy_category, media_urls, image_url,
        stock_count, views_count, sales_count, rating,
        available_from, is_draft, product_section,
        brand_id, location_availability, cafeteria_ids,
          brands:brands!products_brand_id_fkey (
            id, name, logo_url, verified, verification_status,
          avg_rating, marketplace_type, delicacies_approval_status,
          availability_start, availability_end, is_available_now,
          university_id, delivery_scope, assigned_delivery_system
        )
      `)
      .eq('product_section', 'delicacies')
      .eq('is_draft', false)
      .gt('stock_count', 0)
      .order('sales_count', { ascending: false })
      .limit(limit);

    // Scope to a valid university or to global/legacy records when none is provided.
    query = universityId
      ? query.or(`university_id.eq.${universityId},visibility_type.eq.global,visibility_type.is.null,university_id.is.null`)
      : query.or('visibility_type.eq.global,visibility_type.is.null,university_id.is.null');

    if (category) {
      query = query.eq('delicacy_category', category);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter out brands not approved for delicacies
    const filtered = (data || []).filter((p) => {
      const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands;
      return brand?.delicacies_approval_status === 'approved';
    });

    return NextResponse.json({ products: filtered });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
