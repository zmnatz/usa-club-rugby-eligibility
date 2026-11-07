import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Club } from '@/types/eligibility';
import type { FeedFixture } from '@/utils/feeds';
import type { ParticipationSnapshot } from '@/utils/participation';

// Reads the nightly data at build time, for getStaticPaths and getStaticProps.
// Never import this from code that runs in the browser.

const PUBLISHED = path.join(process.cwd(), 'public', 'data');

export interface PublishedClub extends Club {
  /** The club's page path and file name, e.g. "rocky-gorge". */
  key: string;
}

export interface PublishedIndex {
  /** When the published data last changed. */
  generatedAt: string;
  season: string;
  clubs: PublishedClub[];
}

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
