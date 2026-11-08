import { describe, expect, it } from 'vitest';
import { computeBreakdown } from '../eligibility.ts';
import { buildPlayerIndex } from '../players.ts';
import { DEFAULT_RULES } from '../rules.ts';
import type { PlayerRow } from '../types.ts';

const club = {
  key: 'nova',
  name: 'NOVA',
  sides: [
    { teamName: 'NOVA MD1', label: 'D1' },
    { teamName: 'NOVA MD2', label: 'D2' },
  ],
};

const row = (playerId: string, name: string, teamName: string, played: number): PlayerRow => ({
  playerId,
  firstName: name,
  lastName: '',
  lastRegistered: '',
  teamName,
  competition: 'Capital Men D1',
  appearances: played,
  played,
  substitute: 0,
  rounds: {},
});

describe('buildPlayerIndex', () => {
  const breakdown = computeBreakdown(
    [
      row('p1', 'Ann', 'NOVA MD1', 3),
      row('p1', 'Ann', 'NOVA MD2', 1),
      row('p2', 'Name Withheld', 'NOVA MD1', 2),
      row('p3', ' name  withheld ', 'NOVA MD2', 2),
    ],
    club.sides,
    DEFAULT_RULES,
    {},
  );

  it('lists each player once, with the clubs they are in', () => {
    const index = buildPlayerIndex('2026/2027', [{ club, breakdown }]);
    expect(index.players.p1).toEqual({ name: 'Ann', clubs: ['nova'] });
  });

  it('leaves out players whose profile is not public', () => {
    const index = buildPlayerIndex('2026/2027', [{ club, breakdown }]);
    expect(Object.keys(index.players)).toEqual(['p1']);
  });

  it('keeps a player who is in two clubs under both, in the order the clubs were given', () => {
    const other = { key: 'potomac', name: 'Potomac', sides: [{ teamName: 'Potomac MD1', label: 'D1' }] };
    const elsewhere = computeBreakdown([row('p1', 'Ann', 'Potomac MD1', 2)], other.sides, DEFAULT_RULES, {});
    const index = buildPlayerIndex('2026/2027', [
      { club: other, breakdown: elsewhere },
      { club, breakdown },
    ]);
    expect(index.players.p1.clubs).toEqual(['potomac', 'nova']);
  });
});
