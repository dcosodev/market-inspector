/**
 * Yahoo Finance unofficial public API.
 *
 * No key required. Used as a fallback when Finnhub/Alpha Vantage
 * are unavailable. Yahoo does not publish this endpoint officially,
 * so requests include a browser-compatible User-Agent.
 *
 * The /v8/finance/chart endpoint returns quote + intraday/daily
 * candles required by the stock quote and history tools.
 */
import { ofetch } from "ofetch";
import { RateLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const YAHOO_BASES = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

/** Conservative: 20 req/min. Yahoo doesn't publish official limits. */
const yahooLimiter = new RateLimiter(20, 20 / 60);

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export class YahooError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "YahooError";
  }
}

export interface YahooQuote {
  symbol: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  currency: string;
  longName: string;
  timestamp: number;
}

export interface YahooCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        symbol: string;
        regularMarketPrice: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        chartPreviousClose: number;
        regularMarketVolume: number;
        currency: string;
        longName?: string;
        regularMarketTime: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
    error?: { code: string; description: string };
  };
}

async function yahooChartFetch(
  path: string,
  query: Record<string, string>
): Promise<YahooChartResponse> {
  for (const base of YAHOO_BASES) {
    try {
      return await ofetch<YahooChartResponse>(`${base}${path}`, {
        query,
        headers: HEADERS,
        timeout: MARKET_REQUEST_TIMEOUT_MS,
        onResponseError({ response }) {
          throw new YahooError(
            `Yahoo ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`,
            response.status
          );
        },
      });
    } catch (e) {
      if (e instanceof YahooError && e.status === 429 && base !== YAHOO_BASES[YAHOO_BASES.length - 1]) {
        continue;
      }
      throw e;
    }
  }
  throw new YahooError("All Yahoo endpoints unavailable", 429);
}

export async function fetchYahooQuote(symbol: string): Promise<YahooQuote> {
  await yahooLimiter.acquire();
  const upper = symbol.toUpperCase();
  const data = await yahooChartFetch(
    `/v8/finance/chart/${encodeURIComponent(upper)}`,
    { interval: "1d", range: "2d" }
  );
  if (data.chart.error) {
    throw new YahooError(`Yahoo error: ${data.chart.error.description}`);
  }
  const result = data.chart.result?.[0];
  if (!result) {
    throw new YahooError(`No data for symbol "${upper}"`);
  }
  const meta = result.meta;
  const current = meta.regularMarketPrice;
  const prev = meta.chartPreviousClose;
  const change = current - prev;
  const changePercent = prev !== 0 ? (change / prev) * 100 : 0;
  // The 2-day chart includes daily candle opens; fall back to the
  // current price only when Yahoo omits the first open value.
  const open = result.indicators?.quote?.[0]?.open?.[0] ?? current;
  return {
    symbol: upper,
    currentPrice: current,
    highPrice: meta.regularMarketDayHigh,
    lowPrice: meta.regularMarketDayLow,
    openPrice: open,
    previousClose: prev,
    change,
    changePercent,
    volume: meta.regularMarketVolume,
    currency: meta.currency,
    longName: meta.longName ?? upper,
    timestamp: meta.regularMarketTime * 1000,
  };
}

export async function fetchYahooCandles(
  symbol: string,
  days: number
): Promise<YahooCandle[]> {
  await yahooLimiter.acquire();
  const upper = symbol.toUpperCase();
  const data = await yahooChartFetch(
    `/v8/finance/chart/${encodeURIComponent(upper)}`,
    { interval: "1d", range: `${Math.min(days, 30)}d` }
  );
  const result = data.chart.result?.[0];
  if (!result || !result.timestamp) {
    throw new YahooError(`No candle data for "${upper}"`);
  }
  const quote = result.indicators?.quote?.[0];
  if (!quote) {
    throw new YahooError(`No quote indicators for "${upper}"`);
  }
  return result.timestamp
    .map((ts, i) => {
      const o = quote.open?.[i] ?? null;
      const h = quote.high?.[i] ?? null;
      const l = quote.low?.[i] ?? null;
      const c = quote.close?.[i] ?? null;
      const v = quote.volume?.[i] ?? null;
      if (o === null || h === null || l === null || c === null || v === null) {
        return null;
      }
      return {
        timestamp: ts * 1000,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      };
    })
    .filter((c): c is YahooCandle => c !== null);
}
