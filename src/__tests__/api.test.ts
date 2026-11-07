import { describe, expect, it } from 'vitest';
import { rateLimitBudget } from '@/utils/api';

describe('rateLimitBudget', () => {
  it('reads the request budget from the limiter header, ignoring the complexity budget', () => {
    expect(
      rateLimitBudget(
        '"IP limit by request count";type="RequestCount";budget=500;limited=?0;remaining=168;refill=1, "IP limit by query complexity";type="QueryComplexity";budget=1000000;limited=?0;remaining=944779;refill=60',
      ),
    ).toEqual({ remaining: 168, refillSeconds: 1 });
  });

  it('reads a blocked budget', () => {
    expect(
      rateLimitBudget('"IP limit by request count";type="RequestCount";budget=500;limited;remaining=0;refill=48'),
    ).toEqual({ remaining: 0, refillSeconds: 48 });
  });

  it('has none when the header is missing', () => {
    expect(rateLimitBudget(null)).toBeNull();
  });
});
