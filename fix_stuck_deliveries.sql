-- ============================================================
-- SQL Script: Fix Stuck/Old Deliveries
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- Update any delivery records that are waiting for vendor,
-- but the vendor has already marked the order as ready / ready_for_pickup
UPDATE public.deliveries d
SET status = 'pending'
FROM public.orders o
WHERE d.order_id = o.id
  AND d.agent_id IS NULL
  AND d.status = 'waiting_for_vendor'
  AND o.status IN ('ready', 'ready_for_pickup');

-- Notify schema update
NOTIFY pgrst, 'reload schema';
