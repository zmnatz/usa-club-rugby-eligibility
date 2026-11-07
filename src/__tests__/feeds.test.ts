import { describe, expect, it } from 'vitest';
import {
  clubIdsFromMatches,
  currentSeason,
  type FeedFixture,
  fetchFeed,
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

describe('fetchFeed', () => {
  const pageOf = (season: string, count = 100) =>
    Array.from({ length: count }, (_, i) => fixture(`${season}-${i}`, { season }));

  it('stops at the first page with nothing from the seasons being read, and keeps only those seasons', async () => {
    const pages = [pageOf('2026/2027'), [...pageOf('2026/2027', 50), ...pageOf('2025/2026', 50)], pageOf('2025/2026'), pageOf('2024/2025')];
    const requested: number[] = [];
    const feed = await fetchFeed({ id: 1, type: 'council' }, '2026/2027', async (_, skip) => {
      requested.push(skip);
      return pages[skip / 100];
    });
    expect(requested).toEqual([0, 100, 200]);
    expect(feed).toHaveLength(150);
    expect(feed.every((f) => f.season === '2026/2027')).toBe(true);
  });

  it('reads to the end when every season is wanted', async () => {
    const pages = [pageOf('2026/2027'), pageOf('2025/2026', 30)];
    const feed = await fetchFeed({ id: 1, type: 'council' }, '', async (_, skip) => pages[skip / 100]);
    expect(feed).toHaveLength(130);
  });
});
