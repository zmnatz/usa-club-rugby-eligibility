import { describe, expect, it } from 'vitest';
import type { PublishedClubFile, PublishedFixturesFile, PublishedIndexFile } from '../data.ts';
import type { FeedFixture } from '../feeds.ts';
import { clubEligibility, createPublishedClient, type PublishedIndex } from '../published.ts';
import type { ParticipationSnapshot } from '../participation.ts';

const index: PublishedIndex = {
  generatedAt: '2026-11-07T00:00:00.000Z',
  season: '2026/2027',
  clubs: [
    {
      key: 'nova',
      name: 'NOVA',
      sides: [
        { teamName: 'NOVA MD1', label: 'D1' },
        { teamName: 'NOVA MD2', label: 'D2' },
      ],
    },
  ],
};

const row = (playerId: string, firstName: string, teamName: string, played: number) => ({
  playerId,
  firstName,
  lastName: 'Test',
  lastRegistered: '',
  teamName,
  competition: 'Capital Men D1',
  appearances: played,
  played,
  substitute: 0,
  rounds: {},
});

const snapshot: ParticipationSnapshot = {
  season: '2026/2027',
  rows: [row('p1', 'Ann', 'NOVA MD1', 3), row('p2', 'Bob', 'NOVA MD2', 1)],
  gaps: [],
};

function server(files: Record<string, unknown>) {
  const requested: string[] = [];
  const fetcher = (async (url: string) => {
    requested.push(url);
    const file = url.replace('https://example.test/data/', '');
    return file in files
      ? { ok: true, status: 200, json: async () => files[file] }
      : { ok: false, status: 404, json: async () => ({}) };
  }) as unknown as typeof fetch;
  return { fetcher, requested };
}

const files = { 'index.json': index, 'fixtures.json': { fixtures: [] as FeedFixture[] }, 'clubs/nova.json': snapshot };

describe('createPublishedClient', () => {
  it('lists every team of every club with its parsed division', async () => {
    const { fetcher } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data/', fetch: fetcher });
    const teams = await client.teams();
    expect(teams.map((team) => [team.clubKey, team.teamName, team.label, team.side?.level])).toEqual([
      ['nova', 'NOVA MD1', 'D1', 1],
      ['nova', 'NOVA MD2', 'D2', 2],
    ]);
  });

  it("gives each player a verdict on every one of the club's sides", async () => {
    const { fetcher } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    const players = await client.players('nova', { now: new Date('2026-11-07T00:00:00Z') });
    const verdict = (name: string, side: string) =>
      players.find((p) => p.firstName === name && p.sideLabel === side)?.eligible;
    expect(players).toHaveLength(4);
    expect(verdict('Ann', 'D1')).toBe(true);
    expect(verdict('Bob', 'D2')).toBe(false);
  });

  it("gives a player's verdict on every club side they're listed on, with the fixtures behind it", async () => {
    const { fetcher, requested } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    const profile = await client.player('p1', { now: new Date('2026-11-07T00:00:00Z') });
    expect(profile?.name).toBe('Ann Test');
    expect(profile?.clubs.map((entry) => [entry.clubKey, entry.sideLabel, entry.player.eligible])).toEqual([
      ['nova', 'D1', true],
      ['nova', 'D2', false],
    ]);
    // Each side's rounds, the player's own side first, and no raw rows kept.
    expect(profile?.clubs[1].fixtures.sides.map((side) => side.teamName)).toEqual(['NOVA MD2', 'NOVA MD1']);
    expect(profile?.clubs[0].player.rows).toEqual([]);
    expect(requested.sort()).toEqual([
      'https://example.test/data/clubs/nova.json',
      'https://example.test/data/fixtures.json',
      'https://example.test/data/index.json',
    ]);
  });

  it('has no profile for a player that is not in the published index', async () => {
    const { fetcher } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    expect(await client.player('nobody')).toBeNull();
  });

  it('reads each file once however many calls need it', async () => {
    const { fetcher, requested } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    await Promise.all([client.players('nova'), client.eligibility('nova'), client.teams()]);
    expect(requested.sort()).toEqual([
      'https://example.test/data/clubs/nova.json',
      'https://example.test/data/fixtures.json',
      'https://example.test/data/index.json',
    ]);
  });

  it('says so when a club is not published', async () => {
    const { fetcher } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    await expect(client.club('nobody')).rejects.toThrow('No club "nobody"');
  });

  it('is a pure function of its inputs, so the same data gives the same verdicts', () => {
    const now = new Date('2026-11-07T00:00:00Z');
    expect(clubEligibility(snapshot, [], index.clubs[0], { now })).toEqual(
      clubEligibility(snapshot, [], index.clubs[0], { now }),
    );
  });
});

describe('data file types', () => {
  it('describe the files the client reads', async () => {
    const { fetcher } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    const clubFile: PublishedClubFile = { ...snapshot, generatedAt: index.generatedAt };
    const fixturesFile: PublishedFixturesFile = { season: index.season, fixtures: [] };
    const indexFile: PublishedIndexFile = index;
    expect([clubFile.rows.length, fixturesFile.fixtures.length, indexFile.clubs.length]).toEqual([2, 0, 1]);
    expect((await client.club('nova')).snapshot.season).toBe(snapshot.season);
  });
});

describe('a Locked Season', () => {
  it('reads the one file that season is published as', async () => {
    const file = { season: '2024/2025', slug: '2024-25', clubs: [], fixtures: [], clubFiles: {}, unplacedTeams: [] };
    const asked: string[] = [];
    const client = createPublishedClient({
      baseUrl: 'https://example.test/data/',
      fetch: (async (url: string) => {
        asked.push(url);
        return new Response(JSON.stringify(file));
      }) as unknown as typeof fetch,
    });
    expect(await client.season('2024-25')).toEqual(file);
    expect(asked).toEqual(['https://example.test/data/seasons/2024-25.json']);
  });
});
