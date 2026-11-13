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
const GENERIC_WORDS = new Set(['women', 'womens', 'men', 'mens', 's', 'the', 'of', 'and']);

const nameWords = (name: string) => comparableName(name).split(' ').filter((word) => word && !GENERIC_WORDS.has(word));

/** Whether two words are the same but for one slip: a letter added, dropped, changed or
 *  swapped with the next, e.g. "Grizziles" and "Grizzlies". Short words must match exactly. */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
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

/** Whether one name's words are all in the other, e.g. "Bayonne" and "Bayonne Bombers". */
function similarNames(a: string, b: string): boolean {
  const [shorter, longer] = [nameWords(a), nameWords(b)].sort((x, y) => x.length - y.length);
  return shorter.length > 0 && shorter.every((word) => longer.some((other) => sameWord(word, other)));
}

/** A competition's name without its season and the words that change from year to year,
 *  e.g. "2025-26 MW Men's D3 - Ohio League" and "2027 Midwest Men's D3 - Ohio". */
const comparableCompetition = (name: string) =>
  name
    .toLowerCase()
    .replace(/['’+]/g, '')
    .replace(/\(?\b(19|20)\d\d([-/]\d\d(\d\d)?)?\b\)?/g, ' ')
    .replace(/\bmw\b/g, 'midwest')
    .replace(/\b(league|conference)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The competitions each team played in, by team name. */
function competitionsByTeam(fixtures: FixtureSides[]): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const fixture of fixtures) {
    for (const team of [fixture.homeTeam.name, fixture.awayTeam.name]) {
      if (!team) continue;
      const competitions = found.get(team) ?? new Set<string>();
      competitions.add(comparableCompetition(fixture.compName));
      found.set(team, competitions);
    }
  }
  return found;
}

const isWomensTeam = (teamName: string) => /\bW(D\d|\+|XV)?\b|women/i.test(teamName);

/** The clubs of `previous` (the last Locked Season) that aren't in `current`, sorted by
 *  name. A club is taken to be in `current` when a current club has its key or one of its
 *  team names, or has its name but for words like "Rugby" or "RFC". It is also taken to
 *  be a current club when the two have a side in the same competition and division, of
 *  the same gender, and one name's words are all in the other ("Bayonne" and "Bayonne
 *  Bombers"), allowing a one-letter slip in a long word. A club renamed in any other way
 *  is listed under both names. */
export function clubsWithoutFixtures(current: SeasonClubs, previous: SeasonClubs): PublishedClub[] {
  const keys = new Set(current.clubs.map((club) => club.key));
  const teams = new Set(current.clubs.flatMap((club) => club.sides.map((side) => side.teamName.toLowerCase())));
  const names = new Set(current.clubs.map((club) => comparableName(club.name)));
  const currentCompetitions = competitionsByTeam(current.fixtures);
  const previousCompetitions = competitionsByTeam(previous.fixtures);

  // A side of each club in the same competition and division, of the same gender.
  const sharesCompetition = (old: PublishedClub, club: PublishedClub) =>
    old.sides.some((oldSide) =>
      club.sides.some(
        (side) =>
          side.label === oldSide.label &&
          isWomensTeam(side.teamName) === isWomensTeam(oldSide.teamName) &&
          [...(previousCompetitions.get(oldSide.teamName) ?? [])].some((competition) =>
            currentCompetitions.get(side.teamName)?.has(competition),
          ),
      ),
    );

  return previous.clubs
    .filter(
      (old) =>
        !keys.has(old.key) &&
        !names.has(comparableName(old.name)) &&
        !old.sides.some((side) => teams.has(side.teamName.toLowerCase())) &&
        !current.clubs.some((club) => similarNames(old.name, club.name) && sharesCompetition(old, club)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
