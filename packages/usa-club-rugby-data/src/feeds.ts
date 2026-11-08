import { mapConcurrent, postWithRetry } from './api.ts';
import type { MatchCentreData } from './playerHistory.ts';
import { crestEntityId } from './rugbyXplorer.ts';

// Reading fixture lists from the CMS behind Rugby Xplorer. No one feed lists every
// senior club fixture: the council's misses some its unions list, a union's misses
// some of its own, and some appear only in the feeds of the clubs playing them. So
// the nightly job reads all three. See docs/adr/001-national-coverage.md.

const CMS_URL = 'https://rugby-au-cms.graphcdn.app';
/** Fixtures per page for the council and union feeds, which are long and mostly
 *  the current season. */
const PAGE_SIZE = 100;
/** Fixtures per page for a club's feed. The CMS charges complexity on the limit
 *  asked for, not what comes back (about 18 a fixture), and a club's feed holds
 *  every season, so its current season usually fits a short page: about 450 a page
 *  instead of 1,800. See docs/adr/001-national-coverage.md. */
export const CLUB_PAGE_SIZE = 25;
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

const FEED_FIELDS = `{
    id compId compName season dateTime round status sourceType
    homeTeam { name score }
    awayTeam { name score }
  }`;

export const FEED_QUERY = `query EligibilityFeed($entityId: Int, $entityType: String, $type: String, $skip: Int, $limit: Int) {
  getEntityFixturesAndResults(type: $type, entityId: $entityId, entityType: $entityType, limit: $limit, skip: $skip) ${FEED_FIELDS}
}`;

/** Feed pages per request. The CMS answers several in one request, each under its
 *  own alias, which counts once against its request budget, as match batches do.
 *  Twenty 100-fixture pages is about 2,000 fixtures, near a 100-match batch in size. */
export const FEED_BATCH_SIZE = 20;
/** Club pages per request: 50 short pages cost about what 20 long ones do. */
export const CLUB_FEED_BATCH_SIZE = 50;

/** One page of one entity's results or fixtures. */
export interface FeedPageRequest {
  source: FeedSource;
  list: FeedList;
  skip: number;
  limit: number;
}

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

/** Which of an entity's lists a page comes from. `results` is played matches,
 *  newest first; `fixtures` is matches still to play, soonest first. The CMS's
 *  `all` list is neither complete nor in one order (a club's can start with last
 *  season's spring and stop short of this season's later fixtures), so it isn't
 *  used. See docs/adr/001-national-coverage.md. */
export type FeedList = 'results' | 'fixtures';

export async function fetchFeedPage(
  source: FeedSource,
  skip: number,
  limit = PAGE_SIZE,
  list: FeedList = 'results',
): Promise<FeedFixture[]> {
  const response = await postWithRetry<{
    data: { getEntityFixturesAndResults: RawFixture[] | null };
    errors?: { message: string }[];
  }>(CMS_URL, {
    operationName: 'EligibilityFeed',
    variables: { entityId: source.id, entityType: source.type, type: list, skip, limit },
    query: FEED_QUERY,
  });
  // A throttled query can answer 200 with errors, which mustn't read as an empty feed.
  if (response.errors?.length) {
    throw new Error(`Feed ${source.type} ${source.id} failed: ${response.errors[0].message}`);
  }
  return (response.data.getEntityFixturesAndResults ?? []).map(normalizeFixture);
}

/** Whether a page of results has nothing from the seasons being read. Results come
 *  newest first, so everything after it is older too. */
export function isPastPage(page: FeedFixture[], fromSeason: string): boolean {
  return fromSeason !== '' && page.every((fixture) => fixture.season < fromSeason);
}

/** Several feed pages in one request. Throws if the CMS reports any error, so a
 *  caller can fall back to asking one page at a time. */
export async function fetchFeedPages(requests: FeedPageRequest[]): Promise<FeedFixture[][]> {
  const declarations = requests
    .map((_, i) => `$e${i}: Int, $t${i}: String, $k${i}: String, $s${i}: Int, $l${i}: Int`)
    .join(', ');
  const selections = requests
    .map(
      (_, i) =>
        `f${i}: getEntityFixturesAndResults(type: $k${i}, entityId: $e${i}, entityType: $t${i}, limit: $l${i}, skip: $s${i}) ${FEED_FIELDS}`,
    )
    .join('\n  ');
  const response = await postWithRetry<{
    data: Record<string, RawFixture[] | null> | null;
    errors?: { message: string }[];
  }>(CMS_URL, {
    query: `query EligibilityFeedBatch(${declarations}) {\n  ${selections}\n}`,
    variables: Object.fromEntries(
      requests.flatMap(({ source, list, skip, limit }, i) => [
        [`e${i}`, source.id],
        [`t${i}`, source.type],
        [`k${i}`, list],
        [`s${i}`, skip],
        [`l${i}`, limit],
      ]),
    ),
  });
  if (response.errors?.length || !response.data) {
    throw new Error(`Feed batch failed: ${response.errors?.[0]?.message ?? 'no data'}`);
  }
  const data = response.data;
  return requests.map((_, i) => (data[`f${i}`] ?? []).map(normalizeFixture));
}

interface FeedsOptions {
  /** Fixtures per page. */
  pageSize?: number;
  batchSize?: number;
  concurrency?: number;
  fetchPages?: (requests: FeedPageRequest[]) => Promise<FeedFixture[][]>;
  fetchPage?: (source: FeedSource, skip: number, limit: number, list: FeedList) => Promise<FeedFixture[]>;
}

/** Many entities' fixtures from `fromSeason` on, a page of each per alias. Each
 *  entity's results are read back to the first page from before `fromSeason`, and
 *  its fixtures to the end of the list. Each round asks for the next page of every
 *  list that isn't finished. A batch the CMS rejects is asked again a page at a
 *  time; a page that still fails throws, because a missing fixture would
 *  undercount players without any sign. */
export async function fetchFeeds(
  sources: FeedSource[],
  fromSeason: string,
  {
    pageSize = PAGE_SIZE,
    batchSize = FEED_BATCH_SIZE,
    concurrency = 2,
    fetchPages = fetchFeedPages,
    fetchPage = fetchFeedPage,
  }: FeedsOptions = {},
): Promise<FeedFixture[][]> {
  const feeds = sources.map(() => [] as FeedFixture[]);
  type Pending = { index: number; list: FeedList; skip: number };
  let pending: Pending[] = sources.flatMap((_, index) => [
    { index, list: 'results' as const, skip: 0 },
    { index, list: 'fixtures' as const, skip: 0 },
  ]);
  while (pending.length > 0) {
    const batches: Pending[][] = [];
    for (let start = 0; start < pending.length; start += batchSize) {
      batches.push(pending.slice(start, start + batchSize));
    }
    const next: Pending[] = [];
    await mapConcurrent(batches, concurrency, async (batch) => {
      const requests = batch.map(({ index, list, skip }) => ({ source: sources[index], list, skip, limit: pageSize }));
      const pages = await fetchPages(requests).catch(() =>
        Promise.all(requests.map(({ source, skip, limit, list }) => fetchPage(source, skip, limit, list))),
      );
      batch.forEach((item, i) => {
        const page = pages[i];
        feeds[item.index].push(...page);
        const ended = page.length < pageSize || item.skip + pageSize >= MAX_FIXTURES;
        const past = item.list === 'results' && isPastPage(page, fromSeason);
        if (!ended && !past) next.push({ ...item, skip: item.skip + pageSize });
      });
    });
    pending = next;
  }
  return feeds.map((feed) => feed.filter((fixture) => fixture.season >= fromSeason));
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
