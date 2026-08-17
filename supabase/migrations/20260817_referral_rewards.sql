-- MasterCart Referral & Rewards — additive production migration
-- Implements user-to-user and user-to-vendor attribution, lineage, ledger,
-- server-enforced settings, idempotent rewards, reversals, and referral payouts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.referral_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('user_to_user', 'user_to_vendor')),
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  registration_count INTEGER NOT NULL DEFAULT 0 CHECK (registration_count >= 0),
  activated_count INTEGER NOT NULL DEFAULT 0 CHECK (activated_count >= 0),
  qualified_count INTEGER NOT NULL DEFAULT 0 CHECK (qualified_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_activity_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  visitor_key TEXT NOT NULL,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referred_brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('clicked', 'visited', 'registration_started', 'registered', 'activated', 'qualified', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.referral_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  referred_brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('user_to_user', 'user_to_vendor')),
  referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL,
  parent_referral_id UUID REFERENCES public.referral_relationships(id) ON DELETE SET NULL,
  root_referral_id UUID REFERENCES public.referral_relationships(id) ON DELETE SET NULL,
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 100),
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'activated', 'qualified', 'converted', 'paused', 'expired', 'reversed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  activated_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT referral_relationship_not_self CHECK (referrer_user_id <> referred_user_id),
  CONSTRAINT referral_relationship_vendor_target CHECK (
    (referral_type = 'user_to_vendor' AND referred_brand_id IS NOT NULL)
    OR (referral_type = 'user_to_user')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_relationship_user_parent_unique
  ON public.referral_relationships (referred_user_id, referral_type);
CREATE UNIQUE INDEX IF NOT EXISTS referral_relationship_vendor_unique
  ON public.referral_relationships (referred_brand_id)
  WHERE referral_type = 'user_to_vendor' AND referred_brand_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_link_id UUID REFERENCES public.referral_links(id) ON DELETE SET NULL,
  referral_id UUID REFERENCES public.referral_relationships(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('link_created', 'clicked', 'visited', 'registration_started', 'registered', 'activated', 'qualified', 'converted', 'earning_generated', 'earning_confirmed', 'earning_reversed', 'withdrawal_requested', 'withdrawal_processed')),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.referral_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  referral_id UUID REFERENCES public.referral_relationships(id) ON DELETE SET NULL,
  referral_type TEXT NOT NULL CHECK (referral_type IN ('user_to_user', 'user_to_vendor')),
  source_type TEXT NOT NULL CHECK (source_type IN ('REFERRAL_SIGNUP_REWARD', 'USER_PURCHASE_REFERRAL', 'VENDOR_SALES_REFERRAL', 'REFERRAL_REVERSAL', 'REFERRAL_WITHDRAWAL')),
  source_transaction_id UUID,
  source_key TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'available', 'withdrawn', 'reversed', 'cancelled')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  confirmed_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.referral_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS payout_requests_referral_scope_idx
  ON public.payout_requests (user_id, source_type, created_at, status);

CREATE INDEX IF NOT EXISTS referral_links_owner_idx ON public.referral_links(owner_user_id, referral_type);
CREATE INDEX IF NOT EXISTS referral_links_active_idx ON public.referral_links(is_active, referral_type);
CREATE INDEX IF NOT EXISTS referral_attributions_link_idx ON public.referral_attributions(referral_link_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS referral_relationship_referrer_idx ON public.referral_relationships(referrer_user_id, status, referral_type);
CREATE INDEX IF NOT EXISTS referral_relationship_referred_idx ON public.referral_relationships(referred_user_id, status, referral_type);
CREATE INDEX IF NOT EXISTS referral_relationship_brand_idx ON public.referral_relationships(referred_brand_id, status);
CREATE INDEX IF NOT EXISTS referral_events_relationship_idx ON public.referral_events(referral_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS referral_events_order_idx ON public.referral_events(source_order_id, event_type);
CREATE INDEX IF NOT EXISTS referral_ledger_beneficiary_idx ON public.referral_ledger(beneficiary_user_id, status, created_at);
CREATE INDEX IF NOT EXISTS referral_ledger_source_idx ON public.referral_ledger(source_transaction_id, source_type);
CREATE INDEX IF NOT EXISTS referral_audit_admin_idx ON public.referral_admin_audit(admin_id, created_at);

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_links_owner_read ON public.referral_links;
CREATE POLICY referral_links_owner_read ON public.referral_links FOR SELECT USING (auth.uid() = owner_user_id);
DROP POLICY IF EXISTS referral_relationship_owner_read ON public.referral_relationships;
CREATE POLICY referral_relationship_owner_read ON public.referral_relationships FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
DROP POLICY IF EXISTS referral_events_owner_read ON public.referral_events;
CREATE POLICY referral_events_owner_read ON public.referral_events FOR SELECT USING (
  auth.uid() = actor_user_id
  OR EXISTS (SELECT 1 FROM public.referral_relationships r WHERE r.id = referral_events.referral_id AND (r.referrer_user_id = auth.uid() OR r.referred_user_id = auth.uid()))
);
DROP POLICY IF EXISTS referral_ledger_owner_read ON public.referral_ledger;
CREATE POLICY referral_ledger_owner_read ON public.referral_ledger FOR SELECT USING (auth.uid() = beneficiary_user_id);
DROP POLICY IF EXISTS referral_admin_audit_admin_read ON public.referral_admin_audit;
CREATE POLICY referral_admin_audit_admin_read ON public.referral_admin_audit FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

INSERT INTO public.platform_settings (key, value)
VALUES ('referral_config', '{
  "global_enabled": true,
  "user_to_user_enabled": true,
  "user_to_vendor_enabled": true,
  "user_to_user_immediate_reward_enabled": false,
  "user_to_user_immediate_reward_amount": 0,
  "user_to_user_purchase_reward_enabled": true,
  "user_to_user_purchase_reward_percentage": 0,
  "user_to_vendor_reward_enabled": true,
  "user_to_vendor_reward_percentage": 0,
  "minimum_withdrawal": 1000,
  "maximum_withdrawal": 100000,
  "daily_withdrawal_limit": 100000,
  "weekly_withdrawal_limit": 300000,
  "monthly_withdrawal_limit": 1000000,
  "minimum_qualifying_purchase": 0,
  "minimum_vendor_sales": 0,
  "reward_confirmation_period_days": 0,
  "maximum_reward_per_referred_customer": null,
  "maximum_vendor_referral_earning": null,
  "maximum_lifetime_referral_reward": null
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_referral_config()
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(value, '{}'::jsonb) FROM public.platform_settings WHERE key = 'referral_config' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.referral_feature_enabled(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((get_referral_config()->>'global_enabled')::boolean, false)
    AND CASE p_type
      WHEN 'user_to_user' THEN COALESCE((get_referral_config()->>'user_to_user_enabled')::boolean, false)
      WHEN 'user_to_vendor' THEN COALESCE((get_referral_config()->>'user_to_vendor_enabled')::boolean, false)
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_referral_link(p_owner_user_id UUID, p_referral_type TEXT)
RETURNS public.referral_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.referral_links;
  v_code TEXT;
BEGIN
  IF NOT public.referral_feature_enabled(p_referral_type) THEN
    RAISE EXCEPTION 'This referral program is temporarily paused';
  END IF;
  SELECT * INTO v_link FROM public.referral_links WHERE owner_user_id = p_owner_user_id AND referral_type = p_referral_type AND is_active = true LIMIT 1;
  IF FOUND THEN RETURN v_link; END IF;
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_links WHERE code = v_code);
  END LOOP;
  INSERT INTO public.referral_links (owner_user_id, referral_type, code)
  VALUES (p_owner_user_id, p_referral_type, v_code)
  RETURNING * INTO v_link;
  INSERT INTO public.referral_events (referral_link_id, event_type, actor_user_id, event_key)
  VALUES (v_link.id, 'link_created', p_owner_user_id, 'link_created:' || v_link.id::text)
  ON CONFLICT (event_key) DO NOTHING;
  RETURN v_link;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_referral_attribution(
  p_code TEXT,
  p_referred_user_id UUID,
  p_referred_brand_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.referral_links;
  v_parent public.referral_relationships;
  v_relationship public.referral_relationships;
  v_type TEXT;
  v_amount NUMERIC;
  v_period INTEGER;
  v_config JSONB;
BEGIN
  SELECT * INTO v_link FROM public.referral_links WHERE code = upper(trim(p_code)) AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referral link is invalid'; END IF;
  v_type := CASE WHEN p_referred_brand_id IS NULL THEN 'user_to_user' ELSE 'user_to_vendor' END;
  IF v_link.referral_type <> v_type THEN RAISE EXCEPTION 'This referral is not available for this account type'; END IF;
  IF NOT public.referral_feature_enabled(v_type) THEN RAISE EXCEPTION 'Referral rewards are temporarily paused'; END IF;
  IF v_link.owner_user_id = p_referred_user_id THEN RAISE EXCEPTION 'You cannot refer yourself'; END IF;
  IF EXISTS (SELECT 1 FROM public.referral_relationships WHERE referred_user_id = p_referred_user_id AND referral_type = v_type) THEN
    SELECT * INTO v_relationship FROM public.referral_relationships WHERE referred_user_id = p_referred_user_id AND referral_type = v_type LIMIT 1;
    RETURN v_relationship.id;
  END IF;

  SELECT * INTO v_parent FROM public.referral_relationships WHERE referred_user_id = v_link.owner_user_id AND referral_type = 'user_to_user' LIMIT 1;
  INSERT INTO public.referral_relationships (
    referrer_user_id, referred_user_id, referred_brand_id, referral_type, referral_link_id,
    parent_referral_id, root_referral_id, depth, status, activated_at
  ) VALUES (
    v_link.owner_user_id, p_referred_user_id, p_referred_brand_id, v_type, v_link.id,
    v_parent.id, COALESCE(v_parent.root_referral_id, v_parent.id), COALESCE(v_parent.depth + 1, 0), 'activated', now()
  ) RETURNING * INTO v_relationship;

  UPDATE public.referral_links
  SET registration_count = registration_count + 1,
      activated_count = activated_count + 1,
      last_activity_at = now()
  WHERE id = v_link.id;

  INSERT INTO public.referral_events (referral_link_id, referral_id, event_type, actor_user_id, event_key, metadata)
  VALUES (v_link.id, v_relationship.id, 'registered', p_referred_user_id, 'registered:' || v_relationship.id::text, jsonb_build_object('referral_type', v_type))
  ON CONFLICT (event_key) DO NOTHING;
  INSERT INTO public.referral_events (referral_link_id, referral_id, event_type, actor_user_id, event_key)
  VALUES (v_link.id, v_relationship.id, 'activated', p_referred_user_id, 'activated:' || v_relationship.id::text)
  ON CONFLICT (event_key) DO NOTHING;
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (v_link.owner_user_id, 'referral', 'You have a new referral', 'A new account has activated through your referral link.', '/dashboard/customer/referrals', false);

  v_config := public.get_referral_config();
  IF v_type = 'user_to_user' AND COALESCE((v_config->>'user_to_user_immediate_reward_enabled')::boolean, false) THEN
    v_amount := COALESCE((v_config->>'user_to_user_immediate_reward_amount')::numeric, 0);
    IF v_amount > 0 THEN
      INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, confirmed_at, available_at, metadata)
      VALUES (v_link.owner_user_id, v_relationship.id, v_type, 'REFERRAL_SIGNUP_REWARD', v_relationship.id, 'signup:' || v_relationship.id::text, v_amount, 'available', 'One-time referral activation reward', now(), now(), jsonb_build_object('amount_rule', 'immediate_activation'))
      ON CONFLICT (source_key) DO NOTHING;
      INSERT INTO public.referral_events (referral_link_id, referral_id, event_type, actor_user_id, event_key, metadata)
      VALUES (v_link.id, v_relationship.id, 'earning_generated', v_link.owner_user_id, 'earning_generated:signup:' || v_relationship.id::text, jsonb_build_object('amount', v_amount))
      ON CONFLICT (event_key) DO NOTHING;
      INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
      VALUES (v_link.owner_user_id, 'referral', 'Referral reward earned', 'You earned ₦' || to_char(v_amount, 'FM999G999G990D00') || ' from a new referral.', '/dashboard/customer/referrals', false);
    END IF;
  END IF;
  RETURN v_relationship.id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_relationship FROM public.referral_relationships WHERE referred_user_id = p_referred_user_id AND referral_type = v_type LIMIT 1;
  RETURN v_relationship.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral_order(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_config JSONB;
  v_relationship RECORD;
  v_amount NUMERIC;
  v_count INTEGER := 0;
  v_period INTEGER;
  v_status TEXT;
  v_min NUMERIC;
  v_cap NUMERIC;
BEGIN
  SELECT id, customer_id, brand_id, total_amount, status INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR v_order.status NOT IN ('delivered', 'confirmed', 'completed') THEN RETURN 0; END IF;
  v_config := public.get_referral_config();
  v_period := COALESCE((v_config->>'reward_confirmation_period_days')::integer, 0);
  v_status := CASE WHEN v_period > 0 THEN 'pending' ELSE 'available' END;
  v_min := COALESCE((v_config->>'minimum_qualifying_purchase')::numeric, 0);
  IF COALESCE(v_order.total_amount, 0) < v_min THEN RETURN 0; END IF;

  IF public.referral_feature_enabled('user_to_user') AND COALESCE((v_config->>'user_to_user_purchase_reward_enabled')::boolean, false) THEN
    SELECT * INTO v_relationship FROM public.referral_relationships WHERE referred_user_id = v_order.customer_id AND referral_type = 'user_to_user' AND status IN ('activated', 'qualified', 'converted') LIMIT 1;
    IF FOUND THEN
      v_amount := round((v_order.total_amount * COALESCE((v_config->>'user_to_user_purchase_reward_percentage')::numeric, 0) / 100), 2);
      v_cap := (v_config->>'maximum_reward_per_referred_customer')::numeric;
      IF v_cap IS NOT NULL THEN
        SELECT GREATEST(v_cap - COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND source_type = 'USER_PURCHASE_REFERRAL' AND referral_id = v_relationship.id AND status NOT IN ('reversed','cancelled')), 0), 0) INTO v_amount FROM public.referral_ledger;
      END IF;
      IF v_amount > 0 THEN
        INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, confirmed_at, available_at, metadata)
        VALUES (v_relationship.referrer_user_id, v_relationship.id, 'user_to_user', 'USER_PURCHASE_REFERRAL', v_order.id, 'user_purchase:' || v_order.id::text || ':' || v_relationship.id::text, v_amount, v_status, 'Referral earning from a qualifying customer purchase', CASE WHEN v_status = 'available' THEN now() ELSE NULL END, CASE WHEN v_status = 'available' THEN now() ELSE NULL END, jsonb_build_object('order_amount', v_order.total_amount, 'percentage', v_config->'user_to_user_purchase_reward_percentage'))
        ON CONFLICT (source_key) DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
      END IF;
    END IF;
  END IF;

  IF public.referral_feature_enabled('user_to_vendor') AND COALESCE((v_config->>'user_to_vendor_reward_enabled')::boolean, false) THEN
    SELECT * INTO v_relationship FROM public.referral_relationships WHERE referred_brand_id = v_order.brand_id AND referral_type = 'user_to_vendor' AND status IN ('activated', 'qualified', 'converted') LIMIT 1;
    IF FOUND THEN
      v_amount := round((v_order.total_amount * COALESCE((v_config->>'user_to_vendor_reward_percentage')::numeric, 0) / 100), 2);
      v_cap := (v_config->>'maximum_vendor_referral_earning')::numeric;
      IF v_cap IS NOT NULL THEN v_amount := LEAST(v_amount, v_cap); END IF;
      IF v_amount > 0 THEN
        INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, confirmed_at, available_at, metadata)
        VALUES (v_relationship.referrer_user_id, v_relationship.id, 'user_to_vendor', 'VENDOR_SALES_REFERRAL', v_order.id, 'vendor_sale:' || v_order.id::text || ':' || v_relationship.id::text, v_amount, v_status, 'Referral earning from a qualifying vendor sale', CASE WHEN v_status = 'available' THEN now() ELSE NULL END, CASE WHEN v_status = 'available' THEN now() ELSE NULL END, jsonb_build_object('sale_amount', v_order.total_amount, 'percentage', v_config->'user_to_vendor_reward_percentage'))
        ON CONFLICT (source_key) DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
      END IF;
    END IF;
  END IF;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_referral_earnings(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_period INTEGER; v_count INTEGER;
BEGIN
  v_period := COALESCE((public.get_referral_config()->>'reward_confirmation_period_days')::integer, 0);
  UPDATE public.referral_ledger
  SET status = 'available', confirmed_at = COALESCE(confirmed_at, now()), available_at = now()
  WHERE status = 'pending'
    AND created_at <= now() - make_interval(days => v_period)
    AND (p_user_id IS NULL OR beneficiary_user_id = p_user_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_referral_order(p_order_id UUID, p_reason TEXT DEFAULT 'Underlying order was refunded or cancelled', p_refund_amount NUMERIC DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_amount NUMERIC;
  v_row RECORD;
  v_reversal NUMERIC;
  v_count INTEGER := 0;
  v_ratio NUMERIC;
BEGIN
  SELECT total_amount INTO v_order_amount FROM public.orders WHERE id = p_order_id;
  IF COALESCE(v_order_amount, 0) <= 0 THEN RETURN 0; END IF;
  v_ratio := LEAST(GREATEST(COALESCE(p_refund_amount, v_order_amount) / v_order_amount, 0), 1);
  FOR v_row IN SELECT * FROM public.referral_ledger WHERE source_transaction_id = p_order_id AND source_type IN ('USER_PURCHASE_REFERRAL', 'VENDOR_SALES_REFERRAL') AND status NOT IN ('reversed', 'cancelled') LOOP
    v_reversal := round(v_row.amount * v_ratio, 2);
    IF v_reversal <= 0 THEN CONTINUE; END IF;
    INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, reversed_at, metadata)
    VALUES (v_row.beneficiary_user_id, v_row.referral_id, v_row.referral_type, 'REFERRAL_REVERSAL', p_order_id, 'reversal:' || v_row.source_key || ':' || replace(v_ratio::text, '.', '_'), -v_reversal, 'reversed', p_reason, now(), jsonb_build_object('original_source_key', v_row.source_key, 'refund_ratio', v_ratio))
    ON CONFLICT (source_key) DO NOTHING;
    UPDATE public.referral_ledger SET status = CASE WHEN v_ratio >= 1 THEN 'reversed' ELSE status END, reversed_at = CASE WHEN v_ratio >= 1 THEN now() ELSE reversed_at END WHERE id = v_row.id;
    INSERT INTO public.referral_events (referral_id, event_type, actor_user_id, source_order_id, event_key, metadata)
    VALUES (v_row.referral_id, 'earning_reversed', v_row.beneficiary_user_id, p_order_id, 'earning_reversed:' || v_row.source_key || ':' || replace(v_ratio::text, '.', '_'), jsonb_build_object('amount', v_reversal, 'reason', p_reason))
    ON CONFLICT (event_key) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.referral_balance_summary(p_user_id UUID)
RETURNS TABLE(total_earned NUMERIC, pending_earnings NUMERIC, available_earnings NUMERIC, withdrawn_earnings NUMERIC, reversed_earnings NUMERIC)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND source_type <> 'REFERRAL_WITHDRAWAL' AND status NOT IN ('reversed','cancelled')), 0),
    COALESCE(SUM(amount) FILTER (WHERE amount > 0 AND status = 'pending'), 0),
    COALESCE(SUM(amount) FILTER (WHERE status IN ('available','confirmed')), 0) + COALESCE(SUM(amount) FILTER (WHERE source_type = 'REFERRAL_WITHDRAWAL' AND status IN ('pending','withdrawn')), 0),
    COALESCE(SUM(amount) FILTER (WHERE source_type = 'REFERRAL_WITHDRAWAL' AND status = 'withdrawn'), 0) * -1,
    COALESCE(SUM(amount) FILTER (WHERE source_type = 'REFERRAL_REVERSAL'), 0) * -1
  FROM public.referral_ledger WHERE beneficiary_user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.request_referral_payout(p_user_id UUID, p_amount NUMERIC, p_bank_details JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_config JSONB := public.get_referral_config();
  v_min NUMERIC := COALESCE((v_config->>'minimum_withdrawal')::numeric, 0);
  v_max NUMERIC := COALESCE((v_config->>'maximum_withdrawal')::numeric, 999999999);
  v_available NUMERIC;
  v_request_id UUID := gen_random_uuid();
  v_daily NUMERIC;
  v_weekly NUMERIC;
  v_monthly NUMERIC;
BEGIN
  PERFORM public.refresh_referral_earnings(p_user_id);
  IF NOT public.referral_feature_enabled('user_to_user') AND NOT public.referral_feature_enabled('user_to_vendor') THEN RAISE EXCEPTION 'Referral withdrawals are temporarily unavailable'; END IF;
  IF p_amount < v_min THEN RAISE EXCEPTION 'Minimum referral withdrawal is %', v_min; END IF;
  IF p_amount > v_max THEN RAISE EXCEPTION 'This withdrawal exceeds the maximum allowed per transaction'; END IF;
  SELECT available_earnings INTO v_available FROM public.referral_balance_summary(p_user_id);
  IF v_available < p_amount THEN RAISE EXCEPTION 'Insufficient available referral balance'; END IF;
  SELECT COALESCE(SUM(amount_requested),0) INTO v_daily FROM public.payout_requests WHERE user_id=p_user_id AND source_type='referral' AND created_at >= date_trunc('day', now()) AND status NOT IN ('rejected','failed','cancelled');
  SELECT COALESCE(SUM(amount_requested),0) INTO v_weekly FROM public.payout_requests WHERE user_id=p_user_id AND source_type='referral' AND created_at >= date_trunc('week', now()) AND status NOT IN ('rejected','failed','cancelled');
  SELECT COALESCE(SUM(amount_requested),0) INTO v_monthly FROM public.payout_requests WHERE user_id=p_user_id AND source_type='referral' AND created_at >= date_trunc('month', now()) AND status NOT IN ('rejected','failed','cancelled');
  IF v_daily + p_amount > COALESCE((v_config->>'daily_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Daily referral withdrawal limit exceeded'; END IF;
  IF v_weekly + p_amount > COALESCE((v_config->>'weekly_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Weekly referral withdrawal limit exceeded'; END IF;
  IF v_monthly + p_amount > COALESCE((v_config->>'monthly_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Monthly referral withdrawal limit exceeded'; END IF;
  INSERT INTO public.payout_requests (id, user_id, role, amount_requested, bank_details, status, source_type, source_metadata)
  VALUES (v_request_id, p_user_id, 'referral', p_amount, p_bank_details, 'pending', 'referral', jsonb_build_object('requested_at', now()));
  INSERT INTO public.referral_ledger (beneficiary_user_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, metadata)
  VALUES (p_user_id, 'user_to_user', 'REFERRAL_WITHDRAWAL', v_request_id, 'withdrawal:' || v_request_id::text, -p_amount, 'pending', 'Referral withdrawal requested', jsonb_build_object('payout_request_id', v_request_id));
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (p_user_id, 'referral', 'Referral withdrawal submitted', 'Your referral withdrawal request has been submitted for review.', '/dashboard/customer/referrals', false);
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_referral_payout(p_request_id UUID, p_admin_id UUID, p_proof_url TEXT, p_reference TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.payout_requests WHERE id=p_request_id AND source_type='referral' AND status IN ('pending','processing');
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.payout_requests SET status='completed', proof_url=p_proof_url, transfer_reference=p_reference, confirmed_by=p_admin_id, confirmed_at=now() WHERE id=p_request_id;
  UPDATE public.referral_ledger SET status='withdrawn', withdrawn_at=now() WHERE source_transaction_id=p_request_id AND source_type='REFERRAL_WITHDRAWAL';
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (v_req.user_id, 'referral', 'Referral withdrawal completed', 'Your referral withdrawal has been completed.', '/dashboard/customer/referrals', false);
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_referral_payout(p_request_id UUID, p_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.payout_requests WHERE id=p_request_id AND source_type='referral' AND status IN ('pending','processing');
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.payout_requests SET status='rejected', confirmed_by=p_admin_id, confirmed_at=now() WHERE id=p_request_id;
  UPDATE public.referral_ledger SET status='cancelled' WHERE source_transaction_id=p_request_id AND source_type='REFERRAL_WITHDRAWAL';
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (v_req.user_id, 'referral', 'Referral withdrawal rejected', 'Your referral withdrawal could not be completed. Your eligible referral balance has been restored.', '/dashboard/customer/referrals', false);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_config() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_feature_enabled(text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_referral_link(uuid,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_referral_attribution(text,uuid,uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral_order(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_referral_earnings(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_referral_order(uuid,text,numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_balance_summary(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.request_referral_payout(uuid,numeric,jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_referral_payout(uuid,uuid,text,text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_referral_payout(uuid,uuid) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
