import { createHash } from 'node:crypto';
import path from 'node:path';
import { requestStats, rateLimitState } from '../api.ts';
import {
  type ArchiveManifest,
  buildLockedSeason,
  buildPublished,
  type LockedSeasonData,
  lockedSeasons,
  parseSeasonFixtures,
  parseSeasonMatches,
  type PublishedData,
  refreshFrom,
  type SeasonMatches,
  seasonFile,
  seasonSlug,
  serializeSeasonFixtures,
  serializeSeasonMatches,
} from '../archive.ts';
import { currentSeason, hashFeedQueries, type FeedFixture, type FeedSource, fetchFeedPage } from '../feeds.ts';
import { discoverFixtures } from '../live.ts';
import { hashMatchCentreQueries, type MatchCentreData } from '../playerHistory.ts';
import { DEFAULT_RULES } from '../rules.ts';
import { lockedSeasonPlayerIndex } from '../players.ts';
import { DEFAULT_SOURCES, type SourcesConfig } from '../sources.ts';
import type { EligibilityRules } from '../types.ts';
import { listJson, prune, readJson, readText, withoutStamp, writeIfChanged } from './files.ts';
import {
  type LockedSeasonFiles,
  lockedSeasonKey,
  pruneCache,
  readCachedSeason,
  writeCachedSeason,
} from './lockedSeasonCache.ts';

// The nightly job as a library: refresh the raw archive from the CMS, calculate the
// published files from it, and check that the published files can be recalculated.
// See docs/snapshots.md.

export interface SnapshotPaths {
  /** The raw match archive: manifest.json, fixtures/ and matches/. */
  archiveDir: string;
  /** The published data: index.json, fixtures.json, players.json, clubs/, seasons.json and seasons/. */
  publishedDir: string;
}

export interface SnapshotOptions extends SnapshotPaths {
  rules?: EligibilityRules;
  sources?: SourcesConfig;
  /** Calculate from the archive only, with no CMS requests. */
  offline?: boolean;
  /** Also read every past season the feeds list. */
  fullHistory?: boolean;
  /** The time the run is for. Defaults to the archive's `pulledAt`; an archive
   *  that records none falls back to the build's own time. */
  now?: Date;
  /** A directory to keep each Locked Season's published files in between runs, reused
   *  while the season's archive and this package's code are unchanged. */
  cacheDir?: string;
  log?: (message: string) => void;
}

const manifestFile = (archiveDir: string) => path.join(archiveDir, 'manifest.json');
const fixturesDir = (archiveDir: string) => path.join(archiveDir, 'fixtures');
const matchesDir = (archiveDir: string) => path.join(archiveDir, 'matches');

export function readManifest(archiveDir: string): ArchiveManifest | null {
  return readJson<ArchiveManifest>(manifestFile(archiveDir));
}

const readSeasonText = (archiveDir: string, season: string) => ({
  fixturesText: readText(path.join(fixturesDir(archiveDir), seasonFile(season))),
  matchesText: readText(path.join(matchesDir(archiveDir), seasonFile(season))),
});

/** A season's archived fixtures and match records (those the CMS had). */
export function readSeason(archiveDir: string, season: string): { fixtures: FeedFixture[]; matches: MatchCentreData[] } {
  return parseSeason(readSeasonText(archiveDir, season));
}

function parseSeason({ fixturesText, matchesText }: ReturnType<typeof readSeasonText>): {
  fixtures: FeedFixture[];
  matches: MatchCentreData[];
} {
  return {
    fixtures: fixturesText ? parseSeasonFixtures(fixturesText) : [],
    matches: matchesText
      ? Object.values(parseSeasonMatches(matchesText)).flatMap((match) => (match ? [match] : []))
      : [],
  };
}

/** A Locked Season's two published files. */
const renderLockedSeason = (locked: LockedSeasonData): LockedSeasonFiles => ({
  file: JSON.stringify(locked),
  players: JSON.stringify(lockedSeasonPlayerIndex(locked)),
});

/** The files the nightly job publishes, by path under the published directory.
 *  `generatedAt` is the one field that differs between two runs over the same data.
 *  `lockedFiles` holds Locked Seasons' files already rendered, by slug. */
export function renderPublished(
  data: PublishedData,
  generatedAt: string,
  lockedFiles: ReadonlyMap<string, LockedSeasonFiles> = new Map(),
): Map<string, string> {
  const files = new Map<string, string>();
  files.set('fixtures.json', JSON.stringify({ season: data.season, fixtures: data.fixtures }));
  files.set('players.json', JSON.stringify(data.players));
  for (const [key, snapshot] of Object.entries(data.clubFiles)) {
    files.set(`clubs/${key}.json`, JSON.stringify({ ...snapshot, generatedAt }));
  }
  files.set('index.json', JSON.stringify({ generatedAt, season: data.season, clubs: data.clubs }));
  const history = data.history ?? [];
  if (history.length > 0) {
    files.set(
      'seasons.json',
      JSON.stringify({
        seasons: history.map(({ season, slug, clubs, unplacedTeams }) => ({
          season,
          slug,
          clubs: clubs.length,
          unplacedTeams: unplacedTeams.length,
        })),
      }),
    );
  }
  // One file a season, and its player index. A Locked Season doesn't change, so neither
  // carries a time.
  for (const locked of history) {
    const { file, players } = lockedFiles.get(locked.slug) ?? renderLockedSeason(locked);
    files.set(`seasons/${locked.slug}.json`, file);
    files.set(`seasons/${locked.slug}.players.json`, players);
  }
  return files;
}

/** Calculates the published data from the archive alone. */
export function publishFromArchive(
  archiveDir: string,
  rules: EligibilityRules,
  now: Date,
): PublishedData {
  return publishWithCache(archiveDir, rules, now).data;
}

/** `publishFromArchive`, reusing and refreshing the Locked Seasons kept in `cacheDir`, if
 *  given. Returns the Locked Seasons' files too, rendered, so they aren't rendered twice. */
function publishWithCache(
  archiveDir: string,
  rules: EligibilityRules,
  now: Date,
  cacheDir?: string,
  log: (message: string) => void = () => {},
): { data: PublishedData; lockedFiles: Map<string, LockedSeasonFiles> } {
  const manifest = readManifest(archiveDir);
  if (!manifest) throw new Error(`No archive at ${archiveDir}: run without --offline first.`);
  const { fixtures, matches } = readSeason(archiveDir, manifest.currentSeason);
  const lockedFiles = new Map<string, LockedSeasonFiles>();
  const keys: { slug: string; key: string }[] = [];
  const reused: string[] = [];
  const history = lockedSeasons(manifest).map((season) => {
    const text = readSeasonText(archiveDir, season);
    if (!cacheDir) {
      const locked = parseSeason(text);
      return buildLockedSeason(locked.fixtures, locked.matches, season, now);
    }
    const slug = seasonSlug(season);
    const key = lockedSeasonKey(season, text.fixturesText ?? '', text.matchesText ?? '');
    keys.push({ slug, key });
    const cached = readCachedSeason(cacheDir, slug, key);
    if (cached) {
      reused.push(season);
      lockedFiles.set(slug, cached);
      return JSON.parse(cached.file) as LockedSeasonData;
    }
    const parsed = parseSeason(text);
    const locked = buildLockedSeason(parsed.fixtures, parsed.matches, season, now);
    const files = renderLockedSeason(locked);
    writeCachedSeason(cacheDir, slug, key, files);
    lockedFiles.set(slug, files);
    return locked;
  });
  if (cacheDir) {
    pruneCache(cacheDir, keys);
    log(`Locked Seasons: ${reused.length} of ${history.length} reused from ${cacheDir}`);
  }
  return { data: { ...buildPublished(fixtures, matches, rules, now), history }, lockedFiles };
}

/** Writes the published files, changing only those whose content changed: a
 *  differing `generatedAt` alone doesn't count as a change. */
export function writePublished(publishedDir: string, files: Map<string, string>): boolean {
  let changed = false;
  const keep = new Map<string, Set<string>>([
    ['clubs', new Set()],
    ['seasons', new Set()],
  ]);
  for (const [name, content] of files) {
    if (name === 'index.json') continue;
    keep.get(path.posix.dirname(name))?.add(path.posix.basename(name));
    changed = writeIfChanged(path.join(publishedDir, name), content) || changed;
  }
  for (const [dir, names] of keep) {
    changed = prune(path.join(publishedDir, dir), names) > 0 || changed;
  }
  changed = writeIfChanged(path.join(publishedDir, 'index.json'), files.get('index.json') as string) || changed;
  return changed;
}

async function refreshArchive(
  archiveDir: string,
  manifest: ArchiveManifest | null,
  { sources = DEFAULT_SOURCES, fullHistory = false, now = new Date(), log = () => {} }: SnapshotOptions,
): Promise<ArchiveManifest> {
  const hash = createHash('sha256');
  hashFeedQueries((text) => hash.update(text));
  hashMatchCentreQueries((text) => hash.update(text));
  const fields = hash.digest('hex').slice(0, 12);
  const council: FeedSource = { id: sources.council.id, type: sources.council.type };
  // The newest result says which season is current; results come newest first.
  const firstPage = await fetchFeedPage(council, 0, 100, 'results');
  const latest = firstPage.reduce((max, fixture) => (fixture.season > max ? fixture.season : max), '');
  const from = refreshFrom(manifest, latest, { fields, fullHistory });
  const fieldsChanged = manifest !== null && manifest.fields !== fields;
  log(`Reading ${from ? `seasons from ${from}` : 'every season'}${fieldsChanged ? ' (fields changed)' : ''}`);

  const { fixtures, matches, clubIds } = await discoverFixtures({
    sources,
    fromSeason: from,
    now,
    knownClubIds: manifest?.clubIds ?? [],
    log,
  });

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
      path.join(fixturesDir(archiveDir), seasonFile(season)),
      serializeSeasonFixtures(season, seasonFixtures),
    );
    const matchesChanged = writeIfChanged(
      path.join(matchesDir(archiveDir), seasonFile(season)),
      serializeSeasonMatches(season, seasonMatches),
    );
    log(
      `${season}: ${seasonFixtures.length} fixtures, ${Object.keys(seasonMatches).length} match records${fixturesChanged || matchesChanged ? '' : ' (unchanged)'}`,
    );
  }

  return {
    fields,
    currentSeason: currentSeason(fixtures, now) || manifest?.currentSeason || latest,
    seasons: [...new Set([...(manifest?.seasons ?? []), ...refreshed])].sort(),
    clubIds,
    pulledAt: now.toISOString(),
  };
}

/** The nightly job: refresh the archive from the CMS (unless offline), then
 *  calculate the published files from it. Nothing is written until every request
 *  has succeeded, so a failed run leaves the previous data in place. */
export async function runSnapshot(options: SnapshotOptions): Promise<{ changed: boolean; season: string; clubs: number }> {
  const { archiveDir, publishedDir, rules = DEFAULT_RULES, offline = false, log = () => {} } = options;
  let manifest = readManifest(archiveDir);
  if (!offline) {
    manifest = await refreshArchive(archiveDir, manifest, options);
    writeIfChanged(manifestFile(archiveDir), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (!manifest) throw new Error('No archive yet: run without --offline first.');
  // Calculated as of the last pull, so the same archive always gives the same data
  // once it records one. An archive from before `pulledAt` falls back to now.
  if (!options.now && !manifest.pulledAt) {
    log('No pulledAt in the archive: building as of now, so this build is not reproducible. Run a snapshot to record it.');
  }
  const now = options.now ?? (manifest.pulledAt ? new Date(manifest.pulledAt) : new Date());
  const { data, lockedFiles } = publishWithCache(archiveDir, rules, now, options.cacheDir, log);
  const changed = writePublished(publishedDir, renderPublished(data, now.toISOString(), lockedFiles));
  log(
    `Published ${data.season}: ${data.clubs.length} clubs, ${data.fixtures.length} fixtures${changed ? '' : ' (unchanged)'}` +
      ` (requests ${requestStats.requests}, rate-limit pauses ${rateLimitState.pauses})`,
  );
  return { changed, season: data.season, clubs: data.clubs.length };
}

export interface VerifyResult {
  ok: boolean;
  /** The time the published data was calculated for: its index's `generatedAt`. */
  asOf: string;
  /** Published files whose content differs from the recalculation. */
  different: string[];
  /** Files the recalculation makes that aren't published. */
  missing: string[];
  /** Published files the recalculation doesn't make. */
  extra: string[];
  checked: number;
}

/** Recalculates the published files from the archive and compares them with what
 *  is published. The calculation is a pure function of the archive, the rules and
 *  the time, and the published index records that time, so any difference means
 *  the archive, the rules or the code changed without the data being regenerated
 *  (or the published files were edited by hand). */
export function verifyPublished(options: SnapshotPaths & { rules?: EligibilityRules; now?: Date }): VerifyResult {
  const { archiveDir, publishedDir, rules = DEFAULT_RULES } = options;
  const index = readJson<{ generatedAt: string }>(path.join(publishedDir, 'index.json'));
  if (!index) throw new Error(`No published data at ${publishedDir}.`);
  const now = options.now ?? new Date(index.generatedAt);
  const expected = renderPublished(publishFromArchive(archiveDir, rules, now), index.generatedAt);

  const different: string[] = [];
  const missing: string[] = [];
  for (const [name, content] of expected) {
    const saved = readText(path.join(publishedDir, name));
    if (saved === null) missing.push(name);
    else if (withoutStamp(saved) !== withoutStamp(content)) different.push(name);
  }
  const extra = ['clubs', 'seasons']
    .flatMap((dir) => listJson(path.join(publishedDir, dir)).map((name) => `${dir}/${name}`))
    .filter((name) => !expected.has(name));
  return {
    ok: different.length + missing.length + extra.length === 0,
    asOf: index.generatedAt,
    different,
    missing,
    extra,
    checked: expected.size,
  };
}
