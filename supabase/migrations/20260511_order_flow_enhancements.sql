-- MIGRATION: Tracking Delivery Fees explicitly in orders
-- 2026-05-11

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee_charged DECIMAL DEFAULT 0.00;

-- Update existing orders: If delivery_method is platform, we assume 1500 for the first item in each batch?
-- Actually, better to just leave existing as 0 and start tracking from now.
