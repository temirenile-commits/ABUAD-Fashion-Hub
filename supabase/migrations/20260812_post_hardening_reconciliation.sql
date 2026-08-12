-- MasterCart post-hardening reconciliation
-- Idempotent follow-up for live fixes discovered during authenticated testing.
-- No production rows are changed.

BEGIN;

-- The existing users SELECT policy is already public. Remove the redundant
-- self-referencing policy that causes recursion when RLS checks users.role.
DROP POLICY IF EXISTS "Super Admins can view all users" ON public.users;

-- The wallet helper was missing an explicit path in the first hardening pass.
ALTER FUNCTION public.adjust_brand_wallet(uuid, numeric)
  SET search_path = public, pg_temp;

-- This helper only checks rows already visible to the caller; it does not need
-- SECURITY DEFINER owner privileges. It remains executable by authenticated
-- sessions because an existing orders RLS predicate calls it.
ALTER FUNCTION public.is_delivery_agent()
  SECURITY INVOKER
  SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.is_delivery_agent() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_delivery_agent() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
