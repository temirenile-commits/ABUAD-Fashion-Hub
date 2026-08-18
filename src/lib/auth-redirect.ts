const PRODUCTION_AUTH_ORIGIN = 'https://master-cart-reshuffled.vercel.app';

function safeReturnPath(returnTo: string | null | undefined): string | null {
  if (returnTo === null || returnTo === undefined || returnTo === '') return null;
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
  return returnTo.slice(0, 300);
}

export function getAuthCallbackUrl(returnTo?: string | null): string {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1';
  // Production OAuth must never inherit a Vercel preview/deployment hostname.
  const origin = isLocal ? currentOrigin : PRODUCTION_AUTH_ORIGIN;
  const safePath = safeReturnPath(returnTo);
  const callback = `${origin || PRODUCTION_AUTH_ORIGIN}/auth/callback`;
  return safePath ? `${callback}?returnTo=${encodeURIComponent(safePath)}` : callback;
}

export function getSafeCallbackDestination(requestUrl: URL): URL | null {
  const safePath = safeReturnPath(requestUrl.searchParams.get('returnTo'));
  if (!safePath) return null;
  const destination = new URL(safePath, requestUrl.origin);
  if (destination.origin !== requestUrl.origin) return null;
  return destination;
}
