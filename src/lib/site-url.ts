export const CANONICAL_SITE_URL = 'https://master-cart-reshuffled.vercel.app';

const CANONICAL_HOSTS = new Set(['master-cart-reshuffled.vercel.app']);

export function getCanonicalSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return CANONICAL_SITE_URL;

  try {
    const parsed = new URL(configured);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocal || CANONICAL_HOSTS.has(parsed.hostname)) {
      return parsed.origin;
    }
  } catch {
    // Invalid configuration must not become an OAuth origin.
  }

  return CANONICAL_SITE_URL;
}
