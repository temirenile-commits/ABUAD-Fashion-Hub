-- Migration to create homepage sections and section products for university merchandising
-- Run this in the Supabase SQL Editor

-- 1. Create homepage_sections table
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'automated'
  layout_type TEXT NOT NULL DEFAULT 'horizontal_scroll', -- 'horizontal_scroll' | 'grid' | 'banner'
  auto_rule JSONB DEFAULT '{}'::jsonb,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create section_products table (junction table for manual sections)
CREATE TABLE IF NOT EXISTS public.section_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(section_id, product_id)
);

-- 3. Add RLS Policies
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_products ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone
CREATE POLICY "Homepage sections are viewable by everyone" ON public.homepage_sections
  FOR SELECT USING (true);

CREATE POLICY "Section products are viewable by everyone" ON public.section_products
  FOR SELECT USING (true);

-- Allow full access to admins
CREATE POLICY "Admins have full access to homepage_sections" ON public.homepage_sections
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'university_admin')));

CREATE POLICY "Admins have full access to section_products" ON public.section_products
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'university_admin')));

-- 4. Notify about schema change
NOTIFY pgrst, 'reload schema';
