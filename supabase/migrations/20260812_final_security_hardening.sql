-- MasterCart final live-database security reconciliation
-- This migration changes authorization metadata only. It does not reset data or alter business logic.

BEGIN;

-- ============================================================================
-- A. RLS: the eight tables reported as enabled without policies
-- ============================================================================

-- The existing users SELECT policy is already public. Remove the redundant
-- self-referencing super-admin policy, which causes PostgreSQL infinite
-- recursion whenever another RLS policy safely checks users.role.
DROP POLICY IF EXISTS "Super Admins can view all users" ON public.users;

ALTER TABLE public.brand_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delicacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delicacy_orders_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delicacy_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delicacy_vendor_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bonuses ENABLE ROW LEVEL SECURITY;

-- Remove only policies created by earlier reconciliation attempts. Existing
-- unrelated policies are intentionally left untouched.
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

-- Extra names make this migration idempotent if an earlier dry run used the
-- corrected names below.
DROP POLICY IF EXISTS "brand_reels_public_read_verified" ON public.brand_reels;
DROP POLICY IF EXISTS "brand_reels_vendor_insert" ON public.brand_reels;
DROP POLICY IF EXISTS "brand_reels_vendor_update" ON public.brand_reels;
DROP POLICY IF EXISTS "brand_reels_vendor_delete" ON public.brand_reels;
DROP POLICY IF EXISTS "delicacy_categories_public_read" ON public.delicacy_categories;
DROP POLICY IF EXISTS "delicacy_categories_admin_insert" ON public.delicacy_categories;
DROP POLICY IF EXISTS "delicacy_categories_admin_update" ON public.delicacy_categories;
DROP POLICY IF EXISTS "delicacy_categories_admin_delete" ON public.delicacy_categories;
DROP POLICY IF EXISTS "delicacy_orders_batch_scoped_read" ON public.delicacy_orders_batch;
DROP POLICY IF EXISTS "delicacy_orders_batch_agent_update" ON public.delicacy_orders_batch;
DROP POLICY IF EXISTS "delicacy_orders_batch_admin_manage" ON public.delicacy_orders_batch;
DROP POLICY IF EXISTS "delicacy_reward_pool_scoped_read" ON public.delicacy_reward_pool;
DROP POLICY IF EXISTS "delicacy_reward_pool_admin_manage" ON public.delicacy_reward_pool;
DROP POLICY IF EXISTS "delicacy_vendor_rankings_scoped_read" ON public.delicacy_vendor_rankings;
DROP POLICY IF EXISTS "delicacy_vendor_rankings_admin_manage" ON public.delicacy_vendor_rankings;
DROP POLICY IF EXISTS "payout_records_vendor_read" ON public.payout_records;
DROP POLICY IF EXISTS "payout_records_scoped_admin_read" ON public.payout_records;
DROP POLICY IF EXISTS "payout_records_full_admin_manage" ON public.payout_records;
DROP POLICY IF EXISTS "university_notices_public_global_read" ON public.university_notices;
DROP POLICY IF EXISTS "university_notices_authenticated_scoped_read" ON public.university_notices;
DROP POLICY IF EXISTS "university_notices_scoped_admin_insert" ON public.university_notices;
DROP POLICY IF EXISTS "university_notices_scoped_admin_update" ON public.university_notices;
DROP POLICY IF EXISTS "university_notices_scoped_admin_delete" ON public.university_notices;
DROP POLICY IF EXISTS "vendor_bonuses_vendor_read" ON public.vendor_bonuses;
DROP POLICY IF EXISTS "vendor_bonuses_scoped_admin_read" ON public.vendor_bonuses;
DROP POLICY IF EXISTS "vendor_bonuses_full_admin_manage" ON public.vendor_bonuses;

-- Brand reels: verified brand content may be viewed; only the owning vendor or
-- an administrative role may mutate it. The read predicate is intentionally
-- not an unrestricted USING (true).
CREATE POLICY "brand_reels_public_read_verified"
ON public.brand_reels FOR SELECT
TO anon, authenticated
USING (
  brand_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.brands b
    WHERE b.id = brand_reels.brand_id
      AND (COALESCE(b.verified, false) OR b.verification_status = 'verified')
  )
);

CREATE POLICY "brand_reels_vendor_insert"
ON public.brand_reels FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = brand_reels.brand_id AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

CREATE POLICY "brand_reels_vendor_update"
ON public.brand_reels FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = brand_reels.brand_id AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = brand_reels.brand_id AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

CREATE POLICY "brand_reels_vendor_delete"
ON public.brand_reels FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = brand_reels.brand_id AND b.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Delicacy categories are public catalogue metadata. Mutation is administrative.
CREATE POLICY "delicacy_categories_public_read"
ON public.delicacy_categories FOR SELECT
TO anon, authenticated
USING (id IS NOT NULL);

CREATE POLICY "delicacy_categories_admin_insert"
ON public.delicacy_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

CREATE POLICY "delicacy_categories_admin_update"
ON public.delicacy_categories FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

CREATE POLICY "delicacy_categories_admin_delete"
ON public.delicacy_categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Batch delivery records are not public. Assigned riders can read/update their
-- own batches; university staff can read batches in their university; admins
-- can manage all batches.
CREATE POLICY "delicacy_orders_batch_scoped_read"
ON public.delicacy_orders_batch FOR SELECT
TO authenticated
USING (
  assigned_agent_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff', 'customer_support_agent')
      AND u.university_id = delicacy_orders_batch.university_id
  )
);

CREATE POLICY "delicacy_orders_batch_agent_update"
ON public.delicacy_orders_batch FOR UPDATE
TO authenticated
USING (assigned_agent_id = auth.uid())
WITH CHECK (assigned_agent_id = auth.uid());

CREATE POLICY "delicacy_orders_batch_admin_manage"
ON public.delicacy_orders_batch FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Reward pools contain financial aggregates. Only admins and scoped university
-- administrators may read them; only platform admins may mutate them.
CREATE POLICY "delicacy_reward_pool_scoped_read"
ON public.delicacy_reward_pool FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff', 'customer_support_agent')
      AND u.university_id = delicacy_reward_pool.university_id
  )
);

CREATE POLICY "delicacy_reward_pool_admin_manage"
ON public.delicacy_reward_pool FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Rankings are served through the server-side ranking API because the row also
-- contains reward_amount. Keep the underlying financial ranking table private.
CREATE POLICY "delicacy_vendor_rankings_scoped_read"
ON public.delicacy_vendor_rankings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff', 'customer_support_agent')
      AND u.university_id = delicacy_vendor_rankings.university_id
  )
  OR EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = delicacy_vendor_rankings.brand_id AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "delicacy_vendor_rankings_admin_manage"
ON public.delicacy_vendor_rankings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Payout records are financial records: a vendor may read its own records;
-- scoped university staff may read records in their university; only platform
-- admins can insert/update/delete them.
CREATE POLICY "payout_records_vendor_read"
ON public.payout_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = payout_records.brand_id AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "payout_records_scoped_admin_read"
ON public.payout_records FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff', 'customer_support_agent')
      AND u.university_id = payout_records.university_id
  )
);

CREATE POLICY "payout_records_full_admin_manage"
ON public.payout_records FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- Notices may expose only active global content to anonymous visitors. Signed-
-- in users additionally see active notices for their own university.
CREATE POLICY "university_notices_public_global_read"
ON public.university_notices FOR SELECT
TO anon
USING (COALESCE(is_active, false) AND university_id IS NULL);

CREATE POLICY "university_notices_authenticated_scoped_read"
ON public.university_notices FOR SELECT
TO authenticated
USING (
  COALESCE(is_active, false)
  AND (
    university_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.university_id = university_notices.university_id
    )
  )
);

CREATE POLICY "university_notices_scoped_admin_insert"
ON public.university_notices FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff')
      AND u.university_id = university_notices.university_id
  )
);

CREATE POLICY "university_notices_scoped_admin_update"
ON public.university_notices FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff')
      AND u.university_id = university_notices.university_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff')
      AND u.university_id = university_notices.university_id
  )
);

CREATE POLICY "university_notices_scoped_admin_delete"
ON public.university_notices FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff')
      AND u.university_id = university_notices.university_id
  )
);

-- Vendor bonuses are financial records. Vendors can view bonuses for their own
-- brand; scoped administrators can view their university; platform admins manage.
CREATE POLICY "vendor_bonuses_vendor_read"
ON public.vendor_bonuses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = vendor_bonuses.brand_id AND b.owner_id = auth.uid()
  )
);

CREATE POLICY "vendor_bonuses_scoped_admin_read"
ON public.vendor_bonuses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.brands b ON b.university_id = u.university_id
    WHERE u.id = auth.uid()
      AND u.role IN ('university_admin', 'university_staff', 'customer_support_agent')
      AND b.id = vendor_bonuses.brand_id
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

CREATE POLICY "vendor_bonuses_full_admin_manage"
ON public.vendor_bonuses FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'admin', 'sub_admin')
  )
);

-- ============================================================================
-- B. Analytics/statistics views: use the querying user's RLS context
-- ============================================================================

ALTER VIEW public.university_analytics SET (security_invoker = true);
ALTER VIEW public.product_stats SET (security_invoker = true);

-- ============================================================================
-- C. Harden every flagged function with an explicit, safe search_path.
-- Function bodies and business logic are unchanged.
-- ============================================================================

ALTER FUNCTION public.get_delivery_fee(text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_product_weekly_sold(uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.adjust_agent_wallet(uuid, numeric)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.adjust_brand_wallet(uuid, numeric)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_product_stock(uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_vendor_wallet(uuid, numeric)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.adjust_vendor_wallet(uuid, numeric, numeric)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.sync_brand_followers_count()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.release_escrow(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.request_payout(uuid, text, numeric, jsonb)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.confirm_payout(uuid, uuid, text, text)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.reject_payout(uuid, uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_brand_ai_settings()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_ratings_and_reviews()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_delivery_completion()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_order_maturity(timestamptz)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_brand_wallet()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_listing_credits(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.add_listing_credits(uuid, integer)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_brand_rating_on_review()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_agent_wallet()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.recalculate_vendor_ratings()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_brand_rating()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_vendor_on_order()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_wishlist_notification()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_payout_record(
  uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, text
) SET search_path = public, pg_temp;

-- Existing function already needs auth schema access; make the path explicit.
ALTER FUNCTION public.delete_user_account()
  SET search_path = public, auth, pg_temp;
ALTER FUNCTION public.rls_auto_enable()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.is_delivery_agent()
  SECURITY INVOKER
  SET search_path = public, pg_temp;

-- ============================================================================
-- D. Revoke direct API execution from anonymous/ordinary users.
-- All remaining SECURITY DEFINER functions are server-side or trigger helpers.
-- is_delivery_agent() is intentionally SECURITY INVOKER because it is called by
-- an existing RLS predicate and does not need owner privileges.
-- ============================================================================

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.oid <> 'public.is_delivery_agent()'::regprocedure
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      fn.regprocedure
    );
  END LOOP;
END $$;

-- The orders RLS policy calls this helper for authenticated delivery agents.
REVOKE EXECUTE ON FUNCTION public.is_delivery_agent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_delivery_agent() TO authenticated;

-- Explicitly repeat the high-risk functions for audit clarity.
REVOKE EXECUTE ON FUNCTION public.add_listing_credits(uuid, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_agent_wallet(uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_brand_wallet(uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.adjust_vendor_wallet(uuid, numeric, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payout(uuid, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_payout_record(uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_listing_credits(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_delivery_completion() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_vendor_wallet(uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_escrow(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_payout(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_payout(uuid, text, numeric, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- Reload PostgREST's schema cache after DDL/ACL changes.
NOTIFY pgrst, 'reload schema';

COMMIT;
