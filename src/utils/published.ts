import { existsSync } from 'node:fs';
import path from 'node:path';
import { createPublishedClient, httpReader, type PublishedSeasonFile } from '@zmnatz/usa-club-rugby-data';
import { fsReader } from '@zmnatz/usa-club-rugby-data/node';

// The nightly data for getStaticProps and getServerSideProps, at build time and in a page's
// function when it is rendered on request: the package's own client, caching every file it
// reads for the life of the process. Never import this from code that runs in the browser.
//
// The build, `next start` and `next dev` read public/data from disk. A deployed function
// doesn't carry it (ADR 019), so it reads the same files from its own deploy on the CDN, at
// the permalink the build recorded in PUBLISHED_DATA_URL.

export type { PublishedClub, PublishedIndex, PublishedSeason } from '@zmnatz/usa-club-rugby-data';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');
const DATA_URL = process.env.PUBLISHED_DATA_URL;

const onDisk = existsSync(path.join(DATA_DIR, 'index.json'));

export const published = createPublishedClient({
  read: onDisk || !DATA_URL ? fsReader(DATA_DIR) : httpReader({ baseUrl: DATA_URL }),
});

/** A Locked Season's file by its slug, or null if no season by that slug is published.
 *  Only a published season's file is read, so a page's path can't name another file. */
export async function lockedSeason(slug: unknown): Promise<PublishedSeasonFile | null> {
  if (typeof slug !== 'string' || !(await published.seasons()).some((season) => season.slug === slug)) return null;
  return published.season(slug);
}
