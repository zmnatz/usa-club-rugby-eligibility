import { describe, expect, it } from 'vitest';
import type { PublishedClubFile, PublishedFixturesFile, PublishedIndexFile } from '../data.ts';
import type { FeedFixture } from '../feeds.ts';
import {
  clubEligibility,
  createPublishedClient,
  httpReader,
  memoryReader,
  MissingPublishedFile,
  type PublishedIndex,
} from '../published.ts';
import { lockedSeasonPlayerIndex } from '../players.ts';
import type { ParticipationSnapshot } from '../snapshot.ts';

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

/** An in-memory reader that remembers what it was asked for. */
function reader(files: Record<string, unknown>) {
  const requested: string[] = [];
  const memory = memoryReader(files);
  const read = (file: string) => {
    requested.push(file);
    return memory(file);
  };
  return { read, requested };
}

const files = { 'index.json': index, 'fixtures.json': { fixtures: [] as FeedFixture[] }, 'clubs/nova.json': snapshot };

describe('createPublishedClient', () => {
  it('lists every team of every club with its parsed division', async () => {
    const client = createPublishedClient({ read: reader(files).read });
    const teams = await client.teams();
    expect(teams.map((team) => [team.clubKey, team.teamName, team.label, team.side?.level])).toEqual([
      ['nova', 'NOVA MD1', 'D1', 1],
      ['nova', 'NOVA MD2', 'D2', 2],
    ]);
  });

  it("gives each player a verdict on every one of the club's sides", async () => {
    const client = createPublishedClient({ read: reader(files).read });
    const players = await client.players('nova', { now: new Date('2026-11-07T00:00:00Z') });
    const verdict = (name: string, side: string) =>
      players.find((p) => p.firstName === name && p.sideLabel === side)?.eligible;
    expect(players).toHaveLength(4);
    expect(verdict('Ann', 'D1')).toBe(true);
    expect(verdict('Bob', 'D2')).toBe(false);
  });

  it("gives a player's verdict on every club side they're listed on, with the fixtures behind it", async () => {
    const { read, requested } = reader(files);
    const client = createPublishedClient({ read });
    const profile = await client.player('p1', { now: new Date('2026-11-07T00:00:00Z') });
    expect(profile?.name).toBe('Ann Test');
    expect(profile?.clubs.map((entry) => [entry.clubKey, entry.sideLabel, entry.player.eligible])).toEqual([
      ['nova', 'D1', true],
      ['nova', 'D2', false],
    ]);
    // Each side's rounds, the player's own side first, and no raw rows kept.
    expect(profile?.clubs[1].fixtures.sides.map((side) => side.teamName)).toEqual(['NOVA MD2', 'NOVA MD1']);
    expect(profile?.clubs[0].player.rows).toEqual([]);
    expect(requested.sort()).toEqual(['clubs/nova.json', 'fixtures.json', 'index.json']);
  });

  it('has no profile for a player that is not in the published index', async () => {
    const client = createPublishedClient({ read: reader(files).read });
    expect(await client.player('nobody')).toBeNull();
  });

  it('reads each file once however many calls need it', async () => {
    const { read, requested } = reader(files);
    const client = createPublishedClient({ read });
    await Promise.all([client.players('nova'), client.eligibility('nova'), client.teams()]);
    expect(requested.sort()).toEqual(['clubs/nova.json', 'fixtures.json', 'index.json']);
  });

  it('says so when a club is not published', async () => {
    const client = createPublishedClient({ read: reader(files).read });
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
    const client = createPublishedClient({ read: reader(files).read });
    const clubFile: PublishedClubFile = { ...snapshot, generatedAt: index.generatedAt };
    const fixturesFile: PublishedFixturesFile = { season: index.season, fixtures: [] };
    const indexFile: PublishedIndexFile = index;
    expect([clubFile.rows.length, fixturesFile.fixtures.length, indexFile.clubs.length]).toEqual([2, 0, 1]);
    expect((await client.club('nova')).snapshot.season).toBe(snapshot.season);
  });
});

describe('a Locked Season', () => {
  const file = { season: '2024/2025', slug: '2024-25', clubs: [], fixtures: [], clubFiles: {}, unplacedTeams: [] };

  it('reads the one file that season is published as', async () => {
    const { read, requested } = reader({ 'seasons/2024-25.json': file });
    expect(await createPublishedClient({ read }).season('2024-25')).toEqual(file);
    expect(requested).toEqual(['seasons/2024-25.json']);
  });

  it('lists the Locked Seasons published', async () => {
    const seasons = [{ season: '2024/2025', slug: '2024-25', clubs: 3, unplacedTeams: 0 }];
    const client = createPublishedClient({ read: memoryReader({ 'seasons.json': { generatedAt: '', seasons } }) });
    expect(await client.seasons()).toEqual(seasons);
  });

  it('lists none before the archive holds one', async () => {
    expect(await createPublishedClient({ read: memoryReader({}) }).seasons()).toEqual([]);
  });
});

describe('a player across Locked Seasons', () => {
  const past = (season: string, slug: string, ids: string[]) => ({
    season,
    slug,
    clubs: index.clubs,
    fixtures: [] as FeedFixture[],
    clubFiles: {
      nova: { ...snapshot, season, rows: ids.map((id, i) => row(id, id === 'p1' ? 'Ann' : 'Bob', 'NOVA MD1', i + 1)) },
    },
    unplacedTeams: [],
  });
  const seasons = [
    { season: '2025/2026', slug: '2025-26', clubs: 1, unplacedTeams: 0 },
    { season: '2024/2025', slug: '2024-25', clubs: 1, unplacedTeams: 0 },
  ];
  const client = () =>
    createPublishedClient({
      read: memoryReader({
        'seasons.json': { generatedAt: '', seasons },
        'seasons/2025-26.json': past('2025/2026', '2025-26', ['p1', 'p2']),
        'seasons/2024-25.json': past('2024/2025', '2024-25', ['p1']),
      }),
    });

  it("gives a player's verdicts in each season they're in, newest first", async () => {
    const found = await client().playerSeasons('p1');
    expect(found.map(({ slug }) => slug)).toEqual(['2025-26', '2024-25']);
    expect(found.every(({ clubs }) => clubs.every((entry) => entry.clubKey === 'nova'))).toBe(true);
    expect(found[0].name).toBe('Ann Test');
  });

  it('skips seasons the player is not in, and gives none for an unknown id', async () => {
    expect((await client().playerSeasons('p2')).map(({ slug }) => slug)).toEqual(['2025-26']);
    expect(await client().playerSeasons('nobody')).toEqual([]);
  });

  it('lists every player in any past season', async () => {
    expect(Object.keys(await client().pastPlayerIds()).sort()).toEqual(['p1', 'p2']);
  });

  it("reads each season's published player index, then only the seasons the player is in", async () => {
    const seasonFiles = {
      'seasons/2025-26.json': past('2025/2026', '2025-26', ['p1', 'p2']),
      'seasons/2024-25.json': past('2024/2025', '2024-25', ['p1']),
    };
    const { read, requested } = reader({
      'seasons.json': { generatedAt: '', seasons },
      ...seasonFiles,
      'seasons/2025-26.players.json': lockedSeasonPlayerIndex(seasonFiles['seasons/2025-26.json']),
      'seasons/2024-25.players.json': lockedSeasonPlayerIndex(seasonFiles['seasons/2024-25.json']),
    });
    const found = await createPublishedClient({ read }).playerSeasons('p2');
    expect(found).toEqual(await client().playerSeasons('p2'));
    expect(requested.sort()).toEqual([
      'seasons.json',
      'seasons/2024-25.players.json',
      'seasons/2025-26.json',
      'seasons/2025-26.players.json',
    ]);
  });
});

describe('player lookups', () => {
  const potomac = { key: 'potomac', name: 'Potomac', sides: [{ teamName: 'Potomac MD1', label: 'D1' }] };
  const twoClubs = {
    ...files,
    'index.json': { ...index, clubs: [...index.clubs, potomac] },
    'clubs/potomac.json': { ...snapshot, rows: [row('p3', 'Cy', 'Potomac MD1', 2)] },
    'players.json': {
      season: index.season,
      players: {
        p1: { name: 'Ann Test', clubs: ['nova'] },
        p2: { name: 'Bob Test', clubs: ['nova'] },
        p3: { name: 'Cy Test', clubs: ['potomac'] },
      },
    },
  };

  it('find a player from the published index and read only the clubs it names', async () => {
    const { read, requested } = reader(twoClubs);
    const client = createPublishedClient({ read });
    expect(await client.playerIndex()).toBe(twoClubs['players.json']);
    const profile = await client.player('p1');
    expect(profile?.clubs.map((entry) => [entry.clubKey, entry.sideLabel])).toEqual([
      ['nova', 'D1'],
      ['nova', 'D2'],
    ]);
    expect(requested.sort()).toEqual(['clubs/nova.json', 'fixtures.json', 'index.json', 'players.json']);
  });

  it('give the same profile from the published index as from working it out', async () => {
    const withIndex = createPublishedClient({ read: memoryReader(twoClubs) });
    const { 'players.json': _, ...withoutIndex } = twoClubs;
    const workedOut = createPublishedClient({ read: memoryReader(withoutIndex) });
    expect(await workedOut.playerIndex()).toEqual(twoClubs['players.json']);
    for (const id of ['p1', 'p2', 'p3', 'nobody']) expect(await withIndex.player(id)).toEqual(await workedOut.player(id));
  });

  it('work out the index under custom options instead of reading the published one', async () => {
    const { read, requested } = reader(twoClubs);
    const client = createPublishedClient({ read });
    const found = await client.playerIndex({ now: new Date('2026-11-07T00:00:00Z') });
    expect(Object.keys(found.players).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(requested).not.toContain('players.json');
    expect(requested).toContain('clubs/potomac.json');
  });

  it('work out each club once for every player looked up with the same options', async () => {
    const client = createPublishedClient({ read: memoryReader(files) });
    const options = { now: new Date('2026-11-07T00:00:00Z') };
    const first = await client.playerIndex(options);
    expect(await client.playerIndex(options)).toBe(first);
    expect(Object.keys(first.players).sort()).toEqual(['p1', 'p2']);
  });
});

describe('memoryReader', () => {
  it('says a file is missing when it has none by that name', async () => {
    await expect(memoryReader({})('index.json')).rejects.toBeInstanceOf(MissingPublishedFile);
  });
});

describe('httpReader', () => {
  function server(files: Record<string, unknown>) {
    const requested: string[] = [];
    const fetcher = (async (url: string) => {
      requested.push(url);
      const file = url.replace('https://example.test/data/', '');
      return file in files
        ? new Response(JSON.stringify(files[file]))
        : new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
    return { fetcher, requested };
  }

  it('reads each file under the base URL, with or without a trailing slash', async () => {
    const { fetcher, requested } = server(files);
    await httpReader({ baseUrl: 'https://example.test/data/', fetch: fetcher })('index.json');
    await httpReader({ baseUrl: 'https://example.test/data', fetch: fetcher })('clubs/nova.json');
    expect(requested).toEqual(['https://example.test/data/index.json', 'https://example.test/data/clubs/nova.json']);
  });

  it('says a file is missing on a 404', async () => {
    const { fetcher } = server({});
    await expect(httpReader({ baseUrl: 'https://example.test/data', fetch: fetcher })('seasons.json')).rejects.toBeInstanceOf(
      MissingPublishedFile,
    );
  });

  it('is what the client reads with when given a base URL', async () => {
    const { fetcher, requested } = server(files);
    const client = createPublishedClient({ baseUrl: 'https://example.test/data', fetch: fetcher });
    await client.teams();
    expect(requested).toEqual(['https://example.test/data/index.json']);
  });
});
