import { describe, expect, it } from 'vitest';
import { buildParticipationSnapshot } from '../snapshot.ts';
import { SEASON, result, game, history } from './participationFixtures.ts';

describe('buildParticipationSnapshot', () => {
  it("totals starts and substitute appearances, and doesn't count a reserve who never entered", () => {
    const snapshot = buildParticipationSnapshot(
      [
        history('sam', 'Sam Van Der Berg', [
          game('f1'),
          game('f2', { starter: false, played: true }),
          game('f3', { starter: false, played: false }),
        ]),
      ],
      [
        result('f1'),
        result('f2', { round: 'Round 5' }),
        result('f3', { round: 'Round 6' }),
      ],
    );

    expect(snapshot.season).toBe(SEASON);
    expect(snapshot.rows).toEqual([
      {
        playerId: 'sam',
        firstName: 'Sam',
        lastName: 'Van Der Berg',
        lastRegistered: '',
        teamName: 'Rocky Gorge MD1',
        competition: 'MAC Men D1',
        appearances: 2,
        played: 1,
        substitute: 1,
        rounds: { f1: 'Start', f2: 'Sub', f3: 'R' },
      },
    ]);
  });

  it("keeps a player's sides as separate rows", () => {
    const snapshot = buildParticipationSnapshot(
      [
        history('sam', 'Sam Hooker', [
          game('f1'),
          game('f2', { teamName: 'Rocky Gorge MD3', compName: 'Capital Men D3' }),
        ]),
      ],
      [result('f1'), result('f2', { compName: 'Capital Men D3', homeTeam: { name: 'Rocky Gorge MD3' }, awayTeam: { name: 'NOVA MD3' } })],
    );

    expect(snapshot.rows.map((row) => [row.teamName, row.played])).toEqual([
      ['Rocky Gorge MD1', 1],
      ['Rocky Gorge MD3', 1],
    ]);
  });

  it('covers only the latest season with results', () => {
    const snapshot = buildParticipationSnapshot(
      [history('sam', 'Sam Hooker', [game('f1'), game('old', { season: '2025/2026' })])],
      [result('f1'), result('old', { season: '2025/2026' })],
    );

    expect(snapshot.season).toBe(SEASON);
    expect(snapshot.rows[0].played).toBe(1);
  });

  it('leaves coaches out of the rows', () => {
    const snapshot = buildParticipationSnapshot(
      [history('pat', 'Pat Coach', [game('f1', { starter: false, played: false, coach: true })])],
      [result('f1')],
    );

    expect(snapshot.rows).toEqual([]);
  });

  it('flags a side with a result but no lineup, even when only its coach is listed', () => {
    const snapshot = buildParticipationSnapshot(
      [
        history('pat', 'Pat Coach', [game('f1', { starter: false, played: false, coach: true })]),
        history('nia', 'Nia Prop', [game('f1', { teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1' })]),
      ],
      [result('f1')],
    );

    expect(snapshot.gaps).toEqual([
      {
        kind: 'no-lineup',
        fixtureId: 'f1',
        teamName: 'Rocky Gorge MD1',
        opponent: 'NOVA MD1',
        competition: 'MAC Men D1',
        dateTime: '2026-10-17T17:00:00Z',
      },
    ]);
  });

  it('flags a side whose listed substitutes all show as unused, but not one with a used substitute', () => {
    const snapshot = buildParticipationSnapshot(
      [
        history('sam', 'Sam Hooker', [game('f1')]),
        history('joe', 'Joe Bench', [game('f1', { starter: false, played: false })]),
        history('nia', 'Nia Prop', [game('f1', { teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1' })]),
        history('ola', 'Ola Bench', [
          game('f1', { teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1', starter: false, played: true }),
        ]),
      ],
      [result('f1')],
    );

    expect(snapshot.gaps.map((gap) => [gap.teamName, gap.kind])).toEqual([
      ['Rocky Gorge MD1', 'no-substitutions'],
    ]);
  });

  it('ignores fixtures dated after the snapshot, which can carry placeholder scores', () => {
    const snapshot = buildParticipationSnapshot(
      [history('sam', 'Sam Hooker', [game('f1')]), history('nia', 'Nia Prop', [game('f1', { teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1', starter: true })])],
      [result('f1'), result('later', { dateTime: '2026-11-14T18:00:00Z' })],
      new Date('2026-11-06T00:00:00Z'),
    );

    expect(snapshot.gaps).toEqual([]);
  });

  describe('a forfeit (Reg 3.4(h))', () => {
    const forfeit = (homeScore: string, awayScore: string) =>
      result('f1', {
        status: 'Forfeit',
        homeTeam: { name: 'Rocky Gorge MD1', score: homeScore },
        awayTeam: { name: 'NOVA MD1', score: awayScore },
      });
    const histories = [
      history('sam', 'Sam Hooker', [game('f1')]),
      history('kim', 'Kim Lock', [game('f1', { starter: false, played: false })]),
      history('lee', 'Lee Prop', [game('f1', { teamName: 'NOVA MD1', opponent: 'Rocky Gorge MD1' })]),
    ];

    it("counts the non-forfeiting side's rostered players, starters and replacements", () => {
      const snapshot = buildParticipationSnapshot(histories, [forfeit('49', '0')]);

      expect(snapshot.rows.map((row) => [row.playerId, row.played, row.substitute])).toEqual([
        ['kim', 0, 1],
        ['sam', 1, 0],
      ]);
      expect(snapshot.gaps).toEqual([]);
    });

    it('gives the forfeiting side nothing, whichever side forfeited', () => {
      const snapshot = buildParticipationSnapshot(histories, [forfeit('0', '49')]);

      expect(snapshot.rows.map((row) => row.playerId)).toEqual(['lee']);
    });

    it("flags the non-forfeiting side when it entered no roster, as the match then doesn't count", () => {
      const snapshot = buildParticipationSnapshot([], [forfeit('49', '0')]);

      expect(snapshot.gaps.map((gap) => [gap.teamName, gap.kind])).toEqual([['Rocky Gorge MD1', 'no-lineup']]);
    });

    it('counts nobody when the scores leave the forfeiting side unclear', () => {
      const snapshot = buildParticipationSnapshot(histories, [forfeit('', '')]);

      expect(snapshot.rows).toEqual([]);
      expect(snapshot.gaps).toEqual([]);
    });
  });

  it('records the fixtures it has results for, including ones with gaps', () => {
    const snapshot = buildParticipationSnapshot(
      [history('sam', 'Sam Hooker', [game('with-lineup')])],
      [result('with-lineup'), result('no-lineup'), result('old', { season: '2025/2026' })],
    );

    expect(snapshot.resultIds).toEqual(['no-lineup', 'with-lineup']);
  });

  it('gives identical output whatever order the histories arrive in', () => {
    const histories = [
      history('b', 'B Player', [game('f1')]),
      history('a', 'A Player', [game('f1')]),
    ];
    const results = [result('f1')];

    expect(buildParticipationSnapshot([...histories].reverse(), results)).toEqual(
      buildParticipationSnapshot(histories, results),
    );
  });
});
