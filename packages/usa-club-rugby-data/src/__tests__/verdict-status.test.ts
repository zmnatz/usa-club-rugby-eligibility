import { describe, expect, it } from 'vitest';
import { VERDICT_STATUSES, verdictRank, verdictStatus } from '../eligibility.ts';

const player = (eligible: boolean, pending: string[] = [], cautions: string[] = []) => ({ eligible, pending, cautions });

describe('verdictStatus', () => {
  it.each([
    [player(false), 'ineligible'],
    [player(true, [], ['one more']), 'caution'],
    [player(true, ['needs one']), 'on-track'],
    [player(true), 'eligible'],
  ] as const)('%#: %j is %s', (input, status) => {
    expect(verdictStatus({ ...input, pending: [...input.pending], cautions: [...input.cautions] })).toBe(status);
  });

  it('puts Ineligible above Caution and Caution above On Track', () => {
    expect(verdictStatus(player(false, ['needs one'], ['one more']))).toBe('ineligible');
    expect(verdictStatus(player(true, ['needs one'], ['one more']))).toBe('caution');
  });
});

describe('verdictRank', () => {
  it('orders Ineligible, Caution, On Track, Eligible', () => {
    expect(VERDICT_STATUSES).toEqual(['ineligible', 'caution', 'on-track', 'eligible']);
    const ranks = [player(false), player(true, [], ['one more']), player(true, ['needs one']), player(true)].map(verdictRank);
    expect(ranks).toEqual([0, 1, 2, 3]);
  });
});
