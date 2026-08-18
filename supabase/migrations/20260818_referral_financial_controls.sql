-- MasterCart referral financial controls.
-- Extends the existing referral architecture; it does not replace attribution or reward tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.referral_relationships
  ADD COLUMN IF NOT EXISTS qualifying_transaction_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qualifying_transaction_limit INTEGER,
  ADD COLUMN IF NOT EXISTS earning_status TEXT NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_relationship_earning_status_check') THEN
    ALTER TABLE public.referral_relationships
      ADD CONSTRAINT referral_relationship_earning_status_check
      CHECK (earning_status IN ('ACTIVE', 'EXPIRED', 'PAUSED'));
  END IF;
END $$;

ALTER TABLE public.referral_ledger
  ADD COLUMN IF NOT EXISTS source_payment_id UUID,
  ADD COLUMN IF NOT EXISTS gross_transaction_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS applied_rate NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS funding_source TEXT,
  ADD COLUMN IF NOT EXISTS qualifying_transaction_number INTEGER,
  ADD COLUMN IF NOT EXISTS qualifying_transaction_limit INTEGER,
  ADD COLUMN IF NOT EXISTS remaining_qualifying_transactions INTEGER,
  ADD COLUMN IF NOT EXISTS mastercart_share_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS customer_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vendor_earning_amount NUMERIC(14,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_ledger_funding_source_check') THEN
    ALTER TABLE public.referral_ledger
      ADD CONSTRAINT referral_ledger_funding_source_check
      CHECK (funding_source IS NULL OR funding_source IN ('MASTER_CART_ADMIN_FUNDS', 'MASTER_CART_ADMIN_SHARE'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.referral_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  masked_account_number TEXT NOT NULL,
  verified_account_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('pending', 'verified', 'failed', 'inactive')),
  verification_reference TEXT,
  provider_recipient_code TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  attached_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  inactive_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_payout_accounts_one_active
  ON public.referral_payout_accounts(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS referral_payout_accounts_user_idx
  ON public.referral_payout_accounts(user_id, is_active, created_at DESC);

ALTER TABLE public.referral_payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_payout_accounts_owner_read ON public.referral_payout_accounts;
CREATE POLICY referral_payout_accounts_owner_read ON public.referral_payout_accounts
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS referral_payout_accounts_admin_read ON public.referral_payout_accounts;
CREATE POLICY referral_payout_accounts_admin_read ON public.referral_payout_accounts
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS referral_payout_account_id UUID REFERENCES public.referral_payout_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.payout_requests DROP CONSTRAINT IF EXISTS payout_requests_role_check;
ALTER TABLE public.payout_requests ADD CONSTRAINT payout_requests_role_check CHECK (role IN ('vendor', 'delivery', 'referral'));
ALTER TABLE public.payout_requests DROP CONSTRAINT IF EXISTS payout_requests_status_check;
ALTER TABLE public.payout_requests ADD CONSTRAINT payout_requests_status_check CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed', 'due', 'paid', 'cancelled', 'reversed'));

INSERT INTO public.platform_settings (key, value)
VALUES ('referral_config', jsonb_build_object(
  'global_enabled', true,
  'user_to_user_enabled', true,
  'user_to_vendor_enabled', true,
  'user_to_user_immediate_reward_enabled', false,
  'user_to_user_immediate_reward_amount', 0,
  'user_to_user_purchase_reward_enabled', true,
  'user_to_user_purchase_reward_percentage', 0,
  'user_to_user_reward_purchase_limit', 5,
  'user_to_user_maximum_reward', NULL,
  'user_to_vendor_reward_enabled', true,
  'user_to_vendor_reward_percentage', 0,
  'vendor_referral_qualifying_sale_limit', 10,
  'user_to_vendor_maximum_reward', NULL,
  'minimum_withdrawal', 1000,
  'maximum_withdrawal', 100000,
  'daily_withdrawal_limit', 100000,
  'weekly_withdrawal_limit', 300000,
  'monthly_withdrawal_limit', 1000000,
  'minimum_qualifying_purchase', 0,
  'minimum_vendor_sales', 0,
  'reward_confirmation_period_days', 0,
  'maximum_reward_per_referred_customer', NULL,
  'maximum_vendor_referral_earning', NULL,
  'maximum_lifetime_referral_reward', NULL
))
ON CONFLICT (key) DO UPDATE SET value = platform_settings.value || EXCLUDED.value, updated_at = now();

-- Backfill counters from existing positive purchase/sales ledger entries.
UPDATE public.referral_relationships r
SET qualifying_transaction_count = counts.total_count
FROM (
  SELECT referral_id, COUNT(DISTINCT source_transaction_id)::INTEGER AS total_count
  FROM public.referral_ledger
  WHERE source_type IN ('USER_PURCHASE_REFERRAL', 'VENDOR_SALES_REFERRAL')
    AND amount > 0
    AND status NOT IN ('reversed', 'cancelled')
  GROUP BY referral_id
) counts
WHERE r.id = counts.referral_id;

CREATE OR REPLACE FUNCTION public.mask_referral_account(p_account_number TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT repeat('*', greatest(length(regexp_replace(p_account_number, '\\D', '', 'g')) - 4, 0)) || right(regexp_replace(p_account_number, '\\D', '', 'g'), 4);
$$;

CREATE OR REPLACE FUNCTION public.attach_referral_payout_account(
  p_user_id UUID,
  p_bank_code TEXT,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_verified_account_name TEXT,
  p_verification_reference TEXT DEFAULT NULL,
  p_provider_recipient_code TEXT DEFAULT NULL
)
RETURNS public.referral_payout_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_account public.referral_payout_accounts;
  v_number TEXT := regexp_replace(trim(p_account_number), '\\D', '', 'g');
BEGIN
  IF length(v_number) < 10 OR length(v_number) > 12 THEN RAISE EXCEPTION 'Invalid bank account number'; END IF;
  IF nullif(trim(p_verified_account_name), '') IS NULL THEN RAISE EXCEPTION 'Verified account name is required'; END IF;
  UPDATE public.referral_payout_accounts
  SET is_active = FALSE, verification_status = 'inactive', inactive_at = now()
  WHERE user_id = p_user_id AND is_active = TRUE;
  INSERT INTO public.referral_payout_accounts (
    user_id, bank_code, bank_name, account_number, masked_account_number,
    verified_account_name, verification_status, verification_reference,
    provider_recipient_code, verified_at, attached_at, is_active
  ) VALUES (
    p_user_id, trim(p_bank_code), trim(p_bank_name), v_number, public.mask_referral_account(v_number),
    upper(trim(p_verified_account_name)), 'verified', p_verification_reference,
    p_provider_recipient_code, now(), now(), TRUE
  ) RETURNING * INTO v_account;
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_referral_payout(p_user_id UUID, p_amount NUMERIC, p_bank_details JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_config JSONB := public.get_referral_config();
  v_account public.referral_payout_accounts;
  v_available NUMERIC;
  v_min NUMERIC := COALESCE((v_config->>'minimum_withdrawal')::numeric, 0);
  v_max NUMERIC := COALESCE((v_config->>'maximum_withdrawal')::numeric, 999999999);
  v_request_id UUID := gen_random_uuid();
  v_account_id UUID := NULLIF(p_bank_details->>'payout_account_id', '')::UUID;
BEGIN
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'A verified payout account is required'; END IF;
  SELECT * INTO v_account FROM public.referral_payout_accounts WHERE id = v_account_id AND user_id = p_user_id AND is_active = TRUE AND verification_status = 'verified';
  IF NOT FOUND THEN RAISE EXCEPTION 'The payout account is not verified or does not belong to this user'; END IF;
  PERFORM public.refresh_referral_earnings(p_user_id);
  IF p_amount < v_min THEN RAISE EXCEPTION 'Minimum referral withdrawal is %', v_min; END IF;
  IF p_amount > v_max THEN RAISE EXCEPTION 'This withdrawal exceeds the maximum allowed per transaction'; END IF;
  SELECT available_earnings INTO v_available FROM public.referral_balance_summary(p_user_id);
  IF v_available < p_amount THEN RAISE EXCEPTION 'Insufficient available referral balance'; END IF;
  INSERT INTO public.payout_requests (id, user_id, role, amount_requested, bank_details, status, source_type, source_metadata, referral_payout_account_id)
  VALUES (v_request_id, p_user_id, 'referral', p_amount, jsonb_build_object('bank_name', v_account.bank_name, 'masked_account_number', v_account.masked_account_number, 'account_name', v_account.verified_account_name), 'due', 'referral', jsonb_build_object('funding_source', 'MASTER_CART_ADMIN_FUNDS', 'payout_account_id', v_account.id), v_account.id);
  INSERT INTO public.referral_ledger (beneficiary_user_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, metadata)
  VALUES (p_user_id, 'user_to_user', 'REFERRAL_WITHDRAWAL', v_request_id, 'withdrawal:' || v_request_id::text, -p_amount, 'pending', 'Referral withdrawal requested', jsonb_build_object('payout_request_id', v_request_id, 'payout_account_id', v_account.id));
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (p_user_id, 'referral', 'Referral withdrawal submitted', 'Your referral withdrawal has been submitted for admin review.', '/dashboard/customer/referrals', false);
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_referral_order(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
  v_limit INTEGER;
  v_next INTEGER;
  v_remaining INTEGER;
  v_admin_share NUMERIC;
  v_source_type TEXT;
  v_rate NUMERIC;
BEGIN
  SELECT id, customer_id, brand_id, total_amount, commission_amount, vendor_earning, delivery_fee_charged, status, paystack_reference
  INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status NOT IN ('delivered', 'confirmed', 'completed') THEN RETURN 0; END IF;
  v_config := public.get_referral_config();
  v_period := COALESCE((v_config->>'reward_confirmation_period_days')::integer, 0);
  v_status := CASE WHEN v_period > 0 THEN 'pending' ELSE 'available' END;
  v_min := COALESCE((v_config->>'minimum_qualifying_purchase')::numeric, 0);
  IF COALESCE(v_order.total_amount, 0) < v_min THEN RETURN 0; END IF;
  v_admin_share := GREATEST(COALESCE(v_order.total_amount, 0) - COALESCE(v_order.vendor_earning, 0), 0);

  IF public.referral_feature_enabled('user_to_user') AND COALESCE((v_config->>'user_to_user_purchase_reward_enabled')::boolean, false) THEN
    SELECT * INTO v_relationship FROM public.referral_relationships WHERE referred_user_id = v_order.customer_id AND referral_type = 'user_to_user' AND status IN ('activated', 'qualified', 'converted') AND earning_status = 'ACTIVE' FOR UPDATE;
    IF FOUND THEN
      v_limit := NULLIF((v_config->>'user_to_user_reward_purchase_limit')::integer, 0);
      v_next := COALESCE(v_relationship.qualifying_transaction_count, 0) + 1;
      IF v_limit IS NOT NULL AND v_next > v_limit THEN
        UPDATE public.referral_relationships SET earning_status = 'EXPIRED', status = CASE WHEN status = 'converted' THEN status ELSE 'expired' END, qualifying_transaction_limit = v_limit WHERE id = v_relationship.id;
      ELSE
        v_rate := COALESCE((v_config->>'user_to_user_purchase_reward_percentage')::numeric, 0);
        v_amount := LEAST(round((v_order.total_amount * v_rate / 100), 2), v_admin_share);
        v_cap := COALESCE((v_config->>'maximum_reward_per_referred_customer')::numeric, (v_config->>'user_to_user_maximum_reward')::numeric);
        IF v_cap IS NOT NULL THEN v_amount := LEAST(v_amount, GREATEST(v_cap - COALESCE((SELECT SUM(amount) FROM public.referral_ledger WHERE referral_id = v_relationship.id AND source_type = 'USER_PURCHASE_REFERRAL' AND amount > 0 AND status NOT IN ('reversed','cancelled')), 0), 0)); END IF;
        v_remaining := CASE WHEN v_limit IS NULL THEN NULL ELSE greatest(v_limit - v_next, 0) END;
        IF v_amount > 0 THEN
          INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_payment_id, amount, status, description, confirmed_at, available_at, qualifying_transaction_number, qualifying_transaction_limit, remaining_qualifying_transactions, gross_transaction_amount, applied_rate, funding_source, mastercart_share_amount, customer_price, vendor_earning_amount, metadata)
          VALUES (v_relationship.referrer_user_id, v_relationship.id, 'user_to_user', 'USER_PURCHASE_REFERRAL', v_order.id, NULL, v_amount, v_status, 'Referral earning from a qualifying customer purchase', CASE WHEN v_status = 'available' THEN now() ELSE NULL END, CASE WHEN v_status = 'available' THEN now() ELSE NULL END, v_next, v_limit, v_remaining, v_order.total_amount, v_rate, 'MASTER_CART_ADMIN_SHARE', v_admin_share, v_order.total_amount, v_order.vendor_earning, jsonb_build_object('order_reference', v_order.paystack_reference, 'funding_source', 'MASTER_CART_ADMIN_SHARE')) ON CONFLICT (source_key) DO NOTHING;
          IF FOUND THEN
            UPDATE public.referral_relationships SET qualifying_transaction_count = v_next, qualifying_transaction_limit = v_limit, earning_status = CASE WHEN v_limit IS NOT NULL AND v_next >= v_limit THEN 'EXPIRED' ELSE 'ACTIVE' END, status = CASE WHEN v_limit IS NOT NULL AND v_next >= v_limit AND status <> 'converted' THEN 'expired' ELSE status END, qualified_at = COALESCE(qualified_at, now()) WHERE id = v_relationship.id;
            v_count := v_count + 1;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  IF public.referral_feature_enabled('user_to_vendor') AND COALESCE((v_config->>'user_to_vendor_reward_enabled')::boolean, false) THEN
    SELECT * INTO v_relationship FROM public.referral_relationships WHERE referred_brand_id = v_order.brand_id AND referral_type = 'user_to_vendor' AND status IN ('activated', 'qualified', 'converted') AND earning_status = 'ACTIVE' FOR UPDATE;
    IF FOUND THEN
      v_limit := NULLIF((v_config->>'vendor_referral_qualifying_sale_limit')::integer, 0);
      v_next := COALESCE(v_relationship.qualifying_transaction_count, 0) + 1;
      IF v_limit IS NOT NULL AND v_next > v_limit THEN
        UPDATE public.referral_relationships SET earning_status = 'EXPIRED', status = CASE WHEN status = 'converted' THEN status ELSE 'expired' END, qualifying_transaction_limit = v_limit WHERE id = v_relationship.id;
      ELSE
        v_rate := COALESCE((v_config->>'user_to_vendor_reward_percentage')::numeric, 0);
        v_amount := LEAST(round((v_order.total_amount * v_rate / 100), 2), v_admin_share);
        v_cap := COALESCE((v_config->>'maximum_vendor_referral_earning')::numeric, (v_config->>'user_to_vendor_maximum_reward')::numeric);
        IF v_cap IS NOT NULL THEN v_amount := LEAST(v_amount, GREATEST(v_cap - COALESCE((SELECT SUM(amount) FROM public.referral_ledger WHERE referral_id = v_relationship.id AND source_type = 'VENDOR_SALES_REFERRAL' AND amount > 0 AND status NOT IN ('reversed','cancelled')), 0), 0)); END IF;
        v_remaining := CASE WHEN v_limit IS NULL THEN NULL ELSE greatest(v_limit - v_next, 0) END;
        IF v_amount > 0 THEN
          INSERT INTO public.referral_ledger (beneficiary_user_id, referral_id, referral_type, source_type, source_transaction_id, source_payment_id, amount, status, description, confirmed_at, available_at, qualifying_transaction_number, qualifying_transaction_limit, remaining_qualifying_transactions, gross_transaction_amount, applied_rate, funding_source, mastercart_share_amount, customer_price, vendor_earning_amount, metadata)
          VALUES (v_relationship.referrer_user_id, v_relationship.id, 'user_to_vendor', 'VENDOR_SALES_REFERRAL', v_order.id, NULL, v_amount, v_status, 'Referral earning from a qualifying vendor sale', CASE WHEN v_status = 'available' THEN now() ELSE NULL END, CASE WHEN v_status = 'available' THEN now() ELSE NULL END, v_next, v_limit, v_remaining, v_order.total_amount, v_rate, 'MASTER_CART_ADMIN_SHARE', v_admin_share, v_order.total_amount, v_order.vendor_earning, jsonb_build_object('order_reference', v_order.paystack_reference, 'funding_source', 'MASTER_CART_ADMIN_SHARE')) ON CONFLICT (source_key) DO NOTHING;
          IF FOUND THEN
            UPDATE public.referral_relationships SET qualifying_transaction_count = v_next, qualifying_transaction_limit = v_limit, earning_status = CASE WHEN v_limit IS NOT NULL AND v_next >= v_limit THEN 'EXPIRED' ELSE 'ACTIVE' END, status = CASE WHEN v_limit IS NOT NULL AND v_next >= v_limit AND status <> 'converted' THEN 'expired' ELSE status END, qualified_at = COALESCE(qualified_at, now()) WHERE id = v_relationship.id;
            v_count := v_count + 1;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mask_referral_account(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attach_referral_payout_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_referral_payout(UUID, NUMERIC, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_referral_order(UUID) TO service_role;
NOTIFY pgrst, 'reload schema';
