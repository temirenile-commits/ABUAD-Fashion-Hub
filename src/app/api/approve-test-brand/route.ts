import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ delicacies_approval_status: 'approved' })
      .eq('name', 'Renile stores ');

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Brand approved for delicacies' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
