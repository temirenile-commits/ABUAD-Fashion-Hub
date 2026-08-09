/**
 * MasterCart Email Utility
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
        from: 'MasterCart <onboarding@resend.dev>',
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
  paymentSuccess: (name: string, orderId: string, amount: string, deliveryCode: string) => `
    <div style="font-family: sans-serif; color: #000000; max-width: 600px; margin: 0 auto; border: 1px solid #FFFFFF; border-radius: 12px; overflow: hidden;">
      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Secured! 🎉</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hi ${name || 'Customer'},</p>
        <p>Your payment of <strong>${amount}</strong> for order <strong>#${orderId}</strong> has been successfully received and is now held in <strong>Escrow Protection</strong>.</p>
        
        <div style="background: #FFFFFF; border: 2px dashed #000000; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
          <h2 style="margin: 0; color: #000000; font-size: 14px; text-transform: uppercase;">Your Delivery Verification Code</h2>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 10px 0;">${deliveryCode}</div>
          <p style="margin: 0; font-size: 12px; color: #000000;">Give this code to the delivery agent only when you receive your package.</p>
        </div>

        <p>The vendor has been notified and will begin processing your items shortly.</p>
        <div style="background: #FFFFFF; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          <p style="margin: 5px 0;">Order ID: #${orderId}</p>
          <p style="margin: 5px 0;">Status: Paid (Escrow)</p>
        </div>
        <p>Remember: Do not release the payment until you have received and inspected your items.</p>
        <a href="https://abuadfashionista.com/dashboard/customer" style="display: inline-block; background: #000000; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">View Order Status</a>
      </div>
      <div style="background: #FFFFFF; padding: 20px; text-align: center; font-size: 12px; color: #000000;">
        &copy; 2026 MasterCart. All rights reserved.
      </div>
    </div>
  `,
  paymentFailed: (name: string, reason: string) => `
    <div style="font-family: sans-serif; color: #000000; max-width: 600px; margin: 0 auto; border: 1px solid #FFFFFF; border-radius: 12px; overflow: hidden;">
      <div style="background: #000000; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Payment Error ❌</h1>
      </div>
      <div style="padding: 30px;">
        <p>Hi ${name || 'Customer'},</p>
        <p>There was an issue with your recent transaction on MasterCart.</p>
        <div style="background: #FFFFFF; border-left: 4px solid #000000; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #000000;"><strong>Reason:</strong> ${reason || 'Transaction could not be completed.'}</p>
        </div>
        <p>As a result, your items are still in your cart and have not been locked for shipping.</p>
        <p>Please try again or contact support if you have already been debited.</p>
        <a href="https://mastercart.com/checkout" style="display: inline-block; background: #000000; color: white; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Try Again</a>
      </div>
    </div>
  `
};
