/**
 * ABUAD Fashion Hub Email Utility
 * Powered by Resend (https://resend.com)
 */

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.warn('⚠️ [MAIL] RESEND_API_KEY is missing. Logging email content instead:');
    console.log(`[TO]: ${to}`);
    console.log(`[SUBJECT]: ${subject}`);
    console.log(`[BODY]: ${html.substring(0, 200)}...`);
    return { success: true, mocked: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'ABUAD Fashion Hub <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Resend error');
    
    return { success: true, id: data.id };
  } catch (error: any) {
    console.error('❌ [MAIL] Error sending email:', error.message);
    return { success: false, error: error.message };
  }
}

export const emailTemplates = {
  paymentSuccess: (name: string, orderId: string, amount: string) => `
    <div style="font-family: sans-serif; color: #1e1b4b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #eb0c7a; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Secured! 🎉</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hi ${name || 'Customer'},</p>
        <p>Your payment of <strong>${amount}</strong> for order <strong>#${orderId}</strong> has been successfully received and is now held in <strong>Escrow Protection</strong>.</p>
        <p>The vendor has been notified and will begin processing your items shortly.</p>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          <p style="margin: 5px 0;">Order ID: #${orderId}</p>
          <p style="margin: 5px 0;">Status: Paid (Escrow)</p>
        </div>
        <p>Remember: Do not release the payment until you have received and inspected your items.</p>
        <a href="https://abuadfashionhub.com/dashboard/customer" style="display: inline-block; background: #c9a14a; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">View Order Status</a>
      </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
        &copy; 2026 ABUAD Fashion Hub. All rights reserved.
      </div>
    </div>
  `,
  paymentFailed: (name: string, reason: string) => `
    <div style="font-family: sans-serif; color: #1e1b4b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #ef4444; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Error ❌</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hi ${name || 'Customer'},</p>
        <p>There was an issue with your recent transaction on ABUAD Fashion Hub.</p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #b91c1c;"><strong>Reason:</strong> ${reason || 'Transaction could not be completed.'}</p>
        </div>
        <p>As a result, your items are still in your cart and have not been locked for shipping.</p>
        <p>Please try again or contact support if you have already been debited.</p>
        <a href="https://abuadfashionhub.com/checkout" style="display: inline-block; background: #1e1b4b; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Try Again</a>
      </div>
    </div>
  `
};
