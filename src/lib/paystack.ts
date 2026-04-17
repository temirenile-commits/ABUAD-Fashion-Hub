/**
 * Paystack utility functions for Escrow, Checkout, and Payout Logic.
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

type TransactionInitParams = {
  email: string;
  amount: number; // in NGN (will be converted to kobo internally)
  reference?: string;
  callback_url?: string;
  metadata?: any;
};

export async function initializeTransaction(params: TransactionInitParams) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack Secret Key is missing');

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      amount: Math.round(params.amount * 100), // Convert NGN to Kobo
    }),
  });

  const data = await response.json();
  if (!data.status) {
    throw new Error(data.message || 'Failed to initialize Paystack transaction');
  }

  return data.data; // { authorization_url, access_code, reference }
}

export async function verifyTransaction(reference: string) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack Secret Key is missing');

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  const data = await response.json();
  return data;
}

// Escrow Fund Release API Integration (Mock structure for future Paystack Transfers API implementation)
export async function releaseEscrowPayment(bankCode: string, accountNumber: string, amount: number, reason: string) {
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack Secret Key is missing');

  // STEP 1: Create a Transfer Recipient
  // https://paystack.com/docs/transfers/single-transfers/#create-a-transfer-recipient
  
  // STEP 2: Initiate Transfer
  // https://paystack.com/docs/transfers/single-transfers/#initiate-a-transfer

  console.log(`[ESCROW] Releasing N${amount} to Bank Code ${bankCode}, Acc ${accountNumber} for reason: ${reason}`);
  return { success: true, reference: `es_rel_${Date.now()}` };
}
