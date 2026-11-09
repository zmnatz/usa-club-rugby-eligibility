import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  FeedFixture,
  ParticipationSnapshot,
  PublishedIndex,
  PublishedSeason,
  PublishedSeasonIndex,
  PublishedSeasonsFile,
} from '@zmnatz/usa-club-rugby-data';

// Reads the nightly data at build time, for getStaticPaths and getStaticProps.
// Never import this from code that runs in the browser.

export type { PublishedClub, PublishedIndex, PublishedSeason, PublishedSeasonIndex } from '@zmnatz/usa-club-rugby-data';

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

export function readSeasonIndex(slug: string): PublishedSeasonIndex {
  return readJson<PublishedSeasonIndex>(path.join('seasons', slug, 'index.json'));
}

export function readSeasonFixtures(slug: string): FeedFixture[] {
  return readJson<{ fixtures: FeedFixture[] }>(path.join('seasons', slug, 'fixtures.json')).fixtures;
}

export function readSeasonClubSnapshot(slug: string, key: string): ParticipationSnapshot {
  return readJson<ParticipationSnapshot>(path.join('seasons', slug, 'clubs', `${key}.json`));
}
