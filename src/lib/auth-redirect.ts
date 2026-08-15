const PRODUCTION_AUTH_ORIGIN = 'https://master-cart-reshuffled.vercel.app';

function safeReturnPath(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return '/';
  return returnTo.slice(0, 300);
}

export function getAuthCallbackUrl(returnTo?: string | null): string {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1';
  // Production OAuth must never inherit a Vercel preview/deployment hostname.
  const origin = isLocal ? currentOrigin : PRODUCTION_AUTH_ORIGIN;
  return `${origin || PRODUCTION_AUTH_ORIGIN}/auth/callback?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function getSafeCallbackDestination(requestUrl: URL): URL {
  const returnTo = safeReturnPath(requestUrl.searchParams.get('returnTo'));
  const destination = new URL(returnTo, requestUrl.origin);
  if (destination.origin !== requestUrl.origin) return new URL('/', requestUrl.origin);
  return destination;
}
