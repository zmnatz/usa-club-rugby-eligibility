// Team names across the unions put the division last, in several forms:
// "NOVA WD3", "Rocky Gorge MD1", "Amoskeag W+D3", "Black Sheep D2 1st XV",
// "Buffalo MD3 2nd", "OMAHA M D2 1st XVs", "Omaha Womens D2 1st XV".
// A name with no division ("NYAC ARP", "Gaston Hellhounds Festival") can't be
// ranked and gives null. See docs/adr/001-national-coverage.md.
const SIDE_NAME =
  /^(.+?)\s+(?:(M|W\+?|Men'?s|Women'?s)\s*)?D(\d+)(?:\s+(1st|2nd|3rd)(?:\s+XVs?)?)?$/i;

export interface TeamSide {
  /** The club, with men's and women's sides as separate clubs, e.g. "NOVA Women". */
  clubName: string;
  /** The club's name without the women's suffix, e.g. "NOVA". */
  baseName: string;
  gender: 'M' | 'W';
  level: number;
  /** Which XV at that level: 1 unless the name says "2nd" or "3rd". */
  xv: number;
}

/** The National Championship Series covers men's divisions 1 to 3 and women's 1 and
 *  2 (Senior Club Regulations, Terms and Definitions 34). Matches below that don't
 *  count towards eligibility, so those sides aren't assessed. */
export function isNcsSide({ gender, level }: Pick<TeamSide, 'gender' | 'level'>): boolean {
  return level <= (gender === 'W' ? 2 : 3);
}

/** Reads a side's club and division from its name, e.g. "NOVA WD3". A team name
 *  that doesn't end in a division gives null. */
export function parseTeamSide(teamName: string): TeamSide | null {
  const match = teamName.trim().match(SIDE_NAME);
  if (!match) return null;
  const [, baseName, genderToken = '', level, ordinal = '1st'] = match;
  const gender = genderToken.toUpperCase().startsWith('W') ? 'W' : 'M';
  return {
    clubName: gender === 'W' ? `${baseName} Women` : baseName,
    baseName,
    gender,
    level: Number(level),
    xv: Number(ordinal[0]),
  };
}

/** The label a side is shown under, e.g. "D1", or "D3 2nd XV" for a club's
 *  second side at one level. */
export function sideLabel({ level, xv }: Pick<TeamSide, 'level' | 'xv'>): string {
  return xv > 1 ? `D${level} ${xv === 2 ? '2nd' : '3rd'} XV` : `D${level}`;
}

/** A club's name as a file name, e.g. "NOVA Women" -> "nova-women". */
export function clubKey(clubName: string): string {
  return clubName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
