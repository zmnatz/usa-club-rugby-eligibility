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

describe('a team with no division', () => {
  it.each(["SWRU Men's D2 & D3", 'Approved 3.4.3 Matches', 'MW Spring 2024 - NCS Pathway Matches'])(
    'is a one-side club when alone at its club: %s',
    (competition) => {
      expect(place(game(competition, 'Tempe Old Devils Men'))).toEqual({
        clubs: [{ name: 'Tempe Old Devils', sides: [{ teamName: 'Tempe Old Devils Men', label: 'Senior' }] }],
        unplacedTeams: [],
      });
    },
  );

  it('is a one-side club when its competitions split evenly between divisions', () => {
    const result = place(game('NorCal Mens D2', 'Marin Mens'), game('NorCal Mens D3', 'Marin Mens'));
    expect(result).toEqual({ clubs: [{ name: 'Marin', sides: [{ teamName: 'Marin Mens', label: 'Senior' }] }], unplacedTeams: [] });
  });

  it('keeps a women\'s team as a women\'s club', () => {
    expect(place(game('Approved 3.4.3 Matches', 'Phoenix Women\'s Rugby Senior')).clubs[0].name).toBe('Phoenix Women');
  });

  it.each([
    ['Old Gaelic B-Side B-League', 'Old Gaelic'],
    ['Phoenixville Men B-Side B-League', 'Phoenixville'],
    ['Riverton Men B Side', 'Riverton'],
  ])('is taken as Division 3 when it is a B side: %s', (team, club) => {
    expect(place(game('Approved 3.4.3 Matches', team)).clubs).toEqual([{ name: club, sides: [{ teamName: team, label: 'D3' }] }]);
  });

  it('ranks a B side below its club\'s main side', () => {
    const { clubs } = place(game('EPRU D2 Men', 'Media MD2'), game('Approved 3.4.3 Matches', 'Media B-Side B-League'));
    expect(clubs[0].sides).toEqual([
      { teamName: 'Media MD2', label: 'D2' },
      { teamName: 'Media B-Side B-League', label: 'D3' },
    ]);
  });

  it('leaves out a women\'s B side, since Women\'s Division 3 is outside the NCS', () => {
    expect(place(game('Approved 3.4.3 Matches', 'Riverton Women B-Side'))).toEqual({ clubs: [], unplacedTeams: [] });
  });

  it('ranks a 2nd XV one division below its club\'s other side', () => {
    const { clubs } = place(game('PNRFU Men D2', "Pigs Men's D2 Senior"), game('PNRFU Championship', 'Pigs 2nd XV'));
    expect(clubs).toEqual([
      {
        name: 'Pigs',
        sides: [
          { teamName: "Pigs Men's D2 Senior", label: 'D2' },
          { teamName: 'Pigs 2nd XV', label: 'D3' },
        ],
      },
    ]);
  });

  it('ranks a 2nd XV below the lowest of its club\'s sides', () => {
    const { clubs } = place(
      game('Capital Men D1', 'Austin MD1'),
      game('Capital Men D2', 'Austin MD2'),
      game('Approved 3.4.3 Matches', 'Austin 2nd XV'),
    );
    expect(clubs[0].sides.map((side) => side.label)).toEqual(['D1', 'D2', 'D3']);
  });

  it('ranks a 2nd XV below its 1st XV when neither has a division', () => {
    const result = place(game('PNRFU Championship', 'Quake 1st XV'), game('PNRFU Championship', 'Quake 2nd XV'));
    expect(result).toEqual({
      clubs: [
        {
          name: 'Quake',
          sides: [
            { teamName: 'Quake 1st XV', label: '1st XV' },
            { teamName: 'Quake 2nd XV', label: '2nd XV' },
          ],
        },
      ],
      unplacedTeams: [],
    });
  });

  it('ranks a 3rd XV two divisions below', () => {
    const { clubs } = place(game('Capital Men D1', 'Austin MD1'), game('Approved 3.4.3 Matches', 'Austin 3rd XV'));
    expect(clubs[0].sides.map((side) => side.label)).toEqual(['D1', 'D3']);
  });

  it('leaves out a 2nd XV that would fall below the NCS', () => {
    const result = place(game('NERFU Women D2', 'Riverton WD2'), game('Approved 3.4.3 Matches', 'Riverton Women 2nd XV'));
    expect(result).toEqual({ clubs: [{ name: 'Riverton Women', sides: [{ teamName: 'Riverton WD2', label: 'D2' }] }], unplacedTeams: [] });
  });

  it.each([
    'Atlanta WD2 Championship',
    'Denver Barbarians RMR Premiership',
    'Atlanta Bucks 18+',
    'Brujos Rugby Senior (18-99)',
    'Charlotte ARP',
    'Best Bank Bros M7s',
    'Atown 10s',
    'Capital Selects Women',
  ])('stays unmatched when it is a round or one-off entry, not a side: %s', (team) => {
    expect(place(game('Approved 3.4.3 Matches', team))).toEqual({ clubs: [], unplacedTeams: [team] });
  });

  it('stays unmatched when its club has another team with no division, since they cannot be ranked', () => {
    const result = place(game('Approved 3.4.3 Matches', 'Quake Men'), game('Approved 3.4.3 Matches', 'Quake Senior'));
    expect(result).toEqual({ clubs: [], unplacedTeams: ['Quake Men', 'Quake Senior'] });
  });
});

describe('teams that cannot be placed', () => {
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
