/**
 * Minimal in-memory, per-key fixed-window rate limiter for API routes.
 *
 * This protects the public Gemini-backed endpoints (/api/anomalies POST and
 * /api/chat) from unbounded usage. It is intentionally simple:
 *
 *   - State lives in process memory, so each serverless instance enforces its
 *     own window. This is a mitigation, not a global quota; for a hard global
 *     limit use a shared store (e.g. Upstash/Redis). It is still far better
 *     than no server-side limit, which let any caller bypass the client-side
 *     localStorage quota.
 *   - Fixed window (not sliding) keeps the implementation allocation-light.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets (only meaningful when blocked). */
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and report whether it is within `limit` per
 * `windowMs`. The first call in a window always passes.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers. Falls back to a shared bucket. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Test helper: clear all tracked windows. */
export function resetRateLimits(): void {
  buckets.clear();
}
