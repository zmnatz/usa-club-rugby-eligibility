import type { FeedFixture } from '@zmnatz/usa-club-rugby-data';

// The nightly data, published under public/data/ by scripts/snapshot.ts. Club pages
// get theirs at build time; this is for the CSV page, which can be for any club.
const DATA_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/data`;

/** The current season's fixtures, every senior club side. */
export async function loadFixtures(): Promise<FeedFixture[]> {
  const res = await fetch(`${DATA_URL}/fixtures.json`);
  if (!res.ok) throw new Error(`The fixture list is unavailable: ${res.status}`);
  return ((await res.json()) as { fixtures: FeedFixture[] }).fixtures;
}
