-- ============================================================
-- MasterCart Delicacies — Advanced Categorization & Ads
-- Created: 2026-05-14
-- ============================================================

-- ── 1. UPDATE PRODUCT CATEGORIES ─────────────────────────────
-- Dropping and re-adding the check constraint to match requested categories
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_delicacy_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_delicacy_category_check
  CHECK (delicacy_category IN (
    'snacks', 
    'small_chops', 
    'pastries_baked', 
    'drinks_beverages', 
    'provisions', 
    'combo_packages', 
    'frozen_chilled', 
    'seasonal_trending',
    'other'
  ));

-- ── 2. CATEGORY SUGGESTIONS TABLE ────────────────────────────
CREATE TABLE IF NOT EXISTS public.category_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their own suggestions"
ON public.category_suggestions
FOR SELECT
USING (auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id));

CREATE POLICY "Vendors can insert suggestions"
ON public.category_suggestions
FOR INSERT
WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id));

CREATE POLICY "Admins can manage all suggestions"
ON public.category_suggestions
FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- ── 3. UPDATE PLATFORM SETTINGS FOR CATEGORIES ───────────────
INSERT INTO platform_settings (key, value)
VALUES (
  'delicacy_categories_v2',
  '[
    {"id": "snacks", "label": "Snacks", "icon": "Chips"},
    {"id": "small_chops", "label": "Small Chops", "icon": "PuffPuff"},
    {"id": "pastries_baked", "label": "Pastries & Baked Items", "icon": "Cake"},
    {"id": "drinks_beverages", "label": "Drinks & Beverages", "icon": "Coffee"},
    {"id": "provisions", "label": "Provisions", "icon": "ShoppingCart"},
    {"id": "combo_packages", "label": "Combo Packages", "icon": "Gift"},
    {"id": "frozen_chilled", "label": "Frozen & Chilled Items", "icon": "IceCream"},
    {"id": "seasonal_trending", "label": "Seasonal / Trending", "icon": "Star"}
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- ── 4. SEED INITIAL BILLBOARD ADS ─────────────────────────────
-- We'll placeholder this until we generate the image
INSERT INTO platform_settings (key, value)
VALUES (
  'manual_billboards',
  '[]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
