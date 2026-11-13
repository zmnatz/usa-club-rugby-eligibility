import fs from 'node:fs';
import path from 'node:path';
import {
  type LockedSeasonData,
  type ParticipationSnapshot,
  type PublishedFixturesFile,
  type PublishedIndexFile,
  type PublishedSeasonsFile,
  type SeasonSummary,
  seasonSummary,
} from '@zmnatz/usa-club-rugby-data';
import type { PublishedFiles, SeasonCounts, SeasonCountChange } from './data-diff.ts';

// Reading a built public/data directory, and the verdict counts it adds up to, for
// the CI helpers that compare two builds.

/** Every JSON file under a published data directory, keyed by its path. */
export function readPublished(dir: string): PublishedFiles {
  const files: Record<string, unknown> = {};
  const walk = (relative: string) => {
    for (const entry of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.json')) {
        files[file] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      }
    }
  };
  walk('');
  return files;
}

function summarize(summary: SeasonSummary): SeasonCounts {
  return {
    players: summary.players,
    matches: summary.matches,
    eligible: summary.divisions.reduce((total, division) => total + division.eligible, 0),
    ineligible: summary.ineligible.verdicts,
  };
}

/** The verdict counts each published season adds up to. The current season is
 *  assembled from its index, fixtures and club files; a Locked Season is one file. */
export function countsFor(files: PublishedFiles): Map<string, SeasonCounts> {
  const counts = new Map<string, SeasonCounts>();
  const index = files['index.json'] as PublishedIndexFile | undefined;
  const fixtures = files['fixtures.json'] as PublishedFixturesFile | undefined;
  if (index && fixtures) {
    const clubFiles: Record<string, ParticipationSnapshot> = {};
    for (const club of index.clubs) {
      const file = files[`clubs/${club.key}.json`];
      if (file) clubFiles[club.key] = file as ParticipationSnapshot;
    }
    counts.set(
      index.season,
      summarize(
        seasonSummary({
          season: index.season,
          slug: 'current',
          fixtures: fixtures.fixtures,
          clubs: index.clubs,
          clubFiles,
          unplacedTeams: [],
        }),
      ),
    );
  }
  const seasons = files['seasons.json'] as PublishedSeasonsFile | undefined;
  for (const { slug } of seasons?.seasons ?? []) {
    const file = files[`seasons/${slug}.json`] as LockedSeasonData | undefined;
    if (file) counts.set(file.season, summarize(seasonSummary(file)));
  }
  return counts;
}

const sameCounts = (a?: SeasonCounts, b?: SeasonCounts) =>
  a === undefined || b === undefined
    ? a === b
    : a.players === b.players && a.matches === b.matches && a.eligible === b.eligible && a.ineligible === b.ineligible;

/** Only the seasons whose counts differ, so the table stays short. */
export function countChanges(base: Map<string, SeasonCounts>, head: Map<string, SeasonCounts>): SeasonCountChange[] {
  const order = [...head.keys(), ...[...base.keys()].filter((season) => !head.has(season))];
  return order
    .filter((season) => !sameCounts(base.get(season), head.get(season)))
    .map((season) => ({ season, base: base.get(season), head: head.get(season) }));
}
