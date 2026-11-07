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
  type ArchiveManifest,
  buildPublished,
  fetchMatchRecords,
  matchesToRead,
  parseSeasonFixtures,
  parseSeasonMatches,
  refreshFrom,
  type SeasonMatches,
  seasonFile,
  serializeSeasonFixtures,
  serializeSeasonMatches,
} from '@/utils/archive';
import {
  CLUB_FEED_BATCH_SIZE,
  CLUB_PAGE_SIZE,
  clubIdsFromMatches,
  currentSeason,
  FEED_QUERY,
  type FeedFixture,
  type FeedSource,
  fetchFeedPage,
  fetchFeeds,
  keepCompetitions,
  mergeFeeds,
} from '@/utils/feeds';
import { MATCH_CENTRE_QUERY, type MatchCentreData } from '@/utils/playerHistory';

const ROOT = path.resolve(import.meta.dir, '..');
const ARCHIVE = path.join(ROOT, 'archive');
const FIXTURES_DIR = path.join(ARCHIVE, 'fixtures');
const MATCHES_DIR = path.join(ARCHIVE, 'matches');
const MANIFEST = path.join(ARCHIVE, 'manifest.json');
const PUBLISHED = path.join(ROOT, 'public', 'data');
/** Club feeds lead to more clubs; a few rounds reach every club with a result. */
const MAX_DISCOVERY_ROUNDS = 5;

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');
const fullHistory = args.has('--full-history');
const startedAt = Date.now();

const readText = (file: string): string | null => (existsSync(file) ? readFileSync(file, 'utf8') : null);
const readJson = <T>(file: string): T | null => {
  const text = readText(file);
  return text === null ? null : (JSON.parse(text) as T);
};

/** Writes only when the content differs, ignoring `generatedAt`, so a quiet night
 *  changes nothing and makes no commit. */
function writeIfChanged(file: string, content: string): boolean {
  const strip = (text: string) => text.replace(/"generatedAt":"[^"]*",?/, '');
  const saved = readText(file);
  if (saved !== null && strip(saved) === strip(content)) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
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
      `(requests ${requestStats.requests}, left ${rateLimitState.remaining ?? '?'} requests / ` +
      `${rateLimitState.complexityRemaining ?? '?'} complexity, pauses ${JSON.stringify(rateLimitState.pausesBy)})`,
  );

async function refreshArchive(manifest: ArchiveManifest | null, now: Date): Promise<ArchiveManifest> {
  const fields = createHash('sha256').update(FEED_QUERY).update(MATCH_CENTRE_QUERY).digest('hex').slice(0, 12);
  const council: FeedSource = { id: sources.council.id, type: sources.council.type };
  // The newest result says which season is current; results come newest first.
  const firstPage = await fetchFeedPage(council, 0, 100, 'results');
  const latest = firstPage.reduce((max, fixture) => (fixture.season > max ? fixture.season : max), '');
  const from = refreshFrom(manifest, latest, { fields, fullHistory });
  const fieldsChanged = manifest !== null && manifest.fields !== fields;
  log(`Reading ${from ? `seasons from ${from}` : 'every season'}${fieldsChanged ? ' (fields changed)' : ''}`);

  // The council and union feeds define which competitions count as senior club.
  const baseSources: { label: string; source: FeedSource }[] = [
    { label: 'Senior Club Council', source: council },
    ...sources.unions.map((union) => ({ label: union.name, source: { id: union.id, type: 'geographical-union' } })),
  ];
  const baseFeeds = await fetchFeeds(
    baseSources.map(({ source }) => source),
    from,
  );
  baseFeeds.forEach((feed, i) => {
    if (feed.length === 0) log(`${baseSources[i].label}: no fixtures`);
  });
  let fixtures = mergeFeeds(baseFeeds);
  const competitions = new Set(fixtures.map((fixture) => fixture.compId));
  log(`Council and ${sources.unions.length} union feeds: ${fixtures.length} fixtures in ${competitions.size} competitions`);

  const clubIds = new Set(manifest?.clubIds ?? []);
  const readClubs = new Set<number>();
  const matches = new Map<string, MatchCentreData | null>();

  for (let round = 1; round <= MAX_DISCOVERY_ROUNDS; round++) {
    const pending = matchesToRead(fixtures, from, now).filter((fixture) => !matches.has(fixture.id));
    for (const [id, match] of await fetchMatchRecords(pending)) matches.set(id, match);
    const found = clubIdsFromMatches([...matches.values()].flatMap((match) => (match ? [match] : [])));
    for (const id of found) clubIds.add(id);

    const toRead = [...clubIds].filter((id) => !readClubs.has(id));
    log(`Round ${round}: ${pending.length} match records, ${toRead.length} club feeds to read`);
    if (toRead.length === 0) break;
    const clubFeeds = await fetchFeeds(
      toRead.map((id) => ({ id, type: 'club' })),
      from,
      { pageSize: CLUB_PAGE_SIZE, batchSize: CLUB_FEED_BATCH_SIZE },
    );
    for (const id of toRead) readClubs.add(id);
    const before = fixtures.length;
    fixtures = mergeFeeds([fixtures, ...clubFeeds.map((feed) => keepCompetitions(feed, competitions))]);
    log(`Club feeds added ${fixtures.length - before} fixtures`);
  }

  // Each refreshed season's files hold exactly this run's fixtures and records, so a
  // fixture dropped from every feed goes too. Locked seasons aren't touched.
  const refreshed = [...new Set(fixtures.map((fixture) => fixture.season))].sort();
  for (const season of refreshed) {
    const seasonFixtures = fixtures.filter((fixture) => fixture.season === season);
    const seasonMatches: SeasonMatches = {};
    for (const fixture of seasonFixtures) {
      if (matches.has(fixture.id)) seasonMatches[fixture.id] = matches.get(fixture.id) ?? null;
    }
    const fixturesChanged = writeIfChanged(
      path.join(FIXTURES_DIR, seasonFile(season)),
      serializeSeasonFixtures(season, seasonFixtures),
    );
    const matchesChanged = writeIfChanged(
      path.join(MATCHES_DIR, seasonFile(season)),
      serializeSeasonMatches(season, seasonMatches),
    );
    const changed = fixturesChanged || matchesChanged;
    log(
      `${season}: ${seasonFixtures.length} fixtures, ${Object.keys(seasonMatches).length} match records${changed ? '' : ' (unchanged)'}`,
    );
  }

  return {
    fields,
    currentSeason: currentSeason(fixtures, now) || manifest?.currentSeason || latest,
    seasons: [...new Set([...(manifest?.seasons ?? []), ...refreshed])].sort(),
    clubIds: [...clubIds].sort((a, b) => a - b),
  };
}

function readSeason(season: string): { fixtures: FeedFixture[]; matches: MatchCentreData[] } {
  const fixturesText = readText(path.join(FIXTURES_DIR, seasonFile(season)));
  const matchesText = readText(path.join(MATCHES_DIR, seasonFile(season)));
  return {
    fixtures: fixturesText ? parseSeasonFixtures(fixturesText) : [],
    matches: matchesText
      ? Object.values(parseSeasonMatches(matchesText)).flatMap((match) => (match ? [match] : []))
      : [],
  };
}

function publish(manifest: ArchiveManifest, now: Date): void {
  const { fixtures, matches } = readSeason(manifest.currentSeason);
  const data = buildPublished(fixtures, matches, eligibility, now);
  const generatedAt = now.toISOString();
  let changed = writeIfChanged(
    path.join(PUBLISHED, 'fixtures.json'),
    JSON.stringify({ season: data.season, fixtures: data.fixtures }),
  );
  const keep = new Set<string>();
  for (const [key, snapshot] of Object.entries(data.clubFiles)) {
    keep.add(`${key}.json`);
    changed =
      writeIfChanged(path.join(PUBLISHED, 'clubs', `${key}.json`), JSON.stringify({ ...snapshot, generatedAt })) ||
      changed;
  }
  changed = prune(path.join(PUBLISHED, 'clubs'), keep) > 0 || changed;
  // The index's time is when the published data last changed, not when it was checked.
  const indexFile = path.join(PUBLISHED, 'index.json');
  const saved = readJson<{ generatedAt?: string }>(indexFile);
  writeIfChanged(
    indexFile,
    JSON.stringify({
      generatedAt: changed || !saved?.generatedAt ? generatedAt : saved.generatedAt,
      season: data.season,
      clubs: data.clubs,
    }),
  );
  log(
    `Published ${data.season}: ${data.clubs.length} clubs, ${data.fixtures.length} fixtures, ${matches.length} match records${changed ? '' : ' (unchanged)'}`,
  );
}

const now = new Date();
let manifest = readJson<ArchiveManifest>(MANIFEST);
if (!offline) {
  manifest = await refreshArchive(manifest, now);
  writeIfChanged(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}
if (!manifest) {
  throw new Error('No archive yet: run without --offline first.');
}
publish(manifest, now);
const minutes = ((Date.now() - startedAt) / 60000).toFixed(1);
log(
  `Done in ${minutes} min: ${requestStats.requests} CMS requests, ${requestStats.retries} retries, ` +
    `${(requestStats.waitMs / 1000).toFixed(0)}s with the rate limit gate closed`,
);
