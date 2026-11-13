import { describe, expect, it } from 'vitest';
import { isForfeit, isPenaltyTryForfeit, markForfeits } from '../forfeit.ts';

const event = (type: string) => ({ id: type, minute: '0', type, comment: type });
const score = (home: string, away: string) => ({ homeTeam: { score: home }, awayTeam: { score: away } });
const penaltyTries = (count: number) => Array.from({ length: count }, () => event('Penalty Try'));

describe('isPenaltyTryForfeit', () => {
  it('is a forfeit when one side scored nothing and every score was a penalty try', () => {
    expect(isPenaltyTryForfeit(score('28', '0'), penaltyTries(4))).toBe(true);
    expect(isPenaltyTryForfeit(score('0', '49'), [...penaltyTries(7), event('Substitution - Tactical')])).toBe(true);
  });

  it('needs at least three penalty tries, since a real match can end 14–0 on two', () => {
    expect(isPenaltyTryForfeit(score('14', '0'), penaltyTries(2))).toBe(false);
    expect(isPenaltyTryForfeit(score('21', '0'), penaltyTries(3))).toBe(true);
  });

  it('is not when any other score was entered', () => {
    expect(isPenaltyTryForfeit(score('33', '0'), [...penaltyTries(4), event('Try')])).toBe(false);
    expect(isPenaltyTryForfeit(score('31', '0'), [...penaltyTries(4), event('Penalty Goal')])).toBe(false);
  });

  it('is not when both sides scored, neither did, or nothing was a penalty try', () => {
    expect(isPenaltyTryForfeit(score('14', '7'), penaltyTries(3))).toBe(false);
    expect(isPenaltyTryForfeit(score('0', '0'), [])).toBe(false);
    expect(isPenaltyTryForfeit(score('5', '0'), [event('Try')])).toBe(false);
    expect(isPenaltyTryForfeit(score('', ''), penaltyTries(3))).toBe(false);
  });
});

describe('markForfeits', () => {
  const fixture = (id: string, status: string, home = '28', away = '0') => ({ id, status, ...score(home, away) });

  it('marks a result entered as penalty tries a forfeit, and leaves the rest', () => {
    const fixtures = [fixture('pt', 'Result'), fixture('played', 'Result', '28', '7'), fixture('no-record', 'Result')];
    const matches = [
      { fixture: { id: 'pt' }, commentary: penaltyTries(4) },
      { fixture: { id: 'played' }, commentary: [...penaltyTries(4), event('Try')] },
    ] as Parameters<typeof markForfeits>[1];
    expect(markForfeits(fixtures, matches).map((item) => [item.id, isForfeit(item)])).toEqual([
      ['pt', true],
      ['played', false],
      ['no-record', false],
    ]);
  });

  it('keeps a fixture already marked a forfeit', () => {
    expect(isForfeit(markForfeits([fixture('f', 'Forfeit')], [])[0])).toBe(true);
  });
});
