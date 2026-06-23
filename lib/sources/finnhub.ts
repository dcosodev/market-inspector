/**
 * Finnhub.io API client (primary source for stock data).
 *
 * Free tier: 60 requests per minute, enforced by a local limiter.
 * Base URL: https://finnhub.io/api/v1
 */
import { ofetch } from "ofetch";
import { RateLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

/** 60 req/min = 1 req/sec. Capacity 60 so a burst of 60 is OK. */
const finnhubLimiter = new RateLimiter(60, 60 / 60);

export class FinnhubError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "FinnhubError";
  }
}

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new FinnhubError("FINNHUB_API_KEY is not configured");
  return key;
}

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

/** Fetch the current quote for a US stock symbol (e.g. AAPL, MSFT, TSLA). */
export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  await finnhubLimiter.acquire();
  const key = apiKey();
  const upper = symbol.toUpperCase();
  const data = await ofetch<Record<string, unknown>>(
    `${FINNHUB_BASE}/quote`,
    {
      query: { symbol: upper, token: key },
      timeout: MARKET_REQUEST_TIMEOUT_MS,
      // Finnhub returns 200 with { c: 0 } for unknown symbols — treat
      // it as a 404 by inspecting the body.
      onResponseError({ response }) {
        throw new FinnhubError(
          `Finnhub ${response.status}: ${response._data ?? "unknown"}`,
          response.status
        );
      },
    }
  );
  const current = Number(data.c);
  if (!current) {
    throw new FinnhubError(`No data for symbol "${upper}"`);
  }
  return {
    symbol: upper,
    currentPrice: current,
    highPrice: Number(data.h),
    lowPrice: Number(data.l),
    openPrice: Number(data.o),
    previousClose: Number(data.pc),
    change: Number(data.d),
    changePercent: Number(data.dp),
    timestamp: Number(data.t) * 1000, // Finnhub returns seconds
  };
}

export interface SymbolSearchResult {
  symbol: string;
  description: string;
  type: string;
  displaySymbol: string;
}

/** Search for ticker symbols by company name or partial ticker. */
export async function searchSymbol(query: string): Promise<SymbolSearchResult[]> {
  await finnhubLimiter.acquire();
  const key = apiKey();
  const data = await ofetch<{ result: Array<Record<string, unknown>> }>(
    `${FINNHUB_BASE}/search`,
    {
      query: { q: query, token: key },
      timeout: MARKET_REQUEST_TIMEOUT_MS,
      onResponseError({ response }) {
        throw new FinnhubError(
          `Finnhub ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`,
          response.status
        );
      },
    }
  );
  return (data.result ?? []).map((row) => ({
    symbol: String(row.symbol),
    description: String(row.description),
    type: String(row.type),
    displaySymbol: String(row.displaySymbol ?? row.symbol),
  }));
}

export interface StockCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fetch daily candles. `days` controls the lookback window. */
export async function fetchStockCandles(
  symbol: string,
  days: number
): Promise<StockCandle[]> {
  await finnhubLimiter.acquire();
  const key = apiKey();
  const upper = symbol.toUpperCase();
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;
  const data = await ofetch<{
    s: string;
    t?: number[];
    o?: number[];
    h?: number[];
    l?: number[];
    c?: number[];
    v?: number[];
  }>(`${FINNHUB_BASE}/stock/candle`, {
    query: {
      symbol: upper,
      resolution: "D",
      from,
      to,
      token: key,
    },
    timeout: MARKET_REQUEST_TIMEOUT_MS,
    onResponseError({ response }) {
      throw new FinnhubError(
        `Finnhub ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`,
        response.status
      );
    },
  });
  if (data.s !== "ok" || !data.t) {
    throw new FinnhubError(`No candle data for "${upper}" (status: ${data.s})`);
  }
  return data.t.map((ts, i) => ({
    timestamp: ts * 1000,
    open: Number(data.o![i]),
    high: Number(data.h![i]),
    low: Number(data.l![i]),
    close: Number(data.c![i]),
    volume: Number(data.v![i]),
  }));
}
