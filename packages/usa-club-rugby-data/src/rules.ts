import type { EligibilityRules } from './types.ts';

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
  nonQualifyingCompetitions: [
    'Super Regional',
    'ASR ',
    'National Championships',
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
