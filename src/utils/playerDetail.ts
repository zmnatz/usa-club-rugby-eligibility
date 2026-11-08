// What a player's detail shows beyond their verdict: the fixtures behind it. Worked
// out by the engine, so the club page (in the browser, from live data) and the
// player database (at build time) give the same answer. Plain data in and out,
// and no imports but the package's, so the build script can run it under Node.
import {
  DEFAULT_RULES as eligibility,
  playerRounds,
  possibleFixtures,
} from '@zmnatz/usa-club-rugby-data';
import type {
  Club,
  ParticipationSnapshot,
  PlayerEligibility,
  PlayerRound,
  PossibleFixture,
  ScheduledFixture,
} from '@zmnatz/usa-club-rugby-data';

/** What's needed to set a player's verdict against the team's fixtures. */
export interface RoundAccounting {
  snapshot: ParticipationSnapshot;
  fixtures: ScheduledFixture[];
  clubSlug: string | null;
  /** The club's sides, upper first. */
  sides: string[];
}

/** The club's schedule, for justifying an on-track verdict. */
export interface ClubSchedule {
  club: Club;
  fixtures: ScheduledFixture[];
  clubSlug: string | null;
}

/** One side's fixtures for one player. */
export interface SideRounds {
  teamName: string;
  rounds: PlayerRound[];
}

/** The fixtures behind a record player's verdict. */
export interface PlayerFixtures {
  /** A round table per side, the player's own first. */
  sides: SideRounds[];
  /** Why an on-track player is on track; empty for anyone else. */
  possible: PossibleFixture[];
}

/** Each side's rounds for the player, own side first; every side feeds the verdict. */
export function sideRounds(player: PlayerEligibility, accounting: RoundAccounting): SideRounds[] {
  return [player.teamName, ...accounting.sides.filter((side) => side !== player.teamName)].map((teamName) => ({
    teamName,
    rounds: playerRounds({
      fixtures: accounting.fixtures,
      teamName,
      season: accounting.snapshot.season,
      rows: player.rows,
      gaps: accounting.snapshot.gaps,
      resultIds: accounting.snapshot.resultIds ?? [],
      rules: eligibility,
    }),
  }));
}

/** The fixtures a verdict counted as possible, on the player's side and the sides
 *  below it, or every side for the top one. */
export function possibleFor(player: PlayerEligibility, schedule: ClubSchedule): PossibleFixture[] {
  const { club, fixtures } = schedule;
  const lists = possibleFixtures(fixtures, club, eligibility);
  const index = club.sides.findIndex((side) => side.teamName === player.teamName);
  return club.sides
    .slice(Math.max(index, 0))
    .flatMap((side) => lists[side.teamName] ?? [])
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

export function playerFixtures(
  player: PlayerEligibility,
  accounting: RoundAccounting,
  schedule: ClubSchedule,
): PlayerFixtures {
  return {
    sides: sideRounds(player, accounting),
    possible: player.pending.length > 0 ? possibleFor(player, schedule) : [],
  };
}
