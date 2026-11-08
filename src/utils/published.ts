import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FeedFixture, ParticipationSnapshot, PublishedIndex } from '@zmnatz/usa-club-rugby-data';

// Reads the nightly data at build time, for getStaticPaths and getStaticProps.
// Never import this from code that runs in the browser.

export type { PublishedClub, PublishedIndex } from '@zmnatz/usa-club-rugby-data';

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
