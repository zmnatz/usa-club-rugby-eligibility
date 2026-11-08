import { afterEach, describe, expect, it, vi } from 'vitest';
import { pauseAfter, postWithRetry, rateLimitBudget, rateLimitRules } from '../api.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(status: number, body: unknown) {
  return () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

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

describe('postWithRetry and the rate limit', () => {
  const limited = () => ({
    ok: false,
    status: 429,
    headers: new Headers({ 'retry-after': '0.005' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });

  it("waits out each 429's Retry-After without using up its retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(limited())
      .mockResolvedValueOnce(mockFetch(200, { data: 1 })());
    vi.stubGlobal('fetch', fetchMock);

    await expect(postWithRetry('/api/test', {}, null, { retries: 0 })).resolves.toEqual({ data: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

const BOTH = (requests: string, complexity: string) =>
  `"IP limit by request count";type="RequestCount";budget=500;${requests}, "IP limit by query complexity";type="QueryComplexity";budget=1000000;${complexity}`;

describe('rateLimitRules', () => {
  it('reads both budgets, and which one blocked', () => {
    expect(rateLimitRules(BOTH('limited=?0;remaining=481;refill=25', 'limited;remaining=0;refill=27'))).toEqual([
      { type: 'RequestCount', budget: 500, remaining: 481, refillSeconds: 25, limited: false },
      { type: 'QueryComplexity', budget: 1000000, remaining: 0, refillSeconds: 27, limited: true },
    ]);
  });

  it('has none when the header is missing', () => {
    expect(rateLimitRules(null)).toEqual([]);
  });
});

describe('pauseAfter', () => {
  it("doesn't pause while both budgets are above their reserves", () => {
    expect(pauseAfter(rateLimitRules(BOTH('limited=?0;remaining=481;refill=25', 'limited=?0;remaining=680918;refill=27')))).toBeNull();
  });

  it("waits for the complexity window to reset when it's nearly spent, since it doesn't trickle back", () => {
    expect(pauseAfter(rateLimitRules(BOTH('limited=?0;remaining=481;refill=25', 'limited=?0;remaining=60000;refill=27')))).toEqual({
      ms: 28_000,
      reason: 'QueryComplexity',
    });
  });

  it('waits a few seconds when the request count is low, as it refills about 4 a second', () => {
    expect(pauseAfter(rateLimitRules(BOTH('limited=?0;remaining=10;refill=1', 'limited=?0;remaining=900000;refill=40')))).toEqual({
      ms: 3_000,
      reason: 'RequestCount',
    });
  });

  it('takes the longer wait when both are low', () => {
    expect(pauseAfter(rateLimitRules(BOTH('limited=?0;remaining=10;refill=1', 'limited=?0;remaining=1000;refill=40')))?.reason).toBe(
      'QueryComplexity',
    );
  });
});
