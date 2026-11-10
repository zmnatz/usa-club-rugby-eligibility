import { describe, expect, it } from 'vitest';
import { clubFixtures, listClubs } from '../clubFixtures.ts';
import type { Club } from '../types.ts';
import { baseConfig, sideOf, fixtureOf } from './participationFixtures.ts';

describe('listClubs', () => {
  it('lists clubs with two sides, ranked upper then lower, sorted by name', () => {
    const clubs = listClubs(
      [
        fixtureOf('Rocky Gorge MD3', 'James River MD3'),
        fixtureOf('Rocky Gorge MD1', '', 'MAC Men D1'),
        fixtureOf('James River MD2', '', 'Capital Men D2'),
      ],
      baseConfig,
    );

    expect(clubs).toEqual([
      { name: 'James River', sides: [sideOf('James River MD2', 2), sideOf('James River MD3', 3)] },
      { name: 'Rocky Gorge', sides: [sideOf('Rocky Gorge MD1', 1), sideOf('Rocky Gorge MD3', 3)] },
    ]);
  });

  it('lists a club with one side', () => {
    const clubs = listClubs([fixtureOf('Frederick MD3', 'Rocky Gorge MD3')], baseConfig);

    expect(clubs).toContainEqual({ name: 'Frederick', sides: [sideOf('Frederick MD3', 3)] });
  });

  it('lists a club fielding three sides, highest division first', () => {
    const clubs = listClubs(
      [
        fixtureOf('Tri MD1', 'NOVA MD1', 'MAC Men D1'),
        fixtureOf('Tri MD2', 'Raleigh MD2', 'Capital Men D2'),
        fixtureOf('Tri MD3', 'Loudoun MD3'),
      ],
      baseConfig,
    );

    expect(clubs.find((club) => club.name === 'Tri')?.sides.map((side) => side.teamName)).toEqual([
      'Tri MD1',
      'Tri MD2',
      'Tri MD3',
    ]);
  });

  it("lists a club's women's sides separately from its men's", () => {
    const clubs = listClubs(
      [
        fixtureOf('NOVA WD1', 'Boston WD1', 'Atlantic Women D1'),
        fixtureOf('NOVA WD2', 'Raleigh WD2', 'Capital Women D2'),
        fixtureOf('NOVA MD1', 'Washington MD1', 'MAC Men D1'),
      ],
      baseConfig,
    );

    expect(clubs.find((club) => club.name === 'NOVA Women')?.sides).toEqual([
      { teamName: 'NOVA WD1', label: 'D1' },
      { teamName: 'NOVA WD2', label: 'D2' },
    ]);
    expect(clubs.find((club) => club.name === 'NOVA')?.sides).toEqual([{ teamName: 'NOVA MD1', label: 'D1' }]);
  });

  it('only counts sides in qualifying competitions', () => {
    const clubs = listClubs(
      [
        fixtureOf('Rocky Gorge MD1', 'NOVA MD1', 'MAC Men D1'),
        fixtureOf('Rocky Gorge MD3', 'NOVA MD2', 'MAC 7s - Rites of Summer'),
      ],
      baseConfig,
    );

    expect(clubs.find((club) => club.name === 'Rocky Gorge')?.sides).toEqual([
      { teamName: 'Rocky Gorge MD1', label: 'D1' },
    ]);
  });

  it('ignores unnamed sides', () => {
    expect(listClubs([fixtureOf('', '')], baseConfig)).toEqual([]);
  });
});

describe('clubFixtures', () => {
  it("keeps every fixture in the club's divisions, including open playoff slots", () => {
    const fixture = (id: string, compName: string, home: string, away: string) => ({
      id,
      compName,
      homeTeam: { name: home },
      awayTeam: { name: away },
    });
    const fixtures = [
      fixture('1', 'MAC Men D1', 'Rocky Gorge MD1', 'NOVA MD1'),
      fixture('2', 'MAC Men D1', 'Washington MD1', 'Baltimore Chesapeake MD1'),
      fixture('3', 'MAC Men D1 Playoffs', '', ''),
      fixture('4', 'MAC Men D3', 'Rocky Gorge MD3', 'BARC MD3'),
      fixture('5', 'MAC Women D1', 'NOVA WD1', 'DC Furies WD1'),
    ];
    const club: Club = {
      name: 'Rocky Gorge',
      sides: [
        { teamName: 'Rocky Gorge MD1', label: 'D1' },
        { teamName: 'Rocky Gorge MD3', label: 'D3' },
      ],
    };

    expect(clubFixtures(fixtures, club).map((entry) => entry.id)).toEqual(['1', '2', '3', '4']);
  });
});
