import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'master-cart-reshuffled.vercel.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CANONICAL_HOSTS = new Set([CANONICAL_HOST]);

export function middleware(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(hostname) || CANONICAL_HOSTS.has(hostname)) {
    return NextResponse.next();
  }

  // Never forward an OAuth code or state from an old host to the canonical
  // host. A stale callback must restart from login rather than replaying a
  // verifier-bound code across domains.
  const pathname = request.nextUrl.pathname;
  if (pathname === '/auth/callback') {
    const loginUrl = new URL('/auth/login?error=oauth_domain_mismatch', `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(loginUrl, 308);
  }

  // Do not rewrite API or framework asset requests. Browser page requests on
  // old Vercel aliases are redirected before login can create PKCE state.
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next();
  }

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.hostname = CANONICAL_HOST;
  canonicalUrl.protocol = 'https:';
  canonicalUrl.port = '';
  return NextResponse.redirect(canonicalUrl, 308);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
