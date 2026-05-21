-- ============================================================
-- SQL Script: Fix RLS Policies for Delivery Agents using Security Definer
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Create a Security Definer function to reliably check if a user is a delivery agent
-- Security Definer bypasses RLS on the users/delivery_agents tables, ensuring the check always works.
CREATE OR REPLACE FUNCTION public.is_delivery_agent()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('delivery', 'admin', 'university_admin')
  ) OR EXISTS (
    SELECT 1 FROM public.delivery_agents 
    WHERE id = auth.uid()
  );
$$;

-- 2. Update Orders RLS
DROP POLICY IF EXISTS "Allow customers, vendors, and delivery agents to select orders" ON public.orders;
CREATE POLICY "Allow customers, vendors, and delivery agents to select orders"
ON public.orders FOR SELECT
USING (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid())
  OR public.is_delivery_agent()
);

-- 3. Ensure Deliveries are readable and updatable
DROP POLICY IF EXISTS "Anyone can select deliveries" ON public.deliveries;
CREATE POLICY "Anyone can select deliveries" ON public.deliveries
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Delivery agents can update deliveries" ON public.deliveries;
CREATE POLICY "Delivery agents can update deliveries" ON public.deliveries
FOR UPDATE
USING (public.is_delivery_agent())
WITH CHECK (public.is_delivery_agent());

-- 4. Ensure Brands are readable by everyone (needed for dashboard queries)
DROP POLICY IF EXISTS "Anyone can select brands" ON public.brands;
CREATE POLICY "Anyone can select brands" ON public.brands
FOR SELECT USING (true);

-- 5. Ensure Products are readable by everyone
DROP POLICY IF EXISTS "Anyone can select products" ON public.products;
CREATE POLICY "Anyone can select products" ON public.products
FOR SELECT USING (true);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
