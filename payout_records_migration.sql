-- ============================================================
-- MasterCart Financial Engine — Payout Records Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Automated payout calculation records (one per order, created on delivery)
CREATE TABLE IF NOT EXISTS payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id),
  university_id UUID,
  -- Financial Breakdown
  gross_amount NUMERIC NOT NULL DEFAULT 0,         -- Full order value
  commission_deduction NUMERIC NOT NULL DEFAULT 0, -- Platform commission cut
  promo_deduction NUMERIC NOT NULL DEFAULT 0,      -- Promo discount absorbed by admin/vendor
  delivery_fee_allocation NUMERIC NOT NULL DEFAULT 0, -- Delivery fee portion for agent
  net_payout NUMERIC NOT NULL DEFAULT 0,           -- Final amount owed to vendor
  -- Metadata
  product_section TEXT DEFAULT 'fashion',          -- 'fashion' | 'delicacies'
  calculation_notes TEXT,                          -- Human-readable breakdown
  -- Admin Workflow
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | transferred | confirmed | cancelled
  admin_transfer_reference TEXT,                   -- Bank transfer ref entered by admin
  admin_proof_url TEXT,                            -- Upload proof of transfer
  transferred_by UUID,                             -- Admin user who marked as transferred
  transferred_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS idx_payout_records_brand ON payout_records(brand_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_status ON payout_records(status);
CREATE INDEX IF NOT EXISTS idx_payout_records_university ON payout_records(university_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_order ON payout_records(order_id);

-- 2. Vendor bonuses ledger (weekly rankings, campaign bonuses)
CREATE TABLE IF NOT EXISTS vendor_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  type TEXT NOT NULL,        -- 'weekly_ranking' | 'campaign' | 'top_vendor' | 'delicacies_award'
  amount NUMERIC NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending | paid
  payout_record_id UUID REFERENCES payout_records(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RPC to safely create a payout record (idempotent — won't duplicate)
CREATE OR REPLACE FUNCTION create_payout_record(
  p_order_id UUID,
  p_brand_id UUID,
  p_university_id UUID,
  p_gross_amount NUMERIC,
  p_commission_deduction NUMERIC,
  p_promo_deduction NUMERIC,
  p_delivery_fee_allocation NUMERIC,
  p_net_payout NUMERIC,
  p_product_section TEXT,
  p_calculation_notes TEXT
) RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  -- Check if a record already exists for this order (idempotency)
  SELECT id INTO existing_id FROM payout_records WHERE order_id = p_order_id LIMIT 1;
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO payout_records (
    order_id, brand_id, university_id,
    gross_amount, commission_deduction, promo_deduction,
    delivery_fee_allocation, net_payout, product_section, calculation_notes
  ) VALUES (
    p_order_id, p_brand_id, p_university_id,
    p_gross_amount, p_commission_deduction, p_promo_deduction,
    p_delivery_fee_allocation, p_net_payout, p_product_section, p_calculation_notes
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
