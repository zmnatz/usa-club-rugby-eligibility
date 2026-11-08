import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  it('publishes the same data as one holding only the current season', async () => {
    await runSnapshot({ archiveDir, publishedDir, offline: true, now: NOW });
    const currentOnly = files(publishedDir);

    const file = seasonFile(LOCKED_SEASON);
    writeFileSync(path.join(archiveDir, 'fixtures', file), serializeSeasonFixtures(LOCKED_SEASON, [lockedFixture]));
    writeFileSync(path.join(archiveDir, 'matches', file), serializeSeasonMatches(LOCKED_SEASON, { o1: lockedMatch }));
    writeFileSync(
      path.join(archiveDir, 'manifest.json'),
      JSON.stringify({ fields: 'x', currentSeason: '2026/2027', seasons: [LOCKED_SEASON, '2026/2027'], clubIds: [] }),
    );
    const withHistory = path.join(dir, 'data-with-history');
    await runSnapshot({ archiveDir, publishedDir: withHistory, offline: true, now: NOW });
    expect(files(withHistory)).toEqual(currentOnly);
    // Both sets of files reproduce from the Archive that now holds the Locked Season.
    expect(verifyPublished({ archiveDir, publishedDir }).ok).toBe(true);
    expect(verifyPublished({ archiveDir, publishedDir: withHistory }).ok).toBe(true);
  });
});
