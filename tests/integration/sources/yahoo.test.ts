import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchYahooCandles,
  fetchYahooQuote,
  YahooError,
} from "@/lib/sources/yahoo";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function chartResponse(symbol: string) {
  return {
    chart: {
      result: [
        {
          meta: {
            symbol,
            regularMarketPrice: symbol === "AAPL" ? 203 : 350,
            regularMarketDayHigh: symbol === "AAPL" ? 205 : 355,
            regularMarketDayLow: symbol === "AAPL" ? 198 : 345,
            chartPreviousClose: symbol === "AAPL" ? 201 : 348,
            regularMarketVolume: 123_456,
            currency: "USD",
            longName: symbol === "AAPL" ? "Apple Inc." : "Tesla, Inc.",
            regularMarketTime: 1_750_000_000,
          },
          timestamp: [1_749_800_000, 1_749_886_400],
          indicators: {
            quote: [
              {
                open: [200, 349],
                high: [205, 355],
                low: [198, 345],
                close: [203, 350],
                volume: [123_456, 234_567],
              },
            ],
          },
        },
      ],
      error: null,
    },
  };
}

describe("Yahoo Finance source", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("THIS_TICKER_DOES_NOT_EXIST_12345")) {
          return jsonResponse({
            chart: {
              result: null,
              error: {
                code: "Not Found",
                description: "No data found",
              },
            },
          });
        }
        return jsonResponse(chartResponse(url.includes("TSLA") ? "TSLA" : "AAPL"));
      })
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes a quote response", async () => {
    const quote = await fetchYahooQuote("AAPL");

    expect(quote).toMatchObject({
      symbol: "AAPL",
      currentPrice: 203,
      openPrice: 200,
      previousClose: 201,
      currency: "USD",
      longName: "Apple Inc.",
    });
  });

  it("normalizes daily candles", async () => {
    const candles = await fetchYahooCandles("TSLA", 5);

    expect(candles).toHaveLength(2);
    expect(candles[0]).toMatchObject({
      open: 200,
      high: 205,
      low: 198,
      close: 203,
      volume: 123_456,
    });
  });

  it("throws YahooError for an unknown ticker", async () => {
    await expect(
      fetchYahooQuote("THIS_TICKER_DOES_NOT_EXIST_12345")
    ).rejects.toBeInstanceOf(YahooError);
  });
});
