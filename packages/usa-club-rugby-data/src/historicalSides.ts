import { isQualifying } from './participation.ts';
import { isNcsSide, sideLabel } from './teamSide.ts';
import type { Club, EligibilityRules } from './types.ts';

// Before 2025-26 most team names don't end in a division ("White Plains M",
// "Harrisburg Men Senior Club"), so a Locked Season's clubs can't be read from the
// names alone. A team's division comes from its name if that has one and otherwise
// from the competitions it played in. See docs/adr/006-historical-eligibility.md.

type Gender = 'M' | 'W';

interface HistoricalFixture {
  compName: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

/** A club in a Locked Season, with any team that looks like its own but has no
 *  division: a side left out can make players below it look eligible. */
export interface HistoricalClub extends Club {
  unplacedTeams?: string[];
}

export interface HistoricalClubs {
  clubs: HistoricalClub[];
  /** Teams that couldn't be given a division or ranked within their club. */
  unplacedTeams: string[];
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

/** Trailing words that say nothing about a club's identity. */
const DECORATION = /^(senior|sr|club|rugby|football|rfc|xvs?|15s|[a-z]+rfu)$/i;
const ORDINAL = /^(1st|2nd|3rd)$/i;
const DIVISION_TOKEN = /^(M|W\+?)?D([1-4])$/i;
const ROMAN_DIVISION_TOKEN = /^(M|W\+?)?D(I{1,3}|IV)$/;
const GENDER_TOKEN = /^(?:(m|men|mens|men's)|(w\+?|women\+?|womens\+?|women's\+?))$/i;

/** Names of championship rounds and one-off entries, which aren't a club's side. */
const NOT_A_SIDE = /championship|premiership|18\+|18-99|\bARP\b|7s\b|10s\b|festival|social|gameday|select/i;

/** A one-side club's side when the record doesn't say its division. */
const NO_DIVISION_LABEL = 'Senior';

/** The division a club's second side is taken to play in when nothing of its club,
 *  nor the record, says. */
const LOWER_SIDE_LEVEL = 3;

const genderOf = (token: string): Gender => (token.toUpperCase().startsWith('W') ? 'W' : 'M');

/** A team name without its trailing gender, division, XV and decoration. */
function readTeamName(teamName: string): { base: string; gender?: Gender; level?: number; xv: number; bSide: boolean } {
  const tokens = teamName.trim().split(/\s+/);
  let gender: Gender | undefined;
  let level: number | undefined;
  let xv = 1;
  let bSide = false;
  while (tokens.length > 1) {
    const token = tokens[tokens.length - 1];
    const lettered = tokens[tokens.length - 2].match(/^[ABC]$/);
    const division = token.match(DIVISION_TOKEN) ?? token.match(ROMAN_DIVISION_TOKEN);
    const genderWord = token.match(GENDER_TOKEN);
    if (/^side$/i.test(token) && lettered && tokens.length > 2) {
      xv = 'ABC'.indexOf(lettered[0]) + 1;
      bSide = lettered[0] === 'B';
      tokens.pop();
    } else if (/^b-(side|league)$/i.test(token)) {
      bSide = true;
    } else if (ORDINAL.test(token)) {
      xv = Number(token[0]);
    } else if (division) {
      level = ROMAN[division[2]] ?? Number(division[2]);
      if (division[1]) gender = genderOf(division[1]);
    } else if (genderWord) {
      gender = genderOf(token);
    } else if (!DECORATION.test(token) && !/^side$/i.test(token)) {
      break;
    }
    tokens.pop();
  }
  return { base: tokens.join(' '), gender, level, xv, bSide };
}

/** The one division a competition's name gives, if it gives exactly one. */
function competitionDivision(compName: string): { level: number; gender?: Gender } | null {
  const pattern = /(?<![A-Za-z0-9])(?:[MWmw]\+?\s?)?(?:[Dd]ivision|DIVISION|[Dd]iv\.?|DIV\.?|[Dd])\s*([1-4]|I{1,3}|IV)(?![A-Za-z0-9])/g;
  const levels = new Set([...compName.matchAll(pattern)].map((match) => ROMAN[match[1]] ?? Number(match[1])));
  if (levels.size !== 1) return null;
  const gender = /\bwom[ae]n|\bladies|\bw\+?\s?d\s?\d/i.test(compName)
    ? 'W'
    : /\bmens?\b|\bmen's|\bm\s?d\s?\d/i.test(compName)
      ? 'M'
      : undefined;
  return { level: [...levels][0], gender };
}

/** The division most of a team's fixtures name in their competition; none if they split evenly. */
function mostCommonDivision(divisions: { level: number; gender?: Gender }[]): { level: number; gender?: Gender } | null {
  const counts = new Map<number, number>();
  for (const { level } of divisions) counts.set(level, (counts.get(level) ?? 0) + 1);
  const ranked = [...counts].sort(([, a], [, b]) => b - a);
  if (ranked.length === 0 || ranked[0][1] === ranked[1]?.[1]) return null;
  const level = ranked[0][0];
  return { level, gender: divisions.find((division) => division.level === level && division.gender)?.gender };
}

/** A Locked Season's clubs and sides, highest division first. A team with no division
 *  that is alone at its club is a one-side club. A club holding two
 *  names at one division is left out rather than ranked one above the other, since
 *  that would judge a player against a side that is really their own. */
export function historicalClubs(fixtures: HistoricalFixture[], rules: EligibilityRules): HistoricalClubs {
  const divisionsByTeam = new Map<string, { level: number; gender?: Gender }[]>();
  for (const fixture of fixtures) {
    if (!isQualifying(fixture.compName, rules)) continue;
    const division = competitionDivision(fixture.compName);
    for (const team of [fixture.homeTeam.name, fixture.awayTeam.name]) {
      if (!team) continue;
      const known = divisionsByTeam.get(team) ?? [];
      if (division) known.push(division);
      divisionsByTeam.set(team, known);
    }
  }

  const clubName = (base: string, gender: Gender) => (gender === 'W' ? `${base} Women` : base);
  const sidesByClub = new Map<string, { teamName: string; level: number; xv: number; label?: string }[]>();
  const noDivision = new Map<string, string>();
  const lowerSides: { teamName: string; club: string; gender: Gender; below: number }[] = [];
  for (const [teamName, divisions] of divisionsByTeam) {
    const { base, gender: nameGender, level: nameLevel, xv: nameXv, bSide } = readTeamName(teamName);
    const common = nameLevel === undefined ? mostCommonDivision(divisions) : null;
    const compGender = common?.gender ?? divisions.find((division) => division.gender)?.gender;
    const gender = nameGender ?? compGender ?? 'M';
    const level = nameLevel ?? common?.level;
    const club = clubName(base, gender);
    // A 2nd XV or B side the record gives no division is placed once its club's other
    // sides are: so many divisions below the lowest of them.
    const below = nameXv > 1 ? nameXv - 1 : bSide ? 1 : 0;
    if (level === undefined && below > 0) {
      lowerSides.push({ teamName, club, gender, below });
    } else if (level === undefined) {
      noDivision.set(teamName, club);
    } else if (isNcsSide({ gender, level })) {
      sidesByClub.set(club, [...(sidesByClub.get(club) ?? []), { teamName, level, xv: nameXv }]);
    }
  }
  for (const { teamName, club, gender, below } of lowerSides) {
    const levels = (sidesByClub.get(club) ?? []).map((side) => side.level);
    const firsts = [...noDivision].filter(([team, of]) => of === club && !NOT_A_SIDE.test(team));
    if (levels.length === 0 && firsts.length === 1) {
      // Neither side's division is known, only their order: rank them under their own
      // names, at the lowest levels the NCS has for them.
      const lowest = gender === 'W' ? 2 : 3;
      const [first] = firsts[0];
      noDivision.delete(first);
      sidesByClub.set(club, [
        { teamName: first, level: lowest - below, xv: 1, label: '1st XV' },
        { teamName, level: lowest, xv: 1, label: below === 1 ? '2nd XV' : '3rd XV' },
      ]);
      continue;
    }
    // With no side of its club placed, a second side is taken as Division 3.
    const level = levels.length > 0 ? Math.max(...levels) + below : LOWER_SIDE_LEVEL + below - 1;
    if (isNcsSide({ gender, level })) {
      sidesByClub.set(club, [...(sidesByClub.get(club) ?? []), { teamName, level, xv: 1 }]);
    }
  }

  // Alone at its club, a team needs no division: a one-side club has only the
  // two-match minimum.
  const clubs: HistoricalClub[] = [];
  const sharing = new Map<string, number>();
  for (const club of noDivision.values()) sharing.set(club, (sharing.get(club) ?? 0) + 1);
  for (const [teamName, club] of noDivision) {
    if (NOT_A_SIDE.test(teamName) || sidesByClub.has(club) || sharing.get(club) !== 1) continue;
    clubs.push({ name: club, sides: [{ teamName, label: NO_DIVISION_LABEL }] });
    noDivision.delete(teamName);
  }

  const unplaced = [...noDivision.keys()];
  for (const [name, sides] of sidesByClub) {
    const slots = new Set(sides.map(({ level, xv }) => `${level}:${xv}`));
    if (slots.size < sides.length) {
      unplaced.push(...sides.map((side) => side.teamName));
      continue;
    }
    const unplacedTeams = [...noDivision].filter(([, club]) => club === name).map(([team]) => team).sort();
    clubs.push({
      name,
      sides: [...sides]
        .sort((a, b) => a.level - b.level || a.xv - b.xv)
        .map(({ teamName, level, xv, label }) => ({ teamName, label: label ?? sideLabel({ level, xv }) })),
      ...(unplacedTeams.length > 0 ? { unplacedTeams } : {}),
    });
  }
  return {
    clubs: clubs.sort((a, b) => a.name.localeCompare(b.name)),
    unplacedTeams: unplaced.sort(),
  };
}
