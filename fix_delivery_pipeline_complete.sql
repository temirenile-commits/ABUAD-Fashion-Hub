-- ============================================================
-- COMPLETE DELIVERY PIPELINE FIX
-- Run BOTH blocks in your Supabase SQL Editor
-- https://supabase.com/dashboard → SQL Editor
-- ============================================================


-- BLOCK 1: Fix stuck orders that are 'ready'/'ready_for_pickup'
-- but have NO matching delivery record (because vendor used self-delivery at checkout).
-- This inserts the missing delivery records so agents can see them.

INSERT INTO public.deliveries (order_id, status, delivery_fee)
SELECT
  o.id AS order_id,
  'pending' AS status,
  500 AS delivery_fee         -- default; will be overridden by university config on next claim
FROM public.orders o
LEFT JOIN public.deliveries d ON d.order_id = o.id
WHERE
  o.status IN ('ready', 'ready_for_pickup')
  AND d.id IS NULL;           -- Only insert where no delivery record exists


-- BLOCK 2: Fix delivery records that exist but are still 'waiting_for_vendor'
-- even though the order is already ready for pickup.

UPDATE public.deliveries d
SET status = 'pending'
FROM public.orders o
WHERE d.order_id = o.id
  AND d.agent_id IS NULL
  AND d.status = 'waiting_for_vendor'
  AND o.status IN ('ready', 'ready_for_pickup');


-- BLOCK 3: Fix delivery_method on all ready orders (force to 'platform')
-- so the frontend correctly shows the platform badge and the pipeline is consistent.

UPDATE public.orders
SET delivery_method = 'platform'
WHERE status IN ('ready', 'ready_for_pickup')
  AND (delivery_method IS NULL OR delivery_method != 'platform');


-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
