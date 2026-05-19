-- SQL Migration to fix RLS permissions and enable Realtime for logistics
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Drop existing SELECT policy on orders to avoid conflicts, then recreate with delivery agent permission
DROP POLICY IF EXISTS "Customers view own orders." ON public.orders;
DROP POLICY IF EXISTS "Vendors view own orders." ON public.orders;
DROP POLICY IF EXISTS "Delivery agents view platform orders" ON public.orders;

CREATE POLICY "Allow customers, vendors, and delivery agents to select orders" ON public.orders
FOR SELECT
USING (
  auth.uid() = customer_id 
  OR EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'delivery' OR role = 'admin'))
);

-- 2. Drop and recreate SELECT policy on deliveries table
DROP POLICY IF EXISTS "Users can track deliveries." ON public.deliveries;
DROP POLICY IF EXISTS "Anyone can select deliveries" ON public.deliveries;

CREATE POLICY "Anyone can select deliveries" ON public.deliveries 
FOR SELECT 
USING (true);

-- 3. Drop and recreate UPDATE policy on deliveries table to let agents accept/update delivery state
DROP POLICY IF EXISTS "Delivery agents can update deliveries" ON public.deliveries;

CREATE POLICY "Delivery agents can update deliveries" ON public.deliveries 
FOR UPDATE 
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'delivery' OR role = 'admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'delivery' OR role = 'admin'))
);

-- 4. Enable public read access on delivery_agents profile details (so vendors see name, avatar, and vehicle details)
DROP POLICY IF EXISTS "Agents can view their own profile" ON public.delivery_agents;
DROP POLICY IF EXISTS "Anyone can view delivery agents" ON public.delivery_agents;

CREATE POLICY "Anyone can view delivery agents" ON public.delivery_agents 
FOR SELECT 
USING (true);

-- 5. Enable real-time replication for deliveries table
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

-- Notify Postgres Schema Reload
NOTIFY pgrst, 'reload schema';
