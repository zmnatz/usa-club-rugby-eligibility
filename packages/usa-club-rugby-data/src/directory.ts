import type { PublishedClub } from './published.ts';

// Clubs with nothing in this season's record yet. The current season's clubs are found
// from its fixtures, so a club whose season starts later in the year isn't listed until
// its first fixture is entered. The last Locked Season names most of them.

/** Words a club's name gains or loses between seasons, e.g. "Amoskeag" and "Amoskeag Rugby". */
const NAME_NOISE = /\b(rugby( football)?( club)?|rfc|rugby union)\b/g;

const comparableName = (name: string) =>
  name.toLowerCase().replace(NAME_NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** The clubs of `previous` (the last Locked Season) that aren't in `current`, sorted by
 *  name. A club is taken to be in `current` when its key, any of its team names, or its
 *  name without words like "Rugby" or "RFC" matches a current club's. A club that renamed
 *  itself in other ways is listed under both names. */
export function clubsWithoutFixtures(current: PublishedClub[], previous: PublishedClub[]): PublishedClub[] {
  const keys = new Set(current.map((club) => club.key));
  const teams = new Set(current.flatMap((club) => club.sides.map((side) => side.teamName.toLowerCase())));
  const names = new Set(current.map((club) => comparableName(club.name)));
  return previous
    .filter(
      (club) =>
        !keys.has(club.key) &&
        !names.has(comparableName(club.name)) &&
        !club.sides.some((side) => teams.has(side.teamName.toLowerCase())),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
