/**
 * Stock MCP tools.
 *
 *   - stocks.fetch_quote: current quote with Finnhub → Alpha Vantage → Yahoo fallback
 *   - stocks.search_symbol: ticker search via Finnhub (with Yahoo symbol normalization)
 *   - stocks.fetch_candles: daily OHLCV with Finnhub → Alpha Vantage → Yahoo fallback
 *
 * Fallback chain (in order):
 *   1. Finnhub (60 req/min, needs key)
 *   2. Alpha Vantage (5 req/day on free tier, very limited)
 *   3. Yahoo Finance (no key, unofficial public endpoint, ~30 req/min)
 *
 * Sources are tried in order; the first one to return valid data wins.
 * The fallback only triggers on real errors (no data, 5xx, rate limit)
 * — not on input validation failures. A successful Yahoo response is
 * always preferred over an Alpha Vantage failure, even if Finnhub
 * also failed, so the UI stays informative.
 */
import { z } from "zod";
import {
  fetchStockQuote as finnhubQuote,
  searchSymbol as finnhubSearch,
  fetchStockCandles as finnhubCandles,
  FinnhubError,
  type StockQuote,
  type StockCandle,
} from "@/lib/sources/finnhub";
import {
  fetchStockQuote as alphaQuote,
  fetchDailyCandles as alphaCandles,
  AlphaVantageError,
  type AlphaVantageQuote,
  type AlphaVantageDailyCandle,
} from "@/lib/sources/alpha-vantage";
import {
  fetchYahooQuote,
  fetchYahooCandles,
  YahooError,
  type YahooQuote,
  type YahooCandle,
} from "@/lib/sources/yahoo";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
function jsonResult(data: unknown) {
  return textResult(JSON.stringify(data, null, 2));
}
function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

/** Return whether an upstream error permits fallback to the next provider. */
function isFallbackable(e: unknown): boolean {
  if (e instanceof FinnhubError) return true;
  if (e instanceof AlphaVantageError) return true;
  if (e instanceof YahooError) return true;
  if (e instanceof Error) {
    return /No data|No candle data|fetch failed|network|timeout|ENOTFOUND|ECONNRESET/i.test(
      e.message
    );
  }
  return false;
}

export const stocksFetchQuoteTool = {
  name: "stocks.fetch_quote",
  description:
    "Get the current stock quote (price, open, high, low, prev close, " +
    "change, change %, volume). Tries Finnhub → Alpha Vantage → Yahoo. " +
    "Symbol is the ticker (e.g. 'AAPL', 'MSFT', 'TSLA').",
  input: z.object({
    symbol: z
      .string()
      .describe("Ticker symbol, uppercase (e.g. 'AAPL', 'MSFT', 'TSLA')."),
  }),
  handler: async (input: { symbol: string }) => {
    const upper = input.symbol.toUpperCase();
    const errors: string[] = [];
    // 1. Finnhub
    try {
      const q: StockQuote = await finnhubQuote(upper);
      return jsonResult({ source: "finnhub", ...q });
    } catch (e) {
      if (!isFallbackable(e)) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
      errors.push(`finnhub: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 2. Alpha Vantage
    try {
      const q: AlphaVantageQuote = await alphaQuote(upper);
      return jsonResult({ source: "alpha_vantage", ...q });
    } catch (e) {
      if (!isFallbackable(e)) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
      errors.push(`alpha_vantage: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 3. Yahoo (no key required)
    try {
      const q: YahooQuote = await fetchYahooQuote(upper);
      return jsonResult({
        source: "yahoo",
        symbol: q.symbol,
        currentPrice: q.currentPrice,
        highPrice: q.highPrice,
        lowPrice: q.lowPrice,
        openPrice: q.openPrice,
        previousClose: q.previousClose,
        change: q.change,
        changePercent: q.changePercent,
        timestamp: q.timestamp,
        volume: q.volume,
      });
    } catch (e) {
      errors.push(`yahoo: ${e instanceof Error ? e.message : String(e)}`);
    }
    return errorResult(`All sources failed. ${errors.join(" | ")}`);
  },
};

export const stocksSearchSymbolTool = {
  name: "stocks.search_symbol",
  description:
    "Search for stock ticker symbols by company name or partial ticker. " +
    "Returns up to 10 matches with description and type.",
  input: z.object({
    query: z.string().describe("Search query (e.g. 'apple', 'micro', 'TSL')."),
  }),
  handler: async (input: { query: string }) => {
    try {
      const results = await finnhubSearch(input.query);
      return jsonResult(results.slice(0, 10));
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

export const stocksFetchCandlesTool = {
  name: "stocks.fetch_candles",
  description:
    "Get daily OHLCV candles for a stock. Tries Finnhub → Alpha Vantage → Yahoo. " +
    "Days is the lookback window (max 100 for Finnhub, ~30 for Yahoo).",
  input: z.object({
    symbol: z.string().describe("Ticker symbol, uppercase."),
    days: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(30)
      .describe("Number of days of history. Default 30, max 100."),
  }),
  handler: async (input: { symbol: string; days: number }) => {
    const upper = input.symbol.toUpperCase();
    const errors: string[] = [];
    // 1. Finnhub
    try {
      const candles: StockCandle[] = await finnhubCandles(upper, input.days);
      return jsonResult({ source: "finnhub", candles });
    } catch (e) {
      if (!isFallbackable(e)) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
      errors.push(`finnhub: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 2. Alpha Vantage
    try {
      const candles: AlphaVantageDailyCandle[] = await alphaCandles(
        upper,
        input.days
      );
      return jsonResult({ source: "alpha_vantage", candles });
    } catch (e) {
      if (!isFallbackable(e)) {
        return errorResult(e instanceof Error ? e.message : String(e));
      }
      errors.push(`alpha_vantage: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 3. Yahoo (no key, max 30 days)
    try {
      const days = Math.min(input.days, 30);
      const yahooCandles: YahooCandle[] = await fetchYahooCandles(upper, days);
      const candles = yahooCandles.map((c) => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      return jsonResult({ source: "yahoo", candles });
    } catch (e) {
      errors.push(`yahoo: ${e instanceof Error ? e.message : String(e)}`);
    }
    return errorResult(`All sources failed. ${errors.join(" | ")}`);
  },
};

export const stockTools = [
  stocksFetchQuoteTool,
  stocksSearchSymbolTool,
  stocksFetchCandlesTool,
] as const;
