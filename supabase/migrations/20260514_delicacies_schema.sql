-- ============================================================
-- MasterCart Delicacies — Schema Migration
-- Created: 2026-05-14
-- ============================================================

-- ── 1. EXTEND BRANDS TABLE ──────────────────────────────────
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS marketplace_type TEXT NOT NULL DEFAULT 'fashion'
    CHECK (marketplace_type IN ('fashion', 'delicacies', 'both')),
  ADD COLUMN IF NOT EXISTS delicacies_approval_status TEXT NOT NULL DEFAULT 'not_applied'
    CHECK (delicacies_approval_status IN ('not_applied', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS availability_start TIME,
  ADD COLUMN IF NOT EXISTS availability_end TIME,
  ADD COLUMN IF NOT EXISTS is_available_now BOOLEAN NOT NULL DEFAULT true;

-- ── 2. EXTEND PRODUCTS TABLE ────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_section TEXT NOT NULL DEFAULT 'fashion'
    CHECK (product_section IN ('fashion', 'delicacies')),
  ADD COLUMN IF NOT EXISTS delicacy_category TEXT
    CHECK (delicacy_category IN ('snacks', 'drinks', 'pastries', 'provisions', 'small_chops', 'beverages', 'other')),
  ADD COLUMN IF NOT EXISTS available_from TIMESTAMPTZ;

-- ── 3. EXTEND DELIVERY AGENTS TABLE ─────────────────────────
ALTER TABLE delivery_agents
  ADD COLUMN IF NOT EXISTS specialization TEXT NOT NULL DEFAULT 'general'
    CHECK (specialization IN ('general', 'delicacies')),
  ADD COLUMN IF NOT EXISTS weekly_compensation NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'in-campus'
    CHECK (agent_type IN ('in-campus', 'out-campus'));

-- ── 4. DELICACY BATCH ORDERS TABLE ──────────────────────────
CREATE TABLE IF NOT EXISTS delicacy_orders_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
  delicacy_category TEXT,
  batch_window_start TIMESTAMPTZ NOT NULL,
  batch_window_end TIMESTAMPTZ NOT NULL,
  assigned_agent_id UUID REFERENCES delivery_agents(id) ON DELETE SET NULL,
  order_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'in_transit', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. DELICACY VENDOR RANKINGS TABLE ───────────────────────
CREATE TABLE IF NOT EXISTS delicacy_vendor_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  rank INTEGER,
  orders_completed INTEGER NOT NULL DEFAULT 0,
  avg_rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
  complaints INTEGER NOT NULL DEFAULT 0,
  reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  badge TEXT CHECK (badge IN ('gold', 'silver', 'bronze')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brand_id, university_id, week_start)
);

-- ── 6. DELICACY REWARD POOL TABLE ───────────────────────────
CREATE TABLE IF NOT EXISTS delicacy_reward_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  total_collected NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_disbursed NUMERIC(10, 2) NOT NULL DEFAULT 0,
  operational_reserve NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (university_id, week_start)
);

-- ── 7. INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_section ON products(product_section);
CREATE INDEX IF NOT EXISTS idx_products_delicacy_cat ON products(delicacy_category);
CREATE INDEX IF NOT EXISTS idx_brands_marketplace_type ON brands(marketplace_type);
CREATE INDEX IF NOT EXISTS idx_brands_delicacies_approval ON brands(delicacies_approval_status);
CREATE INDEX IF NOT EXISTS idx_batch_status ON delicacy_orders_batch(status, university_id);
CREATE INDEX IF NOT EXISTS idx_rankings_week ON delicacy_vendor_rankings(week_start, university_id);
CREATE INDEX IF NOT EXISTS idx_agents_specialization ON delivery_agents(specialization, university_id);

-- ── 8. SEED GLOBAL DELICACIES COMMISSION SETTING ─────────────
-- Super admin can update this value from the admin dashboard at any time.
INSERT INTO platform_settings (key, value)
VALUES (
  'delicacies_commission_rate',
  '{"rate": 0, "updated_at": "2026-05-14", "updated_by": "system"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ── 9. SEED DEFAULT APPROVED DELICACY CATEGORIES ─────────────
INSERT INTO platform_settings (key, value)
VALUES (
  'delicacy_categories',
  '["snacks", "drinks", "pastries", "provisions", "small_chops", "beverages"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;
