import { type FixtureSides, clubFixtures } from './clubFixtures.ts';
import { clubBreakdown, clubGaps } from './clubReport.ts';
import { rulesForSeason } from './rules.ts';
import type { ScheduleFixture } from './schedule.ts';
import type { ParticipationGap, ParticipationSnapshot } from './snapshot.ts';
import type { Club, EligibilityBreakdown, EligibilityRules } from './types.ts';

export interface ClubSeasonOptions {
  /** Rules to apply instead of those of the snapshot's season. */
  rules?: EligibilityRules;
  /** The time possible remaining matches are counted from. Defaults to now. The one
   *  non-deterministic input; a Locked Season ignores it. */
  now?: Date;
}

/** A club's season: its verdicts, the gaps that could change them and the fixtures
 *  they were counted from, all under one set of rules. */
export interface ClubSeason<Fixture extends FixtureSides = ScheduleFixture> {
  breakdown: EligibilityBreakdown;
  gaps: ParticipationGap[];
  /** The fixtures in the divisions the club's sides play in. */
  fixtures: Fixture[];
  /** The rules the verdicts and gaps were worked out under. */
  rules: EligibilityRules;
}

/** One club's season from a saved record, under the regulations of the record's season
 *  unless others are given. `fixtures` may be every fixture or already the club's. */
export function clubSeason<Fixture extends ScheduleFixture>(
  snapshot: ParticipationSnapshot,
  fixtures: Fixture[],
  club: Club,
  { rules = rulesForSeason(snapshot.season), now }: ClubSeasonOptions = {},
): ClubSeason<Fixture> {
  const own = clubFixtures(fixtures, club);
  return {
    breakdown: clubBreakdown(snapshot, own, club, { rules, now }),
    gaps: clubGaps(snapshot, club, rules),
    fixtures: own,
    rules,
  };
}
