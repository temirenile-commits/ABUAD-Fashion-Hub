-- ============================================================
-- Migration: Delivery Agent Live Pipeline Fix
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Ensure deliveries table has all columns the new dashboard reads
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone TEXT,
  ADD COLUMN IF NOT EXISTS live_location_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS live_location_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Keep delivery_agents.university_id in sync with users.university_id
--    (Back-fill any existing rows that are missing it)
UPDATE public.delivery_agents da
SET university_id = u.university_id
FROM public.users u
WHERE da.id = u.id
  AND da.university_id IS NULL;

-- 3. Enable Realtime on BOTH deliveries AND orders tables so the
--    dual-listener in the delivery dashboard catches all events instantly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- 4. RLS: Delivery agents must be able to SELECT orders so the dashboard
--    join to orders works client-side.
DROP POLICY IF EXISTS "Allow customers, vendors, and delivery agents to select orders" ON public.orders;
CREATE POLICY "Allow customers, vendors, and delivery agents to select orders"
ON public.orders FOR SELECT
USING (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('delivery', 'admin', 'university_admin'))
);

-- 5. RLS: Delivery agents can SELECT deliveries (already exists, kept idempotent)
DROP POLICY IF EXISTS "Anyone can select deliveries" ON public.deliveries;
CREATE POLICY "Anyone can select deliveries" ON public.deliveries
FOR SELECT USING (true);

-- 6. RLS: Delivery agents can UPDATE deliveries (claim + status changes)
DROP POLICY IF EXISTS "Delivery agents can update deliveries" ON public.deliveries;
CREATE POLICY "Delivery agents can update deliveries" ON public.deliveries
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('delivery', 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('delivery', 'admin'))
);

-- 7. Index to speed up the available-orders queue query
CREATE INDEX IF NOT EXISTS idx_deliveries_agent_status
  ON public.deliveries (agent_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_status_university
  ON public.orders (status, university_id);

-- 8. Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
