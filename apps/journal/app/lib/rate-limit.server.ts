// Per-process in-memory rate limiter. Single-instance is fine for the
// flagship's current topology (one journal container); when we
// horizontally scale we revisit with a Postgres- or Redis-backed store.
//
// Algorithm: fixed-window counter. Each `(scope, key)` pair tracks the
// first-attempt timestamp and a counter. The next attempt after the
// window resets the counter. Simpler than token-bucket and good enough
// for "5 logins per minute" / "3 magic links per 5 minutes" semantics.

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

// Periodic sweep so stale entries don't grow unbounded. 5-minute interval
// is fine — entries are tiny and expire on next check anyway.
let sweepTimer: ReturnType<typeof setInterval> | undefined;
function ensureSweeper(): void {
  if (sweepTimer || process.env.NODE_ENV === "test" || process.env.VITEST) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      // Conservative: drop entries older than 1 hour regardless of
      // configured window. Active limiters re-create their entry.
      if (now - b.windowStart > 60 * 60 * 1000) buckets.delete(k);
    }
  }, 5 * 60 * 1000);
  sweepTimer.unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimitOptions {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Check (and consume) one slot from the given limiter. Returns whether
 * the call is allowed plus how many slots remain in the current window.
 *
 * The limiter is keyed by `${scope}:${key}` — `scope` distinguishes the
 * route family (e.g. "login-attempt", "magic-link-send") so a flood on
 * one endpoint doesn't lock out the others.
 */
export function consumeRateLimit(opts: RateLimitOptions): RateLimitResult {
  // E2E suite drives auth flows from one IP at high volume; production
  // limits would trip and flake tests. Same opt-out pattern as
  // requireSecret() / getDatabaseUrl().
  if (process.env.E2E === "true") {
    return { allowed: true, remaining: opts.limit, resetMs: opts.windowMs };
  }
  ensureSweeper();
  const now = Date.now();
  const id = `${opts.scope}:${opts.key}`;
  const existing = buckets.get(id);
  if (!existing || now - existing.windowStart >= opts.windowMs) {
    buckets.set(id, { windowStart: now, count: 1 });
    return { allowed: true, remaining: opts.limit - 1, resetMs: opts.windowMs };
  }
  existing.count += 1;
  const resetMs = opts.windowMs - (now - existing.windowStart);
  if (existing.count > opts.limit) {
    return { allowed: false, remaining: 0, resetMs };
  }
  return { allowed: true, remaining: opts.limit - existing.count, resetMs };
}

/**
 * Extract the client IP from a Request. Honors `X-Forwarded-For`
 * (Caddy in front of the journal sets it) and falls back to a stable
 * "unknown" bucket so the limiter still meaningfully rate-limits when
 * the header is missing.
 */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the original client; everything after is proxies.
    return xff.split(",")[0]!.trim();
  }
  return "unknown";
}

/** Test-only: reset all buckets between tests. */
export function _resetRateLimitsForTest(): void {
  buckets.clear();
}
