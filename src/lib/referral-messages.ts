export type ReferralAudience = 'user_to_user' | 'user_to_vendor';

const DEFAULT_REFERRER = 'A MasterCart member';

function displayReferrerName(name?: string | null) {
  const normalized = name?.trim().replace(/\s+/g, ' ');
  return normalized ? normalized.slice(0, 80) : DEFAULT_REFERRER;
}

export function getReferralMessage(
  url: string,
  audience: ReferralAudience,
  referrerName?: string | null,
  short = false,
  includeUrl = true,
) {
  const name = displayReferrerName(referrerName);
  const suffix = includeUrl ? `\n\n${url}` : '';

  if (audience === 'user_to_vendor') {
    return short
      ? `Join MasterCart as a vendor and grow your business.\n\nPlease register using ${name}'s referral link:${suffix}`
      : `Hey! ${name} invited you to join MasterCart as a vendor and grow your business on the platform.\n\nPlease register using this referral link so your vendor account is connected to ${name}'s referral:${suffix}`;
  }

  return short
    ? `Join me on MasterCart.\n\nPlease sign up using ${name}'s referral link:${suffix}`
    : `Hey! Join me on MasterCart and discover products, vendors and great deals around you.\n\nPlease sign up using this referral link so your account is connected to ${name}'s referral:${suffix}`;
}

export function getReferralShareTitle() {
  return 'Join me on MasterCart';
}
