import type { EligibilityRules, ScheduleShareLimit } from './types.ts';

/**
 * The 2026-27 USA Club Rugby Senior Club Regulations (§3.4.2, §3.5) as thresholds.
 * Every function that applies the rules takes an `EligibilityRules`, so a different
 * season's rules can be passed instead of these. The numbered rules each field
 * encodes are in docs/adr/000-rules-carried-from-rocky-gorge.md.
 */
export const DEFAULT_RULES: EligibilityRules = {
  // Reg 3.4.2(e): at least two NCS Qualifying matches with the club. Reg 3.5.2(a)
  // applies it at a lower side's own level or below; Reg 3.5.2(b) at any level for
  // the top side.
  minimumMatches: 2,

  // Reg 3.5(d)(i): on playing a fourth match for any upper side, a player is no
  // longer eligible for the lower side(s).
  upperMatchLimit: 4,

  // Competitions that aren't NCS Qualifying Matches. League and local playoff matches
  // count. Case-insensitive name fragments. Applied to the match record and to
  // possible future matches; Super Regionals are also the deadline for reaching the
  // two-match minimums.
  // June and July are the 7s season, so no match then counts, whatever its competition
  // is called. A team with no other matches drops out with them.
  excludedMonths: [6, 7],
  // The 15s postseason, which can reach June (2023 XVs Nationals ran 2-4 June).
  postseasonCompetitions: ['Super Regional', 'National Championship', 'Nationals'],

  nonQualifyingCompetitions: [
    'Super Regional',
    'ASR ',
    'National Championships',
    'Nationals',
    '7s',
    "7's",
    'Sevens',
    'Friendly',
    'Friendlies',
    'Crossover',
    'Social',
    'Festival',
    'Qualifier Rosters',
  ],
};

/** Thresholds for the seasons whose regulations differ from today's, 2022-23 to
 *  2024-25: a lower side is lost at 66% of the upper side's schedule rather than
 *  after four matches, and half a player's matches with an upper side is too many
 *  rather than level being enough. Rugby Xplorer holds nothing earlier. The wording
 *  each encodes is in docs/adr/006-historical-eligibility.md. */
const scheduleShareRules = (scheduleShare: ScheduleShareLimit): EligibilityRules => ({
  ...DEFAULT_RULES,
  upperMatchLimit: null,
  scheduleShare,
  upperSideWinsTie: true,
});

/** 2023-24 and 2024-25: Figure 1 reads 4 for a five-match schedule, not 66% of it. */
const SUMMED_UPPER_LEVELS = scheduleShareRules({ combineUpperSides: true, exceptions: { 5: 4 } });

const SEASON_RULES: Record<string, EligibilityRules> = {
  '2022/2023': scheduleShareRules({ combineUpperSides: false }),
  '2023/2024': SUMMED_UPPER_LEVELS,
  '2024/2025': SUMMED_UPPER_LEVELS,
};

/** The regulations a season was played under. 2025-26 onward are today's. */
export function rulesForSeason(season: string): EligibilityRules {
  return SEASON_RULES[season] ?? DEFAULT_RULES;
}

/** The matches a 66% limit is reached at, for a schedule of so many matches. */
export function scheduleShareTrigger(schedule: number, share: ScheduleShareLimit): number {
  return share.exceptions?.[schedule] ?? Math.round(schedule * 0.66);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A season's rules as sentences, for the page that shows its verdicts. Written from
 *  the same rules the verdicts apply, so the two can't disagree. */
export function describeRules(rules: EligibilityRules): string[] {
  const lines = [
    `Every player needs at least ${rules.minimumMatches} NCS Qualifying Matches with the club; for a lower side, at its division or below.`,
  ];
  if (rules.upperMatchLimit !== null) {
    lines.push(`A ${ordinal(rules.upperMatchLimit)} match for any one upper side loses the sides below it.`);
  }
  if (rules.scheduleShare) {
    const how = rules.scheduleShare.combineUpperSides
      ? "counting the upper sides' matches together"
      : 'for any one upper side';
    const examples = [12, ...Object.keys(rules.scheduleShare.exceptions ?? {}).map(Number)]
      .map((schedule) => `${scheduleShareTrigger(schedule, rules.scheduleShare as ScheduleShareLimit)} of ${schedule}`)
      .join('; ');
    lines.push(
      `Playing 66% of an upper side's schedule loses the sides below it, ${how} and measuring on the upper side with the shorter schedule (${examples}).`,
    );
  }
  lines.push(
    rules.upperSideWinsTie
      ? "Half or more of a player's matches being for the sides above loses a lower side."
      : 'A lower side needs at least as many matches at its division or below as for all the sides above it.',
  );
  const months = (rules.excludedMonths ?? []).map((month) => MONTHS[month - 1]);
  lines.push(
    `Super Regionals, Nationals, 7s, friendlies, crossovers, socials and festivals don't count${
      months.length > 0 ? `, and nor does any match in ${months.join(' or ')}` : ''
    }.`,
  );
  return lines;
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
