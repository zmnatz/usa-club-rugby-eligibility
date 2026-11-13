import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const readText = (file: string): string | null => (existsSync(file) ? readFileSync(file, 'utf8') : null);

export const readJson = <T>(file: string): T | null => {
  const text = readText(file);
  return text === null ? null : (JSON.parse(text) as T);
};

/** Text with the "generatedAt" stamp removed, which is the only thing allowed to
 *  differ between two runs over the same data. */
export const withoutStamp = (text: string): string => text.replace(/"generatedAt":"[^"]*",?/, '');

/** Writes only when the content differs, ignoring `generatedAt`, so a rebuild over
 *  the same data changes nothing. */
export function writeIfChanged(file: string, content: string): boolean {
  const saved = readText(file);
  if (saved !== null && withoutStamp(saved) === withoutStamp(content)) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return true;
}

/** Removes the .json files in a directory that this run didn't write. */
export function prune(dir: string, keep: Set<string>): number {
  if (!existsSync(dir)) return 0;
  const stale = readdirSync(dir).filter((name) => name.endsWith('.json') && !keep.has(name));
  for (const name of stale) rmSync(path.join(dir, name));
  return stale.length;
}

export const listJson = (dir: string): string[] =>
  existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')) : [];
