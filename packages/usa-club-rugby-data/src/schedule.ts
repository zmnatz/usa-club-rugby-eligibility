import { divisionOf, type FixtureSides } from './clubFixtures.ts';
import { isQualifyingMatch } from './qualifying.ts';
import type { Club, EligibilityRules, RemainingMatches } from './types.ts';

// The schedule maths: what a side has scheduled and what it could still play.

/** A match a side could still play before the Super Regionals deadline. */
export interface PossibleFixture {
  fixtureId?: string;
  teamName: string;
  competition: string;
  dateTime: string;
  /** Empty when the teams aren't assigned yet. */
  opponent: string;
  /** A playoff with no teams assigned, which the side may not reach. */
  open: boolean;
}

/** A fixture with the date, status and scores the schedule maths reads. */
export type ScheduleFixture = FixtureSides & {
  id?: string;
  dateTime: string;
  status?: string;
  homeTeam: { name: string; score: string };
  awayTeam: { name: string; score: string };
};

/** Each side's possible matches before the Super Regionals deadline, which count
 *  towards the two-match minimums. A postponed fixture has no date to count on,
 *  and a forfeit won't be played. Future playoff fixtures have no teams assigned,
 *  so any side in that division could play in them: each such date is one possible
 *  match, since a side plays once on a date however many fixtures are on it. */
export function possibleFixtures(
  fixtures: ScheduleFixture[],
  club: Pick<Club, 'sides'>,
  rules: EligibilityRules,
  now: Date = new Date(),
): Record<string, PossibleFixture[]> {
  const upcoming = fixtures.filter((fixture) => {
    return (
      new Date(fixture.dateTime) > now &&
      fixture.status !== 'Forfeit' &&
      fixture.status !== 'Postponed' &&
      fixture.homeTeam.score === '' &&
      fixture.awayTeam.score === '' &&
      isQualifyingMatch(fixture, rules)
    );
  });
  const plays = (fixture: FixtureSides, team: string) =>
    fixture.homeTeam.name === team || fixture.awayTeam.name === team;
  const dateOf = (fixture: { dateTime: string }) => fixture.dateTime.slice(0, 10);

  const forSide = (teamName: string): PossibleFixture[] => {
    const divisions = new Set(
      fixtures.filter((fixture) => plays(fixture, teamName)).map((fixture) => divisionOf(fixture.compName)),
    );
    const own = upcoming.filter((fixture) => plays(fixture, teamName));
    const ownDates = new Set(own.map(dateOf));
    const openByDate = new Map<string, ScheduleFixture>();
    for (const fixture of upcoming) {
      const date = dateOf(fixture);
      if (
        (fixture.homeTeam.name === '' || fixture.awayTeam.name === '') &&
        divisions.has(divisionOf(fixture.compName)) &&
        !ownDates.has(date) &&
        !openByDate.has(date)
      ) {
        openByDate.set(date, fixture);
      }
    }
    const toPossible = (fixture: ScheduleFixture, open: boolean): PossibleFixture => ({
      fixtureId: fixture.id,
      teamName,
      competition: fixture.compName,
      dateTime: fixture.dateTime,
      opponent: open ? '' : fixture.homeTeam.name === teamName ? fixture.awayTeam.name : fixture.homeTeam.name,
      open,
    });
    return [
      ...own.map((fixture) => toPossible(fixture, false)),
      ...[...openByDate.values()].map((fixture) => toPossible(fixture, true)),
    ].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  };
  return Object.fromEntries(club.sides.map(({ teamName }) => [teamName, forSide(teamName)]));
}

/** How many possible matches each side has. */
export function remainingMatches(
  fixtures: ScheduleFixture[],
  club: Pick<Club, 'sides'>,
  rules: EligibilityRules,
  now: Date = new Date(),
): RemainingMatches {
  return Object.fromEntries(
    Object.entries(possibleFixtures(fixtures, club, rules, now)).map(([teamName, list]) => [teamName, list.length]),
  );
}

/** Each side's Qualifying fixtures in the record, played or not, for a limit set as a
 *  share of the schedule. The regulations use the schedule as of the first weekend,
 *  which the CMS doesn't keep, so this is the final list without postponed matches. */
export function scheduledMatches(
  fixtures: ScheduleFixture[],
  club: Pick<Club, 'sides'>,
  rules: EligibilityRules,
): Record<string, number> {
  const counted = fixtures.filter((fixture) => fixture.status !== 'Postponed' && isQualifyingMatch(fixture, rules));
  return Object.fromEntries(
    club.sides.map(({ teamName }) => [
      teamName,
      counted.filter((fixture) => fixture.homeTeam.name === teamName || fixture.awayTeam.name === teamName).length,
    ]),
  );
}
