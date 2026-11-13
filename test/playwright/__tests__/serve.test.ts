import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveFile } from '../lib/serve.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
fs.mkdirSync(path.join(root, 'club/x'), { recursive: true });
fs.writeFileSync(path.join(root, 'index.html'), '');
fs.writeFileSync(path.join(root, 'club/x/index.html'), '');
afterAll(() => fs.rmSync(root, { recursive: true }));

describe('resolveFile', () => {
  it('answers a folder with its index page, with or without the trailing slash', () => {
    expect(resolveFile(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolveFile(root, '/club/x/')).toBe(path.join(root, 'club/x/index.html'));
    expect(resolveFile(root, '/club/x')).toBe(path.join(root, 'club/x/index.html'));
  });

  it('finds nothing for a missing page or a path outside the site', () => {
    expect(resolveFile(root, '/club/y/')).toBeNull();
    expect(resolveFile(root, '/../../etc/passwd')).toBeNull();
  });
});
