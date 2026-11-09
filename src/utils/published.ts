import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  FeedFixture,
  ParticipationSnapshot,
  PublishedIndex,
  PublishedSeason,
  PublishedSeasonFile,
  PublishedSeasonsFile,
} from '@zmnatz/usa-club-rugby-data';

// Reads the nightly data at build time, for getStaticPaths and getStaticProps.
// Never import this from code that runs in the browser.

export type { PublishedClub, PublishedIndex, PublishedSeason, PublishedSeasonFile } from '@zmnatz/usa-club-rugby-data';

const PUBLISHED = path.join(process.cwd(), 'public', 'data');

const readJson = <T>(file: string): T => JSON.parse(readFileSync(path.join(PUBLISHED, file), 'utf8')) as T;

export function readIndex(): PublishedIndex {
  return readJson<PublishedIndex>('index.json');
}

export function readFixtures(): FeedFixture[] {
  return readJson<{ fixtures: FeedFixture[] }>('fixtures.json').fixtures;
}

export function readClubSnapshot(key: string): ParticipationSnapshot {
  return readJson<ParticipationSnapshot>(path.join('clubs', `${key}.json`));
}

/** The Locked Seasons published, newest first. None until the archive holds one. */
export function readSeasons(): PublishedSeason[] {
  if (!existsSync(path.join(PUBLISHED, 'seasons.json'))) return [];
  return readJson<PublishedSeasonsFile>('seasons.json').seasons;
}

const seasonFiles = new Map<string, PublishedSeasonFile>();

/** One Locked Season's file, read once per build process since every one of its
 *  pages needs it. */
export function readSeasonFile(slug: string): PublishedSeasonFile {
  let file = seasonFiles.get(slug);
  if (!file) {
    file = readJson<PublishedSeasonFile>(path.join('seasons', `${slug}.json`));
    seasonFiles.set(slug, file);
  }
  return file;
}
