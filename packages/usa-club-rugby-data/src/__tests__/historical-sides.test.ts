import { describe, expect, it } from 'vitest';
import { historicalClubs } from '../historicalSides.ts';
import { DEFAULT_RULES } from '../rules.ts';

const game = (compName: string, home: string, away = '') => ({
  compName,
  homeTeam: { name: home },
  awayTeam: { name: away },
});

const place = (...fixtures: ReturnType<typeof game>[]) => historicalClubs(fixtures, DEFAULT_RULES);

describe('placing a team in its club and division', () => {
  // Team names as the CMS held them in 2022-23 to 2024-25.
  it.each([
    ['White Plains M', "Empire Men's D3", 'White Plains', 'D3'],
    ['Marin Mens', 'NorCal Mens D2', 'Marin', 'D2'],
    ['Monadnock Wolfpack Men 1st XV', 'NERFU Men D3', 'Monadnock Wolfpack', 'D3'],
    ['Amoskeag Men Senior', 'NERFU Men D2', 'Amoskeag', 'D2'],
    ['She Devils XV', "NERFU Women's D2", 'She Devils Women', 'D2'],
    ['Chico Knotty Oaks Womens', 'NorCal Womens D2', 'Chico Knotty Oaks Women', 'D2'],
    ["Sacramento Amazons Women's Rugby Club Senior", 'NorCal Womens D1', 'Sacramento Amazons Women', 'D1'],
    ['Harrisburg Men Senior Club', 'EPRU D3 Men', 'Harrisburg', 'D3'],
    ['Boise Men 1st XV Senior', 'PNW Rugby Premiership (Men\'s D2)', 'Boise', 'D2'],
    ['Portland Pigs W+ Senior', 'NERFU Womens+ D2', 'Portland Pigs Women', 'D2'],
    ['Las Vegas Women B Side', "SWRU Women's D2", 'Las Vegas Women', 'D2 2nd XV'],
    ["Portland Women's Rugby Football Club Senior Club NERFU DII", 'Approved 3.4.3 Matches', 'Portland Women', 'D2'],
    ['Seattle Men D1 Sr', 'Approved 3.4.3 Matches', 'Seattle', 'D1'],
    ['Knoxville Minx WD2', 'Approved 3.4.3 Matches', 'Knoxville Minx Women', 'D2'],
    ['Black Sheep D2 1st XV', 'Approved 3.4.3 Matches', 'Black Sheep', 'D2'],
    ['Buffalo MD3 2nd', 'Approved 3.4.3 Matches', 'Buffalo', 'D3 2nd XV'],
  ])('%s in %s is %s %s', (team, competition, club, label) => {
    expect(place(game(competition, team)).clubs).toEqual([{ name: club, sides: [{ teamName: team, label }] }]);
  });

  it.each([
    ["MARFU Men's Division 2", 'D2'],
    ['TRU/Frontier Women\'s D1', 'D1'],
    ['Soutwest Regionals - MD2', 'D2'],
    ['True South WD2 2025', 'D2'],
    ['MARFU MD3', 'D3'],
    ["2025-26 MW Women's D1 - Eastern Conference", 'D1'],
    ['Capital Division II', 'D2'],
    ['NORCAL DIVISION 2', 'D2'],
    ['capital division 1', 'D1'],
  ])('reads the division in %s', (competition, label) => {
    expect(place(game(competition, 'Riverton XV')).clubs[0].sides[0].label).toBe(label);
  });

  it('ranks a club\'s sides by division, however differently they are named', () => {
    const { clubs } = place(game('NorCal Mens D2', 'Reno Mens 2nd XV'), game('NorCal Mens D1', 'Reno MD1'));
    expect(clubs).toEqual([
      {
        name: 'Reno',
        sides: [
          { teamName: 'Reno MD1', label: 'D1' },
          { teamName: 'Reno Mens 2nd XV', label: 'D2 2nd XV' },
        ],
      },
    ]);
  });

  it('prefers the division most of a team\'s competitions name', () => {
    const { clubs } = place(
      game('NorCal Mens D2', 'Marin Mens'),
      game('NorCal Mens D2', 'Marin Mens'),
      game('NorCal Mens D3', 'Marin Mens'),
      game('Approved 3.4.3 Matches', 'Marin Mens'),
    );
    expect(clubs[0].sides[0].label).toBe('D2');
  });

  it('ignores competitions that are not NCS Qualifying Matches', () => {
    const { clubs } = place(game('NorCal Mens D2', 'Marin Mens'), game('NorCal 7s D1', 'Marin Mens'));
    expect(clubs[0].sides[0].label).toBe('D2');
  });

  it('leaves out divisions outside the NCS', () => {
    expect(place(game('NERFU Men D4', 'Amoskeag Men Senior'), game('NorCal Womens D3', 'Chico Womens'))).toEqual({
      clubs: [],
      unplacedTeams: [],
    });
  });
});

describe('teams that cannot be placed', () => {
  it.each(["SWRU Men's D2 & D3", 'Approved 3.4.3 Matches', 'MW Spring 2024 - NCS Pathway Matches'])(
    'a competition that names no single division: %s',
    (competition) => {
      expect(place(game(competition, 'Tempe Old Devils Men'))).toEqual({
        clubs: [],
        unplacedTeams: ['Tempe Old Devils Men'],
      });
    },
  );

  it('an even split between two divisions', () => {
    const result = place(game('NorCal Mens D2', 'Marin Mens'), game('NorCal Mens D3', 'Marin Mens'));
    expect(result).toEqual({ clubs: [], unplacedTeams: ['Marin Mens'] });
  });

  it('warns the club when one of its teams has no division', () => {
    const { clubs, unplacedTeams } = place(
      game('EPRU D3 Men', 'Harrisburg MD3'),
      game('Approved 3.4.3 Matches', 'Harrisburg Men Senior Club'),
    );
    expect(clubs).toEqual([
      {
        name: 'Harrisburg',
        sides: [{ teamName: 'Harrisburg MD3', label: 'D3' }],
        unplacedTeams: ['Harrisburg Men Senior Club'],
      },
    ]);
    expect(unplacedTeams).toEqual(['Harrisburg Men Senior Club']);
  });

  it('leaves out a club with two names at one division, which cannot be ranked', () => {
    const result = place(
      game('NERFU Men D2', 'Bay Men'),
      game('NERFU Men D2', 'Bay Men Senior'),
      game('NERFU Men D1', 'Bay MD1'),
    );
    expect(result).toEqual({ clubs: [], unplacedTeams: ['Bay MD1', 'Bay Men', 'Bay Men Senior'] });
  });

  it('skips a fixture with no team assigned', () => {
    expect(place(game('NorCal Mens D2', ''))).toEqual({ clubs: [], unplacedTeams: [] });
  });
});
