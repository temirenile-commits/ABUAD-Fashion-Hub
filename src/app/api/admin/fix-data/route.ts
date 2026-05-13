import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const output: any = {};

    // 1. Find vaxxi
    const { data: vaxxiData } = await supabaseAdmin.from('users').select('*').ilike('name', '%vaxxi%');
    output.vaxxi = vaxxiData;

    if (vaxxiData && vaxxiData.length > 0) {
      const vaxxiId = vaxxiData[0].id;
      // Get their brand
      const { data: brand } = await supabaseAdmin.from('brands').select('id, name').eq('owner_id', vaxxiId);
      output.vaxxiBrand = brand;
    }

    // 2. Find Success Osemuahu
    const { data: successData } = await supabaseAdmin.from('users').select('*').ilike('name', '%Success%');
    output.success = successData;

    if (successData && successData.length > 0) {
      const successId = successData.find((u: any) => u.name.includes('Success Osemuahu'))?.id;
      if (successId) {
        const { data: orders } = await supabaseAdmin.from('orders').select('*').eq('customer_id', successId);
        output.successOrders = orders;
        
        const { data: trans } = await supabaseAdmin.from('transactions').select('*').eq('user_id', successId);
        output.successTransactions = trans;
      }
    }

    return NextResponse.json(output);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
