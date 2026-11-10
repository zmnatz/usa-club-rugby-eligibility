// Shared builders for the Match Participation tests: results, games, player
// histories, report rows and fixtures.
import { computeBreakdown } from '../eligibility.ts';
import type { PlayerGameLog, PlayerHistory } from '../playerHistory.ts';
import { DEFAULT_RULES as eligibilityConfig } from '../rules.ts';
import type { ParticipationSnapshot, ResultFixture } from '../snapshot.ts';
import type { Club, EligibilityRules, PlayerRow } from '../types.ts';

export const SEASON = '2026/2027';

export const result = (id: string, overrides: Partial<ResultFixture> = {}): ResultFixture => ({
  id,
  season: SEASON,
  compName: 'MAC Men D1',
  dateTime: '2026-10-17T17:00:00Z',
  round: 'Round 4',
  homeTeam: { name: 'Rocky Gorge MD1' },
  awayTeam: { name: 'NOVA MD1' },
  ...overrides,
});

export const game = (fixtureId: string, overrides: Partial<PlayerGameLog> = {}): PlayerGameLog => ({
  fixtureId,
  season: SEASON,
  dateTime: '2026-10-17T17:00:00Z',
  compName: 'MAC Men D1',
  teamName: 'Rocky Gorge MD1',
  opponent: 'NOVA MD1',
  scoreFor: '10',
  scoreAgainst: '5',
  result: 'W',
  starter: true,
  played: true,
  coach: false,
  ...overrides,
});

export const history = (id: string, name: string, games: PlayerGameLog[]): PlayerHistory => ({
  id,
  name,
  teamName: 'Rocky Gorge MD1',
  games,
  scoringEvents: [],
});

export const baseConfig: EligibilityRules = {
  minimumMatches: 2,
  upperMatchLimit: 4,
  nonQualifyingCompetitions: eligibilityConfig.nonQualifyingCompetitions,
};

export const sideOf = (teamName: string, level: number) => ({ teamName, label: `D${level}` });

/** A club's verdicts for its top and second side. */
export const verdictsFor = (club: Club, rows: PlayerRow[], remaining: Record<string, number> = {}) => {
  const { sides, ignoredTeamNames } = computeBreakdown(rows, club.sides, baseConfig, remaining);
  return {
    upper: sides[0].players,
    lower: sides[1]?.players ?? [],
    upperSummary: sides[0].summary,
    lowerSummary: sides[1]?.summary,
    ignoredTeamNames,
  };
};

export const row = (overrides: Partial<PlayerRow>): PlayerRow => ({
  playerId: 'sam',
  firstName: 'Sam',
  lastName: 'Hooker',
  lastRegistered: '',
  teamName: 'NOVA MD1',
  competition: 'MAC Men D1',
  appearances: 0,
  played: 0,
  substitute: 0,
  rounds: {},
  ...overrides,
});

export const snapshotOf = (rows: PlayerRow[]): ParticipationSnapshot => ({ season: SEASON, rows, gaps: [] });

export const fixtureOf = (home: string, away: string, compName = 'Capital Men D3') => ({
  compName,
  homeTeam: { name: home },
  awayTeam: { name: away },
});
