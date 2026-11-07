import { describe, expect, it } from 'vitest';
import {
  clubIdsFromMatches,
  currentSeason,
  type FeedFixture,
  type FeedPageRequest,
  fetchFeeds,
  keepCompetitions,
  mergeFeeds,
} from '@/utils/feeds';
import type { MatchCentreData } from '@/utils/playerHistory';

const NOW = new Date('2026-11-07T12:00:00Z');

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
    awayTeam: { name: 'Rocky Gorge MD3', score: '12' },
    ...overrides,
  };
}

describe('mergeFeeds', () => {
  it("dedupes by fixture id, keeping the earlier feed's copy", () => {
    const merged = mergeFeeds([[fixture('a', { round: 'council' })], [fixture('a', { round: 'club' }), fixture('b')]]);
    expect(merged.map((f) => [f.id, f.round])).toEqual([
      ['a', 'council'],
      ['b', 'Round 1'],
    ]);
  });
});

describe('keepCompetitions', () => {
  it("drops a club feed's matches outside the council and union competitions", () => {
    const feed = [fixture('league'), fixture('college', { compId: 'c9', compName: 'NCR D1A' })];
    expect(keepCompetitions(feed, new Set(['c1'])).map((f) => f.id)).toEqual(['league']);
  });
});

describe('clubIdsFromMatches', () => {
  it("reads each side's club from its crest, skipping placeholders", () => {
    const match = (home: string, away: string) =>
      ({
        fixture: { homeTeam: { crest: home }, awayTeam: { crest: away } },
      }) as unknown as MatchCentreData;
    expect(
      clubIdsFromMatches([
        match('https://x.cloudfront.net/ru/team/91204.png?v=1', 'https://y.cloudfront.net/NonVideo/abc.png'),
        match('https://x.cloudfront.net/ru/team/91102.png', 'https://x.cloudfront.net/ru/team/91204.png'),
      ]),
    ).toEqual([91102, 91204]);
  });
});

describe('currentSeason', () => {
  it('is the latest season with a result, not one only scheduled', () => {
    expect(
      currentSeason(
        [
          fixture('old', { season: '2025/2026' }),
          fixture('now'),
          fixture('next', { season: '2027/2028', dateTime: '2027-09-01T15:00:00Z', homeTeam: { name: 'A MD1', score: '' }, awayTeam: { name: 'B MD1', score: '' } }),
        ],
        NOW,
      ),
    ).toBe('2026/2027');
  });

  it("ignores a placeholder score on a fixture that hasn't happened", () => {
    expect(currentSeason([fixture('later', { season: '2027/2028', dateTime: '2027-09-01T15:00:00Z' })], NOW)).toBe('');
  });
});

describe('fetchFeeds', () => {
  const pageOf = (prefix: string, season: string, count = 100) =>
    Array.from({ length: count }, (_, i) => fixture(`${prefix}-${season}-${i}`, { season }));
  type Lists = Record<string, { results: FeedFixture[][]; fixtures: FeedFixture[][] }>;
  const serve = (lists: Lists, asked: string[][]) => async (batch: FeedPageRequest[]) => {
    asked.push(batch.map(({ source, list, skip }) => `${source.id} ${list}@${skip}`));
    return batch.map(({ source, list, skip, limit }) => lists[source.id][list][skip / limit] ?? []);
  };

  it("reads results back to the first page from an earlier season, since they come newest first", async () => {
    const asked: string[][] = [];
    const [feed] = await fetchFeeds([{ id: 1, type: 'council' }], '2026/2027', {
      fetchPages: serve(
        {
          1: {
            results: [pageOf('r', '2026/2027'), [...pageOf('r2', '2026/2027', 50), ...pageOf('r2', '2025/2026', 50)], pageOf('r3', '2025/2026'), pageOf('r4', '2024/2025')],
            fixtures: [],
          },
        },
        asked,
      ),
    });
    expect(asked.flat()).toEqual(['1 results@0', '1 fixtures@0', '1 results@100', '1 results@200']);
    expect(feed).toHaveLength(150);
    expect(feed.every((f) => f.season === '2026/2027')).toBe(true);
  });

  it("reads fixtures to the end of the list, since they come soonest first and an early page can be last season's", async () => {
    const asked: string[][] = [];
    const [feed] = await fetchFeeds([{ id: 2, type: 'club' }], '2026/2027', {
      pageSize: 25,
      fetchPages: serve(
        { 2: { results: [], fixtures: [pageOf('f1', '2025/2026', 25), pageOf('f2', '2026/2027', 25), pageOf('f3', '2026/2027', 5)] } },
        asked,
      ),
    });
    expect(asked.flat()).toEqual(['2 results@0', '2 fixtures@0', '2 fixtures@25', '2 fixtures@50']);
    expect(feed).toHaveLength(30);
  });

  it("asks for a page of several lists per request, and only the next page of those that aren't finished", async () => {
    const asked: string[][] = [];
    const feeds = await fetchFeeds(
      [1, 2].map((id) => ({ id, type: 'club' })),
      '2026/2027',
      {
        fetchPages: serve(
          {
            1: { results: [pageOf('one', '2026/2027'), pageOf('one-b', '2026/2027', 20)], fixtures: [pageOf('one-f', '2026/2027', 3)] },
            2: { results: [pageOf('two', '2026/2027', 40)], fixtures: [] },
          },
          asked,
        ),
      },
    );
    expect(asked).toEqual([['1 results@0', '1 fixtures@0', '2 results@0', '2 fixtures@0'], ['1 results@100']]);
    expect(feeds.map((feed) => feed.length)).toEqual([123, 40]);
  });

  it('reads every season when none is given', async () => {
    const [feed] = await fetchFeeds([{ id: 1, type: 'council' }], '', {
      fetchPages: serve({ 1: { results: [pageOf('a', '2026/2027'), pageOf('b', '2025/2026', 30)], fixtures: [] } }, []),
    });
    expect(feed).toHaveLength(130);
  });

  it('asks a page at a time when a batch is rejected', async () => {
    const single: string[] = [];
    const feeds = await fetchFeeds([{ id: 7, type: 'club' }], '2026/2027', {
      fetchPages: async () => {
        throw new Error('batch rejected');
      },
      fetchPage: async (source, skip, _limit, list) => {
        single.push(`${source.id} ${list}@${skip}`);
        return list === 'results' ? pageOf('seven', '2026/2027', 10) : [];
      },
    });
    expect(single).toEqual(['7 results@0', '7 fixtures@0']);
    expect(feeds[0]).toHaveLength(10);
  });

  it('fails when a page still fails one at a time, rather than undercounting', async () => {
    await expect(
      fetchFeeds([{ id: 7, type: 'club' }], '2026/2027', {
        fetchPages: async () => {
          throw new Error('batch rejected');
        },
        fetchPage: async () => {
          throw new Error('page failed');
        },
      }),
    ).rejects.toThrow('page failed');
  });
});
