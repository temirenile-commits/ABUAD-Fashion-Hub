import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacy_categories_v2')
      .single();

    if (error) throw error;

    return NextResponse.json({ categories: data?.value || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Super admin can add new approved categories
export async function POST(req: Request) {
  try {
    const { category, emoji, id } = await req.json();
    if (!id || !category) return NextResponse.json({ error: 'id and category are required' }, { status: 400 });

    const { data: current } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacy_categories_v2')
      .single();

    const existing: any[] = (current?.value as any[]) || [];
    if (existing.some(c => c.id === id)) {
      return NextResponse.json({ error: 'Category ID already exists' }, { status: 409 });
    }

    const updated = [...existing, { id, label: category, emoji: emoji || '🍽️' }];
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .update({ value: updated })
      .eq('key', 'delicacy_categories_v2');

    if (error) throw error;

    return NextResponse.json({ categories: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
