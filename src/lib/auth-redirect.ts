const PRODUCTION_AUTH_ORIGIN = 'https://master-cart-reshuffled.vercel.app';
const ALLOWED_PRODUCTION_HOSTS = new Set([
  'master-cart-reshuffled.vercel.app',
  'master-cart-camp.vercel.app',
  'abuad-fashion-hub.vercel.app',
]);

function safeReturnPath(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) return '/';
  return returnTo.slice(0, 300);
}

export function getAuthCallbackUrl(returnTo?: string | null): string {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const isLocal = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const origin = configuredOrigin || (isLocal || ALLOWED_PRODUCTION_HOSTS.has(currentHost) ? currentOrigin : PRODUCTION_AUTH_ORIGIN);
  return `${origin || PRODUCTION_AUTH_ORIGIN}/auth/callback?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function getSafeCallbackDestination(requestUrl: URL): URL {
  const returnTo = safeReturnPath(requestUrl.searchParams.get('returnTo'));
  const destination = new URL(returnTo, requestUrl.origin);
  if (destination.origin !== requestUrl.origin) return new URL('/', requestUrl.origin);
  return destination;
}
