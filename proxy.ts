import { type NextRequest, NextResponse } from 'next/server';
import { legacyRedirect } from '@/utils/paths';

// Pages were once named by query: a Locked Season by /season/?season=<slug>&club=<key>, a
// player over a club report by ?player=<cms-id>, a player page's season tab by
// ?season=<slug>, and a player by /player/?id=<cms-id>. Those links are sent on to the
// page's own path, without the query that named it (ADRs 016, 017). A redirect in
// next.config.ts would carry the query along to the new path.
export function proxy(request: NextRequest) {
  const path = legacyRedirect(request.nextUrl.pathname, request.nextUrl.search);
  return path ? NextResponse.redirect(new URL(path, request.url), 308) : NextResponse.next();
}

// Only the old shapes, and only with the query that named the page.
export const config = {
  matcher: [
    { source: '/season/', has: [{ type: 'query', key: 'season' }] },
    { source: '/season/:season/:club/', has: [{ type: 'query', key: 'player' }] },
    { source: '/club/:club/', has: [{ type: 'query', key: 'player' }] },
    { source: '/player/', has: [{ type: 'query', key: 'id' }] },
    { source: '/player/:player/', has: [{ type: 'query', key: 'season' }] },
  ],
};
