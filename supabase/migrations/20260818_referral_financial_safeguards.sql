-- Follow-up safeguards for the referral financial controls migration.

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
  v_daily NUMERIC;
  v_weekly NUMERIC;
  v_monthly NUMERIC;
BEGIN
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'A verified payout account is required'; END IF;
  SELECT * INTO v_account FROM public.referral_payout_accounts WHERE id = v_account_id AND user_id = p_user_id AND is_active = TRUE AND verification_status = 'verified';
  IF NOT FOUND THEN RAISE EXCEPTION 'The payout account is not verified or does not belong to this user'; END IF;
  PERFORM public.refresh_referral_earnings(p_user_id);
  IF p_amount < v_min THEN RAISE EXCEPTION 'Minimum referral withdrawal is %', v_min; END IF;
  IF p_amount > v_max THEN RAISE EXCEPTION 'This withdrawal exceeds the maximum allowed per transaction'; END IF;
  SELECT available_earnings INTO v_available FROM public.referral_balance_summary(p_user_id);
  IF v_available < p_amount THEN RAISE EXCEPTION 'Insufficient available referral balance'; END IF;
  SELECT COALESCE(SUM(amount_requested), 0) INTO v_daily FROM public.payout_requests WHERE user_id = p_user_id AND source_type = 'referral' AND created_at >= date_trunc('day', now()) AND status NOT IN ('rejected','failed','cancelled');
  SELECT COALESCE(SUM(amount_requested), 0) INTO v_weekly FROM public.payout_requests WHERE user_id = p_user_id AND source_type = 'referral' AND created_at >= date_trunc('week', now()) AND status NOT IN ('rejected','failed','cancelled');
  SELECT COALESCE(SUM(amount_requested), 0) INTO v_monthly FROM public.payout_requests WHERE user_id = p_user_id AND source_type = 'referral' AND created_at >= date_trunc('month', now()) AND status NOT IN ('rejected','failed','cancelled');
  IF v_daily + p_amount > COALESCE((v_config->>'daily_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Daily referral withdrawal limit exceeded'; END IF;
  IF v_weekly + p_amount > COALESCE((v_config->>'weekly_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Weekly referral withdrawal limit exceeded'; END IF;
  IF v_monthly + p_amount > COALESCE((v_config->>'monthly_withdrawal_limit')::numeric, 999999999) THEN RAISE EXCEPTION 'Monthly referral withdrawal limit exceeded'; END IF;
  INSERT INTO public.payout_requests (id, user_id, role, amount_requested, bank_details, status, source_type, source_metadata, referral_payout_account_id)
  VALUES (v_request_id, p_user_id, 'referral', p_amount, jsonb_build_object('bank_name', v_account.bank_name, 'masked_account_number', v_account.masked_account_number, 'account_name', v_account.verified_account_name), 'pending', 'referral', jsonb_build_object('funding_source', 'MASTER_CART_ADMIN_FUNDS', 'payout_account_id', v_account.id), v_account.id);
  INSERT INTO public.referral_ledger (beneficiary_user_id, referral_type, source_type, source_transaction_id, source_key, amount, status, description, metadata)
  VALUES (p_user_id, 'user_to_user', 'REFERRAL_WITHDRAWAL', v_request_id, 'withdrawal:' || v_request_id::text, -p_amount, 'pending', 'Referral withdrawal requested', jsonb_build_object('payout_request_id', v_request_id, 'payout_account_id', v_account.id, 'funding_source', 'MASTER_CART_ADMIN_FUNDS'));
  INSERT INTO public.notifications (user_id, type, title, content, link, is_read)
  VALUES (p_user_id, 'referral', 'Referral withdrawal submitted', 'Your referral withdrawal has been submitted for admin review.', '/dashboard/customer/referrals', false);
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_referral_immediate_reward_funding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.source_type = 'REFERRAL_SIGNUP_REWARD' THEN
    NEW.funding_source := 'MASTER_CART_ADMIN_FUNDS';
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object('funding_source', 'MASTER_CART_ADMIN_FUNDS', 'reward_category', 'IMMEDIATE_REFERRAL_REWARD');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS referral_immediate_reward_funding ON public.referral_ledger;
CREATE TRIGGER referral_immediate_reward_funding BEFORE INSERT ON public.referral_ledger FOR EACH ROW EXECUTE FUNCTION public.mark_referral_immediate_reward_funding();

NOTIFY pgrst, 'reload schema';
