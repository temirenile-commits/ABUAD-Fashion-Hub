-- ============================================================
-- MIGRATION: Drop and Recreate deliveries_status_check
-- ============================================================

-- 1. Drop existing restrictive constraint
ALTER TABLE public.deliveries 
  DROP CONSTRAINT IF EXISTS deliveries_status_check;

-- 2. Recreate with waiting_for_vendor allowed
ALTER TABLE public.deliveries 
  ADD CONSTRAINT deliveries_status_check 
  CHECK (status IN ('pending', 'waiting_for_vendor', 'assigned', 'picked_up', 'delivered', 'cancelled'));

-- 3. Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'deliveries_status_check';
