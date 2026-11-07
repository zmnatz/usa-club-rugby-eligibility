import type { Club, EligibilityRules } from '@/types/eligibility';
import { currentSeason, type FeedFixture, isResult, sortFixtures } from '@/utils/feeds';
import { buildParticipationSnapshot, clubSnapshot, listClubs, type ParticipationSnapshot } from '@/utils/participation';
import { aggregatePlayerHistory, type MatchCentreData } from '@/utils/playerHistory';
import { clubKey } from '@/utils/teamSide';

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

/** One played match as the CMS returned it, or null when it holds no record. */
export interface ArchivedMatch {
  fixtureId: string;
  match: MatchCentreData | null;
}

export function seasonDir(season: string): string {
  return season.replace(/[^0-9A-Za-z]+/g, '-');
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

/** The fixtures whose match records a run reads: played, not forfeited, in a
 *  season being refreshed. */
export function matchesToRead(fixtures: FeedFixture[], fromSeason: string, now: Date): FeedFixture[] {
  return fixtures.filter(
    (fixture) => fixture.season >= fromSeason && isResult(fixture, now) && fixture.status !== 'Forfeit',
  );
}

/** What the site publishes: the current season's fixtures, its clubs, and each
 *  club's Match Participation. */
export interface PublishedData {
  season: string;
  fixtures: FeedFixture[];
  clubs: (Club & { key: string })[];
  clubFiles: Record<string, ParticipationSnapshot>;
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
    const base = clubKey(club.name);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return { ...club, key: count === 1 ? base : `${base}-${count}` };
  });
  const clubFiles = Object.fromEntries(
    clubs.map((club) => [club.key, clubSnapshot(participation, club, results)]),
  );
  return { season, fixtures: seasonFixtures, clubs, clubFiles };
}
