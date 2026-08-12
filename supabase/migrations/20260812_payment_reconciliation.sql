-- MasterCart payment reconciliation extension.
-- This migration preserves the existing transactions ledger and brands.free_listings_count.
-- It does not create a new credit table, reset data, or change existing RLS policies.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_type text,
  ADD COLUMN IF NOT EXISTS credits integer,
  ADD COLUMN IF NOT EXISTS expected_amount numeric,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND conname = 'transactions_payment_reference_key'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_payment_reference_key UNIQUE (payment_reference);
  END IF;
END
$$;

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
  inserted_id uuid;
  existing_status text;
  existing_credits integer;
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

  IF p_credits IS NULL OR p_credits <= 0 THEN
    RAISE EXCEPTION 'credit count must be positive';
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

  INSERT INTO public.transactions (
    brand_id,
    user_id,
    type,
    amount,
    status,
    description,
    payment_reference,
    payment_type,
    credits,
    expected_amount,
    paystack_transaction_id,
    processed_at,
    metadata
  ) VALUES (
    p_brand_id,
    p_user_id,
    'payment_in',
    p_amount,
    'success',
    format('Listing credit payment %s', p_payment_reference),
    p_payment_reference,
    p_payment_type,
    p_credits,
    p_expected_amount,
    p_paystack_transaction_id,
    timezone('utc', now()),
    coalesce(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (payment_reference) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT t.id, t.status, t.credits, b.free_listings_count
      INTO transaction_id, existing_status, existing_credits, balance
    FROM public.transactions t
    JOIN public.brands b ON b.id = t.brand_id
    WHERE t.payment_reference = p_payment_reference;

    RETURN QUERY SELECT false, transaction_id, 0, balance, coalesce(existing_status, 'unknown');
    RETURN;
  END IF;

  PERFORM public.add_listing_credits(p_brand_id, p_credits);

  SELECT free_listings_count INTO balance
  FROM public.brands
  WHERE id = p_brand_id;

  RETURN QUERY SELECT true, inserted_id, p_credits, balance, 'success'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb) TO service_role;

ALTER FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb)
  SET search_path TO 'public', 'pg_temp';

COMMENT ON FUNCTION public.reconcile_listing_credit_payment(text, text, uuid, uuid, numeric, numeric, integer, text, jsonb)
  IS 'Trusted server-side, exactly-once reconciliation for vendor listing-credit payments.';

CREATE INDEX IF NOT EXISTS transactions_payment_type_idx
  ON public.transactions (payment_type)
  WHERE payment_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_paystack_transaction_id_idx
  ON public.transactions (paystack_transaction_id)
  WHERE paystack_transaction_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
