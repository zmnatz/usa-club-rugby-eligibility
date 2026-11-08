import type { ArchiveFixturesFile, ArchiveMatchesFile } from './data.ts';
import type { Club, EligibilityRules } from './types.ts';
import { currentSeason, type FeedFixture, isResult, sortFixtures } from './feeds.ts';
import type { PublishedPlayersFile } from './data.ts';
import { buildPlayerIndex, clubContext } from './players.ts';
import { buildParticipationSnapshot, clubSnapshot, listClubs, type ParticipationSnapshot } from './participation.ts';
import {
  aggregatePlayerHistory,
  fetchMatchCentre,
  fetchMatchCentres,
  fetchMatches,
  MATCH_BATCH_SIZE,
  type MatchCentreData,
} from './playerHistory.ts';
import { mapConcurrent } from './api.ts';
import { clubKey } from './teamSide.ts';

// The raw match archive (archive/, committed but not published). The nightly job
// saves every played match's full CMS record here, and everything published is
// calculated from it, so a format change rebuilds locally with no CMS requests.
// Seasons before the current one are locked: never read again unless the fields
// requested change or a --full-history run asks. See docs/adr/002-raw-match-archive.md.

export interface ArchiveManifest {
  /** A hash of the CMS queries the archive was read with. A change re-reads it. */
  fields: string;
  /** The season the verdicts were last for. It gets one more read as the next begins. */
  currentSeason: string;
  /** Every season in the archive, oldest first. */
  seasons: string[];
  /** Clubs whose own feeds are read, found from the crests in match records. */
  clubIds: number[];
}

/** A season's match records by fixture id. null records a match the CMS has no
 *  details for, so a locked season doesn't ask for it again. */
export type SeasonMatches = Record<string, MatchCentreData | null>;

export function seasonFile(season: string): string {
  return `${season.replace(/[^0-9A-Za-z]+/g, '-')}.json`;
}

/** One line per entry in id order, so a night's diff shows only what changed and
 *  git stores it as a small delta. */
function linesById<T>(open: string, entries: [string, T][], close: string): string {
  const sorted = [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `${open}\n${sorted.map(([id, value]) => `${JSON.stringify(id)}:${JSON.stringify(value)}`).join(',\n')}\n${close}\n`;
}

export function serializeSeasonMatches(season: string, matches: SeasonMatches): string {
  return linesById(`{"season":${JSON.stringify(season)},"matches":{`, Object.entries(matches), '}}');
}

export function serializeSeasonFixtures(season: string, fixtures: FeedFixture[]): string {
  return linesById(
    `{"season":${JSON.stringify(season)},"fixtures":{`,
    fixtures.map((fixture) => [fixture.id, fixture]),
    '}}',
  );
}

export function parseSeasonFixtures(text: string): FeedFixture[] {
  return Object.values((JSON.parse(text) as ArchiveFixturesFile).fixtures);
}

export function parseSeasonMatches(text: string): SeasonMatches {
  return (JSON.parse(text) as ArchiveMatchesFile).matches;
}

/** The earliest season to read from the CMS; anything before it stays as archived.
 *  '' reads every season the feeds list. */
export function refreshFrom(
  manifest: ArchiveManifest | null,
  latestSeason: string,
  { fields, fullHistory = false }: { fields: string; fullHistory?: boolean },
): string {
  if (fullHistory) return '';
  // A first run reads the latest season only; --full-history fills in the rest.
  if (!manifest) return latestSeason;
  if (manifest.fields !== fields) return manifest.seasons[0] ?? latestSeason;
  // The season saved as current gets a last read as the next one begins.
  const saved = manifest.currentSeason || latestSeason;
  return saved < latestSeason ? saved : latestSeason;
}

/** The fixtures whose match records a run reads: played, in a season being
 *  refreshed. A forfeit is read too, since the winning side's roster counts
 *  (Reg 3.4(h)). */
export function matchesToRead(fixtures: FeedFixture[], fromSeason: string, now: Date): FeedFixture[] {
  return fixtures.filter((fixture) => fixture.season >= fromSeason && isResult(fixture, now));
}

interface MatchRecordFetchers {
  fetchBatch?: typeof fetchMatchCentres;
  fetchOne?: typeof fetchMatchCentre;
  batchSize?: number;
  concurrency?: number;
}

/** Match records by fixture id, a batch of up to 100 per request. A batch the CMS
 *  rejects is asked again a match at a time. Throws if any match still fails, since
 *  a partial pull could wrongly pass or fail a player. */
export async function fetchMatchRecords(
  fixtures: FeedFixture[],
  {
    fetchBatch = fetchMatchCentres,
    fetchOne = fetchMatchCentre,
    batchSize = MATCH_BATCH_SIZE,
    concurrency = 2,
  }: MatchRecordFetchers = {},
): Promise<Map<string, MatchCentreData | null>> {
  const batches: FeedFixture[][] = [];
  for (let start = 0; start < fixtures.length; start += batchSize) {
    batches.push(fixtures.slice(start, start + batchSize));
  }
  const records = new Map<string, MatchCentreData | null>();
  const rejected: FeedFixture[] = [];
  await mapConcurrent(batches, concurrency, async (batch) => {
    try {
      for (const [id, match] of await fetchBatch(batch)) records.set(id, match);
    } catch {
      rejected.push(...batch);
    }
  });
  const { matches, failed } = await fetchMatches(
    rejected,
    async (fixture) => ({ id: fixture.id, match: await fetchOne(fixture) }),
    { gapMs: 0 },
  );
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${fixtures.length} match records failed: ${failed.map((f) => f.id).join(', ')}`);
  }
  for (const { id, match } of matches) records.set(id, match);
  return records;
}

/** The site's own pages, which a club's page path mustn't take. */
export const RESERVED_PATHS = new Set(['csv', 'methodology', '404', 'data', 'index']);

/** What the site publishes: the current season's fixtures, its clubs, and each
 *  club's Match Participation. */
export interface PublishedData {
  season: string;
  fixtures: FeedFixture[];
  clubs: (Club & { key: string })[];
  clubFiles: Record<string, ParticipationSnapshot>;
  /** Which clubs each player is in the record of. */
  players: PublishedPlayersFile;
}

/** Calculates the published data from archived fixtures and matches, with no
 *  CMS requests. */
export function buildPublished(
  fixtures: FeedFixture[],
  matches: MatchCentreData[],
  rules: EligibilityRules,
  now: Date,
): PublishedData {
  const season = currentSeason(fixtures, now);
  const seasonFixtures = sortFixtures(fixtures.filter((fixture) => fixture.season === season));
  const seasonMatches = matches.filter((match) => match.fixture.season === season);
  const results = seasonFixtures.filter((fixture) => isResult(fixture, now));
  const participation = buildParticipationSnapshot(aggregatePlayerHistory(seasonMatches).values(), results, now);
  // Two names can make one file name ("St. Louis", "St Louis"), so a repeat is numbered.
  const used = new Map<string, number>();
  const clubs = listClubs(seasonFixtures, rules).map((club) => {
    const key = clubKey(club.name);
    const base = RESERVED_PATHS.has(key) ? `${key}-club` : key;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return { ...club, key: count === 1 ? base : `${base}-${count}` };
  });
  const clubFiles = Object.fromEntries(
    clubs.map((club) => [club.key, clubSnapshot(participation, club, results)]),
  );
  const players = buildPlayerIndex(
    season,
    clubs.map((club) => ({
      club,
      breakdown: clubContext(club, clubFiles[club.key], seasonFixtures, { rules, now }).breakdown,
    })),
  );
  return { season, fixtures: seasonFixtures, clubs, clubFiles, players };
}
