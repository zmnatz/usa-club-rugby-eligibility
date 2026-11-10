import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MissingPublishedFile, type PublishedReader } from '../published.ts';

/** Reads the published files from a directory, e.g. a checkout's `public/data`. */
export function fsReader(dir: string): PublishedReader {
  return async (file) => {
    let text: string;
    try {
      text = await readFile(path.join(dir, file), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new MissingPublishedFile(file);
      throw error;
    }
    return JSON.parse(text);
  };
}
