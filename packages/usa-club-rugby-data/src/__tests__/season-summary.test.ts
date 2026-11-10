import { describe, expect, it } from 'vitest';
import type { PublishedSeasonFile } from '../data.ts';
import { seasonSummary } from '../seasonSummary.ts';
import type { PlayerRow } from '../types.ts';

const SEASON = '2025/2026';
const row = (playerId: string, teamName: string, played: number): PlayerRow => ({
  playerId,
  firstName: playerId,
  lastName: 'Test',
  lastRegistered: '',
  teamName,
  competition: 'Test League',
  appearances: played,
  played,
  substitute: 0,
  rounds: {},
});
const file = {
  season: SEASON,
  slug: '2025-26',
  fixtures: [],
  unplacedTeams: ['Somewhere 7s'],
  clubs: [
    { key: 'alpha', name: 'Alpha', sides: [{ teamName: 'Alpha MD1', label: 'D1' }, { teamName: 'Alpha MD2', label: 'D2' }] },
    { key: 'beta-women', name: 'Beta Women', sides: [{ teamName: 'Beta WD1', label: 'D1' }] },
  ],
  clubFiles: {
    alpha: {
      season: SEASON,
      locked: true,
      resultIds: ['a1', 'a2'],
      gaps: [{ kind: 'no-lineup', fixtureId: 'a2', teamName: 'Alpha MD2', opponent: 'X', competition: 'Test League', dateTime: '2025-10-01T15:00:00Z' }],
      rows: [row('p1', 'Alpha MD1', 3), row('p2', 'Alpha MD2', 1), row('p3', 'Alpha MD1', 4), row('p3', 'Alpha MD2', 2)],
    },
    'beta-women': {
      season: SEASON,
      locked: true,
      resultIds: ['b1'],
      gaps: [],
      rows: [row('p4', 'Beta WD1', 2)],
      transfers: { p4: [{ clubKey: 'gamma', clubName: 'Gamma', sides: [] }] },
    },
  },
} as PublishedSeasonFile;

describe('a season at a glance', () => {
  const summary = seasonSummary(file);

  it('counts clubs, sides, players and matches', () => {
    expect(summary).toMatchObject({ clubs: 2, sides: 3, multiSideClubs: 1, players: 4, matches: 3, transfers: 1, unplacedTeams: 1 });
    expect(summary.gaps).toEqual({ noLineup: 1, noSubstitutions: 0 });
  });

  it('gives each division its players and how many were eligible for it', () => {
    expect(summary.divisions).toEqual([
      { division: "Men's D1", sides: 1, players: 2, eligible: 2 },
      { division: "Men's D2", sides: 1, players: 2, eligible: 0 },
      { division: "Women's D1", sides: 1, players: 1, eligible: 1 },
    ]);
  });

  it('says why players weren\'t eligible for a side they played for', () => {
    expect(summary.ineligible).toEqual({ verdicts: 2, shortOfMinimum: 1, upperSideLimit: 1, upperSideShare: 1 });
  });
});
