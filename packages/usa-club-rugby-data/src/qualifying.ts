import type { EligibilityRules, PlayerRow } from './types.ts';

// What counts towards Match Participation. The rule most likely to change from
// season to season (ADR 006), so it lives apart from the counting.

export function isQualifying(competition: string, rules: EligibilityRules): boolean {
  const name = competition.toLowerCase();
  return !rules.nonQualifyingCompetitions.some((term) => name.includes(term.toLowerCase()));
}

/** Whether a match was summer 7s: played in a month that doesn't count
 *  (`excludedMonths`), outside the 15s postseason. */
export function inExcludedMonth(match: { compName: string; dateTime?: string }, rules: EligibilityRules): boolean {
  const { compName, dateTime } = match;
  if (dateTime === undefined || !(rules.excludedMonths ?? []).includes(Number(dateTime.slice(5, 7)))) return false;
  const name = compName.toLowerCase();
  return !(rules.postseasonCompetitions ?? []).some((term) => name.includes(term.toLowerCase()));
}

/** Whether a match counts towards Match Participation: an NCS Qualifying competition,
 *  outside the months that don't count. */
export function isQualifyingMatch(match: { compName: string; dateTime?: string }, rules: EligibilityRules): boolean {
  return isQualifying(match.compName, rules) && !inExcludedMonth(match, rules);
}

/** A report's rows from competitions that count, so a CSV report follows the same
 *  rules as the match record. */
export function qualifyingRows(rows: PlayerRow[], rules: EligibilityRules): PlayerRow[] {
  return rows.filter((row) => isQualifying(row.competition, rules));
}
