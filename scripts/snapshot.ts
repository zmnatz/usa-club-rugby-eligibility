// Nightly snapshot: refresh the raw match archive from the CMS, then calculate the
// published data from it. See docs/snapshots.md.
//
//   bun scripts/snapshot.ts                 refresh the archive, then build
//   bun scripts/snapshot.ts --offline       build from the archive only, no CMS requests
//   bun scripts/snapshot.ts --full-history  also read every past season the feeds list
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import eligibility from '@config/eligibility.yml';
import sources from '@config/sources.yml';
import { rateLimitState, requestStats } from '@/utils/api';
import {
  type ArchivedMatch,
  type ArchiveManifest,
  buildPublished,
  matchesToRead,
  refreshFrom,
  seasonDir,
} from '@/utils/archive';
import {
  clubIdsFromMatches,
  currentSeason,
  FEED_QUERY,
  type FeedFixture,
  fetchClubFeeds,
  fetchFeed,
  fetchFeedPage,
  keepCompetitions,
  mergeFeeds,
  sortFixtures,
} from '@/utils/feeds';
import { fetchMatchCentre, fetchMatches, MATCH_CENTRE_QUERY, type MatchCentreData } from '@/utils/playerHistory';

const ROOT = path.resolve(import.meta.dir, '..');
const ARCHIVE = path.join(ROOT, 'archive');
const PUBLISHED = path.join(ROOT, 'public', 'data');
const MANIFEST = path.join(ARCHIVE, 'manifest.json');
/** Club feeds lead to more clubs; a few rounds reach every club with a result. */
const MAX_DISCOVERY_ROUNDS = 5;
/** Requests in flight. The CMS's rate limit, not this, sets the pace (about 4 a
 *  second after a burst of 500); the shared gate in api.ts waits it out. */
const CONCURRENCY = Number(process.env.SNAPSHOT_CONCURRENCY) || 6;

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const fullHistory = args.has('--full-history');
const startedAt = Date.now();

const readJson = <T>(file: string): T | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null);

/** Writes only when the content differs, ignoring `generatedAt`, so a quiet night
 *  changes nothing and makes no commit. */
function writeIfChanged(file: string, data: unknown): boolean {
  const strip = (text: string) => text.replace(/"generatedAt":"[^"]*",?/, '');
  const next = JSON.stringify(data);
  if (existsSync(file) && strip(readFileSync(file, 'utf8')) === strip(next)) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, next);
  return true;
}

/** Removes the files in a directory that this run didn't write. */
function prune(dir: string, keep: Set<string>): number {
  if (!existsSync(dir)) return 0;
  const stale = readdirSync(dir).filter((name) => name.endsWith('.json') && !keep.has(name));
  for (const name of stale) rmSync(path.join(dir, name));
  return stale.length;
}

const log = (message: string) =>
  console.log(
    `[${((Date.now() - startedAt) / 1000).toFixed(0)}s] ${message} ` +
      `(requests ${requestStats.requests}, budget left ${rateLimitState.remaining ?? '?'}, pauses ${rateLimitState.pauses})`,
  );

/** One feed, logged, so a feed that pages further than expected shows up. */
async function readFeed(label: string, source: { id: number; type: string }, from: string): Promise<FeedFixture[]> {
  const before = requestStats.requests;
  const feed = await fetchFeed(source, from);
  log(`${label}: ${feed.length} fixtures in ${requestStats.requests - before} requests`);
  return feed;
}

async function refreshArchive(manifest: ArchiveManifest | null, now: Date): Promise<ArchiveManifest> {
  const fields = createHash('sha256').update(FEED_QUERY).update(MATCH_CENTRE_QUERY).digest('hex').slice(0, 12);
  const council = { id: sources.council.id, type: sources.council.type };
  const firstPage = await fetchFeedPage(council, 0);
  const latest = firstPage.reduce((max, fixture) => (fixture.season > max ? fixture.season : max), '');
  const from = refreshFrom(manifest, latest, { fields, fullHistory });
  log(`Reading ${from ? `seasons from ${from}` : 'every season'}${manifest?.fields !== fields && manifest ? ' (fields changed)' : ''}`);

  // The council and union feeds define which competitions count as senior club.
  const baseFeeds: FeedFixture[][] = [await readFeed('Senior Club Council', council, from)];
  for (const union of sources.unions) {
    baseFeeds.push(await readFeed(union.name, { id: union.id, type: 'geographical-union' }, from));
  }
  let fixtures = mergeFeeds(baseFeeds);
  const competitions = new Set(fixtures.map((fixture) => fixture.compId));
  log(`Council and ${sources.unions.length} union feeds: ${fixtures.length} fixtures in ${competitions.size} competitions`);

  const clubIds = new Set(manifest?.clubIds ?? []);
  const readClubs = new Set<number>();
  const matches = new Map<string, MatchCentreData | null>();

  for (let round = 1; round <= MAX_DISCOVERY_ROUNDS; round++) {
    const pending = matchesToRead(fixtures, from, now).filter((fixture) => !matches.has(fixture.id));
    const { matches: read, failed } = await fetchMatches(
      pending,
      async (fixture): Promise<ArchivedMatch> => ({ fixtureId: fixture.id, match: await fetchMatchCentre(fixture) }),
      { concurrency: CONCURRENCY, gapMs: 0 },
    );
    // A partial pull could wrongly pass or fail a player, so the archive stays as it was.
    if (failed.length > 0) {
      throw new Error(`${failed.length} of ${pending.length} match records failed: ${failed.map((f) => f.id).join(', ')}`);
    }
    for (const { fixtureId, match } of read) matches.set(fixtureId, match);
    for (const id of clubIdsFromMatches(read.flatMap(({ match }) => (match ? [match] : [])))) clubIds.add(id);

    const toRead = [...clubIds].filter((id) => !readClubs.has(id));
    log(`Round ${round}: ${pending.length} match records, ${toRead.length} club feeds to read`);
    if (toRead.length === 0) break;
    const clubFeeds = await fetchClubFeeds(toRead, from, CONCURRENCY);
    for (const id of toRead) readClubs.add(id);
    const before = fixtures.length;
    fixtures = mergeFeeds([fixtures, ...clubFeeds.map((feed) => keepCompetitions(feed, competitions))]);
    log(`Club feeds added ${fixtures.length - before} fixtures`);
  }

  // Write each refreshed season: its fixture list and one file per played match.
  const refreshed = [...new Set(fixtures.map((fixture) => fixture.season))].sort();
  for (const season of refreshed) {
    const dir = path.join(ARCHIVE, seasonDir(season));
    const seasonFixtures = sortFixtures(fixtures.filter((fixture) => fixture.season === season));
    writeIfChanged(path.join(dir, 'fixtures.json'), seasonFixtures);
    const keep = new Set<string>();
    let changed = 0;
    for (const fixture of seasonFixtures) {
      if (!matches.has(fixture.id)) continue;
      const name = `${fixture.id}.json`;
      keep.add(name);
      if (writeIfChanged(path.join(dir, 'matches', name), { fixtureId: fixture.id, match: matches.get(fixture.id) })) {
        changed += 1;
      }
    }
    const removed = prune(path.join(dir, 'matches'), keep);
    log(`${season}: ${seasonFixtures.length} fixtures, ${keep.size} match records (${changed} changed, ${removed} removed)`);
  }

  return {
    fields,
    currentSeason: currentSeason(fixtures, now) || manifest?.currentSeason || latest,
    seasons: [...new Set([...(manifest?.seasons ?? []), ...refreshed])].sort(),
    clubIds: [...clubIds].sort((a, b) => a - b),
  };
}

function readSeason(season: string): { fixtures: FeedFixture[]; matches: MatchCentreData[] } {
  const dir = path.join(ARCHIVE, seasonDir(season));
  const fixtures = readJson<FeedFixture[]>(path.join(dir, 'fixtures.json')) ?? [];
  const matchDir = path.join(dir, 'matches');
  const matches = existsSync(matchDir)
    ? readdirSync(matchDir).flatMap((name) => {
        const { match } = readJson<ArchivedMatch>(path.join(matchDir, name)) as ArchivedMatch;
        return match ? [match] : [];
      })
    : [];
  return { fixtures, matches };
}

function publish(manifest: ArchiveManifest, now: Date): void {
  const { fixtures, matches } = readSeason(manifest.currentSeason);
  const data = buildPublished(fixtures, matches, eligibility, now);
  const generatedAt = now.toISOString();
  let changed = writeIfChanged(path.join(PUBLISHED, 'fixtures.json'), { season: data.season, fixtures: data.fixtures });
  const keep = new Set<string>();
  for (const [key, snapshot] of Object.entries(data.clubFiles)) {
    keep.add(`${key}.json`);
    changed = writeIfChanged(path.join(PUBLISHED, 'clubs', `${key}.json`), { ...snapshot, generatedAt }) || changed;
  }
  changed = prune(path.join(PUBLISHED, 'clubs'), keep) > 0 || changed;
  // The index's time is when the published data last changed, not when it was checked.
  const indexFile = path.join(PUBLISHED, 'index.json');
  const saved = readJson<{ generatedAt?: string }>(indexFile);
  writeIfChanged(indexFile, {
    generatedAt: changed || !saved?.generatedAt ? generatedAt : saved.generatedAt,
    season: data.season,
    clubs: data.clubs,
  });
  log(`Published ${data.season}: ${data.clubs.length} clubs, ${data.fixtures.length} fixtures, ${matches.length} match records${changed ? '' : ' (unchanged)'}`);
}

const now = new Date();
let manifest = readJson<ArchiveManifest>(MANIFEST);
if (!offline) {
  manifest = await refreshArchive(manifest, now);
  writeIfChanged(MANIFEST, manifest);
}
if (!manifest) {
  throw new Error('No archive yet: run without --offline first.');
}
publish(manifest, now);
const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
log(
  `Done in ${minutes} min: ${requestStats.requests} CMS requests, ${requestStats.retries} retries, ` +
    `${(requestStats.waitMs / 1000).toFixed(0)}s waiting on retries`,
);
