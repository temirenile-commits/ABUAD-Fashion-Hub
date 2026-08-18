export type ReferralClaimResult = {
  success: boolean;
  claimed?: boolean;
  alreadyAttributed?: boolean;
  error?: string;
};

export async function claimReferralAttribution(accessToken?: string, brandId?: string): Promise<ReferralClaimResult> {
  if (!accessToken) return { success: false, error: 'Authentication required.' };
  try {
    const response = await fetch('/api/referrals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: brandId ? 'vendor_activate' : 'claim', ...(brandId ? { brandId } : {}) }),
    });
    const payload = await response.json().catch(() => ({})) as ReferralClaimResult;
    return response.ok ? payload : { success: false, error: payload.error || 'Referral attribution could not be completed.' };
  } catch (error) {
    console.warn('[REFERRAL] Attribution claim request failed:', error);
    return { success: false, error: 'Referral attribution could not be completed.' };
  }
}
