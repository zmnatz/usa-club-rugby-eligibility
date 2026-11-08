import { fetchMatchRecords, matchesToRead } from './archive.ts';
import {
  CLUB_FEED_BATCH_SIZE,
  CLUB_PAGE_SIZE,
  clubIdsFromMatches,
  type FeedFixture,
  type FeedSource,
  fetchFeeds,
  keepCompetitions,
  mergeFeeds,
} from './feeds.ts';
import { type ClubRecord, loadClubRecord, type ParticipationSnapshot, type ScheduledFixture } from './participation.ts';
import { fetchMatchCentre, type MatchCentreData } from './playerHistory.ts';
import { DEFAULT_SOURCES, type SourcesConfig } from './sources.ts';
import type { Club } from './types.ts';

// Live pulls from the Rugby Xplorer CMS. Every request goes through the shared
// rate-limit gate in api.ts (about 500 requests at once, then about 4 a second), so
// prefer the published data (published.ts) unless you need something it lacks.

/** Club feeds lead to more clubs; a few rounds reach every club with a result. */
export const MAX_DISCOVERY_ROUNDS = 5;

export interface DiscoverOptions {
  sources?: SourcesConfig;
  /** The earliest season to read, e.g. "2026/2027". '' reads every season the feeds list. */
  fromSeason: string;
  now?: Date;
  /** Club ids found on an earlier run, so their feeds are read from the first round. */
  knownClubIds?: Iterable<number>;
  /** Match records already in hand, which aren't requested again. */
  knownMatches?: Map<string, MatchCentreData | null>;
  log?: (message: string) => void;
}

export interface Discovery {
  fixtures: FeedFixture[];
  /** A record for every played fixture; null where the CMS has none. */
  matches: Map<string, MatchCentreData | null>;
  clubIds: number[];
}

/** The pull behind the nightly job: the council and union feeds define which
 *  competitions are senior club, every played match's record names the clubs in
 *  it by their crests, and each club's own feed adds the fixtures the others miss.
 *  Repeats until no new club turns up. Throws if any request fails for good. */
export async function discoverFixtures({
  sources = DEFAULT_SOURCES,
  fromSeason,
  now = new Date(),
  knownClubIds = [],
  knownMatches = new Map(),
  log = () => {},
}: DiscoverOptions): Promise<Discovery> {
  const council: FeedSource = { id: sources.council.id, type: sources.council.type };
  const base = [
    { label: 'Senior Club Council', source: council },
    ...sources.unions.map((union) => ({ label: union.name, source: { id: union.id, type: 'geographical-union' } })),
  ];
  const baseFeeds = await fetchFeeds(
    base.map(({ source }) => source),
    fromSeason,
  );
  baseFeeds.forEach((feed, i) => {
    if (feed.length === 0) log(`${base[i].label}: no fixtures`);
  });
  let fixtures = mergeFeeds(baseFeeds);
  const competitions = new Set(fixtures.map((fixture) => fixture.compId));
  log(`Council and ${sources.unions.length} union feeds: ${fixtures.length} fixtures in ${competitions.size} competitions`);

  const clubIds = new Set(knownClubIds);
  const readClubs = new Set<number>();
  const matches = new Map(knownMatches);

  for (let round = 1; round <= MAX_DISCOVERY_ROUNDS; round++) {
    const pending = matchesToRead(fixtures, fromSeason, now).filter((fixture) => !matches.has(fixture.id));
    for (const [id, match] of await fetchMatchRecords(pending)) matches.set(id, match);
    const found = clubIdsFromMatches([...matches.values()].flatMap((match) => (match ? [match] : [])));
    for (const id of found) clubIds.add(id);

    const toRead = [...clubIds].filter((id) => !readClubs.has(id));
    log(`Round ${round}: ${pending.length} match records, ${toRead.length} club feeds to read`);
    if (toRead.length === 0) break;
    const clubFeeds = await fetchFeeds(
      toRead.map((id) => ({ id, type: 'club' })),
      fromSeason,
      { pageSize: CLUB_PAGE_SIZE, batchSize: CLUB_FEED_BATCH_SIZE },
    );
    for (const id of toRead) readClubs.add(id);
    const before = fixtures.length;
    fixtures = mergeFeeds([fixtures, ...clubFeeds.map((feed) => keepCompetitions(feed, competitions))]);
    log(`Club feeds added ${fixtures.length - before} fixtures`);
  }
  return { fixtures, matches, clubIds: [...clubIds].sort((a, b) => a - b) };
}

/** One club's latest-season participation, counted from the CMS now. `fixtures` is
 *  the fixture list (published `fixtures.json` works), and `saved` an earlier
 *  snapshot to build on, such as the club's published file. */
export function fetchClubRecord(
  club: Club,
  fixtures: ScheduledFixture[],
  { saved = null, now = new Date() }: { saved?: ParticipationSnapshot | null; now?: Date } = {},
): Promise<ClubRecord> {
  return loadClubRecord(club, {
    live: true,
    fixtures,
    fetchMatch: fetchMatchCentre,
    loadSaved: async () => saved,
    now,
  });
}

export { fetchMatchRecords };
