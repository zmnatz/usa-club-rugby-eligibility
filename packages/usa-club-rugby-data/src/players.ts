import type { PublishedPlayersFile } from './data.ts';
import type { FeedFixture } from './feeds.ts';
import { type PlayerRound, playerRounds } from './clubReport.ts';
import { clubSeason } from './clubSeason.ts';
import { isQualifying } from './qualifying.ts';
import { type PossibleFixture, possibleFixtures } from './schedule.ts';
import type { ParticipationSnapshot } from './snapshot.ts';
import { isNameWithheld } from './playerHistory.ts';
import type { PublishedClub } from './published.ts';
import { DEFAULT_RULES, rulesForSeason } from './rules.ts';
import type { Club, EligibilityBreakdown, EligibilityRules, PlayerEligibility } from './types.ts';
import { hasSharedName, sharedNames } from './eligibility.ts';

// A player across clubs. A player can be in the record of several clubs (they move,
// or play for more than one), and a verdict only means something within a club, so a
// profile is one verdict for each club side the player is listed on, with the
// fixtures behind it. The nightly job publishes players.json, which says which
// clubs to look in; everything else is worked out from those clubs' files.

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

/** A club's verdicts and the fixtures they're counted from.
 *  @deprecated Use `clubSeason`, which also gives the gaps and the rules. */
export function clubContext(
  club: PublishedClub,
  snapshot: ParticipationSnapshot,
  allFixtures: FeedFixture[],
  options: PlayerOptions = {},
): ClubContext {
  const { fixtures, breakdown } = clubSeason(snapshot, allFixtures, club, options);
  return { club, snapshot, fixtures, breakdown };
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

/** A player's verdicts in one Locked Season: the same as a profile, under that season's
 *  regulations and from that season's record. */
export interface PlayerSeasonProfile {
  /** As the CMS names it, e.g. "2025/2026". */
  season: string;
  /** The season's page path and file name, e.g. "2025-26". */
  slug: string;
  /** The name the record gave the player that season. */
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

/** A Locked Season's player index, worked out from its one published file under the
 *  rules of that season. Published beside it as `seasons/<slug>.players.json`. */
export function lockedSeasonPlayerIndex(file: {
  season: string;
  fixtures: FeedFixture[];
  clubs: PublishedClub[];
  clubFiles: Record<string, ParticipationSnapshot>;
}): PublishedPlayersFile {
  return buildPlayerIndex(
    file.season,
    file.clubs.map((club) => ({ club, breakdown: clubSeason(file.clubFiles[club.key], file.fixtures, club).breakdown })),
  );
}

/** A club's published file and the fixtures its players' games are read from. */
export interface SeasonClubRecord {
  club: PublishedClub;
  snapshot: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

/** A player's games for a club other than the one being shown. */
export interface OtherClubGames {
  clubKey: string;
  clubName: string;
  /** Only the sides they have a counted match for. */
  sides: SideRounds[];
}

/** Players who played for more than one club in the season, by CMS id, with their
 *  games for each other club. The report marks them "Waiver Required"; the rules on
 *  playing for another club aren't checked here. */
export type TransferRecords = Record<string, OtherClubGames[]>;

/** The clubs each player has a counted match for, by CMS id. Unused reserves don't count. */
export function clubsPlayedFor(clubs: SeasonClubRecord[], rules?: EligibilityRules): Map<string, string[]> {
  const played = new Map<string, string[]>();
  for (const { club, snapshot } of clubs) {
    const applied = rules ?? rulesForSeason(snapshot.season);
    const teams = new Set(club.sides.map((side) => side.teamName));
    for (const row of snapshot.rows) {
      if (!teams.has(row.teamName) || row.played + row.substitute === 0 || !isQualifying(row.competition, applied)) continue;
      const keys = played.get(row.playerId) ?? [];
      if (!keys.includes(club.key)) played.set(row.playerId, [...keys, club.key]);
    }
  }
  return played;
}

/** Every player of a club who also played for another club that season, with those
 *  games. Pass `played` from `clubsPlayedFor` when asking for many clubs. */
export function transferRecords(
  clubKey: string,
  clubs: SeasonClubRecord[],
  { rules, played = clubsPlayedFor(clubs, rules) }: { rules?: EligibilityRules; played?: Map<string, string[]> } = {},
): TransferRecords {
  const byKey = new Map(clubs.map((record) => [record.club.key, record]));
  const records: TransferRecords = {};
  for (const [playerId, keys] of played) {
    if (keys.length < 2 || !keys.includes(clubKey)) continue;
    records[playerId] = keys
      .filter((key) => key !== clubKey)
      .flatMap((key) => {
        const other = byKey.get(key);
        if (!other) return [];
        const { club, snapshot, fixtures } = other;
        const rows = snapshot.rows.filter((row) => row.playerId === playerId);
        const sides = club.sides
          .map(({ teamName }) => ({
            teamName,
            rounds: playerRounds({
              fixtures,
              teamName,
              season: snapshot.season,
              rows,
              gaps: snapshot.gaps,
              resultIds: snapshot.resultIds ?? [],
              rules: rules ?? rulesForSeason(snapshot.season),
            }),
          }))
          .filter(({ rounds }) => rounds.some((round) => round.counted));
        return [{ clubKey: club.key, clubName: club.name, sides }];
      })
      .sort((a, b) => a.clubName.localeCompare(b.clubName));
  }
  return records;
}

/** A Locked Season's club files with each player who played for more than one club
 *  shown only at the club of their last counted match, with their games for the
 *  others recorded there (`transfers`). Each club's verdicts still count only its own
 *  matches. By club key. */
export function assignTransfers(
  clubs: SeasonClubRecord[],
  rules?: EligibilityRules,
): Record<string, ParticipationSnapshot> {
  const played = clubsPlayedFor(clubs, rules);
  const dates = new Map(clubs.flatMap(({ fixtures }) => fixtures.map((fixture) => [fixture.id, fixture.dateTime] as const)));
  const lastMatch = (key: string, playerId: string) => {
    const record = clubs.find(({ club }) => club.key === key);
    const counted = (record?.snapshot.rows ?? [])
      .filter((row) => row.playerId === playerId)
      .flatMap((row) => Object.entries(row.rounds).filter(([, code]) => code === 'Start' || code === 'Sub'))
      .map(([fixtureId]) => dates.get(fixtureId) ?? '');
    return counted.sort().at(-1) ?? '';
  };
  /** Each moved player's last club, by CMS id. */
  const lastClub = new Map<string, string>();
  for (const [playerId, keys] of played) {
    if (keys.length < 2) continue;
    const ranked = keys.map((key) => ({ key, date: lastMatch(key, playerId) }));
    ranked.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date.localeCompare(b.date)));
    lastClub.set(playerId, ranked[ranked.length - 1].key);
  }
  return Object.fromEntries(
    clubs.map(({ club, snapshot }) => {
      const moved = transferRecords(club.key, clubs, { rules, played });
      const transfers = Object.fromEntries(Object.entries(moved).filter(([playerId]) => lastClub.get(playerId) === club.key));
      const rows = snapshot.rows.filter((row) => (lastClub.get(row.playerId) ?? club.key) === club.key);
      return [club.key, { ...snapshot, rows, ...(Object.keys(transfers).length > 0 ? { transfers } : {}) }];
    }),
  );
}
