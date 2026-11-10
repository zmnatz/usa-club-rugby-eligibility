import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fsReader } from '../node/published.ts';
import { createPublishedClient, MissingPublishedFile } from '../published.ts';

describe('fsReader', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'published-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(path.join(dir, 'clubs'));
  const index = { generatedAt: '2026-11-07T00:00:00.000Z', season: '2026/2027', clubs: [{ key: 'nova', name: 'NOVA', sides: [] }] };
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  writeFileSync(path.join(dir, 'clubs', 'nova.json'), JSON.stringify({ season: '2026/2027', rows: [], gaps: [] }));

  it('reads the published files from a directory', async () => {
    const client = createPublishedClient({ read: fsReader(dir) });
    expect(await client.index()).toEqual(index);
    expect((await client.club('nova')).snapshot.season).toBe('2026/2027');
  });

  it('says a file is missing when there is none', async () => {
    await expect(fsReader(dir)('seasons.json')).rejects.toBeInstanceOf(MissingPublishedFile);
    expect(await createPublishedClient({ read: fsReader(dir) }).seasons()).toEqual([]);
  });
});
