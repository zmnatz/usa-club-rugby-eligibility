import type { Club } from '@/types/eligibility';
import type { FeedFixture } from '@/utils/feeds';
import type { ParticipationSnapshot } from '@/utils/participation';

// The nightly data, published beside the page under public/data/ by
// scripts/snapshot.ts. BASE_URL is the Pages project path in production.
const DATA_URL = `${import.meta.env.BASE_URL}data`;

export interface PublishedClub extends Club {
  /** The club's file name under data/clubs/. */
  key: string;
}

export interface PublishedIndex {
  /** When the published data last changed. */
  generatedAt: string;
  season: string;
  clubs: PublishedClub[];
}

/** A published file, or null when it isn't there. A host can answer a missing file
 *  with an HTML page, so a non-JSON response counts as missing. */
async function loadJson<T>(file: string): Promise<T | null> {
  const res = await fetch(`${DATA_URL}/${file}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request for ${file} failed: ${res.status}`);
  if (!res.headers.get('content-type')?.includes('json')) return null;
  return (await res.json()) as T;
}

export async function loadIndex(): Promise<PublishedIndex> {
  const index = await loadJson<PublishedIndex>('index.json');
  if (!index) throw new Error('The club list is unavailable.');
  return index;
}

/** The current season's fixtures, every senior club side. */
export async function loadFixtures(): Promise<FeedFixture[]> {
  const data = await loadJson<{ fixtures: FeedFixture[] }>('fixtures.json');
  if (!data) throw new Error('The fixture list is unavailable.');
  return data.fixtures;
}

export function loadClubSnapshot(key: string): Promise<ParticipationSnapshot | null> {
  return loadJson<ParticipationSnapshot>(`clubs/${encodeURIComponent(key)}.json`);
}
