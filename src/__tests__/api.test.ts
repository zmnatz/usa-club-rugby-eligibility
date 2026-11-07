import { afterEach, describe, expect, it, vi } from 'vitest';
import { postWithRetry, rateLimitBudget } from '@/utils/api';

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
