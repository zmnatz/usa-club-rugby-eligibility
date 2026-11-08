import { describe, expect, it } from 'vitest';
import { clubsFromTeamNames } from '../eligibility.ts';
import { clubKey, isNcsSide, parseTeamSide } from '../teamSide.ts';

describe('parseTeamSide', () => {
  it.each([
    ['Rocky Gorge MD1', { clubName: 'Rocky Gorge', gender: 'M', level: 1, xv: 1 }],
    ['NOVA WD3', { clubName: 'NOVA Women', gender: 'W', level: 3, xv: 1 }],
    ['Amoskeag W+D3', { clubName: 'Amoskeag Women', gender: 'W', level: 3, xv: 1 }],
    ['Black Sheep D2 1st XV', { clubName: 'Black Sheep', gender: 'M', level: 2, xv: 1 }],
    ['Kansas City MD3 2nd XV', { clubName: 'Kansas City', gender: 'M', level: 3, xv: 2 }],
    ['Buffalo MD3 2nd', { clubName: 'Buffalo', gender: 'M', level: 3, xv: 2 }],
    ['OMAHA M D2 1st XVs', { clubName: 'OMAHA', gender: 'M', level: 2, xv: 1 }],
    ['Omaha Womens D2 1st XV', { clubName: 'Omaha Women', gender: 'W', level: 2, xv: 1 }],
    ['Atlanta 2.0 Selects WD2', { clubName: 'Atlanta 2.0 Selects Women', gender: 'W', level: 2, xv: 1 }],
  ])('reads %s', (name, expected) => {
    expect(parseTeamSide(name)).toMatchObject(expected);
  });

  it.each(['NYAC ARP', 'Gaston Hellhounds Festival', 'Aquiles Azteca W', 'Exiles M Social', 'Mad River Rugby W+NCP', ''])(
    'has no division for %j',
    (name) => {
      expect(parseTeamSide(name)).toBeNull();
    },
  );
});

describe('isNcsSide', () => {
  it("covers men's divisions 1 to 3 and women's 1 and 2", () => {
    expect(isNcsSide({ gender: 'M', level: 3 })).toBe(true);
    expect(isNcsSide({ gender: 'M', level: 4 })).toBe(false);
    expect(isNcsSide({ gender: 'W', level: 2 })).toBe(true);
    expect(isNcsSide({ gender: 'W', level: 3 })).toBe(false);
  });
});

describe('clubsFromTeamNames with national naming', () => {
  it("ranks a club's 1st XV above its 2nd XV at the same level", () => {
    expect(clubsFromTeamNames(['Kansas City MD3 2nd XV', 'Kansas City MD2 1st XV', 'Kansas City MD3'])).toEqual([
      {
        name: 'Kansas City',
        sides: [
          { teamName: 'Kansas City MD2 1st XV', label: 'D2' },
          { teamName: 'Kansas City MD3', label: 'D3' },
          { teamName: 'Kansas City MD3 2nd XV', label: 'D3 2nd XV' },
        ],
      },
    ]);
  });
});

describe('clubKey', () => {
  it('makes a file name from a club name', () => {
    expect(clubKey('NOVA Women')).toBe('nova-women');
    expect(clubKey("St. Louis Sabres")).toBe('st-louis-sabres');
  });
});
