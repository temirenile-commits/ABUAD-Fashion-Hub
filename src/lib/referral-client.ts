export async function claimReferralAttribution(accessToken?: string, brandId?: string) {
  if (!accessToken) return;
  try {
    await fetch('/api/referrals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action: brandId ? 'vendor_activate' : 'claim', ...(brandId ? { brandId } : {}) }),
    });
  } catch (error) {
    console.warn('[REFERRAL] Attribution claim request failed:', error);
  }
}
