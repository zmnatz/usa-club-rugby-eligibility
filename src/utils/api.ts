const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// The CMS sits behind a rate limiter (Stellate) with two budgets per IP, and
// blocked requests count against them too:
// - RequestCount: 500 requests, refilling at about 4 a second.
// - QueryComplexity: 1,000,000 a window of about a minute, which resets at once.
//   A feed page of 100 fixtures costs about 1,800 and a match record about 56, so
//   batched feeds are what reach it: a 20-page batch is about 36,000.
// Every answer reports both, so all requests share one gate: when either runs
// low they wait together for it to refill, rather than each one running into
// 429s. See docs/adr/001-national-coverage.md.

/** Below this much of a budget the gate pauses. Complexity keeps room for the
 *  requests already in flight: two 20-page feed batches with margin. */
const RATE_LIMIT_RESERVES: Record<string, number> = {
  RequestCount: 20,
  QueryComplexity: 100_000,
};

let pausedUntil = 0;
/** What the last response reported, and how often each limit paused the gate,
 *  for progress logs. */
export const rateLimitState = {
  remaining: null as number | null,
  complexityRemaining: null as number | null,
  pauses: 0,
  pausesBy: {} as Record<string, number>,
};

export interface RateLimitRule {
  /** `RequestCount` or `QueryComplexity`. */
  type: string;
  budget: number;
  remaining: number;
  refillSeconds: number;
  limited: boolean;
}

/** Every budget a response reports, from its `stellate-rate-limit-rules` header. */
export function rateLimitRules(header: string | null): RateLimitRule[] {
  if (!header) return [];
  return header.split(/,\s*(?=")/).flatMap((part) => {
    const type = part.match(/type="([^"]+)"/)?.[1];
    const remaining = part.match(/remaining=(\d+)/)?.[1];
    if (!type || remaining === undefined) return [];
    return [
      {
        type,
        budget: Number(part.match(/budget=(\d+)/)?.[1] ?? 0),
        remaining: Number(remaining),
        refillSeconds: Number(part.match(/refill=(\d+)/)?.[1] ?? 1),
        // "limited" alone means blocked; "limited=?0" means not.
        limited: /;limited(;|$)/.test(part),
      },
    ];
  });
}

/** The request budget a response reports, if it does. */
export function rateLimitBudget(header: string | null): { remaining: number; refillSeconds: number } | null {
  const rule = rateLimitRules(header).find((item) => item.type === 'RequestCount');
  return rule ? { remaining: rule.remaining, refillSeconds: rule.refillSeconds } : null;
}

function pauseFor(ms: number, reason: string): void {
  const until = Date.now() + ms;
  if (until <= pausedUntil) return;
  rateLimitState.pauses += 1;
  rateLimitState.pausesBy[reason] = (rateLimitState.pausesBy[reason] ?? 0) + 1;
  // The time the gate is closed, once, however many requests wait on it.
  requestStats.waitMs += until - Math.max(pausedUntil, Date.now());
  pausedUntil = until;
}

/** How long to hold off after a response, and which budget is why: none while
 *  every budget is above its reserve. Request count trickles back at about 4 a
 *  second, so a few seconds restores its reserve; complexity comes back only when
 *  its window resets, so the wait runs to then. */
export function pauseAfter(rules: RateLimitRule[]): { ms: number; reason: string } | null {
  let longest: { ms: number; reason: string } | null = null;
  for (const rule of rules) {
    const reserve = RATE_LIMIT_RESERVES[rule.type] ?? 0;
    if (rule.remaining >= reserve) continue;
    const seconds = rule.type === 'RequestCount' ? Math.max(rule.refillSeconds, 3) : rule.refillSeconds + 1;
    if (!longest || seconds * 1000 > longest.ms) longest = { ms: seconds * 1000, reason: rule.type };
  }
  return longest;
}

async function waitForBudget(): Promise<void> {
  while (Date.now() < pausedUntil) {
    await sleep(pausedUntil - Date.now());
  }
}

/** A request the rate limiter turned away, and how long it asked to wait. */
export class RateLimitedError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Request failed: 429');
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  await waitForBudget();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...options.headers,
    },
  });

  const rules = rateLimitRules(response.headers?.get('stellate-rate-limit-rules') ?? null);
  for (const rule of rules) {
    if (rule.type === 'RequestCount') rateLimitState.remaining = rule.remaining;
    if (rule.type === 'QueryComplexity') rateLimitState.complexityRemaining = rule.remaining;
  }
  if (response.status === 429) {
    const blocked = rules.find((rule) => rule.limited);
    const retryAfterMs = (Number(response.headers?.get('retry-after')) || blocked?.refillSeconds || 5) * 1000;
    pauseFor(retryAfterMs, `429 ${blocked?.type ?? 'unknown'}`);
    throw new RateLimitedError(retryAfterMs);
  }
  const pause = pauseAfter(rules);
  if (pause) pauseFor(pause.ms, pause.reason);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export function get<T>(url: string, accessToken?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return request<T>(url, { headers });
}

export function post<T>(url: string, body: unknown, accessToken?: string | null): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

/** Counts for the current process, so a snapshot job can report where its time went. */
export const requestStats = { requests: 0, retries: 0, waitMs: 0, requestMs: 0 };

export function resetRequestStats(): void {
  Object.assign(requestStats, { requests: 0, retries: 0, waitMs: 0, requestMs: 0 });
}

function statusFromError(error: unknown): number | undefined {
  const match = String((error as Error)?.message ?? '').match(
    /Request failed: (\d{3})/
  );
  return match ? parseInt(match[1], 10) : undefined;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Maps over items with at most `limit` running at once, keeping the order given so
// the output doesn't depend on which finishes first.
export async function mapConcurrent<Item, Result>(
  items: Item[],
  limit: number,
  run: (item: Item) => Promise<Result>
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** How many times one request waits out the rate limit before giving up. */
const RATE_LIMIT_WAITS = 10;

// POST with exponential backoff for transient failures (5xx, network errors).
// A 429 waits for the limiter's Retry-After, through the shared gate, without
// using up a retry. Other 4xx errors throw immediately.
export async function postWithRetry<T>(
  url: string,
  body: unknown,
  accessToken?: string | null,
  options?: RetryOptions
): Promise<T> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  let rateLimitWaits = 0;

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    requestStats.requests += 1;
    try {
      return await post<T>(url, body, accessToken);
    } catch (error) {
      if (error instanceof RateLimitedError && rateLimitWaits < RATE_LIMIT_WAITS) {
        rateLimitWaits += 1;
        attempt -= 1;
        requestStats.retries += 1;
        continue;
      }
      const status = statusFromError(error);
      const retryable =
        status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt >= retries) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 250;
      requestStats.retries += 1;
      requestStats.waitMs += delay;
      await sleep(delay);
    } finally {
      requestStats.requestMs += Date.now() - startedAt;
    }
  }
}
