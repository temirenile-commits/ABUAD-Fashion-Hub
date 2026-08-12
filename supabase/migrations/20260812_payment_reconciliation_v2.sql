-- Make the existing reconciliation helper finalize pending intents and support zero-credit vendor boosts.
CREATE OR REPLACE FUNCTION public.reconcile_listing_credit_payment(
  p_payment_reference text,
  p_payment_type text,
  p_user_id uuid,
  p_brand_id uuid,
  p_amount numeric,
  p_expected_amount numeric,
  p_credits integer,
  p_paystack_transaction_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  processed boolean,
  transaction_id uuid,
  credits_added integer,
  current_balance integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  existing_id uuid;
  existing_status text;
  existing_credits integer;
  existing_amount numeric;
  existing_expected numeric;
  existing_brand uuid;
  existing_user uuid;
  existing_type text;
  balance integer;
BEGIN
  IF p_payment_reference IS NULL OR btrim(p_payment_reference) = '' THEN
    RAISE EXCEPTION 'payment reference is required';
  END IF;

  IF p_payment_type NOT IN ('posting_credits_purchase', 'delicacies_credit_purchase', 'vendor_subscription') THEN
    RAISE EXCEPTION 'unsupported credit payment type';
  END IF;

  IF p_user_id IS NULL OR p_brand_id IS NULL THEN
    RAISE EXCEPTION 'payment ownership metadata is required';
  END IF;

  IF p_credits IS NULL OR p_credits < 0 OR (p_payment_type <> 'vendor_subscription' AND p_credits = 0) THEN
    RAISE EXCEPTION 'invalid credit count';
  END IF;

  IF p_amount IS NULL OR p_expected_amount IS NULL OR abs(p_amount - p_expected_amount) > 0.01 THEN
    RAISE EXCEPTION 'payment amount does not match expected amount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE id = p_brand_id AND owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'payment brand ownership mismatch';
  END IF;

  SELECT t.id, t.status, t.credits, t.amount, t.expected_amount, t.brand_id, t.user_id, t.payment_type
    INTO existing_id, existing_status, existing_credits, existing_amount, existing_expected, existing_brand, existing_user, existing_type
  FROM public.transactions t
  WHERE t.payment_reference = p_payment_reference
  FOR UPDATE;

  IF existing_id IS NOT NULL THEN
    IF existing_brand <> p_brand_id OR existing_user <> p_user_id OR existing_type <> p_payment_type
      OR coalesce(existing_credits, 0) <> p_credits
      OR abs(coalesce(existing_expected, existing_amount) - p_expected_amount) > 0.01 THEN
      RAISE EXCEPTION 'payment reference metadata mismatch';
    END IF;

    SELECT free_listings_count INTO balance FROM public.brands WHERE id = p_brand_id;

    IF existing_status = 'success' THEN
      RETURN QUERY SELECT false, existing_id, 0, balance, 'success'::text;
      RETURN;
    END IF;

    UPDATE public.transactions
    SET amount = p_amount,
        expected_amount = p_expected_amount,
        status = 'success',
        paystack_transaction_id = p_paystack_transaction_id,
        processed_at = timezone('utc', now()),
        metadata = coalesce(p_metadata, '{}'::jsonb)
    WHERE id = existing_id;
  ELSE
    INSERT INTO public.transactions (
      brand_id, user_id, type, amount, status, description,
      payment_reference, payment_type, credits, expected_amount,
      paystack_transaction_id, processed_at, metadata
    ) VALUES (
      p_brand_id, p_user_id, 'payment_in', p_amount, 'success',
      format('Listing credit payment %s', p_payment_reference),
      p_payment_reference, p_payment_type, p_credits, p_expected_amount,
      p_paystack_transaction_id, timezone('utc', now()), coalesce(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO existing_id;
  END IF;

  IF p_credits > 0 THEN
    PERFORM public.add_listing_credits(p_brand_id, p_credits);
  END IF;

  SELECT free_listings_count INTO balance FROM public.brands WHERE id = p_brand_id;
  RETURN QUERY SELECT true, existing_id, p_credits, balance, 'success'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) TO service_role;
ALTER FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb)
  SET search_path TO 'public', 'pg_temp';
NOTIFY pgrst, 'reload schema';
