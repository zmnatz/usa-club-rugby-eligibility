import path from 'node:path';
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';
import { fsReader } from '@zmnatz/usa-club-rugby-data/node';
import { selectClubs } from '@/utils/buildScope';

// The nightly data at build time, for getStaticPaths and getStaticProps: the package's
// own client, reading public/data from disk. It caches every file and every club's
// verdicts per build process, so the player data is worked out once (src/utils/playerData.ts).
// Never import this from code that runs in the browser.

export type { PublishedClub, PublishedIndex, PublishedSeason } from '@zmnatz/usa-club-rugby-data';

export const published = createPublishedClient({ read: fsReader(path.join(process.cwd(), 'public', 'data')) });

/** The players with a page in this build: those in any club it covers. Name Withheld
 *  players aren't in the index, so have none. */
export async function listPlayerIds(): Promise<string[]> {
  const [{ clubs }, { players }] = await Promise.all([published.index(), published.playerIndex()]);
  const built = new Set(selectClubs(clubs).map((club) => club.key));
  return Object.entries(players)
    .filter(([, player]) => player.clubs.some((key) => built.has(key)))
    .map(([id]) => id);
}
