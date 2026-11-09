import type { PublishedPlayersFile } from './data.ts';
import type { FeedFixture } from './feeds.ts';
import {
  clubBreakdown,
  clubFixtures,
  type ParticipationSnapshot,
  type PlayerRound,
  playerRounds,
  type PossibleFixture,
  possibleFixtures,
} from './participation.ts';
import { isNameWithheld } from './playerHistory.ts';
import type { PublishedClub } from './published.ts';
import { DEFAULT_RULES } from './rules.ts';
import type { Club, EligibilityBreakdown, EligibilityRules, PlayerEligibility } from './types.ts';
import { hasSharedName, sharedNames } from './eligibility.ts';

// A player across clubs. A player can be in the record of several clubs (they move,
// or play for more than one), and a verdict only means something within a club, so a
// profile is one verdict for each club side the player is listed on, with the
// fixtures behind it. The nightly job publishes players.json, which says which
// clubs to look in; everything else is worked out from the club files.

export interface PlayerOptions {
  rules?: EligibilityRules;
  /** The time possible remaining matches are counted from. Defaults to now. */
  now?: Date;
}

/** One club's published file, with what's worked out from it. */
export interface ClubContext {
  club: PublishedClub;
  snapshot: ParticipationSnapshot;
  /** The fixtures in the club's divisions. */
  fixtures: FeedFixture[];
  breakdown: EligibilityBreakdown;
}

/** What a player's fixtures are worked out from: a club, its published file and its fixtures. */
export interface PlayerRecordInput {
  club: Pick<Club, 'sides'>;
  snapshot: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

/** A club's verdicts and the fixtures they're counted from. */
export function clubContext(
  club: PublishedClub,
  snapshot: ParticipationSnapshot,
  allFixtures: FeedFixture[],
  options: PlayerOptions = {},
): ClubContext {
  const fixtures = clubFixtures(allFixtures, club);
  return { club, snapshot, fixtures, breakdown: clubBreakdown(snapshot, fixtures, club, options) };
}

/** One side's fixtures for one player. */
export interface SideRounds {
  teamName: string;
  rounds: PlayerRound[];
}

/** The fixtures behind a verdict. */
export interface PlayerFixtures {
  /** A round table per side of the club, the player's own side first. */
  sides: SideRounds[];
  /** Why an on-track player is on track; empty for anyone else. */
  possible: PossibleFixture[];
}

/** Each side's rounds for the player, own side first; every side feeds the verdict. */
export function sideRounds(
  player: PlayerEligibility,
  club: Pick<Club, 'sides'>,
  snapshot: ParticipationSnapshot,
  fixtures: FeedFixture[],
  rules: EligibilityRules = DEFAULT_RULES,
): SideRounds[] {
  const sides = club.sides.map((side) => side.teamName);
  return [player.teamName, ...sides.filter((side) => side !== player.teamName)].map((teamName) => ({
    teamName,
    rounds: playerRounds({
      fixtures,
      teamName,
      season: snapshot.season,
      rows: player.rows,
      gaps: snapshot.gaps,
      resultIds: snapshot.resultIds ?? [],
      rules,
    }),
  }));
}

/** The fixtures a verdict counted as possible, on the player's side and the sides
 *  below it, or every side for the top one. */
export function possibleFor(
  player: PlayerEligibility,
  club: Pick<Club, 'sides'>,
  fixtures: FeedFixture[],
  { rules = DEFAULT_RULES, now = new Date() }: PlayerOptions = {},
): PossibleFixture[] {
  const lists = possibleFixtures(fixtures, club, rules, now);
  const index = club.sides.findIndex((side) => side.teamName === player.teamName);
  return club.sides
    .slice(Math.max(index, 0))
    .flatMap((side) => lists[side.teamName] ?? [])
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
}

/** The fixtures behind one player's verdict in a club. */
export function playerFixtures(
  player: PlayerEligibility,
  { club, snapshot, fixtures }: PlayerRecordInput,
  options: PlayerOptions = {},
): PlayerFixtures {
  const { rules = DEFAULT_RULES } = options;
  return {
    sides: sideRounds(player, club, snapshot, fixtures, rules),
    possible: player.pending.length > 0 ? possibleFor(player, club, fixtures, options) : [],
  };
}

/** A player's verdict on one side of one club, with the fixtures behind it. */
export interface PlayerClubEntry {
  clubKey: string;
  clubName: string;
  /** The side this verdict is for, e.g. "D1". */
  sideLabel: string;
  /** Another player in this side shares the name, so show the id to tell them apart. */
  showCmsId: boolean;
  /** Without its raw rows, which only the fixtures were worked out from. */
  player: PlayerEligibility;
  fixtures: PlayerFixtures;
}

/** A player and their verdict on every club side they're listed on. */
export interface PlayerProfile {
  /** The player's CMS id. */
  id: string;
  name: string;
  clubs: PlayerClubEntry[];
}

/** A player's verdicts in one club: one per side they're listed on. */
export function playerEntries(playerId: string, context: ClubContext, options: PlayerOptions = {}): PlayerClubEntry[] {
  const { club, breakdown } = context;
  return breakdown.sides.flatMap((side) => {
    const player = side.players.find((candidate) => candidate.playerId === playerId);
    if (!player) return [];
    return [
      {
        clubKey: club.key,
        clubName: club.name,
        sideLabel: side.label,
        showCmsId: hasSharedName(player, sharedNames(side.players)),
        player: { ...player, rows: [] },
        fixtures: playerFixtures(player, context, options),
      },
    ];
  });
}

/** Clubs and sides in the order a profile lists them. */
export function sortEntries(entries: PlayerClubEntry[]): PlayerClubEntry[] {
  return [...entries].sort((a, b) => a.clubName.localeCompare(b.clubName) || a.sideLabel.localeCompare(b.sideLabel));
}

/** Which clubs each player is in the record of, for finding a player from their id.
 *  A player whose profile isn't public ("Name Withheld") is left out. */
export function buildPlayerIndex(
  season: string,
  clubs: { club: Pick<PublishedClub, 'key'>; breakdown: EligibilityBreakdown }[],
): PublishedPlayersFile {
  const found = new Map<string, { name: string; clubs: string[] }>();
  for (const { club, breakdown } of clubs) {
    for (const side of breakdown.sides) {
      for (const player of side.players) {
        if (isNameWithheld(player.name)) continue;
        const entry = found.get(player.playerId) ?? { name: player.name, clubs: [] };
        if (!entry.clubs.includes(club.key)) entry.clubs.push(club.key);
        found.set(player.playerId, entry);
      }
    }
  }
  const players = Object.fromEntries([...found].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return { season, players };
}
