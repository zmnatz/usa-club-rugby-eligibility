import { describe, expect, it } from 'vitest';
import { listClubs } from '../clubFixtures.ts';
import { clubSeason } from '../clubSeason.ts';
import { rulesForSeason } from '../rules.ts';
import type { ParticipationSnapshot } from '../snapshot.ts';
import { SEASON, baseConfig, row } from './participationFixtures.ts';

const NOW = new Date('2026-10-20T12:00:00Z');
const scheduled = (home: string, away: string, compName: string) => ({
  compName,
  dateTime: '2027-02-01T17:00:00Z',
  homeTeam: { name: home, score: '' },
  awayTeam: { name: away, score: '' },
});
const fixtures = [
  scheduled('Loudoun MD3', 'Frederick MD3', 'Capital Men D3'),
  scheduled('Other MD1', 'Another MD1', 'Capital Men D1'),
];
const [club] = listClubs(fixtures, baseConfig).filter((item) => item.sides[0]?.teamName === 'Loudoun MD3');
const gap = {
  kind: 'no-lineup' as const,
  fixtureId: 'f1',
  teamName: 'Loudoun MD3',
  opponent: 'Frederick MD3',
  competition: 'Capital Men D3',
  dateTime: '2026-10-17T17:00:00Z',
};
const snapshot: ParticipationSnapshot = {
  season: SEASON,
  rows: [row({ playerId: 'one', teamName: 'Loudoun MD3', played: 1, competition: 'Capital Men D3' })],
  gaps: [gap, { ...gap, teamName: 'Other MD1', competition: 'Capital Men D1' }],
};

describe('clubSeason', () => {
  it("gives the club's verdicts, gaps and fixtures together", () => {
    const season = clubSeason(snapshot, fixtures, club, { rules: baseConfig, now: NOW });

    expect(season.breakdown.sides.flatMap((side) => side.players.map((player) => player.playerId))).toEqual(['one']);
    expect(season.gaps.map((item) => item.teamName)).toEqual(['Loudoun MD3']);
    expect(season.fixtures.map((fixture) => fixture.compName)).toEqual(['Capital Men D3']);
  });

  it("resolves the rules of the record's season unless others are given", () => {
    expect(clubSeason(snapshot, fixtures, club, { now: NOW }).rules).toBe(rulesForSeason(SEASON));
    expect(clubSeason(snapshot, fixtures, club, { rules: baseConfig, now: NOW }).rules).toBe(baseConfig);
  });

  it('gives the same season for every fixture or only the club’s', () => {
    const all = clubSeason(snapshot, fixtures, club, { now: NOW });
    const own = clubSeason(snapshot, all.fixtures, club, { now: NOW });

    expect(own).toEqual(all);
  });
});
