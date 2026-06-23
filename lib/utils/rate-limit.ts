/**
 * Token-bucket rate limiter.
 *
 * Each call refills the bucket by `refillPerSec` tokens, up to
 * `capacity`. The first call always passes (full bucket). Subsequent
 * calls wait until a token is available, then proceed.
 *
 * This is a co-operative limiter: it does not stop external calls,
 * it just gates them. Use one instance per upstream service.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    // Safety: never spin longer than 90s in case the math is wrong.
    const start = Date.now();
    while (Date.now() - start < 90_000) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const tokensNeeded = 1 - this.tokens;
      const msToWait = Math.max(50, Math.ceil((tokensNeeded / this.refillPerSec) * 1000));
      await new Promise((r) => setTimeout(r, msToWait));
    }
    throw new Error("RateLimiter: waited >90s for a token");
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.capacity,
      this.tokens + elapsedSec * this.refillPerSec
    );
    this.lastRefill = now;
  }
}

/** CoinGecko free tier: conservative 5 req/min to avoid 429s. */
export const coingeckoLimiter = new RateLimiter(5, 5 / 60);
