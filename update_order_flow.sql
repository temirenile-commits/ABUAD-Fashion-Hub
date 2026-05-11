-- Run this script in the Supabase SQL Editor

-- 1. Ensure orders table has the new status tracking and verification columns
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS delivery_code TEXT,
  ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

-- 2. Ensure deliveries table has denormalized agent info for easy access
ALTER TABLE public.deliveries 
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone TEXT;

-- 3. Optional: Ensure the deliveries table has 'picked_up' status in any check constraints if applicable.
-- If you use enums for status, you might need to update the enum type:
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready';
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_transit';

-- Done.
