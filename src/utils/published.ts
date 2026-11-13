import path from 'node:path';
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';
import { fsReader } from '@zmnatz/usa-club-rugby-data/node';

// The nightly data for getStaticProps, at build time and in a page's function when it is
// generated on request: the package's own client, reading public/data from disk. It
// caches every file it reads for the life of the process. Never import this from code
// that runs in the browser.

export type { PublishedClub, PublishedIndex, PublishedSeason } from '@zmnatz/usa-club-rugby-data';

export const published = createPublishedClient({ read: fsReader(path.join(process.cwd(), 'public', 'data')) });
