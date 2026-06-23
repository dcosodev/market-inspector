/**
 * Alpha Vantage API client (fallback for stock data when Finnhub fails).
 *
 * Free tier: 25 req/day. Use sparingly — only when Finnhub returns
 * an error or is rate-limited.
 * Base URL: https://www.alphavantage.co/query
 */
import { ofetch } from "ofetch";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const ALPHA_BASE = "https://www.alphavantage.co/query";

let callsToday = 0;
let lastResetDay = "";

export class AlphaVantageError extends Error {
  constructor(message: string, readonly isRateLimit = false) {
    super(message);
    this.name = "AlphaVantageError";
  }
}

function acquireAlphaVantageToken(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    callsToday = 0;
    lastResetDay = today;
  }
  if (callsToday >= 5) {
    throw new AlphaVantageError(
      "Alpha Vantage daily limit (5/day) reached",
      true
    );
  }
  callsToday += 1;
}

/** Reset the module-level fallback quota between tests. */
export function _resetAlphaVantageCounter(): void {
  callsToday = 0;
  lastResetDay = "";
}

function apiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new AlphaVantageError("ALPHA_VANTAGE_API_KEY is not configured");
  return key;
}

export interface AlphaVantageQuote {
  symbol: string;
  currentPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  latestTradingDay: string;
}

/** Fetch the current quote through Alpha Vantage GLOBAL_QUOTE. */
export async function fetchStockQuote(symbol: string): Promise<AlphaVantageQuote> {
  acquireAlphaVantageToken();
  const key = apiKey();
  const upper = symbol.toUpperCase();
  const data = await ofetch<{
    "Global Quote"?: Record<string, string>;
    Note?: string;
    Information?: string;
  }>(ALPHA_BASE, {
    query: {
      function: "GLOBAL_QUOTE",
      symbol: upper,
      apikey: key,
    },
    timeout: MARKET_REQUEST_TIMEOUT_MS,
  });
  if (data.Note || data.Information) {
    // Alpha Vantage signals rate limit / premium requirement with a Note
    throw new AlphaVantageError(
      data.Note ?? data.Information ?? "Rate limited",
      true
    );
  }
  const gq = data["Global Quote"];
  if (!gq || !gq["05. price"]) {
    throw new AlphaVantageError(`No quote data for "${upper}"`);
  }
  return {
    symbol: gq["01. symbol"] ?? upper,
    currentPrice: Number(gq["05. price"]),
    openPrice: Number(gq["02. open"]),
    highPrice: Number(gq["03. high"]),
    lowPrice: Number(gq["04. low"]),
    previousClose: Number(gq["08. previous close"]),
    change: Number(gq["09. change"]),
    changePercent: Number.parseFloat(
      String(gq["10. change percent"] ?? "0").replace("%", "")
    ),
    volume: Number(gq["06. volume"]),
    latestTradingDay: gq["07. latest trading day"] ?? "",
  };
}

export interface AlphaVantageDailyCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Fetch daily candles (full history, then trimmed to `days`). */
export async function fetchDailyCandles(
  symbol: string,
  days: number
): Promise<AlphaVantageDailyCandle[]> {
  acquireAlphaVantageToken();
  const key = apiKey();
  const upper = symbol.toUpperCase();
  const data = await ofetch<{
    "Time Series (Daily)"?: Record<string, Record<string, string>>;
    Note?: string;
    Information?: string;
  }>(ALPHA_BASE, {
    query: {
      function: "TIME_SERIES_DAILY",
      symbol: upper,
      apikey: key,
      outputsize: "compact",
    },
    timeout: MARKET_REQUEST_TIMEOUT_MS,
  });
  if (data.Note || data.Information) {
    throw new AlphaVantageError(
      data.Note ?? data.Information ?? "Rate limited",
      true
    );
  }
  const series = data["Time Series (Daily)"];
  if (!series) {
    throw new AlphaVantageError(`No daily data for "${upper}"`);
  }
  const entries = Object.entries(series)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, days);
  return entries.map(([date, vals]) => ({
    timestamp: new Date(date).getTime(),
    open: Number(vals["1. open"]),
    high: Number(vals["2. high"]),
    low: Number(vals["3. low"]),
    close: Number(vals["4. close"]),
    volume: Number(vals["5. volume"]),
  }));
}
