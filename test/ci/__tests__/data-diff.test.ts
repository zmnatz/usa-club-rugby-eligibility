import { describe, expect, it } from 'bun:test';
import { buildComment, diffPublished, type PublishedFiles } from '../lib/data-diff.ts';

const NOW = '2026-11-11T13:43:34.399Z';

const row = (teamName: string, playerId: string, over: Record<string, unknown> = {}) => ({
  teamName,
  playerId,
  competition: 'League',
  appearances: 1,
  played: 1,
  substitute: 0,
  rounds: {},
  ...over,
});

const clubFile = (over: Record<string, unknown> = {}) => ({
  season: '2026/2027',
  generatedAt: NOW,
  resultIds: ['r1'],
  rows: [row('Nova D1', 'p1')],
  gaps: [],
  ...over,
});

const fixture = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  compId: 'c1',
  compName: 'League',
  season: '2026/2027',
  dateTime: '2026-09-01T12:00:00+00:00',
  round: 'Round 1',
  status: 'Result',
  sourceType: '2',
  homeTeam: { name: 'Nova', score: '20' },
  awayTeam: { name: 'Rivals', score: '10' },
  ...over,
});

const dir = (over: Record<string, unknown> = {}): PublishedFiles => ({
  'index.json': { generatedAt: NOW, season: '2026/2027', clubs: [{ key: 'nova', name: 'Nova', sides: [] }] },
  'fixtures.json': { season: '2026/2027', fixtures: [fixture('f1')] },
  'clubs/nova.json': clubFile(),
  ...over,
});

const comment = (base: PublishedFiles, head: PublishedFiles, counts = []) => buildComment({ diff: diffPublished(base, head), counts });

describe('diffPublished', () => {
  it('ignores the build stamp', () => {
    const base = dir();
    const head = dir({
      'index.json': { ...(base['index.json'] as object), generatedAt: '2026-11-12T00:00:00.000Z' },
      'clubs/nova.json': clubFile({ generatedAt: '2026-11-12T00:00:00.000Z' }),
    });
    expect(diffPublished(base, head).unchanged).toBe(true);
  });

  it('ignores key order', () => {
    const base = dir();
    const head = dir({
      'clubs/nova.json': { gaps: [], rows: [row('Nova D1', 'p1')], resultIds: ['r1'], generatedAt: NOW, season: '2026/2027' },
    });
    expect(diffPublished(base, head).unchanged).toBe(true);
  });

  it('reports player rows added, removed and changed', () => {
    const head = dir({
      'clubs/nova.json': clubFile({
        rows: [row('Nova D1', 'p1', { played: 2 }), row('Nova D1', 'p2')],
      }),
    });
    const diff = diffPublished(dir(), head);
    expect(diff.clubs.changed).toHaveLength(1);
    expect(diff.clubs.changed[0].details.join(' ')).toContain('1 player row added');
    expect(diff.clubs.changed[0].details.join(' ')).toContain('1 player row changed');
    expect(diff.unchanged).toBe(false);
  });

  it('reports clubs and fixtures added and removed', () => {
    const head = dir({
      'clubs/nova.json': clubFile(),
      'clubs/rivals.json': clubFile(),
      'fixtures.json': { season: '2026/2027', fixtures: [fixture('f1', { status: 'Postponed' }), fixture('f2')] },
    });
    const diff = diffPublished(dir(), head);
    expect(diff.clubs.added).toEqual(['rivals']);
    expect(diff.fixtures.added).toEqual(['f2']);
    expect(diff.fixtures.changed).toEqual(['f1']);
  });

  it('reports a club list change that is not a new club file', () => {
    const head = dir({
      'index.json': {
        generatedAt: NOW,
        season: '2026/2027',
        clubs: [{ key: 'nova', name: 'Nova', sides: [{ teamName: 'Nova D2', division: 'D2' }] }],
      },
    });
    expect(diffPublished(dir(), head).clubListChanged).toBe(true);
  });

  it('reports changed and added Locked Seasons', () => {
    const seasonFile = (slug: string) => ({
      season: '2025/2026',
      slug,
      fixtures: [fixture('f1')],
      clubs: [{ key: 'nova', name: 'Nova', sides: [] }],
      clubFiles: { nova: clubFile() },
      unplacedTeams: [],
    });
    const base = dir({
      'seasons.json': { seasons: [{ season: '2025/2026', slug: '2025-26', clubs: 1, unplacedTeams: 0 }] },
      'seasons/2025-26.json': seasonFile('2025-26'),
    });
    const head = dir({
      'seasons.json': {
        seasons: [
          { season: '2025/2026', slug: '2025-26', clubs: 1, unplacedTeams: 0 },
          { season: '2024/2025', slug: '2024-25', clubs: 1, unplacedTeams: 0 },
        ],
      },
      'seasons/2025-26.json': { ...seasonFile('2025-26'), clubFiles: { nova: clubFile({ resultIds: ['r1', 'r2'] }) } },
      'seasons/2024-25.json': seasonFile('2024-25'),
    });
    const diff = diffPublished(base, head);
    expect(diff.seasons.added).toEqual(['2024-25']);
    expect(diff.seasons.changed.map((season) => season.slug)).toEqual(['2025-26']);
  });
});

describe('buildComment', () => {
  it('starts with the marker so the comment can be updated in place', () => {
    expect(comment(dir(), dir()).startsWith('<!-- pr-data-diff -->')).toBe(true);
  });

  it('says when nothing changed', () => {
    expect(comment(dir(), dir())).toContain('No published file changed.');
  });

  it('lists the changed clubs and fixtures, and the run', () => {
    const body = buildComment({
      diff: diffPublished(dir(), dir({ 'fixtures.json': { season: '2026/2027', fixtures: [fixture('f1'), fixture('f2')] } })),
      counts: [
        {
          season: '2026/2027',
          base: { players: 10, matches: 5, eligible: 8, ineligible: 2 },
          head: { players: 11, matches: 6, eligible: 9, ineligible: 2 },
        },
      ],
      baseSha: 'abc1234567',
      headSha: 'def7654321',
      runUrl: 'https://github.com/o/r/actions/runs/1',
    });
    expect(body).toContain('abc1234');
    expect(body).toContain('def7654');
    expect(body).toContain('https://github.com/o/r/actions/runs/1');
    expect(body).toContain('| 2026/2027 | base | 10 | 8 | 2 | 5 |');
    expect(body).toContain('| | head | 11 | 9 | 2 | 6 |');
    expect(body).toContain('**Fixtures added:** 1 fixture');
  });

  it('caps a long list of added clubs', () => {
    const clubs = Object.fromEntries(
      Array.from({ length: 25 }, (_, index) => [`clubs/c${String(index).padStart(2, '0')}.json`, clubFile()]),
    );
    const head = dir({
      ...clubs,
      'clubs/c00.json': clubFile({ rows: [row('Nova D1', 'p1'), row('Nova D1', 'p2')] }),
    });
    const body = buildComment({ diff: diffPublished(dir(), head), counts: [] });
    expect(body).toContain('and 5 more');
    expect(body).not.toContain('`c20`');
  });
});
