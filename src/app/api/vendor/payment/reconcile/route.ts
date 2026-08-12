import { NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/paystack';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { paymentErrorResponse, reconcileVerifiedVendorPayment } from '@/lib/vendor-payment';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { reference } = await req.json();
    if (typeof reference !== 'string' || !reference.trim()) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    const verification = await verifyTransaction(reference.trim());
    if (!verification?.status || verification?.data?.status !== 'success') {
      return NextResponse.json({
        status: verification?.data?.status || 'pending',
        reference: reference.trim(),
        message: verification?.message || 'Payment is not confirmed by Paystack yet',
      }, { status: 200 });
    }

    const result = await reconcileVerifiedVendorPayment(verification.data, 'callback', user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const result = paymentErrorResponse(error);
    console.error('[Vendor Payment Reconcile]', {
      status: result.status,
      error: result.body,
    });
    return NextResponse.json(result.body, { status: result.status });
  }
}
