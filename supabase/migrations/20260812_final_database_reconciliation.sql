-- MasterCart Final Comprehensive Database Reconciliation Migration
-- Created: 2026-08-12
-- Ensures RLS policies, search_path security on functions, storage, and clean schema without data loss.

-- 1. Enable RLS on all key tables
ALTER TABLE IF EXISTS public.brand_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_orders_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_vendor_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.university_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_bonuses ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing conflicting policies safely
DROP POLICY IF EXISTS "Public read brand_reels" ON public.brand_reels;
DROP POLICY IF EXISTS "Vendor manage brand_reels" ON public.brand_reels;
DROP POLICY IF EXISTS "Public read delicacy_categories" ON public.delicacy_categories;
DROP POLICY IF EXISTS "Admin manage delicacy_categories" ON public.delicacy_categories;
DROP POLICY IF EXISTS "Vendor manage delicacy_orders_batch" ON public.delicacy_orders_batch;
DROP POLICY IF EXISTS "Admin manage delicacy_orders_batch" ON public.delicacy_orders_batch;
DROP POLICY IF EXISTS "Vendor read delicacy_reward_pool" ON public.delicacy_reward_pool;
DROP POLICY IF EXISTS "Admin manage delicacy_reward_pool" ON public.delicacy_reward_pool;
DROP POLICY IF EXISTS "Public read delicacy_vendor_rankings" ON public.delicacy_vendor_rankings;
DROP POLICY IF EXISTS "Admin manage delicacy_vendor_rankings" ON public.delicacy_vendor_rankings;
DROP POLICY IF EXISTS "Vendor read payout_records" ON public.payout_records;
DROP POLICY IF EXISTS "Admin manage payout_records" ON public.payout_records;
DROP POLICY IF EXISTS "Public read university_notices" ON public.university_notices;
DROP POLICY IF EXISTS "Admin manage university_notices" ON public.university_notices;
DROP POLICY IF EXISTS "Vendor read vendor_bonuses" ON public.vendor_bonuses;
DROP POLICY IF EXISTS "Admin manage vendor_bonuses" ON public.vendor_bonuses;

-- 3. Create robust role-based RLS policies
CREATE POLICY "Public read brand_reels" ON public.brand_reels FOR SELECT USING (true);
CREATE POLICY "Vendor manage brand_reels" ON public.brand_reels FOR ALL USING (
  auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id)
  OR auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);

CREATE POLICY "Public read delicacy_categories" ON public.delicacy_categories FOR SELECT USING (true);
CREATE POLICY "Admin manage delicacy_categories" ON public.delicacy_categories FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);

CREATE POLICY "Vendor manage delicacy_orders_batch" ON public.delicacy_orders_batch FOR ALL USING (
  auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id)
  OR auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin', 'university_admin'))
);

CREATE POLICY "Public read delicacy_vendor_rankings" ON public.delicacy_vendor_rankings FOR SELECT USING (true);
CREATE POLICY "Admin manage delicacy_vendor_rankings" ON public.delicacy_vendor_rankings FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);

CREATE POLICY "Public read delicacy_reward_pool" ON public.delicacy_reward_pool FOR SELECT USING (true);
CREATE POLICY "Admin manage delicacy_reward_pool" ON public.delicacy_reward_pool FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);

CREATE POLICY "Vendor read payout_records" ON public.payout_records FOR SELECT USING (
  auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id)
);
CREATE POLICY "Admin manage payout_records" ON public.payout_records FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin', 'accountant'))
);

CREATE POLICY "Public read university_notices" ON public.university_notices FOR SELECT USING (true);
CREATE POLICY "Admin manage university_notices" ON public.university_notices FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin', 'university_admin'))
);

CREATE POLICY "Vendor read vendor_bonuses" ON public.vendor_bonuses FOR SELECT USING (
  auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id)
);
CREATE POLICY "Admin manage vendor_bonuses" ON public.vendor_bonuses FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);

-- 4. Secure Storage Bucket & Objects Policies for Product Media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read product media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated vendor upload product media" ON storage.objects;

CREATE POLICY "Public read product media" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Authenticated vendor upload product media" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'products' AND auth.role() = 'authenticated'
);

-- 5. Set explicit search_path on key helper functions to prevent mutable search_path warnings
ALTER FUNCTION IF EXISTS public.decrement_listing_credits(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.increment_vendor_wallet(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.adjust_vendor_wallet(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.request_payout(uuid, numeric, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.confirm_payout(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.reject_payout(uuid, text) SET search_path = public, pg_temp;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
