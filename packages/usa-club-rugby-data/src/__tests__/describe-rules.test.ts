import { describe, expect, it } from 'vitest';
import { describeRules, rulesForSeason } from '../rules.ts';

const COUNTING =
  "Super Regionals, Nationals, 7s, friendlies, crossovers, socials and festivals don't count, and nor does any match in June or July.";

describe('a season\'s rules in words', () => {
  it('2025-26 and later', () => {
    expect(describeRules(rulesForSeason('2025/2026'))).toEqual([
      'Every player needs at least 2 NCS Qualifying Matches with the club; for a lower side, at its division or below.',
      'A 4th match for any one upper side loses the sides below it.',
      'A lower side needs at least as many matches at its division or below as for all the sides above it.',
      COUNTING,
    ]);
  });

  it('2023-24 and 2024-25', () => {
    expect(describeRules(rulesForSeason('2023/2024'))).toEqual([
      'Every player needs at least 2 NCS Qualifying Matches with the club; for a lower side, at its division or below.',
      "Playing 66% of an upper side's schedule loses the sides below it, counting the upper sides' matches together and measuring on the upper side with the shorter schedule (8 of 12; 4 of 5).",
      'Half or more of a player\'s matches being for the sides above loses a lower side.',
      COUNTING,
    ]);
  });

  it('2022-23', () => {
    expect(describeRules(rulesForSeason('2022/2023'))[1]).toBe(
      "Playing 66% of an upper side's schedule loses the sides below it, for any one upper side and measuring on the upper side with the shorter schedule (8 of 12).",
    );
  });
});
