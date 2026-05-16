import { supabaseAdmin } from '../../../lib/supabase-admin';

export async function GET() {
  try {
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('*, brands(id, name, marketplace_type, delicacies_approval_status, university_id)')
      .order('created_at', { ascending: false })
      .limit(5);

    return new Response(JSON.stringify(products), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
