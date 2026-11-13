import { type FeedFixture, isResult } from './feeds.ts';
import { isForfeit } from './forfeit.ts';
import type { PublishedClub } from './published.ts';
import { isQualifyingMatch } from './qualifying.ts';
import type { ParticipationGap } from './snapshot.ts';
import { isNcsSide, parseTeamSide } from './teamSide.ts';
import type { EligibilityRules } from './types.ts';

// Current-season games whose record still needs entering: no result, or a result
// whose lineup or substitutions are missing, once the leeway after kickoff is up.
// For chasing the clubs, not for the verdicts, which already allow for the gaps.

/** Days after kickoff a club has to enter a game's record before it is listed. */
export const UNREPORTED_LEEWAY_DAYS = 14;
/** A full starting side. A side that rostered no more than this had no substitute to
 *  bring on, so none coming on isn't a gap. */
export const FULL_SIDE = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixtures in these states aren't waiting on a result: the game won't be played as
 *  scheduled. */
const SETTLED_STATUSES = new Set(['Cancelled', 'Postponed']);

export type UnreportedReason =
  | { kind: 'no-result' }
  | { kind: 'no-lineup' | 'no-substitutions'; teamName: string };

export interface UnreportedSide {
  teamName: string;
  /** The club's page key; null for a team that isn't one of a published club's sides. */
  clubKey: string | null;
  clubName: string;
}

export interface UnreportedGame {
  fixtureId: string;
  dateTime: string;
  /** Whole days past the leeway, at least 1. */
  daysOverdue: number;
  competition: string;
  /** Each side's assessed division, e.g. "M1" or "W2", sorted and without repeats. */
  divisions: string[];
  home: UnreportedSide;
  away: UnreportedSide;
  /** The game's discrepancies: a missing result, or each side's gap, home side first. */
  reasons: UnreportedReason[];
}

export interface UnreportedInput {
  /** The current season's fixtures. */
  fixtures: FeedFixture[];
  /** The current season's gaps, from any number of club files; repeats are ignored. */
  gaps: ParticipationGap[];
  clubs: PublishedClub[];
  rules: EligibilityRules;
  now: Date;
}

/** A side's division code, e.g. "M1", or null for a side NCS eligibility doesn't assess. */
function divisionCode(teamName: string): string | null {
  const side = parseTeamSide(teamName);
  return side && isNcsSide(side) ? `${side.gender}${side.level}` : null;
}

/** The games past their leeway with a discrepancy, by kickoff, so the most overdue first. Only Qualifying
 *  Matches with at least one published club's side are listed. */
export function unreportedGames({ fixtures, gaps, clubs, rules, now }: UnreportedInput): UnreportedGame[] {
  const clubOf = new Map(clubs.flatMap((club) => club.sides.map((side) => [side.teamName, club] as const)));
  const sideOf = (teamName: string): UnreportedSide => {
    const club = clubOf.get(teamName);
    return {
      teamName,
      clubKey: club?.key ?? null,
      clubName: club?.name ?? parseTeamSide(teamName)?.clubName ?? teamName,
    };
  };

  const gapsByFixture = new Map<string, ParticipationGap[]>();
  for (const gap of gaps) {
    if (gap.kind === 'no-substitutions' && (gap.rostered ?? 0) <= FULL_SIDE) continue;
    const list = gapsByFixture.get(gap.fixtureId) ?? [];
    if (!list.some((seen) => seen.kind === gap.kind && seen.teamName === gap.teamName)) list.push(gap);
    gapsByFixture.set(gap.fixtureId, list);
  }

  const games: UnreportedGame[] = [];
  for (const fixture of fixtures) {
    const { homeTeam, awayTeam } = fixture;
    // A forfeit has nothing more to enter: its result is the forfeit.
    if (!homeTeam.name || !awayTeam.name || isForfeit(fixture)) continue;
    if (!clubOf.has(homeTeam.name) && !clubOf.has(awayTeam.name)) continue;
    if (!isQualifyingMatch(fixture, rules)) continue;
    const overdueMs = now.getTime() - new Date(fixture.dateTime).getTime() - UNREPORTED_LEEWAY_DAYS * DAY_MS;
    if (!(overdueMs > 0)) continue;

    const reasons: UnreportedReason[] = [];
    if (!isResult(fixture, now) && !SETTLED_STATUSES.has(fixture.status)) reasons.push({ kind: 'no-result' });
    for (const teamName of [homeTeam.name, awayTeam.name]) {
      for (const gap of gapsByFixture.get(fixture.id) ?? []) {
        if (gap.teamName === teamName) reasons.push({ kind: gap.kind, teamName });
      }
    }
    if (reasons.length === 0) continue;

    const divisions = [homeTeam.name, awayTeam.name].map(divisionCode).filter((code) => code !== null);
    games.push({
      fixtureId: fixture.id,
      dateTime: fixture.dateTime,
      daysOverdue: Math.ceil(overdueMs / DAY_MS),
      competition: fixture.compName,
      divisions: [...new Set(divisions)].sort(),
      home: sideOf(homeTeam.name),
      away: sideOf(awayTeam.name),
      reasons,
    });
  }

  return games.sort(
    (a, b) =>
      new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime() ||
      (a.fixtureId < b.fixtureId ? -1 : a.fixtureId > b.fixtureId ? 1 : 0),
  );
}

/** A year or season in a competition name, e.g. "2027", "2026 - 2027" or "2026/27", with
 *  a separator beside it. */
const YEAR = /\s*[-–:]?\s*\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:(?:19|20)\d{2}|\d{2}))?\b\s*[-–:]?\s*/g;

/** A competition's name without its year, which every current-season competition shares,
 *  e.g. "2027 Midwest Men's D1 - Eastern" as "Midwest Men's D1 - Eastern". */
export function competitionLabel(name: string): string {
  const label = name.replace(YEAR, ' ').replace(/\s+/g, ' ').trim();
  return label || name.trim();
}
