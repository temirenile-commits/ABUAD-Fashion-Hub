import { supabaseAdmin } from '@/lib/supabase-admin';

export const VENDOR_PAYMENT_TYPES = [
  'vendor_activation_fee',
  'vendor_subscription',
  'posting_credits_purchase',
  'delicacies_credit_purchase',
] as const;

export type VendorPaymentType = (typeof VENDOR_PAYMENT_TYPES)[number];

export class VendorPaymentError extends Error {
  status: number;
  code?: string;
  details?: string;
  hint?: string;

  constructor(message: string, status = 400, error?: { code?: string; details?: string; hint?: string }) {
    super(message);
    this.name = 'VendorPaymentError';
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
    this.hint = error?.hint;
  }
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeMetadata(value: unknown): Record<string, any> {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

export async function reconcileVerifiedVendorPayment(verifiedData: any, source: 'webhook' | 'callback', requestingUserId?: string) {
  const reference = typeof verifiedData?.reference === 'string' ? verifiedData.reference : '';
  if (!reference) throw new VendorPaymentError('Paystack verification returned no reference', 400);

  const paidAmount = asNumber(verifiedData.amount);
  if (paidAmount === null) throw new VendorPaymentError('Paystack verification returned no amount', 400);

  const verifiedMetadata = normalizeMetadata(verifiedData.metadata);
  const paymentType = verifiedMetadata.payment_type as VendorPaymentType;
  if (!VENDOR_PAYMENT_TYPES.includes(paymentType)) {
    throw new VendorPaymentError('Unsupported vendor payment metadata', 400);
  }

  const { data: internal, error: internalError } = await supabaseAdmin
    .from('transactions')
    .select('id, payment_reference, payment_type, user_id, brand_id, amount, expected_amount, credits, status, metadata')
    .eq('payment_reference', reference)
    .maybeSingle();

  if (internalError) {
    throw new VendorPaymentError('Payment record lookup failed', 500, internalError);
  }
  if (!internal) {
    throw new VendorPaymentError('Payment record not found', 404);
  }
  if (requestingUserId && internal.user_id !== requestingUserId) {
    throw new VendorPaymentError('Payment does not belong to the authenticated user', 403);
  }

  const storedMetadata = normalizeMetadata(internal.metadata);
  const expectedAmount = asNumber(internal.expected_amount ?? storedMetadata.expected_amount);
  const storedAmount = asNumber(internal.amount);
  const amountInKobo = paidAmount;
  const expectedAmountInKobo = (expectedAmount ?? storedAmount ?? 0) * 100;
  const amountTolerance = 1;

  if (internal.payment_reference !== reference || verifiedMetadata.reference && verifiedMetadata.reference !== reference) {
    throw new VendorPaymentError('Payment reference mismatch', 400);
  }
  if (!internal.payment_type || internal.payment_type !== paymentType) {
    throw new VendorPaymentError('Payment type mismatch', 400);
  }
  if (verifiedMetadata.user_id !== internal.user_id || verifiedMetadata.brand_id !== internal.brand_id) {
    throw new VendorPaymentError('Payment ownership metadata mismatch', 400);
  }

  const verifiedCredits = asNumber(verifiedMetadata.credits);
  const storedCredits = asNumber(internal.credits) ?? 0;
  if (verifiedCredits !== null && verifiedCredits !== storedCredits) {
    throw new VendorPaymentError('Payment credit metadata mismatch', 400);
  }

  if (expectedAmount === null || expectedAmount <= 0 || Math.abs(amountInKobo - expectedAmountInKobo) > amountTolerance) {
    throw new VendorPaymentError('Payment amount mismatch', 400);
  }

  if (internal.status === 'success') {
    return {
      processed: false,
      duplicate: true,
      status: 'success',
      reference,
      paymentType,
      currentBalance: null,
      creditsAdded: 0,
      transactionId: internal.id,
      source,
    };
  }

  const metadata = {
    ...storedMetadata,
    ...verifiedMetadata,
    reference,
    verified_amount: amountInKobo / 100,
    paystack_status: verifiedData.status,
    paystack_transaction_id: verifiedData.id ? String(verifiedData.id) : null,
    reconciliation_source: source,
  };

  const { data: result, error: reconcileError } = await supabaseAdmin.rpc('reconcile_listing_credit_payment', {
    p_payment_reference: reference,
    p_payment_type: paymentType,
    p_user_id: internal.user_id,
    p_brand_id: internal.brand_id,
    p_amount: amountInKobo / 100,
    p_expected_amount: expectedAmount,
    p_credits: storedCredits,
    p_paystack_transaction_id: verifiedData.id ? String(verifiedData.id) : null,
    p_metadata: metadata,
  });

  if (reconcileError) {
    throw new VendorPaymentError('Payment reconciliation failed', 500, reconcileError);
  }

  const row = Array.isArray(result) ? result[0] : result;
  return {
    processed: Boolean(row?.processed),
    duplicate: !row?.processed,
    status: row?.status || 'success',
    reference,
    paymentType,
    currentBalance: row?.current_balance ?? null,
    creditsAdded: row?.credits_added ?? 0,
    transactionId: row?.transaction_id || internal.id,
    source,
  };
}

export function paymentErrorResponse(error: unknown) {
  const status = error instanceof VendorPaymentError ? error.status : 500;
  const body = error instanceof VendorPaymentError
    ? { error: error.message, code: error.code, details: error.details, hint: error.hint }
    : { error: error instanceof Error ? error.message : 'Payment processing failed' };
  return { status, body };
}
