import { isQualifyingMatch } from './participation.ts';
import { isNcsSide, sideLabel } from './teamSide.ts';
import type { Club, EligibilityRules } from './types.ts';

// Before 2025-26 most team names don't end in a division ("White Plains M",
// "Harrisburg Men Senior Club"), so a Locked Season's clubs can't be read from the
// names alone. A team's division comes from its name if that has one and otherwise
// from the competitions it played in. See docs/adr/006-historical-eligibility.md.

type Gender = 'M' | 'W';

interface HistoricalFixture {
  compName: string;
  dateTime?: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

/** A club in a Locked Season, with any team that looks like its own but has no
 *  division: a side left out can make players below it look eligible. */
export interface HistoricalClub extends Club {
  unplacedTeams?: string[];
  /** What was assumed about a team where the record doesn't say, one per team. */
  notes?: string[];
}

export interface HistoricalClubs {
  clubs: HistoricalClub[];
  /** Teams that couldn't be given a division or ranked within their club. */
  unplacedTeams: string[];
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 };

/** Trailing words that say nothing about a club's identity, including the age tags
 *  that mark a senior team ("18+", "(18-99)"). */
const DECORATION = /^(senior|sr|club|rugby|football|rfc|team|gameday|xvs?|15s|[a-z]+rfu|18\+|\(?18-99\)?)$/i;
/** The Rocky Mountain union's league tiers, which its team names end in. Later seasons
 *  place the same clubs at these divisions. */
const RMR_TIERS: Record<string, number> = { premiership: 2, championship: 3 };
const ORDINAL = /^(1st|2nd|3rd)$/i;
const DIVISION_TOKEN = /^(M|W\+?)?D([1-4])$/i;
const ROMAN_DIVISION_TOKEN = /^(M|W\+?)?D(I{1,3}|IV)$/;
const GENDER_TOKEN = /^(?:(m|men|mens|men's)|(w\+?|women\+?|womens\+?|women's\+?))$/i;

/** Names of championship rounds and one-off entries, which aren't a club's side, and
 *  of American Rugby Premiership sides, which this report doesn't cover. */
const NOT_A_SIDE = /(?<!rmr )championship|(?<!rmr )premiership|\bARP\b|7s\b|10s\b|festival|social|select|all stars/i;

/** A one-side club's side when the record doesn't say its division. */
const NO_DIVISION_LABEL = 'Senior';

/** The division a club's second side is taken to play in when nothing of its club,
 *  nor the record, says. */
const LOWER_SIDE_LEVEL = 3;

const genderOf = (token: string): Gender => (token.toUpperCase().startsWith('W') ? 'W' : 'M');

/** A team name without its trailing gender, division, XV and decoration. */
function readTeamName(teamName: string): {
  base: string;
  gender?: Gender;
  level?: number;
  xv: number;
  bSide: boolean;
  /** The Rocky Mountain tier the level was read from. */
  tier?: string;
  /** A token naming two divisions ("D1/D2"); the lower of them is taken. */
  paired?: string;
} {
  const tokens = teamName.trim().split(/\s+/);
  let gender: Gender | undefined;
  let level: number | undefined;
  let xv = 1;
  let bSide = false;
  let tierName: string | undefined;
  let paired: string | undefined;
  while (tokens.length > 1) {
    const token = tokens[tokens.length - 1];
    const lettered = tokens[tokens.length - 2].match(/^[ABC]$/);
    const division = token.match(DIVISION_TOKEN) ?? token.match(ROMAN_DIVISION_TOKEN);
    const genderWord = token.match(GENDER_TOKEN);
    const tier = RMR_TIERS[token.toLowerCase()];
    if (tier && /^rmr$/i.test(tokens[tokens.length - 2]) && tokens.length > 2) {
      level = tier;
      tierName = token;
      tokens.pop();
    } else if (token === 'B' || token === '(B)') {
      bSide = true;
    } else if (token === 'A' || token === '-') {
      // "NYAC Mens A" is the club's main side; a dash only separates words.
    } else if (/^[23]$/.test(token)) {
      // "San Antonio 2 M": a number for the XV.
      xv = Number(token);
    } else if (/^D[1-4]\/D?[1-4]$/i.test(token)) {
      level = Math.max(...(token.match(/[1-4]/g) ?? []).map(Number));
      paired = token;
    } else if (/^D[1-4](M|W\+?)$/i.test(token)) {
      // "New Orleans D2M": the division before the gender.
      level = Number(token[1]);
      gender = genderOf(token.slice(2));
    } else if (/^side$/i.test(token) && lettered && tokens.length > 2) {
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
  return { base: tokens.join(' '), gender, level, xv, bSide, tier: tierName, paired };
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
  /** Teams in a women's competition that names no division, for their gender. */
  const inWomensCompetition = new Set<string>();
  const opponents = new Map<string, Set<string>>();
  for (const fixture of fixtures) {
    if (!isQualifyingMatch(fixture, rules)) continue;
    for (const [team, other] of [
      [fixture.homeTeam.name, fixture.awayTeam.name],
      [fixture.awayTeam.name, fixture.homeTeam.name],
    ]) {
      if (team && other) opponents.set(team, (opponents.get(team) ?? new Set()).add(other));
    }
    const division = competitionDivision(fixture.compName);
    for (const team of [fixture.homeTeam.name, fixture.awayTeam.name]) {
      if (!team) continue;
      if (/\bwom[ae]n|\bladies/i.test(fixture.compName)) inWomensCompetition.add(team);
      const known = divisionsByTeam.get(team) ?? [];
      if (division) known.push(division);
      divisionsByTeam.set(team, known);
    }
  }

  /** A club by its name with case, punctuation and spacing ignored, so "Philadelphia-
   *  Whitemarsh" and "Philadelphia Whitemarsh" are one club, shown as first spelled. */
  const shownName = new Map<string, string>();
  const clubName = (base: string, gender: Gender) => {
    const name = gender === 'W' ? `${base} Women` : base;
    const id = name.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();
    if (!shownName.has(id)) shownName.set(id, name);
    return id;
  };
  const shown = (id: string) => shownName.get(id) ?? id;
  const excluded: string[] = [];
  const clubOf = new Map<string, string>();
  const sidesByClub = new Map<string, { teamName: string; level: number; xv: number; label?: string }[]>();
  const noDivision = new Map<string, string>();
  const lowerSides: { teamName: string; club: string; gender: Gender; below: number }[] = [];
  /** What was assumed about a team, by team name. */
  const notes = new Map<string, string>();
  const unnamed = "the record doesn't name its division";
  for (const [teamName, divisions] of divisionsByTeam) {
    // American Rugby Premiership, 7s and 10s sides aren't assessed, whatever
    // competitions they're in.
    if (/\bARP\b|7s\b|10s\b/i.test(teamName)) {
      excluded.push(teamName);
      continue;
    }
    const { base, gender: nameGender, level: nameLevel, xv: nameXv, bSide, tier, paired } = readTeamName(teamName);
    const common = nameLevel === undefined ? mostCommonDivision(divisions) : null;
    if (common && new Set(divisions.map((division) => division.level)).size > 1) {
      notes.set(
        teamName,
        `${teamName}: its competitions name more than one division, so it is taken as D${common.level}, where most of its matches were.`,
      );
    }
    if (tier) notes.set(teamName, `${teamName}: its Rocky Mountain tier, ${tier}, is taken as D${nameLevel}.`);
    if (paired) notes.set(teamName, `${teamName}: its name gives two divisions, ${paired}, so it is taken as D${nameLevel}.`);
    const compGender =
      common?.gender ??
      divisions.find((division) => division.gender)?.gender ??
      (inWomensCompetition.has(teamName) ? 'W' : undefined);
    const gender = nameGender ?? compGender ?? 'M';
    const level = nameLevel ?? common?.level;
    const club = clubName(base, gender);
    clubOf.set(teamName, club);
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
      notes.set(
        first,
        `${first} and ${teamName}: the record doesn't name their divisions, so they are ranked by name, 1st XV above ${below === 1 ? '2nd XV' : '3rd XV'}.`,
      );
      sidesByClub.set(club, [
        { teamName: first, level: lowest - below, xv: 1, label: '1st XV' },
        { teamName, level: lowest, xv: 1, label: below === 1 ? '2nd XV' : '3rd XV' },
      ]);
      continue;
    }
    // With no side of its club placed, a second side is taken as Division 3.
    const level = levels.length > 0 ? Math.max(...levels) + below : LOWER_SIDE_LEVEL + below - 1;
    if (isNcsSide({ gender, level })) {
      const above = (sidesByClub.get(club) ?? []).find((side) => side.level === Math.max(...levels));
      notes.set(
        teamName,
        `${teamName}: ${unnamed}, so as a ${below === 1 ? 'second' : 'third'} side it is taken as D${level}${above ? `, below ${above.teamName}` : ''}.`,
      );
      sidesByClub.set(club, [...(sidesByClub.get(club) ?? []), { teamName, level, xv: 1 }]);
    }
  }

  // Alone at its club, a team needs no division: a one-side club has only the
  // two-match minimum.
  const clubs: HistoricalClub[] = [];
  const sharing = new Map<string, number>();
  for (const club of noDivision.values()) sharing.set(club, (sharing.get(club) ?? 0) + 1);
  /** The clubs a set of teams played against. */
  const opponentClubs = (teams: string[]) =>
    new Set(teams.flatMap((team) => [...(opponents.get(team) ?? [])].map((other) => clubOf.get(other) ?? other)));
  /** Whether a team plays any club its namesake's sides play, as one club's sides do.
   *  Two clubs that only share a name ("Columbus" in Ohio and in Georgia) don't. */
  const sameClub = (teamName: string, club: string) => {
    const theirs = opponentClubs((sidesByClub.get(club) ?? []).map((side) => side.teamName));
    return [...opponentClubs([teamName])].some((other) => theirs.has(other));
  };
  for (const [teamName, club] of noDivision) {
    if (NOT_A_SIDE.test(teamName) || sharing.get(club) !== 1) continue;
    if (sidesByClub.has(club) && sameClub(teamName, club)) continue;
    const note = sidesByClub.has(club)
      ? `${teamName}: another club named ${shown(club)} plays different opponents, so this is a club of its own. The record doesn't name its division, so it is assessed as a one-side club.`
      : `${teamName}: ${unnamed}, so the club is assessed as a one-side club.`;
    clubs.push({ name: shown(club), sides: [{ teamName, label: NO_DIVISION_LABEL }], notes: [note] });
    noDivision.delete(teamName);
  }

  const unplaced = [...noDivision.keys(), ...excluded];
  for (const [name, sides] of sidesByClub) {
    const slots = new Set(sides.map(({ level, xv }) => `${level}:${xv}`));
    if (slots.size < sides.length) {
      unplaced.push(...sides.map((side) => side.teamName));
      continue;
    }
    const unplacedTeams = [...noDivision].filter(([, club]) => club === name).map(([team]) => team).sort();
    const ranked = [...sides].sort((a, b) => a.level - b.level || a.xv - b.xv);
    const clubNotes = ranked.flatMap(({ teamName }) => notes.get(teamName) ?? []);
    clubs.push({
      name: shown(name),
      // "2nd XV" only tells apart two sides at one division.
      sides: ranked.map(({ teamName, level, xv, label }) => ({
        teamName,
        label: label ?? sideLabel({ level, xv: ranked.filter((side) => side.level === level).length > 1 ? xv : 1 }),
      })),
      ...(unplacedTeams.length > 0 ? { unplacedTeams } : {}),
      ...(clubNotes.length > 0 ? { notes: clubNotes } : {}),
    });
  }
  return {
    // Clubs sharing a name keep one order, so each keeps its page key.
    clubs: clubs.sort((a, b) => a.name.localeCompare(b.name) || a.sides[0].teamName.localeCompare(b.sides[0].teamName)),
    unplacedTeams: unplaced.sort(),
  };
}
