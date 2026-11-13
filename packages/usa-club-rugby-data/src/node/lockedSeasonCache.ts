import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prune, readText, writeIfChanged } from './files.ts';

// A Locked Season's archive doesn't change, so neither do its published files, yet working
// them out is most of a build. A run given a cache directory keeps each season's two files
// there, under a key made from the season's archive files and this package's own code, and
// reuses them when both match. A change to the rules or the calculation changes the code,
// so it never reuses a file the new code wouldn't make. `verify` never uses the cache.

/** A Locked Season's published files: `seasons/<slug>.json` and its player index. */
export interface LockedSeasonFiles {
  file: string;
  players: string;
}

let codeHash: string | undefined;

/** A hash of every file in this package's build (or source, under a test runner), so any
 *  change to the code gives every season a new key. */
export function packageCodeHash(): string {
  if (codeHash) return codeHash;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const hash = createHash('sha256');
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        hash.update(path.relative(root, full));
        hash.update(readFileSync(full));
      }
    }
  };
  walk(root);
  codeHash = hash.digest('hex');
  return codeHash;
}

/** The cache key for a Locked Season from its archive files' text. */
export function lockedSeasonKey(season: string, fixturesText: string, matchesText: string): string {
  return createHash('sha256')
    .update(packageCodeHash())
    .update(season)
    .update('\0')
    .update(fixturesText)
    .update('\0')
    .update(matchesText)
    .digest('hex')
    .slice(0, 16);
}

const fileName = (slug: string, key: string) => `${slug}.${key}.json`;
const playersName = (slug: string, key: string) => `${slug}.${key}.players.json`;

/** A Locked Season's files from the cache, or null if they aren't there. */
export function readCachedSeason(cacheDir: string, slug: string, key: string): LockedSeasonFiles | null {
  const file = readText(path.join(cacheDir, fileName(slug, key)));
  const players = readText(path.join(cacheDir, playersName(slug, key)));
  return file !== null && players !== null ? { file, players } : null;
}

/** Keeps a Locked Season's files in the cache. */
export function writeCachedSeason(cacheDir: string, slug: string, key: string, files: LockedSeasonFiles): void {
  writeIfChanged(path.join(cacheDir, fileName(slug, key)), files.file);
  writeIfChanged(path.join(cacheDir, playersName(slug, key)), files.players);
}

/** Removes every cached file but those of the given keys, so the cache holds one build. */
export function pruneCache(cacheDir: string, kept: { slug: string; key: string }[]): number {
  return prune(cacheDir, new Set(kept.flatMap(({ slug, key }) => [fileName(slug, key), playersName(slug, key)])));
}
