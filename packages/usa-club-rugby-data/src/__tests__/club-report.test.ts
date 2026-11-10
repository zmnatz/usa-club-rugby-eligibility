import { describe, expect, it } from 'vitest';
import { listClubs } from '../clubFixtures.ts';
import { clubGaps, participationRows, playerRounds, playerSeasonEligibility } from '../clubReport.ts';
import { remainingMatches } from '../schedule.ts';
import { buildParticipationSnapshot, type ParticipationSnapshot } from '../snapshot.ts';
import type { PlayerRow } from '../types.ts';
import { SEASON, result, game, history, baseConfig, verdictsFor, row, snapshotOf, fixtureOf } from './participationFixtures.ts';

describe('record-based eligibility', () => {
  describe('a club with one side', () => {
    const [club] = listClubs([{ ...fixtureOf('Loudoun MD3', ''), compName: 'Capital Men D3' }], baseConfig);
    const config = baseConfig;
    const verdicts = (rows: PlayerRow[], remaining: Record<string, number> = {}) =>
      verdictsFor(club, participationRows(snapshotOf(rows), club, config), remaining);

    it('needs two qualifying matches, and has no other side to check', () => {
      const breakdown = verdicts([
        row({ playerId: 'two', teamName: 'Loudoun MD3', played: 1, substitute: 1, competition: 'Capital Men D3' }),
        row({ playerId: 'one', teamName: 'Loudoun MD3', played: 1, competition: 'Capital Men D3' }),
      ]);

      const byId = Object.fromEntries(breakdown.upper.map((player) => [player.playerId, player]));
      expect(byId.two.eligible).toBe(true);
      expect(byId.two.otherSides).toEqual([]);
      expect(byId.one.eligible).toBe(false);
      expect(byId.one.reasons).toEqual(['Needs 2 qualifying matches (has 1)']);
      expect(breakdown.lower).toEqual([]);
    });

    it("marks a player on track when the side's remaining fixtures can reach the minimum", () => {
      const [player] = verdicts(
        [row({ playerId: 'one', teamName: 'Loudoun MD3', played: 1, competition: 'Capital Men D3' })],
        { 'Loudoun MD3': 1 },
      ).upper;

      expect(player.eligible).toBe(true);
      expect(player.pending).toEqual(['Needs 1 more qualifying match (1 fixture left)']);
    });

    it('does not treat open playoff slots, which have no team name, as a lower side', () => {
      const open = {
        compName: 'Capital Men D3 Playoffs',
        dateTime: '2027-03-01T17:00:00Z',
        homeTeam: { name: '', score: '' },
        awayTeam: { name: '', score: '' },
      };
      const remaining = remainingMatches([open], club, config, new Date('2026-11-06T12:00:00Z'));

      expect(remaining).toEqual({ 'Loudoun MD3': 0 });
    });
  });

  const [club] = listClubs([fixtureOf('NOVA MD1', 'NOVA MD3')], baseConfig);

  it("evaluates another club's sides under the regulation thresholds", () => {
    const config = baseConfig;
    const snapshot = snapshotOf([
      row({ playerId: 'sam', teamName: 'NOVA MD1', played: 1 }),
      row({ playerId: 'sam', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      row({ playerId: 'other', teamName: 'Rocky Gorge MD1', played: 9 }),
    ]);

    const breakdown = verdictsFor(club, participationRows(snapshot, club, config));

    expect(breakdown.upper.map((player) => [player.playerId, player.eligible])).toEqual([['sam', true]]);
    expect(breakdown.lower.map((player) => [player.playerId, player.eligible])).toEqual([['sam', false]]);
    expect(breakdown.lower[0].reasons).toEqual(['Needs 2 D3 matches (has 1)']);
    expect(breakdown.ignoredTeamNames).toEqual([]);
  });

  it('evaluates a player listed on one side for the other side too', () => {
    const config = baseConfig;
    const snapshot = snapshotOf([
      row({ playerId: 'lower-only', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 2 }),
      row({ playerId: 'upper-only', teamName: 'NOVA MD1', played: 2 }),
    ]);

    const breakdown = verdictsFor(club, participationRows(snapshot, club, config));
    const verdict = (players: typeof breakdown.upper, id: string) =>
      players.find((player) => player.playerId === id);

    expect(verdict(breakdown.upper, 'lower-only')).toMatchObject({
      participation: 0,
      otherSides: [expect.objectContaining({ participation: 2 })],
      eligible: true,
    });
    expect(verdict(breakdown.lower, 'upper-only')).toMatchObject({
      participation: 0,
      otherSides: [expect.objectContaining({ participation: 2 })],
      eligible: false,
    });
    expect(breakdown.upperSummary.competitions).toEqual(['MAC Men D1']);
    expect(breakdown.lowerSummary.competitions).toEqual(['Capital Men D3']);
  });

  it('counts league and local playoff matches, but not Super Regionals, National Championships or 7s', () => {
    const config = baseConfig;
    const snapshot = snapshotOf([
      row({ teamName: 'NOVA MD1', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: 'Capital Men D3 Playoffs', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: '2027 Super Regional Atlantic', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: 'ASR Final 2027', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: '2027 National Championships', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: 'MAC 7s - Rites of Summer', played: 1 }),
      row({ teamName: 'NOVA MD1', competition: "S'kill 7's", played: 1 }),
      row({ teamName: 'NOVA MD1', competition: 'Beltway Sevens', played: 1 }),
    ]);

    const breakdown = verdictsFor(club, participationRows(snapshot, club, config));

    expect(breakdown.upper[0].participation).toBe(2);
    expect(breakdown.upperSummary.competitions).toEqual([
      'Capital Men D3 Playoffs',
      'MAC Men D1',
    ]);
  });

  it("reports gaps only for the club's own sides in qualifying competitions", () => {
    const config = baseConfig;
    const gap = (teamName: string, competition: string) => ({
      kind: 'no-lineup' as const,
      fixtureId: 'f1',
      teamName,
      opponent: 'Other',
      competition,
      dateTime: '2026-10-17T17:00:00Z',
    });
    const snapshot: ParticipationSnapshot = {
      season: SEASON,
      rows: [],
      gaps: [
        gap('NOVA MD1', 'MAC Men D1'),
        gap('Rocky Gorge MD1', 'MAC Men D1'),
        gap('NOVA MD3', '2027 National Championships'),
      ],
    };

    expect(clubGaps(snapshot, club, config).map((item) => item.teamName)).toEqual(['NOVA MD1']);
  });
});

describe('playerRounds', () => {
  const NOW = new Date('2026-10-20T12:00:00Z');
  const fixture = (id: string, round: string, date: string, overrides: Record<string, unknown> = {}) => ({
    id,
    compName: 'Capital Men D3',
    season: SEASON,
    dateTime: `${date}T17:00:00Z`,
    round,
    status: 'Result',
    homeTeam: { name: 'Loudoun MD3', score: '20' },
    awayTeam: { name: 'Frederick MD3', score: '10' },
    ...overrides,
  });
  const rounds = (fixtures: ReturnType<typeof fixture>[], options: Partial<Parameters<typeof playerRounds>[0]> = {}) =>
    playerRounds({
      fixtures,
      teamName: 'Loudoun MD3',
      season: SEASON,
      rows: [
        row({
          teamName: 'Loudoun MD3',
          competition: 'Capital Men D3',
          rounds: { f1: 'Start', f2: 'Sub', f3: 'R' },
        }),
      ],
      gaps: [],
      resultIds: fixtures.map((item) => item.id),
      rules: baseConfig,
      now: NOW,
      ...options,
    });

  it("gives every round of the team's season in date order, whether or not the player appeared", () => {
    const result = rounds([
      fixture('f4', 'Round 4', '2026-10-10'),
      fixture('f1', 'Round 1', '2026-09-10'),
      fixture('f3', 'Round 3', '2026-09-30'),
      fixture('f2', 'Round 2', '2026-09-20'),
    ]);

    expect(result.map((item) => [item.round, item.status, item.counted])).toEqual([
      ['Round 1', 'started', true],
      ['Round 2', 'substitute', true],
      ['Round 3', 'unused', false],
      ['Round 4', 'not-listed', false],
    ]);
  });

  it('gives the opponent and score from the team\'s side, home or away', () => {
    const [home, away] = rounds([
      fixture('f1', 'Round 1', '2026-09-10'),
      fixture('f2', 'Round 2', '2026-09-20', {
        homeTeam: { name: 'NOVA MD3', score: '30' },
        awayTeam: { name: 'Loudoun MD3', score: '5' },
      }),
    ]);

    expect(home).toMatchObject({ fixtureId: 'f1', opponent: 'Frederick MD3', scoreFor: '20', scoreAgainst: '10' });
    expect(away).toMatchObject({ fixtureId: 'f2', opponent: 'NOVA MD3', scoreFor: '5', scoreAgainst: '30' });
  });

  it("leaves out other teams' fixtures and other seasons", () => {
    const result = rounds([
      fixture('other-team', 'Round 1', '2026-09-10', {
        homeTeam: { name: 'NOVA MD3', score: '1' },
        awayTeam: { name: 'Frederick MD3', score: '2' },
      }),
      fixture('last-season', 'Round 1', '2025-09-10', { season: '2025/2026' }),
    ]);

    expect(result).toEqual([]);
  });

  it('says why a round did not count', () => {
    const result = rounds(
      [
        fixture('forfeit', 'Round 1', '2026-09-10', { status: 'Forfeit' }),
        fixture('postponed', 'Round 2', '2026-09-20', { status: 'Postponed' }),
        fixture('no-lineup', 'Round 4', '2026-09-30'),
        fixture('awaiting', 'Round 5', '2026-10-10', {
          status: 'Fixture',
          homeTeam: { name: 'Loudoun MD3', score: '' },
          awayTeam: { name: 'Frederick MD3', score: '' },
        }),
        fixture('upcoming', 'Round 6', '2026-11-10', {
          status: 'Fixture',
          homeTeam: { name: 'Loudoun MD3', score: '' },
          awayTeam: { name: 'Frederick MD3', score: '' },
        }),
        fixture('sevens', 'Round 1', '2026-10-01', { compName: 'Capital 7s' }),
      ],
      {
        resultIds: ['forfeit', 'postponed', 'no-lineup', 'sevens'],
        gaps: [
          {
            kind: 'no-lineup',
            fixtureId: 'no-lineup',
            teamName: 'Loudoun MD3',
            opponent: 'Frederick MD3',
            competition: 'Capital Men D3',
            dateTime: '2026-09-30T17:00:00Z',
          },
        ],
      },
    );

    expect(Object.fromEntries(result.map((item) => [item.fixtureId, [item.status, item.counted]]))).toEqual({
      forfeit: ['forfeit', false],
      postponed: ['postponed', false],
      'no-lineup': ['no-lineup', false],
      sevens: ['not-qualifying', false],
      awaiting: ['awaiting-result', false],
      upcoming: ['upcoming', false],
    });
  });

  it("counts a forfeit the side won with the player rostered, and says it was a forfeit", () => {
    const [round] = rounds([fixture('f1', 'Round 1', '2026-09-10', { status: 'Forfeit' })]);

    expect(round).toMatchObject({ status: 'forfeit-rostered', counted: true });
  });

  it('flags a round whose substitutions were not entered, so a reserve may really have played', () => {
    const [round] = rounds([fixture('f3', 'Round 3', '2026-09-30')], {
      gaps: [
        {
          kind: 'no-substitutions',
          fixtureId: 'f3',
          teamName: 'Loudoun MD3',
          opponent: 'Frederick MD3',
          competition: 'Capital Men D3',
          dateTime: '2026-09-30T17:00:00Z',
        },
      ],
    });

    expect(round).toMatchObject({ status: 'unused', substitutionsMissing: true });
  });

  it('labels a round with no name by its date', () => {
    const [round] = rounds([fixture('f1', '', '2026-09-10')]);

    expect(round.round).toBe('2026-09-10');
  });

  it('tells apart two fixtures with the same round name, using a real snapshot', () => {
    const results = [
      result('first', { dateTime: '2026-10-10T17:00:00Z', round: 'Round 4' }),
      result('second', { dateTime: '2026-10-17T17:00:00Z', round: 'Round 4' }),
    ];
    const snapshot = buildParticipationSnapshot(
      [history('sam', 'Sam Hooker', [game('first', { starter: false, played: false }), game('second')])],
      results,
      new Date('2026-10-20T12:00:00Z'),
    );

    const items = playerRounds({
      fixtures: results.map((item) => ({
        ...item,
        homeTeam: { name: item.homeTeam.name, score: '10' },
        awayTeam: { name: item.awayTeam.name, score: '5' },
      })),
      teamName: 'Rocky Gorge MD1',
      season: SEASON,
      rows: snapshot.rows,
      gaps: snapshot.gaps,
      resultIds: snapshot.resultIds ?? [],
      rules: baseConfig,
      now: NOW,
    });

    expect(items.map((item) => [item.fixtureId, item.status, item.counted])).toEqual([
      ['first', 'unused', false],
      ['second', 'started', true],
    ]);
    expect(snapshot.rows[0].played).toBe(1);
  });
});

describe('playerSeasonEligibility', () => {
  const NOW = new Date('2026-11-06T12:00:00Z');
  const schedule = (home: string, away: string, compName: string, date = '2026-10-10') => ({
    compName,
    dateTime: `${date}T17:00:00Z`,
    homeTeam: { name: home, score: '' },
    awayTeam: { name: away, score: '' },
  });
  const fixtures = [
    schedule('NOVA MD1', 'Washington MD1', 'MAC Men D1'),
    schedule('NOVA MD3', 'Loudoun MD3', 'Capital Men D3'),
  ];

  it('gives a verdict for each side of a two-side club, upper first', () => {
    const snapshot = snapshotOf([
      row({ playerId: 'sam', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 2 }),
      row({ playerId: 'other', teamName: 'NOVA MD1', played: 5 }),
    ]);

    const [result, ...others] = playerSeasonEligibility(snapshot, fixtures, 'sam', baseConfig, NOW);

    expect(others).toEqual([]);
    expect(result.club.name).toBe('NOVA');
    expect(result.verdicts.map((player) => [player.teamName, player.eligible, player.participation])).toEqual([
      ['NOVA MD1', true, 0],
      ['NOVA MD3', true, 2],
    ]);
  });

  it('gives one verdict for a player at a one-side club, and counts its remaining fixtures', () => {
    const snapshot = snapshotOf([
      row({ playerId: 'lee', teamName: 'Loudoun MD3', competition: 'Capital Men D3', played: 1 }),
    ]);
    const withUpcoming = [...fixtures, schedule('Loudoun MD3', 'Frederick MD3', 'Capital Men D3', '2026-11-20')];

    const [result] = playerSeasonEligibility(snapshot, withUpcoming, 'lee', baseConfig, NOW);

    expect(result.verdicts).toHaveLength(1);
    expect(result.verdicts[0]).toMatchObject({
      eligible: true,
      pending: ['Needs 1 more qualifying match (1 fixture left)'],
    });
  });

  it('gives nothing for a player with no qualifying rows this season', () => {
    const snapshot = snapshotOf([
      row({ playerId: 'sevens', teamName: 'NOVA MD1', competition: 'MAC 7s', played: 3 }),
    ]);

    expect(playerSeasonEligibility(snapshot, fixtures, 'sevens', baseConfig, NOW)).toEqual([]);
    expect(playerSeasonEligibility(snapshot, fixtures, 'nobody', baseConfig, NOW)).toEqual([]);
  });
});
