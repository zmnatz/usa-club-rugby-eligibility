import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seasonFile, serializeSeasonFixtures, serializeSeasonMatches } from '../archive.ts';
import type { FeedFixture } from '../feeds.ts';
import { runSnapshot, verifyPublished } from '../node/snapshot.ts';
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
      'seasons/2025-26/clubs/nova.json',
      'seasons/2025-26/clubs/potomac.json',
      'seasons/2025-26/fixtures.json',
      'seasons/2025-26/index.json',
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
    const club = readPublished<Record<string, unknown>>('seasons/2025-26/clubs/nova.json');
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
    const index = readPublished<{ clubs: { key: string; sides: { label: string }[] }[] }>('seasons/2023-24/index.json');
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

  it('catches a Locked Season file that was edited by hand or left over', async () => {
    archiveLocked(LOCKED_SEASON, [lockedFixture], { o1: lockedMatch });
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const club = path.join(publishedDir, 'seasons/2025-26/clubs/nova.json');
    writeFileSync(club, readFileSync(club, 'utf8').replace('"played":1', '"played":9'));
    writeFileSync(path.join(publishedDir, 'seasons/2025-26/clubs/old.json'), '{}');
    expect(verifyPublished({ archiveDir, publishedDir })).toMatchObject({
      ok: false,
      different: ['seasons/2025-26/clubs/nova.json'],
      extra: ['seasons/2025-26/clubs/old.json'],
    });
  });
});
