-- ============================================================
-- MULTI-UNIVERSITY MARKETPLACE MIGRATION
-- Master Cart Platform — Run in Supabase SQL Editor
-- ============================================================

-- ─── 1. UNIVERSITIES TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.universities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  abbreviation TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- Anyone can read universities (for dropdowns)
CREATE POLICY "Universities are publicly readable." 
  ON public.universities FOR SELECT USING (true);

-- Only service role (admin API) can modify
CREATE POLICY "Only service role can modify universities."
  ON public.universities FOR ALL 
  USING (false) WITH CHECK (false);

-- ─── 2. SEED DEFAULT ABUAD UNIVERSITY ───────────────────────
INSERT INTO public.universities (id, name, location, abbreviation, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Afe Babalola University Ado-Ekiti',
  'Ado-Ekiti, Ekiti State, Nigeria',
  'ABUAD',
  true
)
ON CONFLICT (name) DO UPDATE SET
  abbreviation = EXCLUDED.abbreviation,
  location = EXCLUDED.location;

-- ─── 3. EXPAND ROLES IN USERS TABLE ─────────────────────────
-- Drop existing CHECK constraint to expand roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Re-add role constraint with new roles
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'super_admin',
      'university_admin',
      'university_staff',
      'vendor',
      'customer',
      'rider',
      'admin',       -- legacy compat
      'sub_admin',   -- legacy compat
      'delivery'     -- legacy compat
    )
  );

-- Bulk-assign all existing users to ABUAD
UPDATE public.users 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

-- Promote existing 'admin' role to 'super_admin' conceptually
-- (We keep 'admin' role for backward compat but treat it as super_admin in code)

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_users_university_id ON public.users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- ─── 4. BRANDS TABLE — ADD UNIVERSITY_ID ────────────────────
ALTER TABLE public.brands 
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_listings_count INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'academic',
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS billboard_boost_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS delivery_scope TEXT DEFAULT 'campus',
  ADD COLUMN IF NOT EXISTS assigned_delivery_system TEXT;

-- Bulk-assign all existing brands to ABUAD
UPDATE public.brands 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_brands_university_id ON public.brands(university_id);
CREATE INDEX IF NOT EXISTS idx_brands_verification_status ON public.brands(verification_status);

-- ─── 5. PRODUCTS TABLE — ADD UNIVERSITY_ID + VISIBILITY ─────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS visibility_type TEXT DEFAULT 'university' 
    CHECK (visibility_type IN ('university', 'global')),
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flash_sale_price DECIMAL,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Bulk-assign existing products to ABUAD as local visibility
UPDATE public.products 
SET 
  university_id = '00000000-0000-0000-0000-000000000001',
  visibility_type = 'university'
WHERE university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_university_id ON public.products(university_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility_type ON public.products(visibility_type);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);

-- ─── 6. ORDERS TABLE — ADD UNIVERSITY_ID ────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS admin_discount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Backfill orders from customer's university
UPDATE public.orders o
SET university_id = u.university_id
FROM public.users u
WHERE o.customer_id = u.id AND o.university_id IS NULL;

-- Fallback for any orders still without university
UPDATE public.orders
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_university_id ON public.orders(university_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- ─── 7. DELIVERIES TABLE — ADD UNIVERSITY_ID ────────────────
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;

UPDATE public.deliveries d
SET university_id = o.university_id
FROM public.orders o
WHERE d.order_id = o.id AND d.university_id IS NULL;

UPDATE public.deliveries
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_university_id ON public.deliveries(university_id);

-- ─── 8. DELIVERY AGENTS TABLE — ADD UNIVERSITY_ID ───────────
CREATE TABLE IF NOT EXISTS public.delivery_agents (
  id UUID REFERENCES public.users(id) PRIMARY KEY,
  university_id UUID REFERENCES public.universities(id),
  is_active BOOLEAN DEFAULT FALSE,
  wallet_balance DECIMAL DEFAULT 0,
  completed_orders_count INTEGER DEFAULT 0,
  current_lat DECIMAL,
  current_long DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agents can view own profile." ON public.delivery_agents FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Service role manages agents." ON public.delivery_agents FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.delivery_agents
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);

UPDATE public.delivery_agents da
SET university_id = u.university_id
FROM public.users u
WHERE da.id = u.id AND da.university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_agents_university_id ON public.delivery_agents(university_id);

-- ─── 9. PLATFORM SETTINGS TABLE ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are publicly readable." ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Service role manages settings." ON public.platform_settings FOR ALL USING (false) WITH CHECK (false);

-- ─── 10. NOTIFICATIONS TABLE ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'broadcast',
  is_read BOOLEAN DEFAULT FALSE,
  university_id UUID REFERENCES public.universities(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications." ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages notifications." ON public.notifications FOR ALL USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_university_id ON public.notifications(university_id);

-- ─── 11. REVIEWS TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  product_id UUID REFERENCES public.products(id),
  brand_id UUID REFERENCES public.brands(id),
  university_id UUID REFERENCES public.universities(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews are publicly readable." ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users can write reviews." ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages reviews." ON public.reviews FOR ALL USING (false) WITH CHECK (false);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);

UPDATE public.reviews r
SET university_id = u.university_id
FROM public.users u
WHERE r.user_id = u.id AND r.university_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_university_id ON public.reviews(university_id);

-- ─── 12. PAYOUT REQUESTS TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  role TEXT NOT NULL,
  amount_requested DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  proof_url TEXT,
  reference TEXT,
  processed_by UUID REFERENCES public.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payout requests." ON public.payout_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create payout requests." ON public.payout_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages payouts." ON public.payout_requests FOR ALL USING (false) WITH CHECK (false);

-- ─── 13. PROMO CODES TABLE ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL NOT NULL,
  max_uses INTEGER DEFAULT 100,
  current_uses INTEGER DEFAULT 0,
  product_id UUID REFERENCES public.products(id),
  brand_id UUID REFERENCES public.brands(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promo codes are publicly readable." ON public.promo_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Service role manages promo codes." ON public.promo_codes FOR ALL USING (false) WITH CHECK (false);

-- ─── 14. UPDATED RLS POLICIES — PRODUCTS ────────────────────
-- Drop old blanket policy
DROP POLICY IF EXISTS "Products are viewable by everyone." ON public.products;

-- New: Customer marketplace visibility
-- Shows products that are global OR from the customer's own university
CREATE POLICY "Marketplace product visibility" ON public.products FOR SELECT
USING (
  visibility_type = 'global'
  OR (
    university_id IS NOT NULL
    AND university_id = (
      SELECT university_id FROM public.users WHERE id = auth.uid()
    )
  )
  OR auth.uid() IS NULL  -- anon users see global products only (handled by frontend)
);

-- Vendors can still see their own products regardless
CREATE POLICY "Vendors see own products" ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = products.brand_id AND brands.owner_id = auth.uid()
  )
);

-- ─── 15. UPDATED RLS — ORDERS ────────────────────────────────
DROP POLICY IF EXISTS "Customers view own orders." ON public.orders;
DROP POLICY IF EXISTS "Vendors view own orders." ON public.orders;

CREATE POLICY "Customers view own orders." ON public.orders FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Vendors view own orders." ON public.orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
  )
);

-- University admins/staff can view orders in their university
CREATE POLICY "University staff view scoped orders." ON public.orders FOR SELECT
USING (
  university_id = (
    SELECT university_id FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('university_admin', 'university_staff')
  )
);

-- ─── 16. CROSS-UNIVERSITY ANALYTICS VIEW (READ-ONLY) ────────
CREATE OR REPLACE VIEW public.university_analytics AS
SELECT
  u.id AS university_id,
  u.name AS university_name,
  u.abbreviation,
  COUNT(DISTINCT us.id) AS total_users,
  COUNT(DISTINCT b.id) AS total_vendors,
  COUNT(DISTINCT b.id) FILTER (WHERE b.verification_status = 'verified') AS verified_vendors,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid') AS paid_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'paid'), 0) AS total_revenue
FROM public.universities u
LEFT JOIN public.users us ON us.university_id = u.id
LEFT JOIN public.brands b ON b.university_id = u.id
LEFT JOIN public.products p ON p.university_id = u.id
LEFT JOIN public.orders o ON o.university_id = u.id
GROUP BY u.id, u.name, u.abbreviation;

-- Grant read access to authenticated users (university admins see aggregated data)
GRANT SELECT ON public.university_analytics TO authenticated;

-- ─── 17. STORAGE BUCKETS ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('product-media', 'product-media', true),
  ('brand-reels', 'brand-reels', true),
  ('product-images', 'product-images', true),
  ('brand-logos', 'brand-logos', true),
  ('payout_proofs', 'payout_proofs', false),
  ('student-ids', 'student-ids', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE POLICY IF NOT EXISTS "Public Media Access" ON storage.objects 
  FOR SELECT USING (bucket_id IN ('product-media', 'brand-reels', 'product-images', 'brand-logos'));

-- ─── 18. SEED DEFAULT PLATFORM SETTINGS ─────────────────────
INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_rate', '7.5'),
  ('subscription_rates', '[
    {"id":"free","name":"FREE","price":0,"max_products":5,"max_reels":1},
    {"id":"quarter","name":"QUARTER","price":2500,"max_products":25,"max_reels":3},
    {"id":"half","name":"HALF","price":4500,"max_products":50,"max_reels":6},
    {"id":"full","name":"FULL","price":7500,"max_products":200,"max_reels":20}
  ]'),
  ('free_tier_config', '{"max_products":5,"max_reels":1,"trial_days":7}'),
  ('plan_features', '{
    "free":[],
    "quarter":["whatsapp_chat","verified_badge"],
    "half":["whatsapp_chat","verified_badge","promo_codes","campus_nudges"],
    "full":["whatsapp_chat","verified_badge","promo_codes","campus_nudges","billboard_access","advanced_analytics","priority_support","reels_unlimited"]
  }')
ON CONFLICT (key) DO NOTHING;

-- Done! ✅
-- Run this file in the Supabase SQL Editor.
-- After running, assign university_id to users in the Super Admin dashboard.
