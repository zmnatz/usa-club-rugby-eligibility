import type { MatchCentreData } from './playerHistory.ts';
import { scoringKind } from './scoring.ts';

// What a forfeit is. A union marks one with the Forfeit status, but some enter it as a
// result instead, awarding the winning side penalty tries and the forfeiting side nothing.
// Either way Reg 3.4(h) applies, so the archive marks the second kind as a forfeit too
// before anything reads it.

export const FORFEIT_STATUS = 'Forfeit';

/** The fewest penalty tries that make a forfeit. A real match can end 14–0 on two penalty
 *  tries; three and nothing else would be very odd. */
export const FORFEIT_PENALTY_TRIES = 3;

/** Whether a fixture is a forfeit, once `markForfeits` has marked the ones entered as results. */
export const isForfeit = (fixture: { status?: string }): boolean => fixture.status === FORFEIT_STATUS;

interface ScoredSides {
  homeTeam: { score?: string };
  awayTeam: { score?: string };
}

/** Whether a result was a forfeit entered as a score: one side scored nothing, and every
 *  score in the match was a penalty try, at least `FORFEIT_PENALTY_TRIES` of them. */
export function isPenaltyTryForfeit(fixture: ScoredSides, commentary: MatchCentreData['commentary']): boolean {
  const scores = [fixture.homeTeam.score, fixture.awayTeam.score].map(Number);
  if (scores.some(Number.isNaN) || !scores.includes(0) || scores.every((score) => score === 0)) return false;
  const penaltyTries = commentary.filter((event) => event.type.trim().toLowerCase() === 'penalty try');
  return penaltyTries.length >= FORFEIT_PENALTY_TRIES && commentary.every((event) => scoringKind(event.type) === null);
}

/** The fixtures with each forfeit entered as a result marked with the Forfeit status. */
export function markForfeits<Fixture extends ScoredSides & { id: string; status?: string }>(
  fixtures: Fixture[],
  matches: Pick<MatchCentreData, 'fixture' | 'commentary'>[],
): Fixture[] {
  const commentary = new Map(matches.map((match) => [match.fixture.id, match.commentary]));
  return fixtures.map((fixture) => {
    const events = commentary.get(fixture.id);
    return !isForfeit(fixture) && events && isPenaltyTryForfeit(fixture, events)
      ? { ...fixture, status: FORFEIT_STATUS }
      : fixture;
  });
}
