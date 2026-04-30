import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: authUsersData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    const { data: publicUsers, error: publicUsersError, count: userCount } = await supabaseAdmin.from('users').select('*', { count: 'exact' });
    const { data: brands, error: brandsError } = await supabaseAdmin.from('brands').select('*');
    const { data: products, error: productsError } = await supabaseAdmin.from('products').select('*');
    const { data: orders, error: ordersError } = await supabaseAdmin.from('orders').select('*');

    return NextResponse.json({
      message: "Please copy this entire JSON and paste it back to me. This will tell me exactly why your dashboard is empty.",
      diagnostics: {
        timestamp: new Date().toISOString(),
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      auth: {
        usersCount: authUsersData?.users?.length || 0,
        error: authError?.message || null,
      },
      publicDb: {
        usersCount: userCount,
        usersError: publicUsersError?.message || null,
        brandsCount: brands?.length || 0,
        brandsError: brandsError?.message || null,
        productsCount: products?.length || 0,
        productsError: productsError?.message || null,
        ordersCount: orders?.length || 0,
        ordersError: ordersError?.message || null,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
