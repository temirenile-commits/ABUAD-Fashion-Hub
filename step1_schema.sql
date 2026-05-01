-- ============================================================
-- STEP 1: SCHEMA CHANGES (DDL)
-- Run this script FIRST
-- NOTE: ALL INDEX CREATION HAS BEEN MOVED TO STEP 2
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

CREATE POLICY "Universities are publicly readable." 
  ON public.universities FOR SELECT USING (true);

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
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'super_admin', 'university_admin', 'university_staff',
      'vendor', 'customer', 'rider', 'admin', 'sub_admin', 'delivery'
    )
  );

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


-- ─── 5. PRODUCTS TABLE — ADD UNIVERSITY_ID + VISIBILITY ─────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS visibility_type TEXT DEFAULT 'university' 
    CHECK (visibility_type IN ('university', 'global')),
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS flash_sale_price DECIMAL,
  ADD COLUMN IF NOT EXISTS image_url TEXT;


-- ─── 6. ORDERS TABLE — ADD UNIVERSITY_ID ────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS admin_discount DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;


-- ─── 7. DELIVERIES TABLE — ADD UNIVERSITY_ID ────────────────
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id),
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;


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

DROP POLICY IF EXISTS "Public Media Access" ON storage.objects;
CREATE POLICY "Public Media Access" ON storage.objects 
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

-- Schema setup complete. Run step2_data.sql next.
