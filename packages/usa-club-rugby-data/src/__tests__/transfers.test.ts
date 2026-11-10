import { describe, expect, it } from 'vitest';
import type { FeedFixture } from '../feeds.ts';
import type { ParticipationSnapshot } from '../participation.ts';
import { computeBreakdown } from '../eligibility.ts';
import { participationRows, playerRounds } from '../participation.ts';
import { assignTransfers, transferRecords } from '../players.ts';
import { DEFAULT_RULES } from '../rules.ts';
import type { PublishedClub } from '../published.ts';
import type { PlayerRow } from '../types.ts';

const SEASON = '2024/2025';
const fixture = (id: string, home: string, away: string, compName: string): FeedFixture => ({
  id,
  compId: compName,
  compName,
  season: SEASON,
  dateTime: `2024-10-0${id.slice(-1)}T15:00:00Z`,
  round: `Round ${id.slice(-1)}`,
  status: 'Result',
  sourceType: '2',
  homeTeam: { name: home, score: '10' },
  awayTeam: { name: away, score: '5' },
});
const fixtures = [
  fixture('a1', 'Alpha MD2', 'Gamma MD2', 'Test Men D2'),
  fixture('b1', 'Beta MD2', 'Delta MD2', 'Test Men D2'),
  fixture('b2', 'Beta MD2', 'Gamma MD2', 'Test Men D2'),
];
const row = (playerId: string, teamName: string, rounds: Record<string, string>): PlayerRow => {
  const codes = Object.values(rounds);
  return {
    playerId,
    firstName: playerId,
    lastName: 'Test',
    lastRegistered: '',
    teamName,
    competition: 'Test Men D2',
    appearances: codes.filter((code) => code !== 'R').length,
    played: codes.filter((code) => code === 'Start').length,
    substitute: codes.filter((code) => code === 'Sub').length,
    rounds,
  };
};
const snapshot = (rows: PlayerRow[], resultIds: string[]): ParticipationSnapshot => ({
  season: SEASON,
  locked: true,
  resultIds,
  gaps: [],
  rows,
});
const alpha: PublishedClub = { key: 'alpha', name: 'Alpha', sides: [{ teamName: 'Alpha MD2', label: 'D2' }] };
const beta: PublishedClub = { key: 'beta', name: 'Beta', sides: [{ teamName: 'Beta MD2', label: 'D2' }] };
const clubs = [
  {
    club: alpha,
    fixtures,
    snapshot: snapshot([row('moved', 'Alpha MD2', { a1: 'Start' }), row('stayed', 'Alpha MD2', { a1: 'Start' }), row('reserve', 'Alpha MD2', { a1: 'Sub' })], ['a1']),
  },
  {
    club: beta,
    fixtures,
    snapshot: snapshot([row('moved', 'Beta MD2', { b1: 'Start', b2: 'Sub' }), row('reserve', 'Beta MD2', { b1: 'R' })], ['b1', 'b2']),
  },
];

describe('players who played for more than one club', () => {
  it('lists their games for every other club', () => {
    const records = transferRecords('alpha', clubs);
    expect(Object.keys(records)).toEqual(['moved']);
    const [other] = records.moved;
    expect(other).toMatchObject({ clubKey: 'beta', clubName: 'Beta' });
    expect(other.sides.map((side) => side.teamName)).toEqual(['Beta MD2']);
    expect(other.sides[0].rounds.map((round) => [round.fixtureId, round.status, round.counted])).toEqual([
      ['b1', 'started', true],
      ['b2', 'substitute', true],
    ]);
  });

  it('is the same from the other club', () => {
    expect(transferRecords('beta', clubs).moved.map((other) => other.clubKey)).toEqual(['alpha']);
  });

  it('leaves out a player only named as an unused reserve at the other club', () => {
    expect(transferRecords('alpha', clubs).reserve).toBeUndefined();
    expect(transferRecords('beta', clubs).reserve).toBeUndefined();
  });
});

describe('a Locked Season with a player who moved club', () => {
  const assigned = assignTransfers(clubs);

  it('shows the player only at the club they played for last', () => {
    expect(assigned.alpha.rows.map((item) => item.playerId)).toEqual(['stayed', 'reserve']);
    expect(assigned.beta.rows.filter((item) => item.playerId === 'moved').length).toBeGreaterThan(0);
  });

  it('counts only the last club\'s games there', () => {
    const rows = participationRows(assigned.beta, beta, DEFAULT_RULES);
    const [side] = computeBreakdown(rows, beta.sides, DEFAULT_RULES, {}, { locked: true }).sides;
    expect(side.players.find((player) => player.playerId === 'moved')?.participation).toBe(2);
  });

  it('keeps their earlier club\'s games out of the last club\'s own rounds', () => {
    const rows = assigned.beta.rows.filter((item) => item.playerId === 'moved');
    const rounds = playerRounds({ fixtures, teamName: 'Beta MD2', season: SEASON, rows, gaps: [], resultIds: ['b1', 'b2'], rules: DEFAULT_RULES });
    expect(rounds.map((round) => [round.fixtureId, round.status])).toEqual([
      ['b1', 'started'],
      ['b2', 'substitute'],
    ]);
  });

  it('records their games for the earlier club with the last club', () => {
    expect(assigned.beta.transfers?.moved.map((other) => [other.clubKey, other.sides[0].rounds[0].fixtureId])).toEqual([['alpha', 'a1']]);
    expect(assigned.alpha.transfers).toBeUndefined();
  });

  it('leaves everyone else as they were', () => {
    expect(assigned.alpha.rows).toEqual(clubs[0].snapshot.rows.filter((item) => item.playerId !== 'moved'));
  });
});
