import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seasonFile, serializeSeasonFixtures, serializeSeasonMatches } from '../archive.ts';
import type { FeedFixture } from '../feeds.ts';
import { runSnapshot, verifyPublished } from '../node/snapshot.ts';
import type { ParticipationSnapshot } from '../snapshot.ts';
import type { MatchCentreData } from '../playerHistory.ts';

const NOW = new Date('2026-11-07T12:00:00Z');
const fixture: FeedFixture = {
  id: 'm1',
  compId: 'c1',
  compName: 'Capital Men D3',
  season: '2026/2027',
  dateTime: '2026-10-01T15:00:00Z',
  round: 'Round 1',
  status: 'Result',
  sourceType: '2',
  homeTeam: { name: 'NOVA MD3', score: '10' },
  awayTeam: { name: 'Potomac MD3', score: '12' },
};
const side = (name: string, score: string) => ({ id: '', teamId: '', crest: '', name, score });
const match: MatchCentreData = {
  fixture: {
    id: 'm1',
    compId: 'c1',
    compName: fixture.compName,
    dateTime: fixture.dateTime,
    season: fixture.season,
    venue: '',
    homeTeam: side('NOVA MD3', '10'),
    awayTeam: side('Potomac MD3', '12'),
  },
  commentary: [],
  players: [{ id: 'p1__1', name: 'Ann Test', position: 'Prop', shirtNumber: '1', isHome: true }],
  substitutes: [],
  coaches: [],
};

const LOCKED_SEASON = '2025/2026';
const lockedFixture: FeedFixture = { ...fixture, id: 'o1', season: LOCKED_SEASON, dateTime: '2026-03-01T15:00:00Z' };
const lockedMatch: MatchCentreData = {
  ...match,
  fixture: { ...match.fixture, id: 'o1', season: LOCKED_SEASON, dateTime: lockedFixture.dateTime },
  players: [{ id: 'p7__1', name: 'Old Timer', position: 'Prop', shirtNumber: '1', isHome: true }],
};

let dir: string;
let archiveDir: string;
let publishedDir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'ucr-'));
  archiveDir = path.join(dir, 'archive');
  publishedDir = path.join(dir, 'data');
  mkdirSync(path.join(archiveDir, 'fixtures'), { recursive: true });
  mkdirSync(path.join(archiveDir, 'matches'), { recursive: true });
  const file = seasonFile('2026/2027');
  writeFileSync(path.join(archiveDir, 'fixtures', file), serializeSeasonFixtures('2026/2027', [fixture]));
  writeFileSync(path.join(archiveDir, 'matches', file), serializeSeasonMatches('2026/2027', { m1: match }));
  writeFileSync(
    path.join(archiveDir, 'manifest.json'),
    JSON.stringify({ fields: 'x', currentSeason: '2026/2027', seasons: ['2026/2027'], clubIds: [] }),
  );
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('build and verify', () => {
  it('reproduces the published files from the archive alone', async () => {
    const built = await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    expect(built.clubs).toBe(2);
    const result = verifyPublished({ archiveDir, publishedDir });
    expect(result).toMatchObject({ ok: true, asOf: NOW.toISOString(), different: [], missing: [], extra: [] });
  });

  it("calculates as of the archive's last pull, which the manifest records", async () => {
    const pulledAt = '2026-11-09T18:30:00.000Z';
    writeFileSync(
      path.join(archiveDir, 'manifest.json'),
      JSON.stringify({ fields: 'x', currentSeason: '2026/2027', seasons: ['2026/2027'], clubIds: [], pulledAt }),
    );
    await runSnapshot({ archiveDir, publishedDir, offline: true });
    const index = JSON.parse(readFileSync(path.join(publishedDir, 'index.json'), 'utf8'));
    const club = JSON.parse(readFileSync(path.join(publishedDir, 'clubs', 'nova.json'), 'utf8'));
    expect(index.generatedAt).toBe(pulledAt);
    expect(club.generatedAt).toBe(pulledAt);
    expect(verifyPublished({ archiveDir, publishedDir }).ok).toBe(true);
  });

  it('does not publish a player index, which each consumer works out for itself', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    expect(existsSync(path.join(publishedDir, 'players.json'))).toBe(false);
  });

  it('leaves the files alone when nothing changed, even at a later time', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const index = path.join(publishedDir, 'index.json');
    const before = readFileSync(index, 'utf8');
    const again = await runSnapshot({ archiveDir, publishedDir, offline: true, now: new Date('2026-11-08T12:00:00Z') });
    expect(again.changed).toBe(false);
    expect(readFileSync(index, 'utf8')).toBe(before);
  });

  it('catches a published file that was edited by hand, deleted or left over', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const club = path.join(publishedDir, 'clubs', 'nova.json');
    writeFileSync(club, readFileSync(club, 'utf8').replace('"played":1', '"played":9'));
    rmSync(path.join(publishedDir, 'clubs', 'potomac.json'));
    writeFileSync(path.join(publishedDir, 'clubs', 'old.json'), '{}');
    const result = verifyPublished({ archiveDir, publishedDir });
    expect(result).toMatchObject({
      ok: false,
      different: ['clubs/nova.json'],
      missing: ['clubs/potomac.json'],
      extra: ['clubs/old.json'],
    });
  });

  it('catches an archive change that was not regenerated', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const withSub = { ...match, players: [...match.players, { ...match.players[0], id: 'p2__1', name: 'Bob Test' }] };
    writeFileSync(
      path.join(archiveDir, 'matches', seasonFile('2026/2027')),
      serializeSeasonMatches('2026/2027', { m1: withSub }),
    );
    expect(verifyPublished({ archiveDir, publishedDir }).ok).toBe(false);
  });
});

describe('summer 7s', () => {
  it('doesn\'t count a match played in June or July', async () => {
    const summer: FeedFixture = { ...fixture, id: 'm2', dateTime: '2026-07-11T15:00:00Z' };
    const summerMatch: MatchCentreData = {
      ...match,
      fixture: { ...match.fixture, id: 'm2', dateTime: summer.dateTime },
      players: [{ id: 'p9__1', name: 'Summer Sevens', position: 'Wing', shirtNumber: '11', isHome: true }],
    };
    const file = seasonFile('2026/2027');
    writeFileSync(path.join(archiveDir, 'fixtures', file), serializeSeasonFixtures('2026/2027', [fixture, summer]));
    writeFileSync(path.join(archiveDir, 'matches', file), serializeSeasonMatches('2026/2027', { m1: match, m2: summerMatch }));
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const nova = readFileSync(path.join(publishedDir, 'clubs', 'nova.json'), 'utf8');
    expect(nova).toContain('Ann');
    expect(nova).not.toContain('Summer');
    expect(nova).not.toContain('"m2"');
  });
});

describe('an Archive holding a Locked Season', () => {
  const files = (root: string) =>
    Object.fromEntries(
      readdirSync(root, { recursive: true, encoding: 'utf8' })
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => [name, readFileSync(path.join(root, name), 'utf8')]),
    );

  const archiveLocked = (season: string, fixtures: FeedFixture[], matches: Record<string, MatchCentreData | null>) => {
    const file = seasonFile(season);
    writeFileSync(path.join(archiveDir, 'fixtures', file), serializeSeasonFixtures(season, fixtures));
    writeFileSync(path.join(archiveDir, 'matches', file), serializeSeasonMatches(season, matches));
    const manifest = JSON.parse(readFileSync(path.join(archiveDir, 'manifest.json'), 'utf8'));
    manifest.seasons = [season, ...manifest.seasons];
    writeFileSync(path.join(archiveDir, 'manifest.json'), JSON.stringify(manifest));
  };
  const readPublished = <T>(name: string): T => JSON.parse(readFileSync(path.join(publishedDir, name), 'utf8')) as T;

  it('leaves the current season as it was and adds the Locked Season beside it', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const currentOnly = files(publishedDir);

    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    const withHistory = path.join(dir, 'data-with-history');
    await runSnapshot({ archiveDir, publishedDir: withHistory, offline: true, now: NOW });

    const published = files(withHistory);
    const current = Object.fromEntries(Object.entries(published).filter(([name]) => !name.startsWith('season')));
    expect(current).toEqual(currentOnly);
    expect(Object.keys(published).filter((name) => name.startsWith('season')).sort()).toEqual([
      'seasons.json',
      'seasons/2025-26.json',
    ]);
    expect(verifyPublished({ archiveDir, publishedDir: withHistory }).ok).toBe(true);
  });

  it('lists the Locked Seasons, newest first', async () => {
    archiveLocked('2023/2024', [{ ...lockedFixture, id: 'a1', season: '2023/2024' }], {});
    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    expect(readPublished('seasons.json')).toEqual({
      seasons: [
        { season: '2025/2026', slug: '2025-26', clubs: 2, unplacedTeams: 0 },
        { season: '2023/2024', slug: '2023-24', clubs: 2, unplacedTeams: 0 },
      ],
    });
  });

  it('marks a Locked Season\'s club file locked, with no time that would change it', async () => {
    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const club = readPublished<{ clubFiles: Record<string, Record<string, unknown>> }>('seasons/2025-26.json').clubFiles.nova;
    expect(club).toMatchObject({ season: LOCKED_SEASON, locked: true });
    expect(club.generatedAt).toBeUndefined();
    expect((club.rows as { firstName: string }[])[0].firstName).toBe('Old');
  });

  it('places a team by its competition when its name has no division', async () => {
    const named: FeedFixture = {
      ...lockedFixture,
      id: 'w1',
      season: '2023/2024',
      compName: "Empire Men's D3",
      homeTeam: { name: 'White Plains M', score: '5' },
      awayTeam: { name: 'Saratoga M', score: '3' },
    };
    archiveLocked('2023/2024', [named], {});
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const index = readPublished<{ clubs: { key: string; sides: { label: string }[] }[] }>('seasons/2023-24.json');
    expect(index.clubs.map((club) => [club.key, club.sides[0].label])).toEqual([
      ['saratoga', 'D3'],
      ['white-plains', 'D3'],
    ]);
  });

  it('does not publish a season older than the regulations encoded', async () => {
    archiveLocked('2021/2022', [{ ...lockedFixture, id: 'z1', season: '2021/2022' }], {});
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    expect(existsSync(path.join(publishedDir, 'seasons.json'))).toBe(false);
  });

  it('leaves a Locked Season alone on a later night', async () => {
    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const again = await runSnapshot({ archiveDir, publishedDir, offline: true, now: new Date('2026-12-01T12:00:00Z') });
    expect(again.changed).toBe(false);
  });

  it('keeps a player who played summer 7s with their 15s club, with no waiver', async () => {
    const sevens: FeedFixture = {
      ...lockedFixture,
      id: 's1',
      dateTime: '2026-07-11T15:00:00Z',
      homeTeam: { name: 'Bayside MD3', score: '21' },
      awayTeam: { name: 'Potomac MD3', score: '7' },
    };
    const sevensMatch: MatchCentreData = {
      ...lockedMatch,
      fixture: { ...lockedMatch.fixture, id: 's1', dateTime: sevens.dateTime, homeTeam: side('Bayside MD3', '21'), awayTeam: side('Potomac MD3', '7') },
    };
    archiveLocked(LOCKED_SEASON, [lockedFixture, sevens], { o1: lockedMatch, s1: sevensMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const season = readPublished<{ clubs: { key: string }[]; clubFiles: Record<string, { rows: { firstName: string }[]; transfers?: unknown }> }>(
      'seasons/2025-26.json',
    );
    expect(season.clubs.map((club) => club.key)).toEqual(['nova', 'potomac']);
    expect(season.clubFiles.nova.rows.map((row) => row.firstName)).toEqual(['Old']);
    expect(season.clubFiles.nova.transfers).toBeUndefined();
  });

  it('places a player by a June Nationals match, without counting it', async () => {
    const at = (id: string, dateTime: string, compName: string, home: string): [FeedFixture, MatchCentreData] => [
      { ...lockedFixture, id, dateTime, compName, homeTeam: { name: home, score: '20' }, awayTeam: { name: 'Potomac MD3', score: '3' } },
      { ...lockedMatch, fixture: { ...lockedMatch.fixture, id, dateTime, compName, homeTeam: side(home, '20'), awayTeam: side('Potomac MD3', '3') } },
    ];
    const games = [
      at('o1', '2026-03-01T15:00:00Z', 'Capital Men D3', 'NOVA MD3'),
      at('o2', '2026-04-04T15:00:00Z', 'Capital Men D3', 'Bayside MD3'),
      at('o3', '2026-06-05T15:00:00Z', '2026 XVs Nationals', 'NOVA MD3'),
    ];
    archiveLocked(LOCKED_SEASON, games.map(([item]) => item), Object.fromEntries(games.map(([item, record]) => [item.id, record])));
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const { clubFiles } = readPublished<{ clubFiles: Record<string, ParticipationSnapshot> }>('seasons/2025-26.json');
    expect(clubFiles.bayside.rows.some((row) => row.firstName === 'Old')).toBe(false);
    expect(Object.values(clubFiles.nova.transfers ?? {}).flat().map((other) => other.clubKey)).toEqual(['bayside']);
    const counted = clubFiles.nova.rows.filter((row) => row.firstName === 'Old' && row.competition === 'Capital Men D3');
    expect(counted.map((row) => row.played)).toEqual([1]);
  });

  it('catches a Locked Season file that was edited by hand or left over', async () => {
    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const file = path.join(publishedDir, 'seasons/2025-26.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"played":1', '"played":9'));
    writeFileSync(path.join(publishedDir, 'seasons/2019-20.json'), '{}');
    expect(verifyPublished({ archiveDir, publishedDir })).toMatchObject({
      ok: false,
      different: ['seasons/2025-26.json'],
      extra: ['seasons/2019-20.json'],
    });
  });
});
