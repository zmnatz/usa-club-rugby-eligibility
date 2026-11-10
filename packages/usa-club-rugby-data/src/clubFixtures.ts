import { clubsFromTeamNames } from './eligibility.ts';
import { isQualifyingMatch } from './qualifying.ts';
import type { ParticipationSnapshot } from './snapshot.ts';
import type { Club, EligibilityRules } from './types.ts';

// Which clubs there are, which sides belong to a club, and the slice of the
// national record one club needs.

/** The name fields a fixture needs to say who played in it. */
export interface FixtureSides {
  compName: string;
  dateTime?: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

/** Whether a team name is one of the club's sides. */
export const isClubSide = (club: Pick<Club, 'sides'>, teamName: string): boolean =>
  club.sides.some((side) => side.teamName === teamName);

/** A competition's division: playoffs can be a separate competition from the
 *  league they belong to. */
export const divisionOf = (compName: string): string => compName.replace(/\s+playoffs?$/i, '').toLowerCase();

/** Clubs and their sides in qualifying competitions, by name. */
export function listClubs(fixtures: FixtureSides[], rules: EligibilityRules): Club[] {
  return clubsFromTeamNames(
    fixtures
      .filter((fixture) => isQualifyingMatch(fixture, rules))
      .flatMap((fixture) => [fixture.homeTeam.name, fixture.awayTeam.name]),
  );
}

/** The fixtures a club's page needs: every fixture in the divisions its sides play
 *  in, including playoff fixtures with no teams yet, which its possible matches
 *  and round lists are worked out from. */
export function clubFixtures<Fixture extends FixtureSides>(fixtures: Fixture[], club: Pick<Club, 'sides'>): Fixture[] {
  const divisions = new Set(
    fixtures
      .filter((fixture) => isClubSide(club, fixture.homeTeam.name) || isClubSide(club, fixture.awayTeam.name))
      .map((fixture) => divisionOf(fixture.compName)),
  );
  return fixtures.filter((fixture) => divisions.has(divisionOf(fixture.compName)));
}

/** The part of a national snapshot one club's page needs: the rows and gaps for
 *  its sides, and the results involving them. A player who also played for
 *  another club appears in both clubs' files. */
export function clubSnapshot(
  snapshot: ParticipationSnapshot,
  club: Club,
  results: { id: string; homeTeam: { name: string }; awayTeam: { name: string } }[],
): ParticipationSnapshot {
  const own = new Set(
    results
      .filter((fixture) => isClubSide(club, fixture.homeTeam.name) || isClubSide(club, fixture.awayTeam.name))
      .map((fixture) => fixture.id),
  );
  return {
    season: snapshot.season,
    generatedAt: snapshot.generatedAt,
    resultIds: (snapshot.resultIds ?? []).filter((id) => own.has(id)),
    rows: snapshot.rows.filter((row) => isClubSide(club, row.teamName)),
    gaps: snapshot.gaps.filter((gap) => isClubSide(club, gap.teamName)),
  };
}
