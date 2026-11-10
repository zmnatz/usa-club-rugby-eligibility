import { describe, expect, it } from 'vitest';
import { computeBreakdown } from '../eligibility.ts';
import { inExcludedMonth, isQualifyingMatch } from '../qualifying.ts';
import { DEFAULT_RULES, rulesForSeason } from '../rules.ts';
import type { PlayerRow, Side } from '../types.ts';

const side = (level: number): Side => ({ teamName: `Club MD${level}`, label: `D${level}` });

const row = (teamName: string, played: number): PlayerRow => ({
  playerId: 'p',
  firstName: 'Pat',
  lastName: 'Lee',
  lastRegistered: '',
  teamName,
  competition: `${teamName} league`,
  appearances: played,
  played,
  substitute: 0,
  rounds: {},
});

const rowsFor = (sides: Side[], counts: number[]) => sides.map((item, index) => row(item.teamName, counts[index]));

describe('a Locked Season', () => {
  const sides = [side(1), side(2)];

  it('fails a player short of the minimum, whatever fixtures the feed still lists', () => {
    const { sides: [top] } = computeBreakdown(rowsFor(sides, [1, 0]), sides, DEFAULT_RULES, { 'Club MD1': 3 }, { locked: true });
    expect(top.players[0].eligible).toBe(false);
    expect(top.players[0].pending).toEqual([]);
    expect(top.summary.onTrack).toBe(0);
  });

  it('gives no caution to a player one match from the limit', () => {
    const { sides: [, lower] } = computeBreakdown(rowsFor(sides, [3, 5]), sides, DEFAULT_RULES, {}, { locked: true });
    expect(lower.players[0].eligible).toBe(true);
    expect(lower.players[0].cautions).toEqual([]);
    expect(lower.summary.caution).toBe(0);
  });
});

/** The divisions a player's match counts make them eligible for, given each side's schedule. */
function eligibleFor(season: string, levels: number[], counts: number[], schedule: number[]): string[] {
  const sides = levels.map(side);
  const scheduled = Object.fromEntries(sides.map((item, index) => [item.teamName, schedule[index]]));
  return computeBreakdown(rowsFor(sides, counts), sides, rulesForSeason(season), {}, { locked: true, scheduled })
    .sides.filter((item) => item.players[0].eligible)
    .map((item) => item.label);
}

describe('rulesForSeason', () => {
  it.each(['2025/2026', '2026/2027', '2027/2028'])('applies the current regulations to %s', (season) => {
    expect(rulesForSeason(season)).toBe(DEFAULT_RULES);
  });
});

// Regulations 3.5(d), Figure 1, as printed for each season. Lower-side counts are high
// so that only the 66% trigger can decide the verdict.
describe('the 66% trigger', () => {
  it.each([
    [13, 9],
    [12, 8],
    [11, 7],
    [10, 7],
    [9, 6],
    [8, 5],
    [7, 5],
    [6, 4],
    [5, 4],
  ])('2023-24 and 2024-25: a schedule of %i triggers at %i', (schedule, trigger) => {
    for (const season of ['2023/2024', '2024/2025']) {
      expect(eligibleFor(season, [1, 2], [trigger - 1, 20], [schedule, 8])).toEqual(['D1', 'D2']);
      expect(eligibleFor(season, [1, 2], [trigger, 20], [schedule, 8])).toEqual(['D1']);
    }
  });

  it.each([
    [14, 9],
    [13, 9],
    [12, 8],
    [11, 7],
    [10, 7],
    [9, 6],
    [8, 5],
    [7, 5],
    [6, 4],
    [5, 3],
  ])('2022-23: a schedule of %i triggers at %i', (schedule, trigger) => {
    expect(eligibleFor('2022/2023', [1, 2], [trigger - 1, 20], [schedule, 8])).toEqual(['D1', 'D2']);
    expect(eligibleFor('2022/2023', [1, 2], [trigger, 20], [schedule, 8])).toEqual(['D1']);
  });

  it('2023-24 onward adds the upper levels together for the side below them', () => {
    expect(eligibleFor('2024/2025', [1, 2, 3], [2, 2, 20], [6, 6, 8])).toEqual(['D1', 'D2']);
  });

  it('2022-23 judges each upper side alone', () => {
    expect(eligibleFor('2022/2023', [1, 2, 3], [2, 2, 20], [6, 6, 8])).toEqual(['D1', 'D2', 'D3']);
  });

  it('uses the schedule of the upper side with fewer Qualifying Matches', () => {
    // Division 3 is measured on the 6-match schedule (trigger 4), Division 2 on Division 1's 12 (trigger 8).
    expect(eligibleFor('2022/2023', [1, 2, 3], [4, 0, 20], [12, 6, 8])).toEqual(['D1', 'D2']);
  });

  it('is not applied to a side with no schedule in the record', () => {
    expect(eligibleFor('2024/2025', [1, 2], [9, 20], [0, 8])).toEqual(['D1', 'D2']);
  });
});

describe('the 50% comparison', () => {
  it.each(['2022/2023', '2023/2024', '2024/2025'])('%s: half the matches with the upper side loses the lower side', (season) => {
    expect(eligibleFor(season, [1, 2], [3, 3], [12, 8])).toEqual(['D1']);
  });

  it('the printed example: 3 upper and 2 lower matches', () => {
    expect(eligibleFor('2024/2025', [1, 2], [3, 2], [12, 8])).toEqual(['D1']);
  });

  it('2025-26: level with the upper side keeps the lower side', () => {
    expect(eligibleFor('2025/2026', [1, 2], [3, 3], [12, 8])).toEqual(['D1', 'D2']);
  });

  it('adds a player\'s upper sides together for the side below them', () => {
    expect(eligibleFor('2022/2023', [1, 2, 3], [2, 2, 3], [12, 12, 8])).toEqual(['D1', 'D2']);
  });

  it('a player with no upper-side matches is not caught by it', () => {
    expect(eligibleFor('2024/2025', [1, 2], [0, 2], [12, 8])).toEqual(['D1', 'D2']);
  });
});

describe('the end of the season', () => {
  const nationals = { compName: '2023 XVs Nationals', dateTime: '2023-06-02T15:00:00Z' };

  it('a June Nationals is 15s, not summer 7s', () => {
    expect(inExcludedMonth(nationals, DEFAULT_RULES)).toBe(false);
    expect(inExcludedMonth({ compName: 'SCRFU 7s - Ventura 6/10', dateTime: '2023-06-10T15:00:00Z' }, DEFAULT_RULES)).toBe(true);
  });

  it.each(['2023 XVs Nationals', '2026 National Championships XVs', '2025 Super Regional Pacific'])(
    'but %s is no NCS Qualifying Match',
    (compName) => {
      expect(isQualifyingMatch({ compName, dateTime: '2023-05-20T15:00:00Z' }, DEFAULT_RULES)).toBe(false);
    },
  );
});

