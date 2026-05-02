-- ATOMIC SCHEMA REPAIR SCRIPT (FINAL V3)
-- This script ensures all columns exist before adding foreign key relationships.
-- Run this in the Supabase SQL Editor.

-- ──────────────────────────────────────────────────────────
-- 1. USERS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS university_id UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ──────────────────────────────────────────────────────────
-- 2. BRANDS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS university_id UUID;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- ──────────────────────────────────────────────────────────
-- 3. PRODUCTS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS university_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS visibility_type TEXT DEFAULT 'university';

-- ──────────────────────────────────────────────────────────
-- 4. ORDERS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS university_id UUID;

-- ──────────────────────────────────────────────────────────
-- 5. REVIEWS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS university_id UUID;

-- ──────────────────────────────────────────────────────────
-- 6. DELIVERY AGENTS TABLE
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS university_id UUID;
ALTER TABLE public.delivery_agents ADD COLUMN IF NOT EXISTS completed_orders_count INTEGER DEFAULT 0;

-- ──────────────────────────────────────────────────────────
-- 7. APPLY FOREIGN KEY CONSTRAINTS (Ensure Joins Work)
-- ──────────────────────────────────────────────────────────

-- Reviews relationships
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_brand_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_product_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_university_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

-- Orders relationships
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_brand_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_university_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE CASCADE;

-- Brand/Product relationships
ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_owner_id_fkey;
ALTER TABLE public.brands ADD CONSTRAINT brands_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE;

-- Delivery Agent relationships
ALTER TABLE public.delivery_agents DROP CONSTRAINT IF EXISTS delivery_agents_id_fkey;
ALTER TABLE public.delivery_agents ADD CONSTRAINT delivery_agents_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ──────────────────────────────────────────────────────────
-- 8. MERCHANDISING TABLES (Homepage Banners & Sections)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.homepage_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID REFERENCES public.universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'manual',
  layout_type TEXT NOT NULL DEFAULT 'horizontal_scroll',
  auto_rule JSONB DEFAULT '{}'::jsonb,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.section_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(section_id, product_id)
);

-- ──────────────────────────────────────────────────────────
-- 9. DATA REPAIR & SCOPING
-- ──────────────────────────────────────────────────────────

-- Set default university for unassigned admins (ABUAD)
UPDATE public.users 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE role IN ('university_admin', 'university_staff', 'customer_support_agent') 
  AND university_id IS NULL;

-- Propagate university_id from owners to records
UPDATE public.brands b SET university_id = u.university_id FROM public.users u WHERE b.owner_id = u.id AND b.university_id IS NULL;
UPDATE public.delivery_agents da SET university_id = u.university_id FROM public.users u WHERE da.id = u.id AND da.university_id IS NULL;
UPDATE public.products p SET university_id = b.university_id FROM public.brands b WHERE p.brand_id = b.id AND p.university_id IS NULL;
UPDATE public.orders o SET university_id = u.university_id FROM public.users u WHERE o.customer_id = u.id AND o.university_id IS NULL;
UPDATE public.reviews r SET university_id = u.university_id FROM public.users u WHERE r.user_id = u.id AND r.university_id IS NULL;

-- ──────────────────────────────────────────────────────────
-- 10. REFRESH SCHEMA CACHE
-- ──────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
