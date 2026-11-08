// Links to Rugby Xplorer. xplorer.rugby blocks automated clients, so nothing here
// loads the site; links are built from CMS ids, which are its ids.

const SITE = 'https://xplorer.rugby';
/** The Senior Club Council. A match report loads under any entity's path. */
const COUNCIL_SLUG = 'senior-club-council';

/** The Rugby Xplorer match report for a fixture. */
export function matchUrl(fixtureId: string, clubSlug: string | null = null): string {
  return `${SITE}/${clubSlug ?? COUNCIL_SLUG}/match-centre/${encodeURIComponent(fixtureId)}?tab=Points-Summary`;
}

/** Every senior club fixture on Rugby Xplorer. */
export const COUNCIL_FIXTURES_URL = `${SITE}/${COUNCIL_SLUG}/fixtures-results?team=All&comp=All&season=All&tab=Fixtures`;

/** The club id in a CMS-hosted crest URL, e.g. `.../ru/team/91273.png`. */
export function crestEntityId(crest: string | null | undefined): string | null {
  return crest?.match(/\/team\/(\d+)\./)?.[1] ?? null;
}
