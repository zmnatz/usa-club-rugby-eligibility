import { competitionLabel, type UnreportedGame, type UnreportedReason } from './unreported.ts';

// Filtering the unreported games list: what both component packages' UnreportedGames
// show and offer, kept here so the two lists filter the same way.

export type UnreportedReasonKind = UnreportedReason['kind'];

/** What the list is filtered to: a division code, or `all`; text a competition's name must
 *  contain, or none; and the reasons shown, each turned on or off on its own. A game shows
 *  when any of its reasons is on, and every game shows when none is. */
export interface UnreportedFilters {
  division: string;
  competition: string;
  reasons: UnreportedReasonKind[];
}

/** Where the list starts: games with no lineup, the gap that most affects eligibility. */
export const DEFAULT_UNREPORTED: UnreportedFilters = { division: 'all', competition: '', reasons: ['no-lineup'] };

/** The divisions, in order, as the filter shows them. */
export const UNREPORTED_DIVISIONS: [string, string][] = [
  ['M1', "Men's D1"],
  ['M2', "Men's D2"],
  ['M3', "Men's D3"],
  ['W1', "Women's D1"],
  ['W2', "Women's D2"],
];

/** Every reason, in the order the toggles show them. */
export const UNREPORTED_REASONS: [UnreportedReasonKind, string][] = [
  ['no-result', 'No result'],
  ['no-lineup', 'No lineup'],
  ['no-substitutions', 'No substitutions'],
];

/** Each reason's severity, most serious first: a missing lineup changes verdicts, missing
 *  substitutions are a flag to check, and a missing result is the whole game's. */
export const UNREPORTED_TONES: [UnreportedReasonKind, 'error' | 'warning' | 'info'][] = [
  ['no-lineup', 'error'],
  ['no-substitutions', 'warning'],
  ['no-result', 'info'],
];

export type UnreportedTone = (typeof UNREPORTED_TONES)[number][1];

export const unreportedTone = (kind: UnreportedReasonKind): UnreportedTone =>
  UNREPORTED_TONES.find(([option]) => option === kind)?.[1] ?? 'info';

/** The tone of the most serious gap a game's reasons name a side for, or null when none
 *  does. A missing result is the game's, not a side's. */
export function unreportedSideTone(game: UnreportedGame, teamName: string): UnreportedTone | null {
  const kinds: UnreportedReasonKind[] = game.reasons.flatMap((reason) =>
    reason.kind !== 'no-result' && reason.teamName === teamName ? [reason.kind] : [],
  );
  return UNREPORTED_TONES.find(([kind]) => kinds.includes(kind))?.[1] ?? null;
}

/** A reason as the list words it, e.g. "No lineup: NOVA MD3". */
export function unreportedReasonText(reason: UnreportedReason): string {
  if (reason.kind === 'no-result') return 'No result entered';
  const label = UNREPORTED_REASONS.find(([kind]) => kind === reason.kind)?.[1];
  return `${label}: ${reason.teamName}`;
}

export const unreportedGameCount = (count: number) => (count === 1 ? '1 game' : `${count} games`);

export interface UnreportedView {
  /** The games the filters let through. */
  shown: UnreportedGame[];
  /** The division filtered to: `all` when the filters name one the games don't offer. */
  division: string;
  /** The divisions, reasons and competitions the games offer, for the filters' options. */
  divisions: [string, string][];
  reasons: [UnreportedReasonKind, string][];
  competitions: { name: string; label: string }[];
  /** The shown games by competition, in the competitions' order, without empty groups. */
  groups: { name: string; label: string; games: UnreportedGame[] }[];
}

/** The list the filters make of the games, and the options they offer. Competitions are
 *  shown, offered and matched without the year every current-season competition shares. */
export function filterUnreported(games: UnreportedGame[], filters: UnreportedFilters): UnreportedView {
  const competitions = [...new Set(games.map((game) => game.competition))]
    .map((name) => ({ name, label: competitionLabel(name) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const divisions = UNREPORTED_DIVISIONS.filter(([code]) => games.some((game) => game.divisions.includes(code)));
  const reasons = UNREPORTED_REASONS.filter(([kind]) =>
    games.some((game) => game.reasons.some((entry) => entry.kind === kind)),
  );
  const division = divisions.some(([code]) => code === filters.division) ? filters.division : 'all';
  const competition = filters.competition.trim().toLowerCase();
  const shown = games.filter(
    (game) =>
      (division === 'all' || game.divisions.includes(division)) &&
      competitionLabel(game.competition).toLowerCase().includes(competition) &&
      (filters.reasons.length === 0 || game.reasons.some((entry) => filters.reasons.includes(entry.kind))),
  );
  const groups = competitions
    .map(({ name, label }) => ({ name, label, games: shown.filter((game) => game.competition === name) }))
    .filter((group) => group.games.length > 0);
  return { shown, division, divisions, reasons, competitions, groups };
}

/** The reasons turned on after one is toggled, in the toggles' order. */
export function toggleUnreportedReason(
  reasons: UnreportedReasonKind[],
  kind: UnreportedReasonKind,
  on: boolean,
): UnreportedReasonKind[] {
  return UNREPORTED_REASONS.map(([option]) => option).filter((option) =>
    option === kind ? on : reasons.includes(option),
  );
}
