-- 🚀 ABUAD FASHION HUB: MASTER SCHEMA SYNC 🚀
-- Run this in your Supabase SQL Editor to fix ALL "Schema Cache" errors.

-- 1. Ensure all modern Brand columns exist
DO $$ 
BEGIN 
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS room_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS matric_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS college TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS department TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS student_id_url TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS business_proof_url TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 0;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS max_reels INTEGER DEFAULT 0;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_level TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS visibility_score INTEGER DEFAULT 100;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL DEFAULT 0.00;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_code TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'platform';
END $$;

-- 2. Create Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read platform_settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admin write platform_settings" ON public.platform_settings FOR ALL USING (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- 3. Seed Default Pricing (Subscription Rates)
INSERT INTO public.platform_settings (key, value)
VALUES (
  'subscription_rates',
  '[
    {"id": "quarter", "name": "Quarter Power", "price": 5000, "period": "/month", "tagline": "25% vendor power", "color": "#3b82f6", "features": ["10 Products", "1 Reel", "Basic Analytics"]},
    {"id": "half", "name": "Half Power", "price": 10000, "period": "/month", "tagline": "50% vendor power", "color": "#7c3aed", "popular": true, "features": ["50 Products", "5 Reels", "Promo Codes", "Advanced Analytics"]},
    {"id": "full", "name": "Full Power", "price": 20000, "period": "/month", "tagline": "100% vendor power", "color": "#f59e0b", "features": ["Unlimited Products", "Unlimited Reels", "Premium Support", "Featured Listing"]}
  ]'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 4. Seed Default Boost Rates
INSERT INTO public.platform_settings (key, value)
VALUES (
  'boost_rates',
  '[
    {"id": "rodeo", "name": "Rodeo Boost", "price": 2000, "duration": "7 Days", "desc": "+50 Visibility", "icon": "zap"},
    {"id": "nitro", "name": "Nitro Boost", "price": 5000, "duration": "7 Days", "desc": "+150 Visibility", "icon": "flame", "popular": true},
    {"id": "apex", "name": "Apex Boost", "price": 10000, "duration": "7 Days", "desc": "+500 Visibility", "icon": "crown"}
  ]'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- 5. Seed Activation Fee
INSERT INTO public.platform_settings (key, value)
VALUES ('activation_fee', '{"amount": 2000}'::jsonb) 
ON CONFLICT (key) DO NOTHING;

-- 6. Final Refresh
NOTIFY pgrst, 'reload schema';
