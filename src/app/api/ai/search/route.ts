import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { resolveMilesContext } from '@/lib/ai/role-context';
import { searchMiles, type SearchDomain } from '@/lib/ai/search-engine';

const DOMAINS = new Set<SearchDomain>(['products', 'vendors', 'stores', 'reels', 'orders', 'users', 'help', 'features', 'marketplace', 'my_data']);

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const domain = String(body.domain || 'marketplace') as SearchDomain;
    const query = typeof body.query === 'string' ? body.query : '';
    if (!DOMAINS.has(domain)) return NextResponse.json({ error: 'Unsupported Miles search domain.' }, { status: 400 });
    const context = await resolveMilesContext(user.id, 'Miles Search Engine request');
    if (!context) return NextResponse.json({ error: 'Your MasterCart role could not be verified.' }, { status: 403 });
    const result = await searchMiles(context, { query, domain, mode: domain === 'features' ? 'navigate' : 'retrieve', limit: Math.min(20, Math.max(1, Number(body.limit) || 10)), universityId: typeof body.universityId === 'string' ? body.universityId : undefined, vendorId: typeof body.vendorId === 'string' ? body.vendorId : undefined, ownerOnly: body.ownerOnly === true, priceMax: Number.isFinite(Number(body.priceMax)) ? Number(body.priceMax) : undefined, availability: body.availability === true });
    if (result.authorization === 'denied') return NextResponse.json({ error: result.reason || 'This search is outside your current permissions.', code: 'SEARCH_FORBIDDEN', search: result }, { status: 403 });
    return NextResponse.json({ search: result });
  } catch (error) {
    console.error('[MILES_SEARCH_ROUTE_FAILED]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'I could not complete that search right now. Please try again.', code: 'SEARCH_UNAVAILABLE' }, { status: 502 });
  }
}
