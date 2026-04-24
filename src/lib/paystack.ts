/**
 * Paystack utility functions for Escrow, Checkout, and Payout Logic.
 */

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

type TransactionInitParams = {
  email: string;
  amount: number; // in NGN (will be converted to kobo internally)
  reference?: string;
  callback_url?: string;
  metadata?: any;
};

export async function initializeTransaction(params: TransactionInitParams) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !secret.startsWith('sk_')) {
    console.error('[PAYSTACK] Secret Key missing or invalid in Vercel environment.');
    throw new Error('Payment Gateway Configuration Error: Ensure PAYSTACK_SECRET_KEY is added to Vercel Settings -> Environment Variables.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...params,
      amount: Math.round(params.amount * 100), // Convert NGN to Kobo
    }),
  });

  const data = await response.json();
  if (!data.status) {
    console.error('[PAYSTACK_API_ERROR]', data);
    throw new Error(data.message || 'Failed to initialize Paystack transaction');
  }

  return data.data; // { authorization_url, access_code, reference }
}

export async function verifyTransaction(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error('Paystack Secret Key is missing');

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const data = await response.json();
  return data;
}

// Paystack Payout & Verification APIs

export async function listBanks() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const response = await fetch(`${PAYSTACK_BASE_URL}/bank?currency=NGN`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await response.json();
  return data.data; // Array of { name, code, ... }
}

export async function resolveAccountNumber(accountNumber: string, bankCode: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Could not resolve account');
  return data.data; // { account_number, account_name, ... }
}

export async function createTransferRecipient(name: string, accountNumber: string, bankCode: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }),
  });
  const data = await response.json();
  if (!data.status) throw new Error(data.message || 'Failed to create recipient');
  return data.data; // { recipient_code, ... }
}

export async function initiateTransfer(amount: number, recipientCode: string, reference: string, reason: string = 'Vendor Payout') {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(amount * 100), // Convert to Kobo
      recipient: recipientCode,
      reason,
      reference,
    }),
  });
  const data = await response.json();
  // Transfer status can be 'otp', 'pending', 'success', 'failed'
  return data;
}

// Escrow Fund Release API Integration (Legacy Mock - updated to use real logic if needed)
export async function releaseEscrowPayment(bankCode: string, accountNumber: string, amount: number, reason: string) {
  console.log(`[ESCROW] Legacy call for releasing N${amount} to Bank Code ${bankCode}, Acc ${accountNumber}`);
  // In the new system, we move funds in DB, then the vendor initiates a withdrawal.
  return { success: true, reference: `es_rel_${Date.now()}` };
}

