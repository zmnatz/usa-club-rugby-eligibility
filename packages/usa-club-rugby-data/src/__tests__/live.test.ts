import { describe, expect, it } from 'vitest';
import { listClubs } from '../clubFixtures.ts';
import { leagueResults, loadClubRecord } from '../live.ts';
import type { MatchCentreData } from '../playerHistory.ts';
import { buildParticipationSnapshot, type ParticipationSnapshot } from '../snapshot.ts';
import { SEASON, game, history, baseConfig, row, fixtureOf } from './participationFixtures.ts';

describe('loadClubRecord', () => {
  const NOW = new Date('2026-11-06T12:00:00Z');
  const [club] = listClubs([fixtureOf('NOVA MD1', 'NOVA MD3')], baseConfig);

  const scheduled = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    compId: 'comp',
    compName: 'MAC Men D1',
    season: SEASON,
    dateTime: '2026-10-17T17:00:00Z',
    round: 'Round 4',
    status: 'Result',
    sourceType: '2',
    homeTeam: { name: 'NOVA MD1', score: '' },
    awayTeam: { name: 'Rocky Gorge MD1', score: '' },
    ...overrides,
  });

  const matchFor = (id: string, score = '10') => ({
    fixture: {
      id,
      compId: 'comp',
      compName: 'MAC Men D1',
      season: SEASON,
      dateTime: '2026-10-17T17:00:00Z',
      venue: '',
      homeTeam: { id: 'h', name: 'NOVA MD1', teamId: 'h', score, crest: '' },
      awayTeam: { id: 'a', name: 'Rocky Gorge MD1', teamId: 'a', score, crest: '' },
    },
    commentary: [],
    players: [{ id: 'sam__1', name: 'Sam Hooker', position: '1', shirtNumber: '1', isHome: true }],
    substitutes: [],
    coaches: [],
  });

  const saved: ParticipationSnapshot = {
    season: SEASON,
    generatedAt: '2026-10-01T06:00:00.000Z',
    rows: [row({ teamName: 'NOVA MD1', played: 3 })],
    gaps: [],
  };

  const deps = (overrides = {}) => ({
    live: true,
    now: NOW,
    fixtures: [scheduled('f1')],
    fetchMatch: async (fixture: { id: string }) => matchFor(fixture.id),
    loadSaved: async () => null,
    pullOptions: { gapMs: 0, retryDelayMs: 0 },
    ...overrides,
  });

  it("pulls the club's played fixtures live, using the results it finds", async () => {
    const fetched: string[] = [];
    const record = await loadClubRecord(
      club,
      deps({
        fixtures: [
          scheduled('mine'),
          scheduled('other-club', { homeTeam: { name: 'Washington MD1', score: '' } }),
          scheduled('upcoming', { dateTime: '2026-11-14T17:00:00Z' }),
          scheduled('last-season', { season: '2025/2026' }),
        ],
        fetchMatch: async (fixture: { id: string }) => {
          fetched.push(fixture.id);
          return matchFor(fixture.id);
        },
      }),
    );

    expect(fetched).toEqual(['mine']);
    expect(record.source).toBe('live');
    expect(record.asOf).toBe(NOW.toISOString());
    expect(record.snapshot.season).toBe(SEASON);
    expect(record.snapshot.rows).toMatchObject([
      { playerId: 'sam', teamName: 'NOVA MD1', played: 1, rounds: { mine: 'Start' } },
    ]);
  });

  it('does not count a lineup posted for a match with no score yet', async () => {
    const record = await loadClubRecord(
      club,
      deps({ fetchMatch: async (fixture: { id: string }) => matchFor(fixture.id, '') }),
    );

    expect(record.snapshot.rows).toEqual([]);
    expect(record.snapshot.gaps).toEqual([]);
  });

  it('flags a scored fixture when the live pull finds no lineup', async () => {
    const record = await loadClubRecord(
      club,
      deps({
        fixtures: [scheduled('f1', {
          homeTeam: { name: 'NOVA MD1', score: '10' },
          awayTeam: { name: 'Rocky Gorge MD1', score: '5' },
        })],
        fetchMatch: async () => null,
      }),
    );

    expect(record.snapshot.gaps.filter((gap) => gap.teamName === 'NOVA MD1')).toMatchObject([
      { kind: 'no-lineup', fixtureId: 'f1' },
    ]);
  });

  it('fetches a forfeit, as its roster can count', async () => {
    const fetched: string[] = [];
    await loadClubRecord(
      club,
      deps({
        fixtures: [scheduled('f1', { status: 'Forfeit' })],
        fetchMatch: async (fixture: { id: string }) => {
          fetched.push(fixture.id);
          return null;
        },
      }),
    );

    expect(fetched).toEqual(['f1']);
  });

  it('stops pulling at the first failure so the fallback is quick', async () => {
    const fetched: string[] = [];
    const record = await loadClubRecord(
      club,
      deps({
        fixtures: [scheduled('first'), scheduled('second'), scheduled('third')],
        loadSaved: async () => saved,
        pullOptions: { gapMs: 0, retryDelayMs: 0, concurrency: 1 },
        fetchMatch: async (fixture: { id: string }) => {
          fetched.push(fixture.id);
          throw new Error('Request failed: 429');
        },
      }),
    );

    expect(fetched).toEqual(['first']);
    expect(record.liveFailed).toBe(true);
  });

  it("uses the latest season that has started, not one that's only scheduled", async () => {
    const record = await loadClubRecord(
      club,
      deps({
        fixtures: [
          scheduled('current'),
          scheduled('next-season', { season: '2027/2028', dateTime: '2027-09-01T17:00:00Z' }),
        ],
      }),
    );

    expect(record.snapshot.season).toBe(SEASON);
    expect(record.snapshot.rows).toHaveLength(1);
  });

  it('falls back to the saved snapshot when the live pull fails, and says so', async () => {
    const record = await loadClubRecord(
      club,
      deps({
        loadSaved: async () => saved,
        fetchMatch: async () => {
          throw new Error('Request failed: 429');
        },
      }),
    );

    expect(record.source).toBe('saved');
    expect(record.liveFailed).toBe(true);
    expect(record.asOf).toBe(saved.generatedAt);
    expect(record.snapshot).toBe(saved);
  });

  it('fails when the live pull fails and the saved snapshot lacks the club', async () => {
    await expect(
      loadClubRecord(
        club,
        deps({
          fetchMatch: async () => {
            throw new Error('Request failed: 429');
          },
          loadSaved: async () => ({ ...saved, rows: [row({ teamName: 'Other MD1' })] }),
        }),
      ),
    ).rejects.toThrow(/NOVA/);
  });

  describe('with a saved snapshot covering both sides', () => {
    const bothSides: ParticipationSnapshot = {
      season: SEASON,
      generatedAt: '2026-10-20T06:00:00.000Z',
      resultIds: ['old'],
      rows: [
        row({ playerId: 'sam', teamName: 'NOVA MD1', appearances: 2, played: 2, rounds: { old: 'Start', older: 'Start' } }),
        row({ playerId: 'other', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      ],
      gaps: [],
    };
    const pulling = (
      fetched: string[],
      makeMatch: (fixture: { id: string }) => MatchCentreData | null = (fixture) => matchFor(fixture.id),
    ) => async (fixture: { id: string }) => {
      fetched.push(fixture.id);
      return makeMatch(fixture);
    };

    const rival = {
      id: 'rival__1',
      name: 'Rival Prop',
      position: '1',
      shirtNumber: '1',
      isHome: false,
    };

    const gapOf = (
      overrides: Partial<ParticipationSnapshot['gaps'][number]> = {},
    ): ParticipationSnapshot['gaps'][number] => ({
      kind: 'no-lineup',
      fixtureId: 'old',
      teamName: 'NOVA MD1',
      opponent: 'Rocky Gorge MD1',
      competition: 'MAC Men D1',
      dateTime: '2026-10-03T17:00:00Z',
      ...overrides,
    });

    const savedWithGap = (
      gap: ParticipationSnapshot['gaps'][number],
      rows: ParticipationSnapshot['rows'] = [
        row({ playerId: 'sam', teamName: 'NOVA MD1' }),
        row({ playerId: 'other', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      ],
    ): ParticipationSnapshot => ({ ...bothSides, resultIds: ['old'], rows, gaps: [gap] });

    const scoredOld = {
      dateTime: '2026-10-03T17:00:00Z',
      homeTeam: { name: 'NOVA MD1', score: '10' },
      awayTeam: { name: 'Rocky Gorge MD1', score: '5' },
    };

    it('makes no requests when every played fixture already has a result', async () => {
      const fetched: string[] = [];
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', { dateTime: '2026-10-03T17:00:00Z' })],
          loadSaved: async () => bothSides,
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual([]);
      expect(record).toMatchObject({ source: 'saved', liveFailed: false, asOf: bothSides.generatedAt });
      expect(record.snapshot).toBe(bothSides);
    });

    it('skips postponed fixtures, which have nothing to fetch', async () => {
      const fetched: string[] = [];
      await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('moved', { status: 'Postponed' })],
          loadSaved: async () => bothSides,
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual([]);
    });

    it('fetches only fixtures with no result yet, however old, and adds them to the saved totals', async () => {
      const fetched: string[] = [];
      const record = await loadClubRecord(
        club,
        deps({
          // 'new' kicked off before the snapshot was written, but its result came later.
          fixtures: [scheduled('old', { dateTime: '2026-10-03T17:00:00Z' }), scheduled('new')],
          loadSaved: async () => bothSides,
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual(['new']);
      expect(record).toMatchObject({ source: 'live', asOf: NOW.toISOString() });
      expect(record.snapshot.rows.find((item) => item.playerId === 'sam')).toMatchObject({
        appearances: 3,
        played: 3,
        rounds: { old: 'Start', older: 'Start', new: 'Start' },
      });
      expect(record.snapshot.rows.find((item) => item.playerId === 'other')).toMatchObject({ played: 1 });
    });

    it('keeps saved gaps for fixtures absent from the fixture list and adds new ones', async () => {
      const savedGap = gapOf();
      const fetched: string[] = [];
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [
            scheduled('new', {
              homeTeam: { name: 'NOVA MD1', score: '10' },
              awayTeam: { name: 'Rocky Gorge MD1', score: '5' },
            }),
          ],
          loadSaved: async () => ({ ...bothSides, gaps: [savedGap] }),
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual(['new']);
      expect(record.snapshot.gaps).toEqual([savedGap, expect.objectContaining({ fixtureId: 'new' })]);
    });

    it('re-pulls a saved gap and replaces that result instead of counting it twice', async () => {
      const fetched: string[] = [];
      const staleResult = savedWithGap(gapOf(), [
        row({
          playerId: 'sam',
          teamName: 'NOVA MD1',
          appearances: 2,
          played: 2,
          rounds: { old: 'Start', older: 'Start' },
        }),
        row({ playerId: 'other', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      ]);
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', scoredOld)],
          loadSaved: async () => staleResult,
          fetchMatch: pulling(fetched, (fixture) => {
            const match = matchFor(fixture.id);
            return { ...match, players: [...match.players, rival] };
          }),
        }),
      );

      expect(fetched).toEqual(['old']);
      expect(record).toMatchObject({ source: 'live', asOf: NOW.toISOString() });
      expect(record.snapshot.resultIds).toEqual(['old']);
      expect(record.snapshot.gaps).toEqual([]);
      expect(record.snapshot.rows.find((item) => item.playerId === 'sam')).toMatchObject({
        appearances: 2,
        played: 2,
        substitute: 0,
        rounds: { older: 'Start', old: 'Start' },
      });
      expect(record.snapshot.rows.find((item) => item.playerId === 'other')).toMatchObject({ played: 1 });
    });

    it('re-pulls a no-substitutions gap when a substitute came on in the CMS', async () => {
      const fetched: string[] = [];
      const staleResult = savedWithGap(gapOf({ kind: 'no-substitutions', rostered: 1 }), [
        row({ playerId: 'sam', teamName: 'NOVA MD1', appearances: 1, played: 1, rounds: { old: 'Start' } }),
        row({ playerId: 'other', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      ]);
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', scoredOld)],
          loadSaved: async () => staleResult,
          fetchMatch: pulling(fetched, (fixture) => {
            const match = matchFor(fixture.id);
            return {
              ...match,
              players: [...match.players, rival],
              substitutes: [
                { id: 'sub__1', name: 'Tess Sub', position: '9', shirtNumber: '20', isHome: true },
              ],
              commentary: [
                {
                  id: 'substitution',
                  minute: '60',
                  type: 'Substitution - Tactical',
                  comment: 'Substitution - Tactical Off: Sam Hooker, On: Tess Sub',
                },
              ],
            };
          }),
        }),
      );

      expect(fetched).toEqual(['old']);
      expect(record.snapshot.gaps).toEqual([]);
      expect(record.snapshot.rows.find((item) => item.playerId === 'sam')).toMatchObject({
        appearances: 1,
        played: 1,
        substitute: 0,
        rounds: { old: 'Start' },
      });
      expect(record.snapshot.rows.find((item) => item.playerId === 'sub')).toMatchObject({
        playerId: 'sub',
        teamName: 'NOVA MD1',
        appearances: 1,
        played: 0,
        substitute: 1,
        rounds: { old: 'Sub' },
      });
      expect(record.snapshot.rows.find((item) => item.playerId === 'other')).toMatchObject({ played: 1 });
    });

    it('reports a saved gap again when the CMS still has no correction', async () => {
      const fetched: string[] = [];
      const gap = gapOf();
      const staleResult = savedWithGap(gap);
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', scoredOld)],
          loadSaved: async () => staleResult,
          fetchMatch: pulling(fetched, () => null),
        }),
      );

      expect(fetched).toEqual(['old']);
      expect(record.source).toBe('live');
      expect(record.snapshot.resultIds).toEqual(['old']);
      expect(record.snapshot.gaps).toEqual([gap]);
    });

    it('keeps the saved fixture when the CMS record comes back unscored', async () => {
      const gap = gapOf();
      const staleResult = savedWithGap(gap, [
        row({ playerId: 'sam', teamName: 'NOVA MD1', appearances: 1, played: 1, rounds: { old: 'Start' } }),
        row({ playerId: 'other', teamName: 'NOVA MD3', competition: 'Capital Men D3', played: 1 }),
      ]);
      const fetched: string[] = [];
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', scoredOld)],
          loadSaved: async () => staleResult,
          fetchMatch: pulling(fetched, (fixture) => matchFor(fixture.id, '')),
        }),
      );

      expect(fetched).toEqual(['old']);
      expect(record.snapshot.resultIds).toEqual(['old']);
      expect(record.snapshot.gaps).toEqual([gap]);
      expect(record.snapshot.rows.find((item) => item.playerId === 'sam')).toMatchObject({
        appearances: 1,
        played: 1,
        rounds: { old: 'Start' },
      });
    });

    it('keeps a saved gap when its fixture no longer has a score', async () => {
      const fetched: string[] = [];
      const staleResult = savedWithGap(gapOf());
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old')],
          loadSaved: async () => staleResult,
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual([]);
      expect(record.snapshot).toBe(staleResult);
    });

    it('falls back to the saved gap when a re-pull fails', async () => {
      const staleResult = savedWithGap(gapOf());
      const record = await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', scoredOld)],
          loadSaved: async () => staleResult,
          fetchMatch: async () => {
            throw new Error('Request failed: 429');
          },
        }),
      );

      expect(record).toMatchObject({ source: 'saved', liveFailed: true, asOf: staleResult.generatedAt });
      expect(record.snapshot).toBe(staleResult);
    });

    it('pulls everything when the snapshot is from another season', async () => {
      const fetched: string[] = [];
      await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', { dateTime: '2026-10-03T17:00:00Z' })],
          loadSaved: async () => ({ ...bothSides, season: '2025/2026' }),
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual(['old']);
    });

    it('pulls everything when the snapshot is missing a side', async () => {
      const fetched: string[] = [];
      await loadClubRecord(
        club,
        deps({
          fixtures: [scheduled('old', { dateTime: '2026-10-03T17:00:00Z' })],
          loadSaved: async () => ({ ...bothSides, rows: [bothSides.rows[0]] }),
          fetchMatch: pulling(fetched),
        }),
      );

      expect(fetched).toEqual(['old']);
    });

    it('still pulls live when the snapshot cannot be loaded', async () => {
      const record = await loadClubRecord(
        club,
        deps({
          loadSaved: async () => {
            throw new Error('network');
          },
        }),
      );

      expect(record.source).toBe('live');
    });
  });

  it('uses only the saved snapshot outside live mode', async () => {
    const record = await loadClubRecord(
      club,
      deps({
        live: false,
        loadSaved: async () => saved,
        fetchMatch: async () => {
          throw new Error('should not fetch');
        },
      }),
    );

    expect(record).toMatchObject({ source: 'saved', liveFailed: false });
  });
});

describe('leagueResults', () => {
  const NOW = new Date('2026-11-06T12:00:00Z');
  const scheduled = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    compId: 'd2',
    compName: 'Capital Men D2',
    season: SEASON,
    dateTime: '2026-10-17T17:00:00Z',
    status: 'Result',
    sourceType: '2',
    homeTeam: { name: 'James River MD2', score: '10' },
    awayTeam: { name: 'Raleigh MD2', score: '5' },
    ...overrides,
  });

  it('keeps every side\'s played fixtures, in any competition or season, and nothing else', () => {
    const unscored = {
      homeTeam: { name: 'James River MD2', score: '' },
      awayTeam: { name: 'Raleigh MD2', score: '' },
    };
    const results = leagueResults(
      [
        scheduled('d2-result'),
        scheduled('women', { compName: 'Atlantic Women D1' }),
        scheduled('sevens', { compName: 'MAC 7s - Rites of Summer' }),
        scheduled('last-season', { season: '2025/2026', dateTime: '2025-10-17T17:00:00Z' }),
        scheduled('not-played', unscored),
        scheduled('upcoming-placeholder', { dateTime: '2026-11-14T17:00:00Z' }),
      ],
      NOW,
    );

    expect(results.map((fixture) => fixture.id)).toEqual(['d2-result', 'women', 'sevens', 'last-season']);
  });

  it('gives every side rows, and a gap when it has no lineup', () => {
    const [withLineup, withoutLineup] = leagueResults(
      [scheduled('f1'), scheduled('f2', { dateTime: '2026-10-24T17:00:00Z' })],
      NOW,
    );
    const snapshot = buildParticipationSnapshot(
      [
        history('jo', 'Jo Prop', [
          game('f1', { compName: 'Capital Men D2', teamName: 'James River MD2', opponent: 'Raleigh MD2' }),
        ]),
        history('al', 'Al Lock', [
          game('f1', { compName: 'Capital Men D2', teamName: 'Raleigh MD2', opponent: 'James River MD2' }),
        ]),
      ],
      [withLineup, withoutLineup],
      NOW,
    );

    expect(snapshot.rows.map((row) => [row.teamName, row.played])).toEqual([
      ['James River MD2', 1],
      ['Raleigh MD2', 1],
    ]);
    expect(snapshot.gaps.map((gap) => [gap.fixtureId, gap.teamName, gap.kind])).toEqual([
      ['f2', 'James River MD2', 'no-lineup'],
      ['f2', 'Raleigh MD2', 'no-lineup'],
    ]);
  });
});
