import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/utils/api-rate-limit";

describe("api route rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetRateLimits();
  });

  it("allows only the configured number of hits in a fixed window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T00:00:00.000Z"));

    expect(checkRateLimit("client", 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(checkRateLimit("client", 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(checkRateLimit("client", 2, 60_000)).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSec: 60,
    });
  });

  it("resets after the window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T00:00:00.000Z"));

    expect(checkRateLimit("client", 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("client", 1, 60_000).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-06-23T00:01:00.001Z"));

    expect(checkRateLimit("client", 1, 60_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});
