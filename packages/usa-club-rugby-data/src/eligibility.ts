import { parseCsv } from './csv.ts';
import { scheduleShareTrigger } from './rules.ts';
import { isNcsSide, parseTeamSide, sideLabel, type TeamSide } from './teamSide.ts';
import type {
  BreakdownOptions,
  Club,
  DivisionSummary,
  EligibilityBreakdown,
  EligibilityRules,
  PlayerEligibility,
  PlayerRow,
  RemainingMatches,
  Side,
} from './types.ts';

const HEADER_COLUMNS = [
  'USA ID',
  'First Name',
  'Last Name',
  'Player Last Registered',
  'Team Name',
  'Competition',
  'Appearances',
  'Played',
  'Substitute',
] as const;

/** Parse a Rugby Xplorer "matches played" CSV export into PlayerRow records.
 *  The per-round attendance columns (Round 1..N) are kept for detail display;
 *  eligibility reads only the Played + Substitute totals. */
export function parsePlayerRows(csvText: string): PlayerRow[] {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('The CSV contains a header but no player rows.');
  }

  const header = rows[0].map((cell) => cell.trim());
  const indexOf = (name: string) => {
    const at = header.indexOf(name);
    if (at === -1) {
      throw new Error(`The CSV is missing an expected column: "${name}"`);
    }
    return at;
  };

  const col = Object.fromEntries(
    HEADER_COLUMNS.map((name) => [name, indexOf(name)]),
  ) as Record<(typeof HEADER_COLUMNS)[number], number>;

  const ROUND_RE = /^Round \d+$/;
  const roundCols = header
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => ROUND_RE.test(name));

  const asNumber = (value: string) => Number(value) || 0;

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => ({
      playerId: row[col['USA ID']].trim(),
      firstName: row[col['First Name']].trim(),
      lastName: row[col['Last Name']].trim(),
      lastRegistered: row[col['Player Last Registered']].trim(),
      teamName: row[col['Team Name']].trim(),
      competition: row[col.Competition].trim(),
      appearances: asNumber(row[col.Appearances]),
      played: asNumber(row[col.Played]),
      substitute: asNumber(row[col.Substitute]),
      rounds: Object.fromEntries(
        roundCols.map(({ name, index }) => [name, row[index]?.trim() ?? '']),
      ),
    }));
}

/** Match Participation for a team's rows — Played + Substitute (a player who
 *  stepped on the field as a starter or replacement). The per-round attendance
 *  codes do not count; see docs/adr/008-eligibility-rules.md. */
function participation(row: PlayerRow | undefined): number {
  if (!row) return 0;
  return row.played + row.substitute;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** A side's roster: players keyed by id (rows across competitions combined),
 *  each player's raw rows, and the competitions those rows span. */
interface Roster {
  side: Side;
  combined: Map<string, PlayerRow>;
  sources: Map<string, PlayerRow[]>;
  competitions: Set<string>;
}

/** Combine two rows for the same player on the same team, summing the match
 *  totals so participation reflects every competition the report lists. */
function combineRows(previous: PlayerRow, next: PlayerRow): PlayerRow {
  return {
    ...previous,
    appearances: previous.appearances + next.appearances,
    played: previous.played + next.played,
    substitute: previous.substitute + next.substitute,
  };
}

function buildRoster(side: Side, rows: PlayerRow[]): Roster {
  const combined = new Map<string, PlayerRow>();
  const sources = new Map<string, PlayerRow[]>();
  const competitions = new Set<string>();
  for (const row of rows) {
    if (row.teamName !== side.teamName) continue;
    const key = row.playerId.trim();
    if (!key) continue;
    if (row.competition.trim() !== '') competitions.add(row.competition);
    const previous = combined.get(key);
    combined.set(key, previous ? combineRows(previous, row) : row);
    sources.set(key, [...(sources.get(key) ?? []), row]);
  }
  return { side, combined, sources, competitions };
}

/** The verdict for one player on the side at `index`. Reg 3.5(d) and Figure 1:
 *  a lower side's minimum and its comparison both count that side and those below
 *  it, against every side above. Regulations stop at three divisions; a fourth
 *  follows the same form. See docs/adr/012-eligibility-for-any-number-of-sides.md. */
function evaluate(
  row: PlayerRow,
  index: number,
  rosters: Roster[],
  rules: EligibilityRules,
  remaining: RemainingMatches,
  { locked, scheduled }: Required<BreakdownOptions>,
): PlayerEligibility {
  const key = row.playerId.trim();
  const counts = rosters.map((roster) => participation(roster.combined.get(key)));
  const above = counts.slice(0, index);
  const atOrBelow = sum(counts.slice(index));
  const own = rosters[index].side;
  const isLowest = index === rosters.length - 1;
  const ownLabel = isLowest ? own.label : `${own.label} or lower`;
  const fixturesLeft = sum(
    rosters.slice(index).map((roster) => remaining[roster.side.teamName] ?? 0),
  );

  const fixturesKnown = rosters.slice(index).every((roster) => remaining[roster.side.teamName] !== undefined);

  const reasons: string[] = [];
  const pending: string[] = [];
  const cautions: string[] = [];

  // A two-match minimum is met if the player can still reach it by Super
  // Regionals (Reg 3.5.1(a)); see docs/adr/008-eligibility-rules.md.
  const checkMinimum = (count: number, matchLabel: string) => {
    if (count >= rules.minimumMatches) return;
    const short = rules.minimumMatches - count;
    if (short <= fixturesLeft) {
      pending.push(
        `Needs ${short} more ${matchLabel} match${short === 1 ? '' : 'es'} (${fixturesLeft} fixture${fixturesLeft === 1 ? '' : 's'} left)`,
      );
    } else {
      reasons.push(`Needs ${rules.minimumMatches} ${matchLabel} matches (has ${count})`);
    }
  };

  if (index === 0) {
    checkMinimum(sum(counts), 'qualifying');
  } else {
    checkMinimum(atOrBelow, ownLabel);
    const { upperMatchLimit, scheduleShare } = rules;
    if (upperMatchLimit !== null) {
      for (const [aboveIndex, count] of above.entries()) {
        if (count >= upperMatchLimit) {
          reasons.push(
            `Played ${count} ${rosters[aboveIndex].side.label} matches — playing ${upperMatchLimit} for an upper side loses ${own.label} eligibility`,
          );
        } else if (count === upperMatchLimit - 1) {
          cautions.push(
            `One more ${rosters[aboveIndex].side.label} match (${count} played) loses ${own.label} eligibility for the rest of the season`,
          );
        }
      }
    }
    if (scheduleShare) {
      const schedules = rosters.slice(0, index).map((roster) => scheduled[roster.side.teamName] ?? 0).filter((n) => n > 0);
      if (schedules.length > 0) {
        const schedule = Math.min(...schedules);
        const limit = scheduleShareTrigger(schedule, scheduleShare);
        const loses = `reaching ${limit} (66% of a ${schedule}-match schedule) loses ${own.label} eligibility`;
        if (scheduleShare.combineUpperSides) {
          if (sum(above) >= limit) reasons.push(`Played ${sum(above)} upper-side matches — ${loses}`);
        } else {
          for (const [aboveIndex, count] of above.entries()) {
            if (count >= limit) reasons.push(`Played ${count} ${rosters[aboveIndex].side.label} matches — ${loses}`);
          }
        }
      }
    }
    const upperTotal = sum(above);
    if (atOrBelow < upperTotal) {
      reasons.push(`Upper-side participation (${upperTotal}) exceeds ${ownLabel} participation (${atOrBelow})`);
    } else if (rules.upperSideWinsTie && upperTotal > 0 && atOrBelow === upperTotal) {
      reasons.push(`Upper-side participation (${upperTotal}) is half of this player's matches, which loses ${own.label} eligibility`);
    } else if (atOrBelow === upperTotal && fixturesLeft === 0 && fixturesKnown) {
      cautions.push(
        `One more upper-side match loses ${own.label} eligibility for the rest of the season (level at ${atOrBelow} with no ${ownLabel} fixtures left)`,
      );
    }
  }

  return {
    playerId: row.playerId,
    firstName: row.firstName,
    lastName: row.lastName,
    name: [row.firstName, row.lastName].filter(Boolean).join(' '),
    lastRegistered: row.lastRegistered,
    teamName: row.teamName,
    played: row.played,
    substitute: row.substitute,
    participation: counts[index],
    otherSides: rosters.flatMap((roster, rosterIndex) =>
      rosterIndex === index
        ? []
        : [{ label: roster.side.label, teamName: roster.side.teamName, participation: counts[rosterIndex] }],
    ),
    // All of a player's rows, own side first, so the detail view shows them from any table.
    rows: [rosters[index], ...rosters.filter((_, rosterIndex) => rosterIndex !== index)].flatMap(
      (roster) => roster.sources.get(key) ?? [],
    ),
    eligible: reasons.length === 0,
    reasons,
    pending,
    cautions: reasons.length === 0 && !locked ? cautions : [],
  };
}

const byName = (a: PlayerEligibility, b: PlayerEligibility) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/** Resolve the display label for a side: its single competition when the side
 *  spans exactly one, otherwise its team name (a side can span several
 *  competitions). Shared by the table and the export so they can't drift. */
export function divisionLabel(label: string, teamName: string, summary: DivisionSummary): string {
  return summary.competitions.length === 1
    ? `${label} side — ${summary.competitions[0]}`
    : `${label} side — ${teamName}`;
}

const normalizedName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Whether a player's name is held by more than one player on their side. */
export function hasSharedName(player: { name: string }, shared: Set<string>): boolean {
  return shared.has(normalizedName(player.name));
}

/** Names held by more than one player on a side. They stay separate players,
 *  because a shared name doesn't prove they are one person, so the page shows
 *  their ids to tell them apart. */
export function sharedNames(players: { name: string }[]): Set<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const { name } of players) {
    const key = normalizedName(name);
    if (seen.has(key)) shared.add(key);
    seen.add(key);
  }
  return shared;
}

/** Each name held by more than one player at a club, with its ids, for the report's note. */
export function sameNamePlayers(sides: { players: PlayerEligibility[] }[]): { name: string; ids: string[] }[] {
  const byName = new Map<string, { name: string; ids: Set<string> }>();
  for (const player of sides.flatMap((side) => side.players)) {
    const key = normalizedName(player.name);
    const entry = byName.get(key) ?? { name: player.name, ids: new Set<string>() };
    entry.ids.add(player.playerId);
    byName.set(key, entry);
  }
  return [...byName.values()]
    .filter((entry) => entry.ids.size > 1)
    .map((entry) => ({ name: entry.name, ids: [...entry.ids].sort() }));
}

/** Clubs and their NCS sides, highest division first, from team names. A team name
 *  that doesn't end in a division can't be ranked and is skipped. A club's 1st XV
 *  ranks above its 2nd XV at the same level. Sorted by name. */
export function clubsFromTeamNames(teamNames: Iterable<string>): Club[] {
  const clubs = new Map<string, Map<string, TeamSide>>();
  for (const teamName of teamNames) {
    const side = parseTeamSide(teamName);
    if (!side || !isNcsSide(side)) continue;
    const sides = clubs.get(side.clubName) ?? new Map<string, TeamSide>();
    sides.set(teamName, side);
    clubs.set(side.clubName, sides);
  }
  return [...clubs]
    .map(([name, sides]) => ({
      name,
      sides: [...sides]
        .sort(([, a], [, b]) => a.level - b.level || a.xv - b.xv)
        .map(([teamName, side]) => ({ teamName, label: sideLabel(side) })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The clubs in a Match Participation Report, from its Team Name column. */
export function clubsInRows(rows: PlayerRow[]): Club[] {
  return clubsFromTeamNames(rows.map((row) => row.teamName));
}

/** Compute each side's verdicts by joining a player's rows across the club's sides
 *  on their id. Rows for the same player on the same team (one per competition)
 *  are combined into a single total; rows with no id cannot be joined and are
 *  excluded. */
export function computeBreakdown(
  rows: PlayerRow[],
  sides: Side[],
  rules: EligibilityRules,
  remaining: RemainingMatches = {},
  { locked = false, scheduled = {} }: BreakdownOptions = {},
): EligibilityBreakdown {
  const rosters = sides.map((side) => buildRoster(side, rows));
  const teamNames = new Set(sides.map((side) => side.teamName));

  return {
    sides: rosters.map((roster, index) => {
      const players = [...roster.combined.values()]
        .map((row) => evaluate(row, index, rosters, rules, locked ? {} : remaining, { locked, scheduled }))
        .sort(byName);
      return {
        ...roster.side,
        players,
        summary: {
          total: players.length,
          eligible: players.filter((player) => player.eligible).length,
          onTrack: players.filter((player) => player.eligible && player.pending.length > 0).length,
          caution: players.filter((player) => player.cautions.length > 0).length,
          competitions: [...roster.competitions].sort(),
        },
      };
    }),
    ignoredTeamNames: [...new Set(rows.map((row) => row.teamName).filter((name) => !teamNames.has(name)))],
  };
}

/** Where a player stands on a side, most urgent first. */
export const VERDICT_STATUSES = ['ineligible', 'caution', 'on-track', 'eligible'] as const;

export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

/** A verdict as one status. Ineligible outranks Caution, and Caution outranks On
 *  Track, which a player can still recover from. */
export function verdictStatus(player: Pick<PlayerEligibility, 'eligible' | 'pending' | 'cautions'>): VerdictStatus {
  if (!player.eligible) return 'ineligible';
  if (player.cautions.length > 0) return 'caution';
  return player.pending.length > 0 ? 'on-track' : 'eligible';
}

/** A status's place in `VERDICT_STATUSES`, for sorting: lowest is most urgent. */
export function verdictRank(player: Pick<PlayerEligibility, 'eligible' | 'pending' | 'cautions'>): number {
  return VERDICT_STATUSES.indexOf(verdictStatus(player));
}
