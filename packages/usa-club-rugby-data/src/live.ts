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
import { isClubSide } from './clubFixtures.ts';
import {
  aggregatePlayerHistory,
  fetchMatchCentre,
  fetchMatches,
  type FetchMatchesOptions,
  type MatchCentreData,
} from './playerHistory.ts';
import { buildParticipationSnapshot, type ParticipationSnapshot } from './snapshot.ts';
import { DEFAULT_SOURCES, type SourcesConfig } from './sources.ts';
import type { Club, PlayerRow } from './types.ts';

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

/** A scheduled fixture with what a match-centre request needs. */
export interface ScheduledFixture {
  id: string;
  compId: string;
  compName: string;
  season: string;
  dateTime: string;
  round?: string;
  status?: string;
  sourceType: string;
  homeTeam: { name: string; score: string };
  awayTeam: { name: string; score: string };
}

const isScored = (fixture: { homeTeam: { score: string }; awayTeam: { score: string } }) =>
  fixture.homeTeam.score !== '' && fixture.awayTeam.score !== '';

/** The league's played fixtures: every side, competition and season in the
 *  schedule. A fixture dated later can carry a placeholder score. */
export function leagueResults(
  schedule: ScheduledFixture[],
  now: Date = new Date(),
): ScheduledFixture[] {
  return schedule.filter((fixture) => isScored(fixture) && new Date(fixture.dateTime) <= now);
}

/** Pulls one club's latest-season participation live. The schedule comes from the
 *  nightly fixture list, and each played match's score and lineup from the CMS.
 *  Throws if any match can't be fetched, since a partial count could wrongly pass
 *  or fail a player. */
async function pullClubParticipation(
  club: Club,
  fixtures: ScheduledFixture[],
  fetchMatch: (fixture: ScheduledFixture) => Promise<MatchCentreData | null>,
  now: Date,
  pullOptions: FetchMatchesOptions,
  saved: ParticipationSnapshot | null,
): Promise<ParticipationSnapshot | null> {
  const started = fixtures.filter((fixture) => new Date(fixture.dateTime) <= now);
  const season = started.reduce((latest, fixture) => (fixture.season > latest ? fixture.season : latest), '');
  // Build on the snapshot when it covers this club and season; otherwise pull it all.
  const base =
    saved?.resultIds &&
    saved.season === season &&
    club.sides.every((side) => saved.rows.some((row) => row.teamName === side.teamName))
      ? saved
      : null;
  const known = new Set(base?.resultIds);
  const own = started.filter(
    (fixture) =>
      fixture.season === season &&
      !known.has(fixture.id) &&
      fixture.status !== 'Postponed' &&
      (isClubSide(club, fixture.homeTeam.name) || isClubSide(club, fixture.awayTeam.name)),
  );
  // Every played fixture already has a result, so no requests are needed.
  if (base && own.length === 0) {
    return null;
  }
  const toFetch = own;

  const { matches, failed } = await fetchMatches(toFetch, fetchMatch, {
    concurrency: 2,
    // Someone is waiting and the snapshot is the fallback, so don't sit out a
    // rate limit here.
    stopOnFailure: true,
    ...pullOptions,
  });
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${toFetch.length} matches could not be fetched`);
  }

  // A lineup can be posted before kickoff, so only scored matches count.
  const played = matches.filter((match) => isScored(match.fixture));
  const playedIds = new Set(played.map((match) => match.fixture.id));
  const results = own.filter((fixture) => playedIds.has(fixture.id) || isScored(fixture));

  const pulled: ParticipationSnapshot = {
    ...buildParticipationSnapshot(aggregatePlayerHistory(played).values(), results, now),
    season,
  };
  return base ? addParticipation(base, pulled) : pulled;
}

/** Adds newly pulled matches to a snapshot's totals. */
function addParticipation(
  base: ParticipationSnapshot,
  pulled: ParticipationSnapshot,
): ParticipationSnapshot {
  const key = (row: PlayerRow) => `${row.teamName}\0${row.competition}\0${row.playerId}`;
  const rows = new Map(base.rows.map((row) => [key(row), row]));
  for (const row of pulled.rows) {
    const existing = rows.get(key(row));
    rows.set(
      key(row),
      existing
        ? {
            ...existing,
            appearances: existing.appearances + row.appearances,
            played: existing.played + row.played,
            substitute: existing.substitute + row.substitute,
            rounds: { ...existing.rounds, ...row.rounds },
          }
        : row,
    );
  }
  return {
    ...base,
    resultIds: [...(base.resultIds ?? []), ...(pulled.resultIds ?? [])],
    rows: [...rows.values()],
    gaps: [...base.gaps, ...pulled.gaps],
  };
}

/** A club's participation and where it came from. */
export interface ClubRecord {
  snapshot: ParticipationSnapshot;
  source: 'live' | 'saved';
  /** When the data was read or written, if known. */
  asOf?: string;
  /** True when this is the saved snapshot because a live pull failed. */
  liveFailed: boolean;
}

interface ClubRecordDeps {
  /** Pull from the CMS; otherwise use only the saved snapshot (dev and tests). */
  live: boolean;
  fixtures: ScheduledFixture[];
  fetchMatch: (fixture: ScheduledFixture) => Promise<MatchCentreData | null>;
  loadSaved: () => Promise<ParticipationSnapshot | null>;
  now?: Date;
  pullOptions?: FetchMatchesOptions;
}

export async function loadClubRecord(
  club: Club,
  { live, fixtures, fetchMatch, loadSaved, now = new Date(), pullOptions = {} }: ClubRecordDeps,
): Promise<ClubRecord> {
  let liveFailed = false;
  // A failed load only costs the head start when pulling live.
  const saved = await (live ? loadSaved().catch(() => null) : loadSaved());
  if (live) {
    try {
      const pulled = await pullClubParticipation(club, fixtures, fetchMatch, now, pullOptions, saved);
      if (pulled) {
        return { snapshot: pulled, source: 'live', asOf: now.toISOString(), liveFailed: false };
      }
    } catch {
      liveFailed = true;
    }
  }

  const hasClub = saved?.rows.some((row) => isClubSide(club, row.teamName));
  if (!saved || !hasClub) {
    throw new Error(`No saved match data for ${club.name}.`);
  }
  return { snapshot: saved, source: 'saved', asOf: saved.generatedAt, liveFailed };
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
