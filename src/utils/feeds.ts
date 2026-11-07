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

const FEED_FIELDS = `{
    id compId compName season dateTime round status sourceType
    homeTeam { name score }
    awayTeam { name score }
  }`;

export const FEED_QUERY = `query EligibilityFeed($entityId: Int, $entityType: String, $type: String, $skip: Int, $limit: Int) {
  getEntityFixturesAndResults(type: $type, entityId: $entityId, entityType: $entityType, limit: $limit, skip: $skip) ${FEED_FIELDS}
}`;

/** Feed pages per request. The CMS answers several in one request, each under its
 *  own alias, which counts once against its rate limit, as match batches do. Twenty
 *  pages is about 2,000 fixtures, near a 100-match batch in size. */
export const FEED_BATCH_SIZE = 20;

/** One page of one entity's feed. */
export interface FeedPageRequest {
  source: FeedSource;
  skip: number;
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

/** Several feed pages in one request. Throws if the CMS reports any error, so a
 *  caller can fall back to asking one page at a time. */
export async function fetchFeedPages(requests: FeedPageRequest[]): Promise<FeedFixture[][]> {
  const declarations = requests.map((_, i) => `$e${i}: Int, $t${i}: String, $s${i}: Int`).join(', ');
  const selections = requests
    .map(
      (_, i) =>
        `f${i}: getEntityFixturesAndResults(type: "all", entityId: $e${i}, entityType: $t${i}, limit: ${PAGE_SIZE}, skip: $s${i}) ${FEED_FIELDS}`,
    )
    .join('\n  ');
  const response = await postWithRetry<{
    data: Record<string, RawFixture[] | null> | null;
    errors?: { message: string }[];
  }>(CMS_URL, {
    query: `query EligibilityFeedBatch(${declarations}) {\n  ${selections}\n}`,
    variables: Object.fromEntries(
      requests.flatMap(({ source, skip }, i) => [
        [`e${i}`, source.id],
        [`t${i}`, source.type],
        [`s${i}`, skip],
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
  batchSize?: number;
  concurrency?: number;
  fetchPages?: (requests: FeedPageRequest[]) => Promise<FeedFixture[][]>;
  fetchPage?: (source: FeedSource, skip: number) => Promise<FeedFixture[]>;
}

/** Many entities' fixtures from `fromSeason` on, a page of each per alias. Each
 *  round asks for the next page of every feed that isn't finished. A batch the CMS
 *  rejects is asked again a page at a time; a page that still fails throws, because
 *  a missing fixture would undercount players without any sign. */
export async function fetchFeeds(
  sources: FeedSource[],
  fromSeason: string,
  {
    batchSize = FEED_BATCH_SIZE,
    concurrency = 2,
    fetchPages = fetchFeedPages,
    fetchPage = fetchFeedPage,
  }: FeedsOptions = {},
): Promise<FeedFixture[][]> {
  const feeds = sources.map(() => [] as FeedFixture[]);
  let pending = sources.map((_, index) => ({ index, skip: 0 }));
  while (pending.length > 0) {
    const batches: (typeof pending)[] = [];
    for (let start = 0; start < pending.length; start += batchSize) {
      batches.push(pending.slice(start, start + batchSize));
    }
    const next: typeof pending = [];
    await mapConcurrent(batches, concurrency, async (batch) => {
      const requests = batch.map(({ index, skip }) => ({ source: sources[index], skip }));
      const pages = await fetchPages(requests).catch(() =>
        Promise.all(requests.map(({ source, skip }) => fetchPage(source, skip))),
      );
      batch.forEach(({ index, skip }, i) => {
        const page = pages[i];
        feeds[index].push(...page);
        const more = page.length === PAGE_SIZE && !isPastPage(page, fromSeason) && skip + PAGE_SIZE < MAX_FIXTURES;
        if (more) next.push({ index, skip: skip + PAGE_SIZE });
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
