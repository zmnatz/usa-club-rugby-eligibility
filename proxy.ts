import { type NextRequest, NextResponse } from 'next/server';
import { legacySeasonRedirect } from '@/utils/paths';

// A Locked Season was one page, /season/?season=<slug>&club=<key> (ADR 006). Those links
// are sent on to the season's own paths, without the query that named it (ADR 016). A
// redirect in next.config.ts would carry the query along to the new path.
export function proxy(request: NextRequest) {
  const path = legacySeasonRedirect(request.nextUrl.search);
  return path ? NextResponse.redirect(new URL(path, request.url), 308) : NextResponse.next();
}

// Only the list of seasons, and only when the query names one.
export const config = {
  matcher: [{ source: '/season/', has: [{ type: 'query', key: 'season' }] }],
};
