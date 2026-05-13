import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacy_categories')
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
    const { category } = await req.json();
    if (!category) return NextResponse.json({ error: 'category is required' }, { status: 400 });

    const { data: current } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacy_categories')
      .single();

    const existing: string[] = (current?.value as string[]) || [];
    if (existing.includes(category)) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }

    const updated = [...existing, category.toLowerCase().trim()];
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .update({ value: updated })
      .eq('key', 'delicacy_categories');

    if (error) throw error;

    return NextResponse.json({ categories: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
