import { describe, expect, it } from 'vitest';
import { historicalClubs } from '../historicalSides.ts';
import { DEFAULT_RULES } from '../rules.ts';

const game = (compName: string, home: string, away = '', dateTime = '2024-10-05T15:00:00Z') => ({
  compName,
  dateTime,
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
    ['Las Vegas Women B Side', "SWRU Women's D2", 'Las Vegas Women', 'D2'],
    ["Portland Women's Rugby Football Club Senior Club NERFU DII", 'Approved 3.4.3 Matches', 'Portland Women', 'D2'],
    ['Seattle Men D1 Sr', 'Approved 3.4.3 Matches', 'Seattle', 'D1'],
    ['Knoxville Minx WD2', 'Approved 3.4.3 Matches', 'Knoxville Minx Women', 'D2'],
    ['Black Sheep D2 1st XV', 'Approved 3.4.3 Matches', 'Black Sheep', 'D2'],
    ['Buffalo MD3 2nd', 'Approved 3.4.3 Matches', 'Buffalo', 'D3'],
  ])('%s in %s is %s %s', (team, competition, club, label) => {
    expect(place(game(competition, team)).clubs).toMatchObject([{ name: club, sides: [{ teamName: team, label }] }]);
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

  it('names the XV only to tell apart two sides at one division', () => {
    const { clubs } = place(game('NorCal Mens D3', 'Reno MD3'), game('NorCal Mens D3', 'Reno MD3 2nd'));
    expect(clubs[0].sides.map((side) => side.label)).toEqual(['D3', 'D3 2nd XV']);
  });

  it('ranks a club\'s sides by division, however differently they are named', () => {
    const { clubs } = place(game('NorCal Mens D2', 'Reno Mens 2nd XV'), game('NorCal Mens D1', 'Reno MD1'));
    expect(clubs).toMatchObject([
      {
        name: 'Reno',
        sides: [
          { teamName: 'Reno MD1', label: 'D1' },
          { teamName: 'Reno Mens 2nd XV', label: 'D2' },
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
    expect(place(game('NERFU Men D4', 'Amoskeag Men Senior'), game('NorCal Womens D3', 'Chico Womens'))).toMatchObject({
      clubs: [],
      unplacedTeams: [],
    });
  });
});

describe('a team with no division', () => {
  it.each(["SWRU Men's D2 & D3", 'Approved 3.4.3 Matches', 'MW Spring 2024 - NCS Pathway Matches'])(
    'is a one-side club when alone at its club: %s',
    (competition) => {
      expect(place(game(competition, 'Tempe Old Devils Men'))).toMatchObject({
        clubs: [{ name: 'Tempe Old Devils', sides: [{ teamName: 'Tempe Old Devils Men', label: 'Senior' }] }],
        unplacedTeams: [],
      });
    },
  );

  it('is a one-side club when its competitions split evenly between divisions', () => {
    const result = place(game('NorCal Mens D2', 'Marin Mens'), game('NorCal Mens D3', 'Marin Mens'));
    expect(result).toMatchObject({ clubs: [{ name: 'Marin', sides: [{ teamName: 'Marin Mens', label: 'Senior' }] }], unplacedTeams: [] });
  });

  it('keeps a women\'s team as a women\'s club', () => {
    expect(place(game('Approved 3.4.3 Matches', 'Phoenix Women\'s Rugby Senior')).clubs[0].name).toBe('Phoenix Women');
  });

  it.each([
    ['Old Gaelic B-Side B-League', 'Old Gaelic'],
    ['Phoenixville Men B-Side B-League', 'Phoenixville'],
    ['Riverton Men B Side', 'Riverton'],
  ])('is taken as Division 3 when it is a B side: %s', (team, club) => {
    expect(place(game('Approved 3.4.3 Matches', team)).clubs).toMatchObject([{ name: club, sides: [{ teamName: team, label: 'D3' }] }]);
  });

  it('ranks a B side below its club\'s main side', () => {
    const { clubs } = place(game('EPRU D2 Men', 'Media MD2'), game('Approved 3.4.3 Matches', 'Media B-Side B-League'));
    expect(clubs[0].sides).toMatchObject([
      { teamName: 'Media MD2', label: 'D2' },
      { teamName: 'Media B-Side B-League', label: 'D3' },
    ]);
  });

  it('leaves out a women\'s B side, since Women\'s Division 3 is outside the NCS', () => {
    expect(place(game('Approved 3.4.3 Matches', 'Riverton Women B-Side'))).toMatchObject({ clubs: [], unplacedTeams: [] });
  });

  it('ranks a 2nd XV one division below its club\'s other side', () => {
    const { clubs } = place(game('PNRFU Men D2', "Pigs Men's D2 Senior"), game('PNRFU Championship', 'Pigs 2nd XV'));
    expect(clubs).toMatchObject([
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
    expect(clubs[0].sides.map((side) => side.label)).toMatchObject(['D1', 'D2', 'D3']);
  });

  it('ranks a 2nd XV below its 1st XV when neither has a division', () => {
    const result = place(game('PNRFU Championship', 'Quake 1st XV'), game('PNRFU Championship', 'Quake 2nd XV'));
    expect(result).toMatchObject({
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
    expect(clubs[0].sides.map((side) => side.label)).toMatchObject(['D1', 'D3']);
  });

  it('leaves out a 2nd XV that would fall below the NCS', () => {
    const result = place(game('NERFU Women D2', 'Riverton WD2'), game('Approved 3.4.3 Matches', 'Riverton Women 2nd XV'));
    expect(result).toMatchObject({ clubs: [{ name: 'Riverton Women', sides: [{ teamName: 'Riverton WD2', label: 'D2' }] }], unplacedTeams: [] });
  });

  it.each([
    'Atlanta WD2 Championship',
    'Charlotte ARP',
    'Life University Eagles ARP',
    'South Selects Women',
    'Mid-America All Stars Women',
    'Best Bank Bros M7s',
    'Atown 10s',
    'Capital Selects Women',
  ])('stays unmatched when it is a round or one-off entry, not a side: %s', (team) => {
    expect(place(game('Approved 3.4.3 Matches', team))).toMatchObject({ clubs: [], unplacedTeams: [team] });
  });

  it.each([
    ['Atlanta Bucks 18+', '2024 GRU Matrix', 'Atlanta Bucks', 'Senior'],
    ['Brujos Rugby Senior (18-99)', 'Rio Grande', 'Brujos', 'Senior'],
    ['AK Manu Bears Rugby Team 18+', 'Alaska Rugby', 'AK Manu Bears', 'Senior'],
    ['907 Brothers gameday 1st XVs', 'Alaska Rugby', '907 Brothers', 'Senior'],
    ['Gladiators MD3 18+', 'Utah Spring Season - Mens', 'Gladiators', 'D3'],
    ['OP Lightning 18-99', 'SWRU Women', 'OP Lightning Women', 'Senior'],
  ])('reads an age tag as a senior team: %s', (team, competition, club, label) => {
    expect(place(game(competition, team)).clubs).toMatchObject([{ name: club, sides: [{ teamName: team, label }] }]);
  });

  it.each([
    ['Boulder Men RMR Premiership', 'Boulder', 'D2'],
    ['Queen City RMR Championship', 'Queen City', 'D3'],
  ])('reads a Rocky Mountain league tier as a division: %s', (team, club, label) => {
    expect(place(game('RMR Premiership', team)).clubs).toMatchObject([{ name: club, sides: [{ teamName: team, label }] }]);
  });

  it('ranks a club\'s Rocky Mountain tiers, including a B side', () => {
    const { clubs } = place(
      game('RMR Premiership', 'Denver Barbarians RMR Premiership'),
      game('RMR Championship', 'Denver Barbarians B RMR Championship'),
    );
    expect(clubs[0]).toMatchObject({
      name: 'Denver Barbarians',
      sides: [
        { teamName: 'Denver Barbarians RMR Premiership', label: 'D2' },
        { teamName: 'Denver Barbarians B RMR Championship', label: 'D3' },
      ],
    });
  });

  it('stays unmatched when its club has another team with no division, since they cannot be ranked', () => {
    const result = place(game('Approved 3.4.3 Matches', 'Quake Men'), game('Approved 3.4.3 Matches', 'Quake Senior'));
    expect(result).toMatchObject({ clubs: [], unplacedTeams: ['Quake Men', 'Quake Senior'] });
  });
});

describe('teams that cannot be placed', () => {
  it('warns the club when one of its teams has no division', () => {
    const { clubs, unplacedTeams } = place(
      game('EPRU D3 Men', 'Harrisburg MD3', 'York MD3'),
      game('Approved 3.4.3 Matches', 'Harrisburg Men Senior Club', 'York MD3'),
    );
    expect(clubs[0]).toMatchObject({
      name: 'Harrisburg',
      sides: [{ teamName: 'Harrisburg MD3', label: 'D3' }],
      unplacedTeams: ['Harrisburg Men Senior Club'],
    });
    expect(unplacedTeams).toMatchObject(['Harrisburg Men Senior Club']);
  });

  it('keeps apart two clubs that share a name but play nobody in common', () => {
    const { clubs, unplacedTeams } = place(
      game('Ohio Men D2', 'Columbus MD2', 'Cincinnati MD2'),
      game('Georgia Rugby Union Matrix 2025', "Columbus Men's 18+", 'Atlanta Bucks 18+'),
    );
    expect(clubs.filter((club) => club.name === 'Columbus')).toMatchObject([
      { name: 'Columbus', sides: [{ teamName: 'Columbus MD2', label: 'D2' }] },
      { name: 'Columbus', sides: [{ teamName: "Columbus Men's 18+", label: 'Senior' }] },
    ]);
    expect(unplacedTeams).toMatchObject([]);
  });

  it('leaves out a club with two names at one division, which cannot be ranked', () => {
    const result = place(
      game('NERFU Men D2', 'Bay Men'),
      game('NERFU Men D2', 'Bay Men Senior'),
      game('NERFU Men D1', 'Bay MD1'),
    );
    expect(result).toMatchObject({ clubs: [], unplacedTeams: ['Bay MD1', 'Bay Men', 'Bay Men Senior'] });
  });

  it('skips a fixture with no team assigned', () => {
    expect(place(game('NorCal Mens D2', ''))).toMatchObject({ clubs: [], unplacedTeams: [] });
  });
});

describe('a note on each guess', () => {
  const notesOf = (...fixtures: ReturnType<typeof game>[]) => place(...fixtures).clubs.map((club) => club.notes ?? []);

  it('says nothing when the name or competition gives the division', () => {
    expect(notesOf(game('NorCal Mens D2', 'Marin Mens'), game('Approved 3.4.3 Matches', 'Reno MD1'))).toEqual([[], []]);
  });

  it('a division chosen from several', () => {
    expect(notesOf(game('NorCal Mens D2', 'Marin Mens'), game('NorCal Mens D2', 'Marin Mens'), game('NorCal Mens D3', 'Marin Mens'))).toEqual([
      ['Marin Mens: its competitions name more than one division, so it is taken as D2, where most of its matches were.'],
    ]);
  });

  it('a one-side club with no division', () => {
    expect(notesOf(game('Approved 3.4.3 Matches', 'Tempe Old Devils Men'))).toEqual([
      ["Tempe Old Devils Men: the record doesn't name its division, so the club is assessed as a one-side club."],
    ]);
  });

  it('a 2nd XV placed below its club', () => {
    expect(notesOf(game('PNRFU Men D2', "Pigs Men's D2 Senior"), game('PNRFU Championship', 'Pigs 2nd XV'))).toEqual([
      ["Pigs 2nd XV: the record doesn't name its division, so as a second side it is taken as D3, below Pigs Men's D2 Senior."],
    ]);
  });

  it('a B side with nothing to go below', () => {
    expect(notesOf(game('Approved 3.4.3 Matches', 'Old Gaelic B-Side B-League'))).toEqual([
      ["Old Gaelic B-Side B-League: the record doesn't name its division, so as a second side it is taken as D3."],
    ]);
  });

  it('a 1st and 2nd XV ranked by name', () => {
    expect(notesOf(game('PNRFU Championship', 'Quake 1st XV'), game('PNRFU Championship', 'Quake 2nd XV'))).toEqual([
      ["Quake 1st XV and Quake 2nd XV: the record doesn't name their divisions, so they are ranked by name, 1st XV above 2nd XV."],
    ]);
  });

  it('a Rocky Mountain tier', () => {
    expect(notesOf(game('RMR Premiership', 'Boulder Men RMR Premiership'))).toEqual([
      ['Boulder Men RMR Premiership: its Rocky Mountain tier, Premiership, is taken as D2.'],
    ]);
  });

  it('a club kept apart from a namesake', () => {
    const { clubs } = place(
      game('Ohio Men D2', 'Columbus MD2', 'Cincinnati MD2'),
      game('Georgia Rugby Union Matrix 2025', "Columbus Men's 18+", 'Atlanta Bucks 18+'),
    );
    expect(clubs.filter((club) => club.name === 'Columbus').map((club) => club.notes ?? [])).toEqual([
      [],
      [
        "Columbus Men's 18+: another club named Columbus plays different opponents, so this is a club of its own. The record doesn't name its division, so it is assessed as a one-side club.",
      ],
    ]);
  });
});

describe('one club under two spellings', () => {
  const sidesOf = (...fixtures: ReturnType<typeof game>[]) =>
    place(...fixtures).clubs.map((club) => [club.name, club.sides.map((side) => side.label)]);

  it('a number for the XV', () => {
    expect(sidesOf(game("TRU Men's Division 2", 'San Antonio M'), game("TRU Men's Division 3 Central", 'San Antonio 2 M'))).toEqual([
      ['San Antonio', ['D2', 'D3']],
    ]);
    expect(sidesOf(game("TRU Women's Division 1", 'sHARCs W'), game("TRU Women's Division 1", 'sHARCs 2 W'))).toEqual([
      ['sHARCs Women', ['D1', 'D1 2nd XV']],
    ]);
  });

  it('a B side after a dash', () => {
    expect(sidesOf(game('SCRFU Men D1', 'Eagle Rock MD1'), game('SCRFU Men D1', 'Eagle Rock MD1 - B Side'))).toEqual([
      ['Eagle Rock', ['D1', 'D1 2nd XV']],
    ]);
  });

  it('the division before the gender', () => {
    expect(sidesOf(game('Approved 3.4.3 Matches', 'New Orleans D2M'), game('Approved 3.4.3 Matches', 'New Orleans D3M'))).toEqual([
      ['New Orleans', ['D2', 'D3']],
    ]);
  });

  it('a hyphen for a space', () => {
    expect(
      sidesOf(game('Approved 3.4.3 Matches', 'Philadelphia-Whitemarsh RFC D2M'), game('Approved 3.4.3 Matches', 'Philadelphia Whitemarsh B-Side B-League')),
    ).toEqual([['Philadelphia-Whitemarsh', ['D2', 'D3']]]);
  });

  it('a lettered main side', () => {
    expect(sidesOf(game("Empire Men's D3 Metro West", 'NYAC D3 M'), game("Empire Men's D1", 'NYAC Mens A'))).toEqual([['NYAC', ['D1', 'D3']]]);
  });

  it('a B side in brackets, and a side named for two divisions', () => {
    const { clubs } = place(
      game("RMRU Men's Fall 2023 - D1/D2 Hybrid", 'Denver Barbarians RFC D1/D2'),
      game("RMRU Men's Fall 2023 - D3", 'Denver Barbarians RFC (B) D3'),
    );
    expect(clubs.map((club) => [club.name, club.sides.map((side) => side.label)])).toEqual([['Denver Barbarians', ['D2', 'D3']]]);
    expect(clubs[0].notes).toEqual(['Denver Barbarians RFC D1/D2: its name gives two divisions, D1/D2, so it is taken as D2.']);
  });
});

describe('a 7s or 10s side', () => {
  it('is never assessed, even in a competition that names a division', () => {
    expect(place(game("Empire Men's D3", 'White Plains M 7s'), game("Empire Men's D3", 'White Plains D3 M'))).toMatchObject({
      clubs: [{ name: 'White Plains', sides: [{ teamName: 'White Plains D3 M' }] }],
      unplacedTeams: ['White Plains M 7s'],
    });
  });
});

describe('American Rugby Premiership sides', () => {
  it('are never assessed, even in a competition that names a division', () => {
    expect(place(game("Empire Men's D1 Spring", 'NYAC ARP'), game('Empire Men D2', 'NYAC MD2'))).toMatchObject({
      clubs: [{ name: 'NYAC', sides: [{ teamName: 'NYAC MD2' }] }],
      unplacedTeams: ['NYAC ARP'],
    });
  });
});

describe('summer 7s', () => {
  const july = '2025-07-12T15:00:00Z';

  it('leaves out a team that only played in June or July', () => {
    expect(place(game('NorCal Mens D2', 'Marin Sevens', '', july), game('NorCal Mens D2', 'Marin Sevens', '', '2025-06-07T15:00:00Z'))).toEqual({
      clubs: [],
      unplacedTeams: [],
    });
  });

  it('places a team by its other games, not its summer ones', () => {
    const { clubs } = place(
      game('NorCal Mens D3', 'Marin Mens', '', july),
      game('NorCal Mens D3', 'Marin Mens', '', july),
      game('NorCal Mens D2', 'Marin Mens'),
    );
    expect(clubs[0].sides[0].label).toBe('D2');
  });
});

describe('clubs confirmed as one under different names', () => {
  it('merges them, ranked by division, under the club\'s own name', () => {
    const { clubs } = place(game('TRU Men D2', 'Houston United MD2'), game('TRU Men D3', 'HURT MD3'));
    expect(clubs).toMatchObject([
      { name: 'Houston United', sides: [{ teamName: 'Houston United MD2', label: 'D2' }, { teamName: 'HURT MD3', label: 'D3' }] },
    ]);
    expect(clubs[0].notes).toEqual(['HURT MD3: entered as HURT, which is the same club as Houston United.']);
  });

  it('matches a name whatever its case', () => {
    const { clubs } = place(game('Frontier Women D1', 'Utah Vipers WD1'), game('Frontier Women D2', 'SLUGs WD2'));
    expect(clubs.map((club) => [club.name, club.sides.map((side) => side.label)])).toEqual([['Utah Vipers Women', ['D1', 'D2']]]);
  });

  it('goes by the name of its top side', () => {
    const { clubs } = place(game('Penn Men D3', 'Schuylkill River MD3'), game('Penn Men D1', 'Schuylkill River Exiles MD1'));
    expect(clubs.map((club) => [club.name, club.sides.map((side) => side.teamName)])).toEqual([
      ['Schuylkill River Exiles', ['Schuylkill River Exiles MD1', 'Schuylkill River MD3']],
    ]);
    expect(clubs[0].notes).toEqual([
      'Schuylkill River MD3: entered as Schuylkill River, which is the same club as Schuylkill River Exiles.',
    ]);
  });

  it('merges all three Chicago clubs', () => {
    const { clubs } = place(
      game('MW Men D1', 'Chicago Griffins MD1'),
      game('MW Men D2', 'Westside Condors MD2'),
      game('MW Men D3', 'Chicago Silverbacks MD3'),
    );
    expect(clubs.map((club) => [club.name, club.sides.map((side) => side.label)])).toEqual([['Chicago Griffins', ['D1', 'D2', 'D3']]]);
  });
});

