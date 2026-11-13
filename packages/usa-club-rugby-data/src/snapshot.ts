import { isForfeit } from './forfeit.ts';
import type { PlayerGameLog, PlayerHistory } from './playerHistory.ts';
import type { TransferRecords } from './players.ts';
import type { PlayerRow } from './types.ts';

/** A fixture with a final score, as the player-history feed reports it. */
export interface ResultFixture {
  id: string;
  season: string;
  compName: string;
  dateTime: string;
  round?: string;
  status?: string;
  homeTeam: { name: string; score?: string };
  awayTeam: { name: string; score?: string };
}

/** The side that didn't forfeit, which takes the win: the higher score. Null when
 *  the scores don't say. */
export function forfeitWinner(fixture: ResultFixture): string | null {
  const home = Number(fixture.homeTeam.score);
  const away = Number(fixture.awayTeam.score);
  if (!fixture.homeTeam.score || !fixture.awayTeam.score || home === away) return null;
  return home > away ? fixture.homeTeam.name : fixture.awayTeam.name;
}

/** A result whose record can't be trusted to give a side's full participation:
 *  `no-lineup` has no players listed, `no-substitutions` lists substitutes but
 *  none came on, which usually means the match's substitutions weren't entered. */
export interface ParticipationGap {
  kind: 'no-lineup' | 'no-substitutions';
  fixtureId: string;
  teamName: string;
  opponent: string;
  competition: string;
  dateTime: string;
  /** `no-substitutions` only: how many players the side listed, starters and
   *  substitutes. With 15 or fewer, no substitute was available to come on. */
  rostered?: number;
}

/** One season's Match Participation, written beside the player histories and
 *  read by the eligibility page. Rows have the same shape as Match Participation
 *  Report rows, with the CMS player id as the join key and no registration data. */
export interface ParticipationSnapshot {
  season: string;
  /** When the nightly job wrote this file; absent on a live pull. */
  generatedAt?: string;
  /** The fixtures already accounted for, so a live pull can skip them. */
  resultIds?: string[];
  /** A Locked Season: verdicts have no On Track or Caution. */
  locked?: boolean;
  /** Locked Seasons only: players shown here who also played for another club that
   *  season, with those games, which aren't counted here. */
  transfers?: TransferRecords;
  rows: PlayerRow[];
  gaps: ParticipationGap[];
}

function splitName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

function roundCode(game: PlayerGameLog): string {
  if (game.starter) return 'Start';
  return game.played ? 'Sub' : 'R';
}

export function buildParticipationSnapshot(
  histories: Iterable<PlayerHistory>,
  results: ResultFixture[],
  now: Date = new Date(),
): ParticipationSnapshot {
  // The feed can carry placeholder scores on fixtures that haven't happened.
  const played = results.filter((fixture) => new Date(fixture.dateTime) <= now);
  const season = played.reduce((latest, fixture) => (fixture.season > latest ? fixture.season : latest), '');
  const seasonResults = new Map(
    played.filter((fixture) => fixture.season === season).map((fixture) => [fixture.id, fixture]),
  );

  const rows = new Map<string, PlayerRow>();
  // Playing appearances per fixture and side, to spot gaps in the record.
  const listed = new Map<string, { rostered: number; substitutes: number; cameOn: number }>();

  for (const history of histories) {
    for (const game of history.games) {
      const fixture = seasonResults.get(game.fixtureId);
      if (!fixture || game.coach) continue;
      // Reg 3.4(h): a forfeit counts for the non-forfeiting side's rostered players,
      // starters and replacements alike as nobody took the field, and for no one else.
      const forfeit = isForfeit(fixture);
      if (forfeit && forfeitWinner(fixture) !== game.teamName) continue;
      const counted = forfeit ? { ...game, played: true } : game;

      const rowKey = `${game.teamName}\0${game.compName}\0${history.id}`;
      const row = rows.get(rowKey) ?? {
        playerId: history.id,
        ...splitName(history.name),
        lastRegistered: '',
        teamName: game.teamName,
        competition: game.compName,
        appearances: 0,
        played: 0,
        substitute: 0,
        rounds: {},
      };
      if (counted.played) row.appearances += 1;
      if (counted.starter) row.played += 1;
      else if (counted.played) row.substitute += 1;
      row.rounds[fixture.id] = roundCode(counted);
      rows.set(rowKey, row);

      const sideKey = `${game.fixtureId}\0${game.teamName}`;
      const side = listed.get(sideKey) ?? { rostered: 0, substitutes: 0, cameOn: 0 };
      side.rostered += 1;
      if (!counted.starter) {
        side.substitutes += 1;
        if (counted.played) side.cameOn += 1;
      }
      listed.set(sideKey, side);
    }
  }

  const gaps: ParticipationGap[] = [];
  for (const fixture of seasonResults.values()) {
    // A forfeit counts only through the non-forfeiting side's roster, so only that
    // side can be missing one.
    const winner = isForfeit(fixture) ? forfeitWinner(fixture) : undefined;
    const sides = [
      { teamName: fixture.homeTeam.name, opponent: fixture.awayTeam.name },
      { teamName: fixture.awayTeam.name, opponent: fixture.homeTeam.name },
    ].filter(({ teamName }) => winner === undefined || teamName === winner);
    for (const { teamName, opponent } of sides) {
      const side = listed.get(`${fixture.id}\0${teamName}`);
      const kind = !side
        ? 'no-lineup'
        : side.substitutes > 0 && side.cameOn === 0
          ? 'no-substitutions'
          : null;
      if (kind) {
        gaps.push({
          kind,
          fixtureId: fixture.id,
          teamName,
          opponent,
          competition: fixture.compName,
          dateTime: fixture.dateTime,
          ...(kind === 'no-substitutions' && side ? { rostered: side.rostered } : {}),
        });
      }
    }
  }

  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    season,
    resultIds: [...seasonResults.keys()].sort(compare),
    rows: [...rows.values()].sort(
      (a, b) =>
        compare(a.teamName, b.teamName) ||
        compare(a.competition, b.competition) ||
        compare(a.playerId, b.playerId),
    ),
    gaps: gaps.sort(
      (a, b) =>
        compare(a.dateTime, b.dateTime) ||
        compare(a.fixtureId, b.fixtureId) ||
        compare(a.teamName, b.teamName),
    ),
  };
}
