import { type FixtureSides, isClubSide, listClubs } from './clubFixtures.ts';
import { computeBreakdown } from './eligibility.ts';
import { isQualifying, isQualifyingMatch } from './qualifying.ts';
import { rulesForSeason } from './rules.ts';
import { remainingMatches, type ScheduleFixture, scheduledMatches } from './schedule.ts';
import type { ParticipationGap, ParticipationSnapshot } from './snapshot.ts';
import type { Club, EligibilityBreakdown, EligibilityRules, PlayerEligibility, PlayerRow } from './types.ts';

// A club's and a player's verdicts from a saved record, and a player's season
// match by match.

/** The club's rows that count towards Match Participation. As in a Match
 *  Participation Report, every player has a row on every side, so a player only
 *  ever listed on one side still gets a verdict for the others. */
export function participationRows(
  snapshot: ParticipationSnapshot,
  club: Club,
  rules: EligibilityRules,
): PlayerRow[] {
  const teams = club.sides.map((side) => side.teamName);
  const rows = snapshot.rows.filter(
    (row) => teams.includes(row.teamName) && isQualifying(row.competition, rules),
  );
  const onSide = new Set(rows.map((row) => `${row.teamName}\0${row.playerId}`));
  const emptyRows = rows.flatMap((row) =>
    teams.flatMap((teamName) => {
      const key = `${teamName}\0${row.playerId}`;
      if (onSide.has(key)) return [];
      onSide.add(key);
      return [
        {
          ...row,
          teamName,
          competition: '',
          appearances: 0,
          played: 0,
          substitute: 0,
          rounds: {},
        },
      ];
    }),
  );
  return [...rows, ...emptyRows];
}

/** A club's verdicts from a saved record, under the regulations of the record's season
 *  unless others are given. A Locked Season's record gives final verdicts. */
export function clubBreakdown(
  snapshot: ParticipationSnapshot,
  fixtures: ScheduleFixture[],
  club: Club,
  { rules = rulesForSeason(snapshot.season), now = new Date() }: { rules?: EligibilityRules; now?: Date } = {},
): EligibilityBreakdown {
  return computeBreakdown(
    participationRows(snapshot, club, rules),
    club.sides,
    rules,
    remainingMatches(fixtures, club, rules, now),
    { locked: snapshot.locked, scheduled: scheduledMatches(fixtures, club, rules) },
  );
}

/** Gaps that could change the club's verdicts. */
export function clubGaps(
  snapshot: ParticipationSnapshot,
  club: Club,
  rules: EligibilityRules,
): ParticipationGap[] {
  return snapshot.gaps.filter(
    (gap) => isClubSide(club, gap.teamName) && isQualifyingMatch({ compName: gap.competition, dateTime: gap.dateTime }, rules),
  );
}

/** A player's verdicts at one club: one per side the club fields. */
export interface PlayerClubEligibility {
  club: Club;
  verdicts: PlayerEligibility[];
}

/** One player's verdicts for the snapshot's season, from the saved record. */
export function playerSeasonEligibility(
  snapshot: ParticipationSnapshot,
  fixtures: ScheduleFixture[],
  playerId: string,
  rules: EligibilityRules,
  now: Date = new Date(),
): PlayerClubEligibility[] {
  const own = { ...snapshot, rows: snapshot.rows.filter((row) => row.playerId === playerId) };
  const teams = new Set(own.rows.map((row) => row.teamName));
  return listClubs(fixtures, rules)
    .filter((club) => club.sides.some((side) => teams.has(side.teamName)))
    .flatMap((club) => {
      if (participationRows(own, club, rules).length === 0) return [];
      const { sides } = clubBreakdown(own, fixtures, club, { rules, now });
      return [{ club, verdicts: sides.flatMap((side) => side.players) }];
    });
}

/** How one of a team's fixtures stands for one player. Only `started` and
 *  `substitute` count towards Match Participation. */
export type PlayerRoundStatus =
  | 'started'
  | 'substitute'
  | 'unused'
  | 'not-listed'
  | 'no-lineup'
  | 'forfeit'
  | 'forfeit-rostered'
  | 'postponed'
  | 'not-qualifying'
  | 'awaiting-result'
  | 'upcoming';

export interface PlayerRound {
  fixtureId: string;
  round: string;
  competition: string;
  dateTime: string;
  opponent: string;
  scoreFor: string;
  scoreAgainst: string;
  status: PlayerRoundStatus;
  counted: boolean;
  /** The side listed substitutes but none came on, so a reserve may have played. */
  substitutionsMissing: boolean;
}

interface PlayerRoundsInput {
  fixtures: (FixtureSides & {
    id: string;
    season: string;
    dateTime: string;
    round?: string;
    status?: string;
    homeTeam: { name: string; score: string };
    awayTeam: { name: string; score: string };
  })[];
  teamName: string;
  season: string;
  /** The player's rows, whatever side they are for. */
  rows: PlayerRow[];
  gaps: ParticipationGap[];
  resultIds: string[];
  rules: EligibilityRules;
  now?: Date;
}

/** Every fixture of a team's season and how it stands for one player, so a
 *  verdict can be checked match by match against the Rugby Xplorer reports. */
export function playerRounds({
  fixtures,
  teamName,
  season,
  rows,
  gaps,
  resultIds,
  rules,
  now = new Date(),
}: PlayerRoundsInput): PlayerRound[] {
  const results = new Set(resultIds);
  const hasGap = (fixtureId: string, kind: ParticipationGap['kind']) =>
    gaps.some((gap) => gap.kind === kind && gap.fixtureId === fixtureId && gap.teamName === teamName);

  const statusOf = (fixture: PlayerRoundsInput['fixtures'][number]): PlayerRoundStatus => {
    if (!isQualifyingMatch(fixture, rules)) return 'not-qualifying';
    if (fixture.status === 'Postponed') return 'postponed';
    const code = rows.find((row) => row.teamName === teamName && row.competition === fixture.compName)
      ?.rounds[fixture.id];
    if (fixture.status === 'Forfeit') return code && code !== 'R' ? 'forfeit-rostered' : 'forfeit';
    if (code === 'Start') return 'started';
    if (code === 'Sub') return 'substitute';
    if (code === 'R') return 'unused';
    if (hasGap(fixture.id, 'no-lineup')) return 'no-lineup';
    if (new Date(fixture.dateTime) > now) return 'upcoming';
    return results.has(fixture.id) ? 'not-listed' : 'awaiting-result';
  };

  return fixtures
    .filter(
      (fixture) =>
        fixture.season === season &&
        (fixture.homeTeam.name === teamName || fixture.awayTeam.name === teamName),
    )
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .map((fixture) => {
      const isHome = fixture.homeTeam.name === teamName;
      const [own, other] = isHome
        ? [fixture.homeTeam, fixture.awayTeam]
        : [fixture.awayTeam, fixture.homeTeam];
      const status = statusOf(fixture);
      return {
        fixtureId: fixture.id,
        round: fixture.round || fixture.dateTime.slice(0, 10),
        competition: fixture.compName,
        dateTime: fixture.dateTime,
        opponent: other.name,
        scoreFor: own.score,
        scoreAgainst: other.score,
        status,
        counted: status === 'started' || status === 'substitute' || status === 'forfeit-rostered',
        substitutionsMissing: hasGap(fixture.id, 'no-substitutions'),
      };
    });
}
