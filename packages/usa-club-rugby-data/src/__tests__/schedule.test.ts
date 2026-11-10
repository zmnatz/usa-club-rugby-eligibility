import { describe, expect, it } from 'vitest';
import { possibleFixtures, remainingMatches } from '../schedule.ts';
import { baseConfig, sideOf } from './participationFixtures.ts';

describe('remainingMatches', () => {
  const NOW = new Date('2026-11-06T12:00:00Z');
  const sides = { sides: [sideOf('Rocky Gorge MD1', 1), sideOf('Rocky Gorge MD3', 3)] };
  const upcoming = (overrides: Record<string, unknown> = {}) => ({
    compName: 'MAC Men D1',
    dateTime: '2026-11-14T17:00:00Z',
    status: 'Fixture',
    homeTeam: { name: 'Rocky Gorge MD1', score: '' },
    awayTeam: { name: 'NOVA MD1', score: '' },
    ...overrides,
  });

  it("counts each side's fixtures still to play, home or away", () => {
    expect(
      remainingMatches(
        [
          upcoming(),
          upcoming({ homeTeam: { name: 'NOVA MD1', score: '' }, awayTeam: { name: 'Rocky Gorge MD1', score: '' } }),
          upcoming({ compName: 'Capital Men D3', homeTeam: { name: 'Rocky Gorge MD3', score: '' } }),
        ],
        sides,
        baseConfig,
        NOW,
      ),
    ).toEqual({ 'Rocky Gorge MD1': 2, 'Rocky Gorge MD3': 1 });
  });

  describe('playoff fixtures with no teams assigned', () => {
    const unassigned = (overrides: Record<string, unknown> = {}) =>
      upcoming({
        dateTime: '2027-04-10T17:00:00Z',
        homeTeam: { name: '', score: '' },
        awayTeam: { name: '', score: '' },
        ...overrides,
      });
    const played = upcoming({
      dateTime: '2026-10-01T17:00:00Z',
      status: 'Result',
      homeTeam: { name: 'Rocky Gorge MD1', score: '20' },
      awayTeam: { name: 'NOVA MD1', score: '5' },
    });
    const lowerPlayed = {
      ...played,
      compName: 'Capital Men D3',
      homeTeam: { name: 'Rocky Gorge MD3', score: '20' },
      awayTeam: { name: 'NOVA MD3', score: '5' },
    };

    it("count for each side in that division, as one possible game per date", () => {
      expect(
        remainingMatches(
          [
            played,
            lowerPlayed,
            unassigned(),
            unassigned(),
            unassigned({ dateTime: '2027-04-17T17:00:00Z' }),
            unassigned({ compName: 'Capital Men D3', dateTime: '2027-04-03T17:00:00Z' }),
            unassigned({ compName: 'Capital Men D3', dateTime: '2027-04-03T17:00:00Z' }),
          ],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 2, 'Rocky Gorge MD3': 1 });
    });

    it("don't count for a side that doesn't play in that division", () => {
      expect(
        remainingMatches(
          [played, unassigned({ compName: 'Capital Men D2' })],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 0, 'Rocky Gorge MD3': 0 });
    });

    it('count from a separate playoff competition for the same division', () => {
      expect(
        remainingMatches(
          [lowerPlayed, unassigned({ compName: 'Capital Men D3 Playoffs' })],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 0, 'Rocky Gorge MD3': 1 });
    });

    it('count when only one team has been assigned', () => {
      expect(
        remainingMatches(
          [played, unassigned({ homeTeam: { name: 'NOVA MD1', score: '' } })],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 1, 'Rocky Gorge MD3': 0 });
    });

    it("don't add a game on a date the side already has a fixture", () => {
      expect(
        remainingMatches(
          [
            played,
            upcoming({ dateTime: '2027-04-10T17:00:00Z' }),
            unassigned(),
          ],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 1, 'Rocky Gorge MD3': 0 });
    });

    it("don't count once past, or at Super Regionals", () => {
      expect(
        remainingMatches(
          [
            played,
            unassigned({ dateTime: '2026-10-02T17:00:00Z' }),
            unassigned({ compName: '2027 Super Regional Atlantic' }),
          ],
          sides,
          baseConfig,
          NOW,
        ),
      ).toEqual({ 'Rocky Gorge MD1': 0, 'Rocky Gorge MD3': 0 });
    });
  });

  it("counts local playoffs, but not other clubs', played, forfeited or postponed fixtures, 7s, or anything from Super Regionals on", () => {
    expect(
      remainingMatches(
        [
          upcoming({ compName: 'Capital Men D3 Playoffs' }),
          upcoming({ homeTeam: { name: 'Washington MD1', score: '' } }),
          upcoming({ dateTime: '2026-10-01T17:00:00Z' }),
          upcoming({ homeTeam: { name: 'Rocky Gorge MD1', score: '20' } }),
          upcoming({ status: 'Forfeit' }),
          upcoming({ status: 'Postponed' }),
          upcoming({ compName: 'MAC 7s - Rites of Summer' }),
          upcoming({ compName: '2027 Super Regional Atlantic' }),
          upcoming({ compName: '2027 National Championships' }),
        ],
        sides,
        baseConfig,
        NOW,
      ),
    ).toEqual({ 'Rocky Gorge MD1': 1, 'Rocky Gorge MD3': 0 });
  });
});

describe('possibleFixtures', () => {
  const NOW = new Date('2026-11-06T12:00:00Z');
  const club = { sides: [sideOf('NOVA MD1', 1), sideOf('NOVA MD3', 3)] };
  const fixture = (id: string, date: string, home: string, away: string, compName = 'Capital Men D3', overrides = {}) => ({
    id,
    compName,
    dateTime: `${date}T17:00:00Z`,
    homeTeam: { name: home, score: '' },
    awayTeam: { name: away, score: '' },
    ...overrides,
  });
  const fixtures = [
    fixture('later', '2026-12-05', 'Loudoun MD3', 'NOVA MD3'),
    fixture('soon', '2026-11-14', 'NOVA MD3', 'Frederick MD3'),
    fixture('played', '2026-10-10', 'NOVA MD3', 'Raleigh MD3'),
    fixture('playoff-a', '2027-03-20', '', '', 'Capital Men D3 Playoffs'),
    fixture('playoff-b', '2027-03-20', '', '', 'Capital Men D3 Playoffs'),
    fixture('forfeit', '2026-11-21', 'NOVA MD3', 'Roanoke MD3', 'Capital Men D3', { status: 'Forfeit' }),
    fixture('sevens', '2026-11-28', 'NOVA MD3', 'Roanoke MD3', 'Capital 7s'),
    fixture('other', '2026-11-28', 'Loudoun MD3', 'Frederick MD3'),
  ];

  it("lists a side's own fixtures with its opponent, then one open playoff per date, in date order", () => {
    const result = possibleFixtures(fixtures, club, baseConfig, NOW);

    expect(result['NOVA MD3'].map((item) => [item.fixtureId, item.opponent, item.open])).toEqual([
      ['soon', 'Frederick MD3', false],
      ['later', 'Loudoun MD3', false],
      ['playoff-a', '', true],
    ]);
    expect(result['NOVA MD1']).toEqual([]);
  });

  it('holds exactly the fixtures remainingMatches counts, so the list and the verdict agree', () => {
    const counts = remainingMatches(fixtures, club, baseConfig, NOW);
    const lists = possibleFixtures(fixtures, club, baseConfig, NOW);

    expect(counts).toEqual({ 'NOVA MD1': lists['NOVA MD1'].length, 'NOVA MD3': lists['NOVA MD3'].length });
    expect(counts).toEqual({ 'NOVA MD1': 0, 'NOVA MD3': 3 });
  });
});
