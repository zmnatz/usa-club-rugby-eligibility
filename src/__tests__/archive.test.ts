import { describe, expect, it } from 'vitest';
import eligibility from '@config/eligibility.yml';
import {
  type ArchiveManifest,
  buildPublished,
  fetchMatchRecords,
  matchesToRead,
  parseSeasonFixtures,
  parseSeasonMatches,
  refreshFrom,
  seasonFile,
  serializeSeasonFixtures,
  serializeSeasonMatches,
} from '@/utils/archive';
import type { FeedFixture } from '@/utils/feeds';
import type { MatchCentreData } from '@/utils/playerHistory';

const NOW = new Date('2026-11-07T12:00:00Z');
const manifest = (overrides: Partial<ArchiveManifest> = {}): ArchiveManifest => ({
  fields: 'abc',
  currentSeason: '2026/2027',
  seasons: ['2024/2025', '2025/2026', '2026/2027'],
  clubIds: [],
  ...overrides,
});

describe('refreshFrom', () => {
  it('reads only the current season on a normal night, so past seasons stay locked', () => {
    expect(refreshFrom(manifest(), '2026/2027', { fields: 'abc' })).toBe('2026/2027');
  });

  it('gives the season saved as current a last read as the next one begins', () => {
    expect(refreshFrom(manifest(), '2027/2028', { fields: 'abc' })).toBe('2026/2027');
  });

  it('re-reads every archived season when the fields requested change', () => {
    expect(refreshFrom(manifest(), '2026/2027', { fields: 'new' })).toBe('2024/2025');
  });

  it('reads every season the feeds list on a full-history run', () => {
    expect(refreshFrom(manifest(), '2026/2027', { fields: 'abc', fullHistory: true })).toBe('');
  });

  it('starts a new archive with the latest season only', () => {
    expect(refreshFrom(null, '2026/2027', { fields: 'abc' })).toBe('2026/2027');
  });
});

function fixture(id: string, overrides: Partial<FeedFixture> = {}): FeedFixture {
  return {
    id,
    compId: 'c1',
    compName: 'Capital Men D3',
    season: '2026/2027',
    dateTime: '2026-10-01T15:00:00Z',
    round: 'Round 1',
    status: 'Result',
    sourceType: '2',
    homeTeam: { name: 'NOVA MD3', score: '10' },
    awayTeam: { name: 'Potomac MD3', score: '12' },
    ...overrides,
  };
}

describe('matchesToRead', () => {
  it('reads played matches and forfeits in the refreshed seasons, not future fixtures or locked seasons', () => {
    const fixtures = [
      fixture('played'),
      fixture('forfeit', { status: 'Forfeit' }),
      fixture('upcoming', { dateTime: '2026-12-01T15:00:00Z', homeTeam: { name: 'A MD3', score: '' }, awayTeam: { name: 'B MD3', score: '' } }),
      fixture('locked', { season: '2025/2026' }),
    ];
    expect(matchesToRead(fixtures, '2026/2027', NOW).map((f) => f.id)).toEqual(['played', 'forfeit']);
  });
});

describe('season files', () => {
  it('names a file from a season', () => {
    expect(seasonFile('2026/2027')).toBe('2026-2027.json');
  });

  it('writes a match per line in id order, so a night only changes the lines that changed', () => {
    const text = serializeSeasonMatches('2026/2027', { b: null, a: null });
    expect(text).toBe('{"season":"2026/2027","matches":{\n"a":null,\n"b":null\n}}\n');
    expect(parseSeasonMatches(text)).toEqual({ a: null, b: null });
  });

  it('reads back the fixtures it writes', () => {
    const fixtures = [fixture('m2'), fixture('m1')];
    const text = serializeSeasonFixtures('2026/2027', fixtures);
    expect(text.split('\n')).toHaveLength(5);
    expect(parseSeasonFixtures(text).map((f) => f.id)).toEqual(['m1', 'm2']);
  });
});

describe('fetchMatchRecords', () => {
  const fixtures = ['a', 'b', 'c'].map((id) => fixture(id));

  it('asks for matches in batches and keeps a match the CMS has no record for as null', async () => {
    const batches: string[][] = [];
    const records = await fetchMatchRecords(fixtures, {
      batchSize: 2,
      fetchBatch: async (batch) => {
        batches.push(batch.map((f) => f.id));
        return new Map(batch.map((f) => [f.id, null]));
      },
    });
    expect(batches).toEqual([['a', 'b'], ['c']]);
    expect([...records.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('asks again a match at a time when a batch is rejected', async () => {
    const one: string[] = [];
    const records = await fetchMatchRecords(fixtures, {
      fetchBatch: async () => {
        throw new Error('batch rejected');
      },
      fetchOne: async (f) => {
        one.push(f.id);
        return null;
      },
    });
    expect(one.sort()).toEqual(['a', 'b', 'c']);
    expect(records.size).toBe(3);
  });
});

describe('buildPublished', () => {
  const player = (id: string, name: string, isHome: boolean) => ({ id: `${id}__1`, name, position: 'Prop', shirtNumber: '1', isHome });
  const match = (f: FeedFixture, home: string[], away: string[]): MatchCentreData => ({
    fixture: {
      id: f.id,
      compId: f.compId,
      compName: f.compName,
      dateTime: f.dateTime,
      season: f.season,
      venue: '',
      homeTeam: { id: '', teamId: '', crest: '', name: f.homeTeam.name, score: f.homeTeam.score },
      awayTeam: { id: '', teamId: '', crest: '', name: f.awayTeam.name, score: f.awayTeam.score },
    },
    commentary: [],
    players: [...home.map((id) => player(id, `Home ${id}`, true)), ...away.map((id) => player(id, `Away ${id}`, false))],
    substitutes: [],
    coaches: [],
  });

  it("writes each club's own rows, gaps and results from the archived matches alone", () => {
    const played = fixture('m1');
    const noLineup = fixture('m2', { dateTime: '2026-10-08T15:00:00Z' });
    const data = buildPublished([played, noLineup], [match(played, ['p1'], ['p2'])], eligibility, NOW);

    expect(data.season).toBe('2026/2027');
    expect(data.clubs.map((club) => club.key)).toEqual(['nova', 'potomac']);
    const nova = data.clubFiles.nova;
    expect(nova.resultIds).toEqual(['m1', 'm2']);
    expect(nova.rows.map((row) => [row.playerId, row.teamName, row.played])).toEqual([['p1', 'NOVA MD3', 1]]);
    expect(nova.gaps.map((gap) => [gap.fixtureId, gap.kind])).toEqual([['m2', 'no-lineup']]);
    expect(data.clubFiles.potomac.rows.map((row) => row.playerId)).toEqual(['p2']);
  });

  it('numbers two clubs whose names make the same file name', () => {
    const f = fixture('m1', { homeTeam: { name: 'St. Louis MD3', score: '5' }, awayTeam: { name: 'St Louis MD3', score: '7' } });
    expect(buildPublished([f], [], eligibility, NOW).clubs.map((club) => club.key)).toEqual(['st-louis', 'st-louis-2']);
  });
});
