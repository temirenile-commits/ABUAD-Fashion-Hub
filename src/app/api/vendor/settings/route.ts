import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { brandId, ownerId, updates } = await req.json();

    if (!brandId || !ownerId || !updates) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify ownership
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('owner_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (brand.owner_id !== ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    // 2. Update Brand Settings
    // Filter updates to allow only specific fields
    const allowedFields = [
      'name', 'description', 'logo_url', 'banner_url', 
      'whatsapp_number', 'instagram_link', 
      'return_policy', 'shipping_policy', 'social_links',
      'bank_account_number', 'bank_name', 'bank_code'
    ];
    
    const filteredUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const { data: updatedBrand, error: updateError } = await supabaseAdmin
      .from('brands')
      .update(filteredUpdates)
      .eq('id', brandId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, brand: updatedBrand });

  } catch (error: any) {
    console.error('Brand Settings Update Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
