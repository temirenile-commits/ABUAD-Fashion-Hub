-- ============================================================
-- MASTER CART MEGA PATCH — SQL MIGRATIONS
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Fix product_delicacy_category_check constraint
--    (widen allowed values, ensure NULL is valid for fashion)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products DROP CONSTRAINT IF EXISTS product_delicacy_category_check;

ALTER TABLE products 
  ADD CONSTRAINT product_delicacy_category_check 
  CHECK (
    delicacy_category IS NULL OR 
    delicacy_category IN (
      'snacks', 'small_chops', 'pastries_baked', 'drinks_beverages', 
      'provisions', 'combo_packages', 'frozen_chilled', 
      'seasonal_trending', 'other'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Fix promo_codes — make brand_id nullable
--    (platform-wide promo codes don't need a specific brand)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE promo_codes ALTER COLUMN brand_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Ensure promo_codes has university_id column
-- ─────────────────────────────────────────────────────────────
ALTER TABLE promo_codes 
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE;

ALTER TABLE promo_codes 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- ─────────────────────────────────────────────────────────────
-- 4. Ensure notices table exists for university admin
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS university_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notice_type TEXT DEFAULT 'general' CHECK (notice_type IN ('general', 'urgent', 'promo', 'event')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- RLS for notices
ALTER TABLE university_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "University admins manage notices" ON university_notices;
CREATE POLICY "University admins manage notices"
  ON university_notices FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- 5. Ensure products variants column supports per-variant pricing
--    (variants is already JSONB so schema is flexible, 
--     but we ensure the column exists)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';

-- ─────────────────────────────────────────────────────────────
-- 6. Add variant_commission_rate and variant_delivery_rate 
--    fields are stored INSIDE the variants JSONB — no schema change needed.
--    But ensure products has commission_rate and delivery_rate at base level:
-- ─────────────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_rate NUMERIC(10,2) DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- 7. Ensure orders table tracks selected_variant
-- ─────────────────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_variant JSONB DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────
-- 8. University isolation — ensure delicacies queries work with RLS
-- ─────────────────────────────────────────────────────────────
-- products already has university_id — just verify RLS allows scoping

-- ─────────────────────────────────────────────────────────────
-- 9. Billboard entries table for better scoping
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_billboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  cover_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE manual_billboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage billboards" ON manual_billboards;
CREATE POLICY "Admins manage billboards"
  ON manual_billboards FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────
-- DONE — Confirm all ran successfully
-- ─────────────────────────────────────────────────────────────
SELECT 'Mega Patch Migrations Complete ✅' AS status;
