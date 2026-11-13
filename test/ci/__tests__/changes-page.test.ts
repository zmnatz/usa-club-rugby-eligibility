import { describe, expect, it } from 'bun:test';
import { addEntry, END, formatDate, KEEP, readEntries, START } from '../lib/changes-page.ts';
import { buildEntry, changeSummary, diffPublished } from '../lib/data-diff.ts';

const page = `# Data changes\n\nIntro.\n\n${START}\n\n${END}\n\nFooter.\n`;

const entry = (id: string, open = false) =>
  `<details${open ? ' open' : ''} id="${id}">\n<summary><a href="#${id}">${id}</a></summary>\n\nBody of ${id}.\n\n</details>`;

describe('addEntry', () => {
  it('inserts the first entry between the markers and leaves the page alone', () => {
    const result = addEntry(page, entry('change-2026-11-14', true));
    expect(result.replaced).toBe(false);
    expect(result.page).toContain('Intro.');
    expect(result.page).toContain('Footer.');
    expect(result.page.indexOf('id="change-2026-11-14"')).toBeGreaterThan(result.page.indexOf(START));
    expect(result.page.indexOf('id="change-2026-11-14"')).toBeLessThan(result.page.indexOf(END));
  });

  it("keeps the newest first and opens only it", () => {
    let current = addEntry(page, entry('first', true)).page;
    current = addEntry(current, entry('second', true)).page;
    const entries = readEntries(current);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toContain('id="second"');
    expect(entries[0].startsWith('<details open')).toBe(true);
    expect(entries[1]).toContain('id="first"');
    expect(entries[1].startsWith('<details open')).toBe(false);
  });

  it('replaces an entry with the same id instead of adding another', () => {
    let current = addEntry(page, entry('change-2026-11-14', true)).page;
    current = addEntry(current, entry('change-2026-11-13', true)).page;
    const before = readEntries(current).length;
    const result = addEntry(current, entry('change-2026-11-14', true));
    expect(result.replaced).toBe(true);
    expect(readEntries(result.page)).toHaveLength(before);
  });

  it(`keeps the last ${KEEP} updates`, () => {
    let current = page;
    for (let day = 1; day <= KEEP + 3; day += 1) {
      current = addEntry(current, `<details open id="change-${day}">\n<summary>${day}</summary>\n\nBody.\n\n</details>`).page;
    }
    const entries = readEntries(current);
    expect(entries).toHaveLength(KEEP);
    expect(entries[0]).toContain(`id="change-${KEEP + 3}"`);
    expect(entries.at(-1)).toContain('id="change-4"');
  });

  it('fails without the markers', () => {
    expect(() => addEntry('# No markers', entry('x'))).toThrow('changes:start');
  });
});

describe('buildEntry', () => {
  it('links its summary to its own anchor', () => {
    const body = buildEntry({
      diff: diffPublished({}, { 'fixtures.json': { season: '2026/2027', fixtures: [{ id: 'f1' }] } }),
      counts: [],
      id: 'change-2026-11-14',
      title: 'Nov 14, 2026 — 1 fixture changed',
      open: true,
    });
    expect(body.startsWith('<details open id="change-2026-11-14">')).toBe(true);
    expect(body).toContain('<summary><a href="#change-2026-11-14">Nov 14, 2026 — 1 fixture changed</a></summary>');
    expect(body).toContain('**Fixtures added:** 1 fixture');
    expect(body.endsWith('</details>')).toBe(true);
  });

  it('writes the verdict counts as a list, since the page has no table extension', () => {
    const body = buildEntry({
      diff: diffPublished(
        {},
        { 'fixtures.json': { season: '2026/2027', fixtures: [{ id: 'f1' }, { id: 'f2' }] } },
      ),
      counts: [
        {
          season: '2026/2027',
          base: { players: 10, matches: 5, eligible: 8, ineligible: 2 },
          head: { players: 11, matches: 6, eligible: 9, ineligible: 2 },
        },
      ],
      id: 'change-2026-11-14',
      title: 'Nov 14, 2026 — 2 fixtures changed',
    });
    expect(body).toContain('- **2026/2027**: players 10 → 11, eligible 8 → 9');
    expect(body).not.toContain('|');
  });
});

describe('changeSummary', () => {
  it('counts clubs, fixtures and Locked Seasons', () => {
    const diff = diffPublished(
      {},
      {
        'index.json': { season: '2026/2027', clubs: [{ key: 'nova', name: 'Nova', sides: [] }] },
        'clubs/nova.json': { season: '2026/2027', rows: [], gaps: [] },
        'fixtures.json': { season: '2026/2027', fixtures: [{ id: 'f1' }] },
        'seasons.json': { seasons: [{ season: '2025/2026', slug: '2025-26' }] },
        'seasons/2025-26.json': { season: '2025/2026', slug: '2025-26', fixtures: [], clubs: [], clubFiles: {}, unplacedTeams: [] },
      },
    );
    expect(changeSummary(diff)).toBe('1 club, 1 fixture and 1 Locked Season changed');
  });

  it('says when nothing changed', () => {
    expect(changeSummary(diffPublished({}, {}))).toBe('No published data changed');
  });
});

describe('formatDate', () => {
  it('formats a day without the runner locale', () => {
    expect(formatDate('2026-11-14')).toBe('Nov 14, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('rejects another shape', () => {
    expect(() => formatDate('14/11/2026')).toThrow('YYYY-MM-DD');
  });
});
