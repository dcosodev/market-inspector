/**
 * Crypto MCP tools. Wrap CoinGecko client functions with Zod-validated
 * inputs and MCP-formatted outputs.
 *
 * Each tool returns either:
 *   - { content: [{ type: "text", text: <JSON string> }] } on success
 *   - { content: [{ type: "text", text: "Error: ..." }], isError: true } on failure
 *
 * Errors are returned as tool results (not thrown) so Gemini can read
 * them and either retry or report gracefully.
 */
import { z } from "zod";
import {
  coingeckoId,
  fetchCoinPrice,
  fetchTopMovers,
  fetchHistorical,
  fetchGlobal,
  supportedCryptoSymbols,
} from "@/lib/sources/coingecko";
import { fetchBinanceTicker, binancePair } from "@/lib/sources/binance";
import { fetchCoinCapTopMovers, fetchCoinCapGlobal } from "@/lib/sources/coincap";

function isRateLimit(e: unknown): boolean {
  return (
    e instanceof Error &&
    (e.message.includes("429") ||
      e.message.includes("Too Many Requests") ||
      e.message.includes("rate") ||
      e.message.includes("circuit open"))
  );
}

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

/** crypto.fetch_price — current price of a single coin. CoinGecko → Binance fallback. */
export const cryptoFetchPriceTool = {
  name: "crypto.fetch_price",
  description:
    "Get the current USD price and 24h stats for a cryptocurrency. " +
    "Symbol is the ticker (e.g. 'btc', 'eth', 'sol'). " +
    "Returns price, market cap, volume, 24h high/low, 24h change.",
  input: z.object({
    symbol: z
      .string()
      .describe("Ticker symbol, lowercase (e.g. 'btc', 'eth', 'sol')."),
  }),
  handler: async (input: { symbol: string }) => {
    const id = coingeckoId(input.symbol);
    if (!id) {
      return errorResult(
        `Unknown symbol "${input.symbol}". Supported: ${supportedCryptoSymbols().join(", ")}.`
      );
    }
    // 1. CoinGecko (primary — has market cap + full stats)
    try {
      const price = await fetchCoinPrice(id);
      return jsonResult(price);
    } catch (cgErr) {
      const cgMsg = cgErr instanceof Error ? cgErr.message : String(cgErr);
      // Only fall back on rate-limit errors, not on bad symbol
      if (!cgMsg.includes("429") && !cgMsg.includes("Too Many Requests") && !cgMsg.includes("rate")) {
        return errorResult(cgMsg);
      }
      // 2. Binance (fallback — no key, 1200 req/min)
      if (!binancePair(input.symbol)) {
        return errorResult(`CoinGecko rate limited and no Binance pair for "${input.symbol}": ${cgMsg}`);
      }
      try {
        const ticker = await fetchBinanceTicker(input.symbol);
        return jsonResult({ ...ticker, source: "binance" });
      } catch (bErr) {
        return errorResult(
          `All sources failed. coingecko: ${cgMsg} | binance: ${bErr instanceof Error ? bErr.message : String(bErr)}`
        );
      }
    }
  },
};

/** crypto.fetch_top_movers — top N coins by market cap. CoinGecko → CoinPaprika fallback. */
export const cryptoFetchTopMoversTool = {
  name: "crypto.fetch_top_movers",
  description:
    "Get the top N cryptocurrencies by market cap, including 24h price change. " +
    "Useful for detecting broad market moves and finding outliers.",
  input: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(20)
      .describe("Number of coins to return. Default 20, max 100."),
  }),
  handler: async (input: { limit: number }) => {
    // 1. CoinGecko (primary)
    try {
      const rows = await fetchTopMovers(input.limit);
      return jsonResult(rows);
    } catch (e) {
      if (!isRateLimit(e)) return errorResult(e instanceof Error ? e.message : String(e));
    }
    // 2. CoinCap (fallback)
    try {
      const rows = await fetchCoinCapTopMovers(input.limit);
      return jsonResult(rows);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

/** crypto.fetch_historical — historical prices over a window. */
export const cryptoFetchHistoricalTool = {
  name: "crypto.fetch_historical",
  description:
    "Get historical USD price points for a cryptocurrency. " +
    "Days can be 1, 7, 14, 30, 90, 180, or 365. " +
    "Returns an array of { timestamp, price } points.",
  input: z.object({
    symbol: z.string().describe("Ticker symbol, lowercase."),
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .default(7)
      .describe("Number of days of history. Default 7."),
  }),
  handler: async (input: { symbol: string; days: number }) => {
    try {
      const id = coingeckoId(input.symbol);
      if (!id) {
        return errorResult(`Unknown symbol "${input.symbol}".`);
      }
      const candles = await fetchHistorical(id, input.days);
      return jsonResult(candles);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

/** crypto.fetch_global — global crypto market summary. CoinGecko → CoinPaprika fallback. */
export const cryptoFetchGlobalTool = {
  name: "crypto.fetch_global",
  description:
    "Get a snapshot of the global cryptocurrency market: " +
    "total market cap, 24h volume, market cap change %, " +
    "BTC and ETH dominance, number of active coins and exchanges.",
  input: z.object({}),
  handler: async () => {
    // 1. CoinGecko (primary)
    try {
      const global = await fetchGlobal();
      return jsonResult(global);
    } catch (e) {
      if (!isRateLimit(e)) return errorResult(e instanceof Error ? e.message : String(e));
    }
    // 2. CoinCap (fallback — approximated from top 100 assets)
    try {
      const global = await fetchCoinCapGlobal();
      return jsonResult(global);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

/** All crypto tools, in a stable order. */
export const cryptoTools = [
  cryptoFetchPriceTool,
  cryptoFetchTopMoversTool,
  cryptoFetchHistoricalTool,
  cryptoFetchGlobalTool,
] as const;
