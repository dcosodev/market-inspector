import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const GLOBAL_QUOTE = {
  "Global Quote": {
    "01. symbol": "AAPL",
    "02. open": "200.00",
    "03. high": "205.00",
    "04. low": "198.00",
    "05. price": "203.00",
    "06. volume": "123456",
    "07. latest trading day": "2026-06-20",
    "08. previous close": "201.00",
    "09. change": "2.00",
    "10. change percent": "0.9950%",
  },
};

let alphaVantage: typeof import("@/lib/sources/alpha-vantage");
const originalApiKey = process.env.ALPHA_VANTAGE_API_KEY;

beforeAll(async () => {
  process.env.ALPHA_VANTAGE_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(GLOBAL_QUOTE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  alphaVantage = await import("@/lib/sources/alpha-vantage");
});

beforeEach(() => {
  alphaVantage._resetAlphaVantageCounter();
});

afterAll(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) {
    delete process.env.ALPHA_VANTAGE_API_KEY;
  } else {
    process.env.ALPHA_VANTAGE_API_KEY = originalApiKey;
  }
});

describe("Alpha Vantage source", () => {
  it("rejects the sixth call with a daily-limit error", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(alphaVantage.fetchStockQuote("AAPL")).resolves.toMatchObject({
        symbol: "AAPL",
        currentPrice: 203,
      });
    }

    const error = await alphaVantage.fetchStockQuote("AAPL").catch((e) => e);
    expect(error).toBeInstanceOf(alphaVantage.AlphaVantageError);
    expect(error).toMatchObject({
      message: "Alpha Vantage daily limit (5/day) reached",
      isRateLimit: true,
    });
  });
});
