import type { PublishedSeasonFile } from './data.ts';
import { clubBreakdown, clubFixtures, clubGaps, isQualifying } from './participation.ts';
import { rulesForSeason } from './rules.ts';

// A Locked Season at a glance, from its published file: the same verdicts its club
// pages show, counted across every club.

/** One division across the season's clubs. */
export interface DivisionSummaryRow {
  /** "Men's D1", "Women's D2", or "Division not known" for a side the record gave none. */
  division: string;
  sides: number;
  /** Players with a counted match for a side at this division. */
  players: number;
  /** Of those, how many were eligible for that side. */
  eligible: number;
}

export interface SeasonSummary {
  clubs: number;
  sides: number;
  multiSideClubs: number;
  /** Players with a counted match, each once. */
  players: number;
  /** Results counted from the match record. */
  matches: number;
  /** Players who played for more than one club, each shown at their last. */
  transfers: number;
  unplacedTeams: number;
  /** Results where a side's lineup or substitutions weren't entered. */
  gaps: { noLineup: number; noSubstitutions: number };
  divisions: DivisionSummaryRow[];
  /** Why players weren't eligible for a side they played for. A verdict can have
   *  more than one reason. */
  ineligible: { verdicts: number; shortOfMinimum: number; upperSideLimit: number; upperSideShare: number };
}

const ORDER = ["Men's D1", "Men's D2", "Men's D3", "Women's D1", "Women's D2"];

export function seasonSummary(file: PublishedSeasonFile): SeasonSummary {
  const rules = rulesForSeason(file.season);
  const players = new Set<string>();
  const matches = new Set<string>();
  const divisions = new Map<string, DivisionSummaryRow>();
  const ineligible = { verdicts: 0, shortOfMinimum: 0, upperSideLimit: 0, upperSideShare: 0 };
  const gaps = { noLineup: 0, noSubstitutions: 0 };
  let transfers = 0;

  for (const club of file.clubs) {
    const snapshot = file.clubFiles[club.key];
    if (!snapshot) continue;
    for (const id of snapshot.resultIds ?? []) matches.add(id);
    transfers += Object.keys(snapshot.transfers ?? {}).length;
    for (const gap of clubGaps(snapshot, club, rules)) {
      if (gap.kind === 'no-lineup') gaps.noLineup += 1;
      else gaps.noSubstitutions += 1;
    }
    const teams = new Set(club.sides.map((side) => side.teamName));
    for (const row of snapshot.rows) {
      if (teams.has(row.teamName) && row.played + row.substitute > 0 && isQualifying(row.competition, rules)) {
        players.add(row.playerId);
      }
    }

    const women = club.name.endsWith(' Women');
    const breakdown = clubBreakdown(snapshot, clubFixtures(file.fixtures, club), club, { rules });
    for (const side of breakdown.sides) {
      const level = side.label.match(/^D(\d)/)?.[1];
      const division = level ? `${women ? "Women's" : "Men's"} D${level}` : 'Division not known';
      const row = divisions.get(division) ?? { division, sides: 0, players: 0, eligible: 0 };
      row.sides += 1;
      for (const player of side.players) {
        if (player.participation === 0) continue;
        row.players += 1;
        if (player.eligible) {
          row.eligible += 1;
          continue;
        }
        ineligible.verdicts += 1;
        const reasons = player.reasons.join('\n');
        if (/^Needs /m.test(reasons)) ineligible.shortOfMinimum += 1;
        if (/ matches — /.test(reasons)) ineligible.upperSideLimit += 1;
        if (/participation \(/.test(reasons)) ineligible.upperSideShare += 1;
      }
      divisions.set(division, row);
    }
  }

  const rank = (division: string) => (ORDER.includes(division) ? ORDER.indexOf(division) : ORDER.length);
  return {
    clubs: file.clubs.length,
    sides: file.clubs.reduce((total, club) => total + club.sides.length, 0),
    multiSideClubs: file.clubs.filter((club) => club.sides.length > 1).length,
    players: players.size,
    matches: matches.size,
    transfers,
    unplacedTeams: file.unplacedTeams.length,
    gaps,
    divisions: [...divisions.values()].sort((a, b) => rank(a.division) - rank(b.division)),
    ineligible,
  };
}
