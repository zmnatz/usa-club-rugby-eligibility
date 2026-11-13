import type { LockedSeasonData, ParticipationSnapshot, PublishedSeasonsFile } from '@zmnatz/usa-club-rugby-data';

// What changed between two builds of a published data directory. The build stamp
// differs by design (it is the archive's last pull), so it is the one field left
// out of every comparison.

/** Every published JSON file, keyed by its path under the data directory. */
export type PublishedFiles = Readonly<Record<string, unknown>>;

/** A club file whose content changed, and what changed in it. */
export interface ClubChange {
  key: string;
  details: string[];
}

/** A Locked Season file whose content changed, and what changed in it. */
export interface SeasonChange {
  slug: string;
  details: string[];
}

export interface DataDiff {
  /** No published file differs once the build stamp is ignored. */
  unchanged: boolean;
  /** The current season in each build, when they differ. */
  season?: { base?: string; head?: string };
  clubs: { added: string[]; removed: string[]; changed: ClubChange[] };
  fixtures: { added: string[]; removed: string[]; changed: string[] };
  seasons: { added: string[]; removed: string[]; changed: SeasonChange[] };
  /** `index.json` changed beyond its season name and stamp: a club or a side did. */
  clubListChanged: boolean;
}

/** Counts of one season's verdicts, as its stats page shows them. */
export interface SeasonCounts {
  players: number;
  matches: number;
  eligible: number;
  ineligible: number;
}

export interface SeasonCountChange {
  season: string;
  base?: SeasonCounts;
  head?: SeasonCounts;
}

export interface CommentInput {
  diff: DataDiff;
  counts: SeasonCountChange[];
  baseSha?: string;
  headSha?: string;
  runUrl?: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const signed = (n: number, one: string) => `${n > 0 ? '+' : '-'}${plural(Math.abs(n), one)}`;

/** JSON with object keys ordered, so two builds that differ only in key order compare equal. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
}

/** A file's content without its `generatedAt` stamp. */
function comparable(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return stable(value);
  const rest = { ...(value as Record<string, unknown>) };
  delete rest.generatedAt;
  return stable(rest);
}

function clubKeys(files: PublishedFiles): string[] {
  return Object.keys(files)
    .filter((file) => /^clubs\/[^/]+\.json$/.test(file) && files[file] !== undefined)
    .map((file) => file.slice('clubs/'.length, -'.json'.length));
}

function rowKey(row: { teamName: string; competition: string; playerId: string }): string {
  return `${row.teamName}\0${row.competition}\0${row.playerId}`;
}

function clubDetails(base: ParticipationSnapshot, head: ParticipationSnapshot): string[] {
  const details: string[] = [];
  const before = new Map((base.rows ?? []).map((row) => [rowKey(row), row]));
  const after = new Map((head.rows ?? []).map((row) => [rowKey(row), row]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [key, row] of after) {
    const old = before.get(key);
    if (!old) added += 1;
    else if (stable(old) !== stable(row)) changed += 1;
  }
  for (const key of before.keys()) if (!after.has(key)) removed += 1;
  if (added) details.push(`${plural(added, 'player row')} added`);
  if (removed) details.push(`${plural(removed, 'player row')} removed`);
  if (changed) details.push(`${plural(changed, 'player row')} changed`);

  const results = (head.resultIds?.length ?? 0) - (base.resultIds?.length ?? 0);
  if (results) details.push(`${signed(results, 'counted result')}`);
  const gaps = (head.gaps?.length ?? 0) - (base.gaps?.length ?? 0);
  if (gaps) details.push(`${signed(gaps, 'gap')}`);
  const transfers = Object.keys(head.transfers ?? {}).length - Object.keys(base.transfers ?? {}).length;
  if (transfers) details.push(`${signed(transfers, 'transfer')}`);
  if (base.season !== head.season) details.push(`season ${base.season} → ${head.season}`);
  if (Boolean(base.locked) !== Boolean(head.locked)) details.push(head.locked ? 'now locked' : 'no longer locked');
  return details;
}

function seasonDetails(base: LockedSeasonData, head: LockedSeasonData): string[] {
  const details: string[] = [];
  const keys = new Set([...Object.keys(base.clubFiles), ...Object.keys(head.clubFiles)]);
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const key of keys) {
    const before = base.clubFiles[key];
    const after = head.clubFiles[key];
    if (!before) added += 1;
    else if (!after) removed += 1;
    else if (comparable(before) !== comparable(after)) changed += 1;
  }
  if (added) details.push(`${plural(added, 'club')} added`);
  if (removed) details.push(`${plural(removed, 'club')} removed`);
  if (changed) details.push(`${plural(changed, 'club')} changed`);
  if (comparable(base.clubs) !== comparable(head.clubs)) details.push('the club list changed');
  const unplaced = head.unplacedTeams.length - base.unplacedTeams.length;
  if (unplaced) details.push(`${signed(unplaced, 'unplaced team')}`);
  return details;
}

/** Compares two published data directories, ignoring the build stamp. */
export function diffPublished(base: PublishedFiles, head: PublishedFiles): DataDiff {
  const baseClubs = new Set(clubKeys(base));
  const headClubs = new Set(clubKeys(head));
  const changed: ClubChange[] = [];
  for (const key of headClubs) {
    const before = base[`clubs/${key}.json`];
    const after = head[`clubs/${key}.json`];
    if (before === undefined) continue;
    const details = clubDetails(before as ParticipationSnapshot, after as ParticipationSnapshot);
    if (details.length > 0) changed.push({ key, details });
  }
  changed.sort((a, b) => a.key.localeCompare(b.key));

  const fixtureMap = (files: PublishedFiles) => {
    const file = files['fixtures.json'] as { fixtures?: { id: string }[] } | undefined;
    return new Map((file?.fixtures ?? []).map((fixture) => [fixture.id, fixture]));
  };
  const baseFixtures = fixtureMap(base);
  const headFixtures = fixtureMap(head);
  const fixtures = {
    added: [...headFixtures.keys()].filter((id) => !baseFixtures.has(id)).sort(),
    removed: [...baseFixtures.keys()].filter((id) => !headFixtures.has(id)).sort(),
    changed: [...headFixtures.entries()]
      .filter(([id, fixture]) => baseFixtures.has(id) && stable(baseFixtures.get(id)) !== stable(fixture))
      .map(([id]) => id)
      .sort(),
  };

  const seasonList = (files: PublishedFiles) => (files['seasons.json'] as PublishedSeasonsFile | undefined)?.seasons ?? [];
  const baseSeasons = new Map(seasonList(base).map((season) => [season.slug, season]));
  const headSeasons = new Map(seasonList(head).map((season) => [season.slug, season]));
  const changedSeasons: SeasonChange[] = [];
  for (const slug of headSeasons.keys()) {
    if (!baseSeasons.has(slug)) continue;
    const before = base[`seasons/${slug}.json`];
    const after = head[`seasons/${slug}.json`];
    if (before === undefined || after === undefined) continue;
    const details = seasonDetails(before as LockedSeasonData, after as LockedSeasonData);
    if (details.length > 0) changedSeasons.push({ slug, details });
  }
  changedSeasons.sort((a, b) => a.slug.localeCompare(b.slug));

  const baseIndex = base['index.json'] as { season?: string } | undefined;
  const headIndex = head['index.json'] as { season?: string } | undefined;
  const season =
    baseIndex?.season !== headIndex?.season ? { base: baseIndex?.season, head: headIndex?.season } : undefined;
  const withoutSeason = (index: { season?: string }) => {
    const rest = { ...index };
    delete rest.season;
    return comparable(rest);
  };
  // A missing index in one build is covered by the clubs and fixtures: it is not a
  // renamed club or a changed side, so it isn't shown as one.
  const clubListChanged =
    baseIndex !== undefined && headIndex !== undefined && withoutSeason(baseIndex) !== withoutSeason(headIndex);
  const indexChanged = clubListChanged || (baseIndex === undefined) !== (headIndex === undefined);

  const unchanged =
    fixtures.added.length === 0 &&
    fixtures.removed.length === 0 &&
    fixtures.changed.length === 0 &&
    baseClubs.size === headClubs.size &&
    [...headClubs].every((key) => baseClubs.has(key)) &&
    changed.length === 0 &&
    baseSeasons.size === headSeasons.size &&
    [...headSeasons.keys()].every((slug) => baseSeasons.has(slug)) &&
    changedSeasons.length === 0 &&
    !indexChanged;

  return {
    unchanged,
    season,
    clubs: {
      added: [...headClubs].filter((key) => !baseClubs.has(key)).sort(),
      removed: [...baseClubs].filter((key) => !headClubs.has(key)).sort(),
      changed,
    },
    fixtures,
    seasons: {
      added: [...headSeasons.keys()].filter((slug) => !baseSeasons.has(slug)).sort(),
      removed: [...baseSeasons.keys()].filter((slug) => !headSeasons.has(slug)).sort(),
      changed: changedSeasons,
    },
    clubListChanged,
  };
}

const LIMIT = 20;

function listed(items: string[], code = true): string {
  const shown = items.slice(0, LIMIT).map((item) => (code ? `\`${item}\`` : item));
  const more = items.length - shown.length;
  return `${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

function number(n: number | undefined): string {
  return n === undefined ? '—' : n.toLocaleString('en-US');
}

function countsTable(counts: SeasonCountChange[]): string[] {
  if (counts.length === 0) return [];
  const lines = [
    '### Verdicts',
    '',
    '| Season | Build | Players | Eligible | Ineligible | Counted matches |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  ];
  for (const { season, base, head } of counts) {
    lines.push(
      `| ${season} | base | ${number(base?.players)} | ${number(base?.eligible)} | ${number(base?.ineligible)} | ${number(base?.matches)} |`,
    );
    lines.push(
      `| | head | ${number(head?.players)} | ${number(head?.eligible)} | ${number(head?.ineligible)} | ${number(head?.matches)} |`,
    );
  }
  return lines;
}

/** The counts as list text: the changes page is MDX without a table extension, so
 *  it gets a list where the PR comment, rendered by GitHub, gets a table. */
function countsList(counts: SeasonCountChange[]): string[] {
  if (counts.length === 0) return [];
  const lines = ['**Verdicts**', ''];
  for (const { season, base, head } of counts) {
    const metrics = [
      `players ${number(base?.players)} → ${number(head?.players)}`,
      `eligible ${number(base?.eligible)} → ${number(head?.eligible)}`,
      `ineligible ${number(base?.ineligible)} → ${number(head?.ineligible)}`,
      `counted matches ${number(base?.matches)} → ${number(head?.matches)}`,
    ];
    lines.push(`- **${season}**: ${metrics.join(', ')}`);
  }
  return lines;
}

function changeLines(diff: DataDiff): string[] {
  const lines: string[] = [];
  const { clubs, fixtures, seasons } = diff;

  if (clubs.added.length > 0) lines.push(`- **Clubs added:** ${listed(clubs.added)}`);
  if (clubs.removed.length > 0) lines.push(`- **Clubs removed:** ${listed(clubs.removed)}`);
  if (diff.clubListChanged) lines.push('- **The club list changed:** a club was renamed or its sides changed.');
  if (clubs.changed.length > 0) {
    lines.push(`- **${plural(clubs.changed.length, 'club')} changed:**`);
    for (const { key, details } of clubs.changed.slice(0, LIMIT)) {
      lines.push(`  - \`${key}\`: ${details.join(', ')}`);
    }
    if (clubs.changed.length > LIMIT) lines.push(`  - …and ${clubs.changed.length - LIMIT} more`);
  }

  if (fixtures.added.length > 0) lines.push(`- **Fixtures added:** ${plural(fixtures.added.length, 'fixture')}`);
  if (fixtures.removed.length > 0) lines.push(`- **Fixtures removed:** ${plural(fixtures.removed.length, 'fixture')}`);
  if (fixtures.changed.length > 0) lines.push(`- **Fixtures changed:** ${plural(fixtures.changed.length, 'fixture')}`);

  if (seasons.added.length > 0) lines.push(`- **Locked Seasons added:** ${listed(seasons.added)}`);
  if (seasons.removed.length > 0) lines.push(`- **Locked Seasons removed:** ${listed(seasons.removed)}`);
  if (seasons.changed.length > 0) {
    lines.push(`- **${plural(seasons.changed.length, 'Locked Season')} changed:**`);
    for (const { slug, details } of seasons.changed.slice(0, LIMIT)) {
      lines.push(`  - \`${slug}\`: ${details.join(', ')}`);
    }
    if (seasons.changed.length > LIMIT) lines.push(`  - …and ${seasons.changed.length - LIMIT} more`);
  }

  return lines;
}

/** A short label for an entry's summary: what changed, in a few words. */
export function changeSummary(diff: DataDiff): string {
  if (diff.unchanged) return 'No published data changed';
  const parts: string[] = [];
  const clubs = diff.clubs.added.length + diff.clubs.removed.length + diff.clubs.changed.length;
  if (clubs) parts.push(plural(clubs, 'club'));
  const fixtures = diff.fixtures.added.length + diff.fixtures.removed.length + diff.fixtures.changed.length;
  if (fixtures) parts.push(plural(fixtures, 'fixture'));
  const seasons = diff.seasons.added.length + diff.seasons.removed.length + diff.seasons.changed.length;
  if (seasons) parts.push(plural(seasons, 'Locked Season'));
  if (diff.clubListChanged) parts.push('the club list');
  const words = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `${words} changed`;
}

/** The report itself: the verdict counts and what changed. */
export function reportBody(diff: DataDiff, counts: SeasonCountChange[], style: 'table' | 'list' = 'table'): string[] {
  if (diff.unchanged) return ['No published file changed.'];
  const lines: string[] = [];
  if (diff.season) {
    lines.push(`The current season changed from ${diff.season.base ?? '—'} to ${diff.season.head ?? '—'}.`, '');
  }
  const section = style === 'table' ? countsTable(counts) : countsList(counts);
  if (section.length > 0) lines.push(...section, '');
  lines.push(...changeLines(diff));
  return lines;
}

/** The sticky PR comment: what the branch does to the published data. */
export function buildComment({ diff, counts, baseSha, headSha, runUrl }: CommentInput): string {
  const lines = ['<!-- pr-data-diff -->', '## Published data', ''];
  const from = baseSha ? `\`${baseSha.slice(0, 7)}\`` : 'the base';
  const to = headSha ? `\`${headSha.slice(0, 7)}\`` : 'the head';
  lines.push(
    `Both builds are calculated from \`archive/\`, at ${from} and ${to}${runUrl ? ` ([run](${runUrl}))` : ''}. ` +
      "Verdicts are counted with this branch's rules.",
    '',
    ...reportBody(diff, counts),
  );
  return lines.join('\n');
}

export interface EntryInput {
  diff: DataDiff;
  counts: SeasonCountChange[];
  /** The entry's anchor, e.g. "change-2026-11-14". */
  id: string;
  /** The summary line, e.g. "Nov 14, 2026 — 12 clubs changed". */
  title: string;
  /** Expanded by default; only the newest entry on the page is. */
  open?: boolean;
}

/** One entry of the published changes page, as MDX. */
export function buildEntry({ diff, counts, id, title, open = false }: EntryInput): string {
  return [
    `<details${open ? ' open' : ''} id="${id}">`,
    `<summary><a href="#${id}">${title}</a></summary>`,
    '',
    ...reportBody(diff, counts, 'list'),
    '',
    '</details>',
  ].join('\n');
}
