import { mapConcurrent, postWithRetry } from '@/utils/api';
import type { MatchCentreData } from '@/utils/playerHistory';
import { crestEntityId } from '@/utils/rugbyXplorer';

// Reading fixture lists from the CMS behind Rugby Xplorer. No one feed lists every
// senior club fixture: the council's misses some its unions list, a union's misses
// some of its own, and some appear only in the feeds of the clubs playing them. So
// the nightly job reads all three. See docs/adr/001-national-coverage.md.

const CMS_URL = 'https://rugby-au-cms.graphcdn.app';
const PAGE_SIZE = 100;
const MAX_FIXTURES = 5000;

/** A fixture as a feed lists it, with what a match-centre request needs. */
export interface FeedFixture {
  id: string;
  compId: string;
  compName: string;
  season: string;
  dateTime: string;
  round: string;
  status: string;
  sourceType: string;
  homeTeam: { name: string; score: string };
  awayTeam: { name: string; score: string };
}

/** An entity whose fixture list can be read: the council, a union or a club. */
export interface FeedSource {
  id: number;
  type: string;
}

export const FEED_QUERY = `query EligibilityFeed($entityId: Int, $entityType: String, $type: String, $skip: Int, $limit: Int) {
  getEntityFixturesAndResults(type: $type, entityId: $entityId, entityType: $entityType, limit: $limit, skip: $skip) {
    id compId compName season dateTime round status sourceType
    homeTeam { name score }
    awayTeam { name score }
  }
}`;

interface RawFixture extends Omit<FeedFixture, 'homeTeam' | 'awayTeam' | 'round' | 'status' | 'sourceType'> {
  round: string | null;
  status: string | null;
  sourceType: string | null;
  homeTeam: { name: string | null; score: string | null } | null;
  awayTeam: { name: string | null; score: string | null } | null;
}

/** Nulls as empty strings, so the rest of the code compares strings only. */
export function normalizeFixture(raw: RawFixture): FeedFixture {
  const team = (side: RawFixture['homeTeam']) => ({ name: side?.name ?? '', score: side?.score ?? '' });
  return {
    id: raw.id,
    compId: raw.compId,
    compName: raw.compName ?? '',
    season: raw.season ?? '',
    dateTime: raw.dateTime,
    round: raw.round ?? '',
    status: raw.status ?? '',
    sourceType: raw.sourceType || '2',
    homeTeam: team(raw.homeTeam),
    awayTeam: team(raw.awayTeam),
  };
}

export async function fetchFeedPage(source: FeedSource, skip: number): Promise<FeedFixture[]> {
  const response = await postWithRetry<{
    data: { getEntityFixturesAndResults: RawFixture[] | null };
    errors?: { message: string }[];
  }>(CMS_URL, {
    operationName: 'EligibilityFeed',
    variables: { entityId: source.id, entityType: source.type, type: 'all', skip, limit: PAGE_SIZE },
    query: FEED_QUERY,
  });
  // A throttled query can answer 200 with errors, which mustn't read as an empty feed.
  if (response.errors?.length) {
    throw new Error(`Feed ${source.type} ${source.id} failed: ${response.errors[0].message}`);
  }
  return (response.data.getEntityFixturesAndResults ?? []).map(normalizeFixture);
}

/** Whether a page has nothing from the seasons being read. Feeds list newest first
 *  closely enough to stop there. */
export function isPastPage(page: FeedFixture[], fromSeason: string): boolean {
  return fromSeason !== '' && page.every((fixture) => fixture.season < fromSeason);
}

/** One entity's fixtures from `fromSeason` on. Throws on a failed page, because a
 *  missing fixture would undercount players without any sign. */
export async function fetchFeed(
  source: FeedSource,
  fromSeason: string,
  fetchPage: typeof fetchFeedPage = fetchFeedPage,
): Promise<FeedFixture[]> {
  const all: FeedFixture[] = [];
  for (let skip = 0; skip < MAX_FIXTURES; skip += PAGE_SIZE) {
    const page = await fetchPage(source, skip);
    all.push(...page);
    if (page.length < PAGE_SIZE || isPastPage(page, fromSeason)) break;
  }
  return all.filter((fixture) => fixture.season >= fromSeason);
}

/** Club feeds, several at a time; the rate-limit gate in api.ts sets the pace. */
export function fetchClubFeeds(clubIds: number[], fromSeason: string, concurrency: number): Promise<FeedFixture[][]> {
  return mapConcurrent(clubIds, concurrency, (id) => fetchFeed({ id, type: 'club' }, fromSeason));
}

/** Feeds merged and deduplicated by fixture id. An earlier feed's copy wins. */
export function mergeFeeds(feeds: FeedFixture[][]): FeedFixture[] {
  const byId = new Map<string, FeedFixture>();
  for (const feed of feeds) {
    for (const fixture of feed) {
      if (!byId.has(fixture.id)) byId.set(fixture.id, fixture);
    }
  }
  return [...byId.values()];
}

/** A club's feed also lists its college, 7s and out-of-union matches, so only the
 *  competitions the council and unions list are taken from it. */
export function keepCompetitions(feed: FeedFixture[], competitions: Set<string>): FeedFixture[] {
  return feed.filter((fixture) => competitions.has(fixture.compId));
}

/** The club ids in the match records' crests. Feeds carry only a placeholder crest,
 *  but a match record has each side's club crest, which names the club. */
export function clubIdsFromMatches(matches: MatchCentreData[]): number[] {
  const ids = new Set<number>();
  for (const { fixture } of matches) {
    for (const team of [fixture.homeTeam, fixture.awayTeam]) {
      const id = crestEntityId(team?.crest);
      if (id) ids.add(Number(id));
    }
  }
  return [...ids].sort((a, b) => a - b);
}

/** A played fixture with a score. A feed can carry a placeholder score on a
 *  fixture dated later. */
export function isResult(fixture: FeedFixture, now: Date): boolean {
  return fixture.homeTeam.score !== '' && fixture.awayTeam.score !== '' && new Date(fixture.dateTime) <= now;
}

/** The latest season with a result, which is the one the verdicts are for. */
export function currentSeason(fixtures: FeedFixture[], now: Date): string {
  return fixtures
    .filter((fixture) => isResult(fixture, now))
    .reduce((latest, fixture) => (fixture.season > latest ? fixture.season : latest), '');
}

/** The fixture fields the page needs, in a stable order so an unchanged night
 *  writes an identical file. */
export function sortFixtures(fixtures: FeedFixture[]): FeedFixture[] {
  return [...fixtures].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
