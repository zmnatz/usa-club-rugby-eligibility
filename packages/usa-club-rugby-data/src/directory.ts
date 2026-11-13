import type { FixtureSides } from './clubFixtures.ts';
import type { PublishedClub } from './published.ts';

// Clubs with nothing in this season's record yet. The current season's clubs are found
// from its fixtures, so a club whose season starts later in the year isn't listed until
// its first fixture is entered. The last Locked Season names most of them.

/** A season's clubs and the fixtures they were found from. */
export interface SeasonClubs {
  clubs: PublishedClub[];
  fixtures: FixtureSides[];
}

/** Words a club's name gains or loses between seasons, e.g. "Amoskeag" and "Amoskeag Rugby". */
const NAME_NOISE = /\b(rugby( football)?( club)?|rfc|rugby union)\b/g;

const comparableName = (name: string) =>
  name.toLowerCase().replace(/\./g, '').replace(NAME_NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Words that say nothing about which club a name is. */
const GENERIC_WORDS = new Set(['women', 'womens', 'men', 'mens', 's', 'w', 'the', 'of', 'and']);

/** Places that names shorten, e.g. "KC Jazz" and "Kansas City Jazz". */
const PLACE_ABBREVIATIONS: Record<string, string> = {
  kc: 'kansas city',
  la: 'los angeles',
  nyc: 'new york city',
  sf: 'san francisco',
  stl: 'st louis',
  va: 'virginia',
};

const nameWords = (name: string) =>
  comparableName(name)
    .split(' ')
    .flatMap((word) => (PLACE_ABBREVIATIONS[word] ?? word).split(' '))
    .filter((word) => word && !GENERIC_WORDS.has(word));

/** Whether two words are the same but for one slip: a letter added, dropped, changed or
 *  swapped with the next, e.g. "Grizziles" and "Grizzlies". Short words must match exactly. */
function nearlySameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let start = 0;
  while (a[start] === b[start]) start++;
  const [restA, restB] = [a.slice(start), b.slice(start)];
  return (
    restA.slice(1) === restB.slice(1) || // changed
    restA.slice(1) === restB || // dropped
    restA === restB.slice(1) || // added
    (restA[0] === restB[1] && restA[1] === restB[0] && restA.slice(2) === restB.slice(2)) // swapped
  );
}

/** Whether one name's words are all in the other ("Raleigh" and "Raleigh Vipers"), with at
 *  least one the same and the rest at most a slip apart, so "Dayton" isn't "Daytona Beach". */
function similarNames(a: string, b: string): boolean {
  const [shorter, longer] = [nameWords(a), nameWords(b)].sort((x, y) => x.length - y.length);
  return (
    shorter.length > 0 &&
    shorter.some((word) => longer.includes(word)) &&
    shorter.every((word) => longer.some((other) => nearlySameWord(word, other)))
  );
}

const WOMENS = /\bW(D\d|\+|XV)?\b|women/i;

/** The team names of every women's side: named as one, or playing in a women's competition,
 *  since some aren't ("Denver Black Ice D1" in "RMRU Women's 2027 - D1"). */
function womensTeams(fixtures: FixtureSides[]): Set<string> {
  const found = new Set<string>();
  for (const fixture of fixtures) {
    if (!WOMENS.test(fixture.compName)) continue;
    found.add(fixture.homeTeam.name);
    found.add(fixture.awayTeam.name);
  }
  return found;
}

/** Whether `club` is in `clubs` by key, team name, or name but for words like "Rugby". */
function sameClubIn(clubs: PublishedClub[]): (club: PublishedClub) => boolean {
  const keys = new Set(clubs.map((club) => club.key));
  const teams = new Set(clubs.flatMap((club) => club.sides.map((side) => side.teamName.toLowerCase())));
  const names = new Set(clubs.map((club) => comparableName(club.name)));
  return (club) =>
    keys.has(club.key) ||
    names.has(comparableName(club.name)) ||
    club.sides.some((side) => teams.has(side.teamName.toLowerCase()));
}

/** The clubs of `previous` (the last Locked Season) that aren't in `current`, sorted by
 *  name. A club is in `current` when a current club has its key or one of its team names,
 *  or has its name but for words like "Rugby" or "RFC".
 *
 *  It is also taken to be a club that renamed itself when a club new this season has a
 *  side of the same gender in the same division, and one name's words are all in the
 *  other's ("Raleigh Vipers" and "Raleigh"). Only a new club can be a renamed one, and only
 *  for one of last season's clubs: when it looks like several, as "Bucks" looks like
 *  "Atlanta Bucks" and "Montgomery Bucks", they are all listed. Competitions aren't
 *  compared, as they are often renamed or move union from one season to the next. A club
 *  renamed in any other way is listed under both names. */
export function clubsWithoutFixtures(current: SeasonClubs, previous: SeasonClubs): PublishedClub[] {
  const inCurrent = sameClubIn(current.clubs);
  const inPrevious = sameClubIn(previous.clubs);
  const currentWomens = womensTeams(current.fixtures);
  const previousWomens = womensTeams(previous.fixtures);
  const isWomens = (teamName: string, womens: Set<string>) => WOMENS.test(teamName) || womens.has(teamName);

  // A side of each club in the same division, of the same gender.
  const sharesDivision = (old: PublishedClub, club: PublishedClub) =>
    old.sides.some((oldSide) =>
      club.sides.some(
        (side) =>
          side.label === oldSide.label &&
          isWomens(side.teamName, currentWomens) === isWomens(oldSide.teamName, previousWomens),
      ),
    );

  const missing = previous.clubs.filter((old) => !inCurrent(old));
  const newClubs = current.clubs.filter((club) => !inPrevious(club));
  const renamed = new Set<PublishedClub>();
  for (const club of newClubs) {
    const was = missing.filter((old) => similarNames(old.name, club.name) && sharesDivision(old, club));
    if (was.length === 1 && was[0]) renamed.add(was[0]);
  }
  return missing.filter((old) => !renamed.has(old)).sort((a, b) => a.name.localeCompare(b.name));
}
