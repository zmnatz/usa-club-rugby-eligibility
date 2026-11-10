// Clubs that enter their sides under different names ("Houston United" and "HURT").
// Names alone can't show these are one club, so they're listed by hand.

import { parseTeamSide } from './teamSide.ts';

/** Clubs that enter their sides under different names, a group of names each. A
 *  merged club goes by the name of its top side that season, in every season,
 *  the current one included. Confirmed by the project
 *  owner from the players these names share (PR 47); names alone can't show it.
 *  Women's clubs carry " Women". */
export const CLUB_ALIASES: string[][] = [
  ['Chicago Griffins', 'Chicago West Side Condors', 'Chicago Westside Condors', 'Chicago Condors', 'Westside Condors', 'Chicago Silverbacks'],
  ['Eastside Banshees', 'Wailers'],
  ['Fort Lauderdale Knights', 'FTL Knights'],
  ['Houston United', 'HURT'],
  ['Las Vegas Irish', 'Las Vegas Wolfhounds'],
  ['New York', 'NYRC'],
  ['New York Old Blue', 'Old Blue'],
  ['NOVA Women', 'Northern Virginia Women'],
  ['Riverlands', 'Riverlands Golden Boars'],
  ['Schuylkill River', 'Schuylkill River Exiles'],
  ['Utah Vipers Women', 'Utah Slugs Women', 'SLUGs Women', 'Salt City Slugs Women'],
  ['Wisconsin', 'Wisconsin Sharks'],
];

/** A club name with case, punctuation and spacing ignored. */
export const clubNameId = (name: string): string => name.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();

/** The alias group a club name is in, by an id shared with its other names; undefined
 *  for a name on no list. */
export function aliasGroupOf(aliases: string[][] = CLUB_ALIASES): (name: string) => string | undefined {
  const group = new Map(aliases.flatMap((names) => names.map((name) => [clubNameId(name), `alias:${clubNameId(names[0])}`] as const)));
  return (name) => group.get(clubNameId(name));
}

/** Which club a name belongs to, ignoring case, punctuation and spacing: names in one
 *  alias group give the same id. */
export function clubIdentity(aliases: string[][] = CLUB_ALIASES): (name: string) => string {
  const groupOf = aliasGroupOf(aliases);
  return (name) => groupOf(name) ?? clubNameId(name);
}

/** A note for each of a club's sides entered under another of its names, saying which
 *  club it belongs to. */
export function mergedClubNotes(club: { name: string; sides: { teamName: string }[] }): string[] {
  return club.sides.flatMap(({ teamName }) => {
    const written = parseTeamSide(teamName)?.clubName;
    return written && clubNameId(written) !== clubNameId(club.name)
      ? [`${teamName}: entered as ${written}, which is the same club as ${club.name}.`]
      : [];
  });
}
