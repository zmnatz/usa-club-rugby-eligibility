import { describe, expect, it } from 'vitest';
import { listClubs } from '../clubFixtures.ts';
import { qualifyingRows } from '../qualifying.ts';
import { baseConfig, row, fixtureOf } from './participationFixtures.ts';

describe('NCS Qualifying Matches', () => {
  it('leaves out crossovers, so a side playing only those is not listed', () => {
    const clubs = listClubs([fixtureOf('Philadelphia WD1', 'Severn River WD2', 'Capital Women D2-D1 Crossovers')], baseConfig);

    expect(clubs).toEqual([]);
  });
});

describe('qualifyingRows', () => {
  it("drops a report's rows from competitions that don't count, as the match record does", () => {
    const rows = [
      row({ playerId: 'a', competition: 'Capital Men D3' }),
      row({ playerId: 'b', competition: 'Capital Women D2-D1 Crossovers' }),
      row({ playerId: 'c', competition: 'MAC 7s - Rites of Summer' }),
    ];

    expect(qualifyingRows(rows, baseConfig).map((item) => item.playerId)).toEqual(['a']);
  });
});
