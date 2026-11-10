// The report's data logic with no UI: which columns, how rows sort and filter, and the
// export text. Pure, so it is tested directly; `EligibilityReportView` only renders it.
import {
  divisionLabel,
  type EligibilityBreakdown,
  hasSharedName,
  type ParticipationGap,
  type PlayerEligibility,
  sameNamePlayers,
  sharedNames,
  verdictRank,
} from '@zmnatz/usa-club-rugby-data';
import { formatDate, formatDateTime } from './dates';

/** Where a report's rows came from. Only a CSV report carries USA IDs and
 *  registration dates. */
export type ReportSource = 'record' | 'csv';

/** The advice that goes with Caution: a match missing from this report could change it. */
export const CAUTION_ADVICE =
  'Experimental: check the official Rugby Xplorer record for matches not counted here, as one could change this.';

export type StatusFilter = 'all' | 'eligible' | 'caution' | 'ineligible';

/** A fixed column, or `other:<label>` for another side's participation. */
export type SortKey =
  | 'name'
  | 'lastRegistered'
  | 'played'
  | 'sub'
  | 'participation'
  | 'status'
  | 'reasons'
  | `other:${string}`;

export interface ReportColumn {
  key: SortKey;
  title: string;
  numeric?: boolean;
}

export const getColumns = (otherLabels: string[], source: ReportSource): ReportColumn[] => [
  { key: 'name', title: 'Player' },
  ...(source === 'csv' ? [{ key: 'lastRegistered' as const, title: 'Last Registered' }] : []),
  { key: 'played', title: 'Played', numeric: true },
  { key: 'sub', title: 'Sub', numeric: true },
  { key: 'participation', title: 'Participation', numeric: true },
  ...otherLabels.map((label) => ({
    key: `other:${label}` as const,
    title: `${label} Participation`,
    numeric: true,
  })),
  { key: 'status', title: 'Status' },
  { key: 'reasons', title: 'Reason' },
];

/** A player's participation for an `other:<label>` column. */
export function otherSideCount(player: PlayerEligibility, key: `other:${string}`): number {
  const label = key.slice('other:'.length);
  return player.otherSides.find((side) => side.label === label)?.participation ?? 0;
}

export function sortValue(player: PlayerEligibility, key: SortKey): string | number {
  switch (key) {
    case 'name':
      return player.name;
    case 'lastRegistered':
      return player.lastRegistered;
    case 'played':
      return player.played;
    case 'sub':
      return player.substitute;
    case 'participation':
      return player.participation;
    case 'status':
      return verdictRank(player);
    case 'reasons':
      return player.reasons.length + player.cautions.length + player.pending.length;
    default:
      return otherSideCount(player, key);
  }
}

/** Whether a column sorts by number (the rest sort as text). */
export const sortsNumerically = (key: SortKey): boolean => key !== 'name' && key !== 'lastRegistered';

/** Which status filters a player shows under, as space-separated words for a row's
 *  `data-groups`. A cautioned or on-track player is eligible, so shows under both. */
export function statusGroups(player: PlayerEligibility): string {
  const groups: string[] = [player.eligible ? 'eligible' : 'ineligible'];
  if (player.cautions.length > 0) groups.push('caution');
  return groups.join(' ');
}

/** A gap in the match record, in the words shown on the page and in the export. */
export function gapText(gap: ParticipationGap): string {
  const problem = gap.kind === 'no-lineup' ? 'no lineup recorded' : 'no substitutions recorded';
  return `${gap.teamName} v ${gap.opponent} (${formatDate(gap.dateTime)}): ${problem}`;
}

function reportPlayerLine(player: PlayerEligibility, source: ReportSource, shared: Set<string>): string {
  const shownName =
    source === 'csv'
      ? `${player.name} (#${player.playerId})`
      : hasSharedName(player, shared)
        ? `${player.name} (CMS ID ${player.playerId})`
        : player.name;
  return (
    `${shownName}: ` +
    `played ${player.played} / sub ${player.substitute} ` +
    `(participation ${player.participation})` +
    player.otherSides.map((side) => `, ${side.label} participation ${side.participation}`).join('')
  );
}

export interface ReportMeta {
  /** Who the report is for, e.g. "Rocky Gorge". */
  title: string;
  source: ReportSource;
  season?: string;
  gaps: ParticipationGap[];
  /** When the record was last updated, UTC, if the report is of a saved record. Otherwise
   *  the report is stamped with `now`. */
  recordsUpdated?: string;
}

/** The exported report as text. `now` is when it was generated. */
export function buildReport(
  breakdown: EligibilityBreakdown,
  { title, source, season, gaps, recordsUpdated }: ReportMeta,
  now: Date,
): string {
  const lines: string[] = [];
  lines.push(`${title.toUpperCase()} ELIGIBILITY REPORT`);
  lines.push(
    recordsUpdated ? `Records last updated: ${formatDateTime(recordsUpdated)}` : `Generated: ${formatDateTime(now.toISOString())}`,
  );
  if (season) lines.push(`Source: match record, ${season} season`);
  lines.push('');
  if (gaps.length > 0) {
    lines.push('RECORD GAPS (counts may be low; check these matches)');
    for (const gap of gaps) {
      lines.push(`  ${gapText(gap)}`);
    }
    lines.push('');
  }

  if (breakdown.sides.some((side) => side.summary.caution > 0)) {
    lines.push(`CAUTION: ${CAUTION_ADVICE}`, '');
  }

  const sameNames = source === 'record' ? sameNamePlayers(breakdown.sides) : [];
  if (sameNames.length > 0) {
    lines.push('PLAYERS WITH THE SAME NAME (kept separate; counts may be low if one person has two profiles)');
    for (const { name, ids } of sameNames) {
      lines.push(`  ${name}: CMS IDs ${ids.join(', ')}`);
    }
    lines.push('');
  }

  for (const side of breakdown.sides) {
    const shared = sharedNames(side.players);
    const eligible = side.players.filter((p) => p.eligible);
    const ineligible = side.players.filter((p) => !p.eligible);

    lines.push('='.repeat(46));
    lines.push(divisionLabel(side.label, side.teamName, side.summary));
    lines.push('='.repeat(46));
    lines.push('');
    lines.push(`ELIGIBLE (${eligible.length})`);
    if (eligible.length === 0) {
      lines.push('  (none)');
    } else {
      for (const player of eligible) {
        lines.push(`  ${reportPlayerLine(player, source, shared)}`);
        for (const note of player.cautions) {
          lines.push(`    • Caution: ${note}`);
        }
        for (const note of player.pending) {
          lines.push(`    • On track: ${note}`);
        }
      }
    }
    lines.push('');
    lines.push(`INELIGIBLE (${ineligible.length})`);
    if (ineligible.length === 0) {
      lines.push('  (none)');
    } else {
      for (const player of ineligible) {
        lines.push(`  ${reportPlayerLine(player, source, shared)}`);
        for (const reason of player.reasons) {
          lines.push(`    • ${reason}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
