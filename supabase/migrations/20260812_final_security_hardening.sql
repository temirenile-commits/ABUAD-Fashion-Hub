-- MasterCart Final Security & Hardening Migration
-- Created: 2026-08-12
-- Secures RLS policies, converts analytics views to security invoker, revokes public/anon execution on sensitive RPCs, and hardens search_paths.

-- ==============================================================================
-- 1. RLS RECONCILIATION FOR 8 TABLES
-- ==============================================================================

ALTER TABLE IF EXISTS public.brand_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_orders_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.delicacy_vendor_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.university_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_bonuses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
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

-- Create least-privilege policies
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
  AND university_id IN (SELECT university_id FROM public.users WHERE id = auth.uid())
);

CREATE POLICY "Vendor read vendor_bonuses" ON public.vendor_bonuses FOR SELECT USING (
  auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id)
);
CREATE POLICY "Admin manage vendor_bonuses" ON public.vendor_bonuses FOR ALL USING (
  auth.uid() IN (SELECT id FROM public.users WHERE role IN ('super_admin', 'admin', 'sub_admin'))
);


-- ==============================================================================
-- 2. SECURE VIEWS (Convert analytics/stats views to SECURITY INVOKER where safe)
-- ==============================================================================

ALTER VIEW IF EXISTS public.university_analytics SET (security_invoker = true);
ALTER VIEW IF EXISTS public.product_stats SET (security_invoker = true);


-- ==============================================================================
-- 3. REVOKE PUBLIC/ANON EXECUTE ON SENSITIVE FINANCIAL & HELPER RPCs
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.adjust_agent_wallet(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_brand_wallet(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.adjust_vendor_wallet(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_payout(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_payout_record(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_payout(uuid, numeric, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_escrow(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_payout(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;


-- ==============================================================================
-- 4. HARDEN FUNCTION SEARCH_PATHS
-- ==============================================================================

ALTER FUNCTION IF EXISTS public.get_delivery_fee(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.increment_product_weekly_sold(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.adjust_agent_wallet(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.decrement_product_stock(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.increment_vendor_wallet(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.adjust_vendor_wallet(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.sync_brand_followers_count(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.release_escrow(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.request_payout(uuid, numeric, text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.confirm_payout(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.reject_payout(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_new_brand_ai_settings() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.sync_ratings_and_reviews(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_delivery_completion(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.calculate_order_maturity() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_new_brand_wallet() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.decrement_listing_credits(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.add_listing_credits(uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.update_brand_rating_on_review() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_new_agent_wallet() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.recalculate_vendor_ratings(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.update_brand_rating(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.notify_vendor_on_order() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.handle_wishlist_notification() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.create_payout_record(uuid, numeric, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.rls_auto_enable() SET search_path = public, pg_temp;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
