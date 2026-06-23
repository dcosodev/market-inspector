/**
 * CoinGecko free public API client.
 *
 * No API key required. Rate limit: ~10-30 req/min on the free tier.
 * The coingeckoLimiter in lib/utils/rate-limit.ts enforces a conservative
 * 5 req/min on top.
 *
 * Base URL: https://api.coingecko.com/api/v3
 */
import { ofetch } from "ofetch";
import { coingeckoLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

const COINGECKO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

/** Simple in-process TTL cache — avoids hammering CoinGecko with duplicate requests. */
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}

function setCached(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Circuit breaker: after a 429, skip CoinGecko for 90s and let callers
 * fall through to the fallback (CoinCap / Binance) immediately.
 */
let circuitOpenUntil = 0;

export function isCoinGeckoCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function tripCircuit(): void {
  circuitOpenUntil = Date.now() + 90_000;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 1, delayMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (
      retries > 0 &&
      e instanceof Error &&
      (e.message.includes("429") || e.message.includes("Too Many Requests"))
    ) {
      tripCircuit();
      await new Promise((r) => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    if (e instanceof Error && (e.message.includes("429") || e.message.includes("Too Many Requests"))) {
      tripCircuit();
    }
    throw e;
  }
}

/** Symbol-to-CoinGecko-id map. Extend as needed. */
const SYMBOL_TO_ID: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  usdc: "usd-coin",
  usdt: "tether",
  bnb: "binancecoin",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  dot: "polkadot",
  matic: "matic-network",
  link: "chainlink",
  avax: "avalanche-2",
  trx: "tron",
  uni: "uniswap",
};

export function coingeckoId(symbol: string): string | null {
  return SYMBOL_TO_ID[symbol.toLowerCase()] ?? null;
}

export function supportedCryptoSymbols(): string[] {
  return Object.keys(SYMBOL_TO_ID);
}

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  lastUpdated: string;
}

/** Fetch current price for one coin by its CoinGecko id. */
export async function fetchCoinPrice(id: string): Promise<CoinPrice> {
  const cacheKey = `coin:${id}`;
  const cached = getCached<CoinPrice>(cacheKey);
  if (cached) return cached;
  if (isCoinGeckoCircuitOpen()) throw new Error("CoinGecko circuit open (rate limited)");
  await coingeckoLimiter.acquire();
  const data = await withRetry(() =>
    ofetch<Array<Record<string, unknown>>>(
      `${COINGECKO_BASE}/coins/markets`,
      {
        headers: COINGECKO_HEADERS,
        timeout: MARKET_REQUEST_TIMEOUT_MS,
        query: {
          vs_currency: "usd",
          ids: id,
          order: "market_cap_desc",
          per_page: 1,
          page: 1,
          sparkline: false,
          price_change_percentage: "24h",
        },
      }
    )
  );
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`CoinGecko: no data for id "${id}"`);
  }
  const row = data[0];
  if (!row) {
    throw new Error(`CoinGecko: no data for id "${id}"`);
  }
  const result: CoinPrice = {
    id: String(row.id),
    symbol: String(row.symbol).toUpperCase(),
    name: String(row.name),
    currentPrice: Number(row.current_price),
    marketCap: Number(row.market_cap),
    marketCapRank: Number(row.market_cap_rank),
    totalVolume: Number(row.total_volume),
    high24h: Number(row.high_24h),
    low24h: Number(row.low_24h),
    priceChange24h: Number(row.price_change_24h),
    priceChangePercentage24h: Number(row.price_change_percentage_24h),
    lastUpdated: String(row.last_updated),
  };
  setCached(cacheKey, result);
  return result;
}

export interface CoinMarketRow {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  totalVolume: number;
}

/** Fetch the top N coins by market cap. */
export async function fetchTopMovers(limit = 20): Promise<CoinMarketRow[]> {
  const cacheKey = `top:${limit}`;
  const cached = getCached<CoinMarketRow[]>(cacheKey);
  if (cached) return cached;
  if (isCoinGeckoCircuitOpen()) throw new Error("CoinGecko circuit open (rate limited)");
  await coingeckoLimiter.acquire();
  const data = await withRetry(() =>
    ofetch<Array<Record<string, unknown>>>(
      `${COINGECKO_BASE}/coins/markets`,
      {
        headers: COINGECKO_HEADERS,
        timeout: MARKET_REQUEST_TIMEOUT_MS,
        query: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: limit,
          page: 1,
          sparkline: false,
          price_change_percentage: "24h",
        },
      }
    )
  );
  const result = data.map((row) => ({
    id: String(row.id),
    symbol: String(row.symbol).toUpperCase(),
    name: String(row.name),
    currentPrice: Number(row.current_price),
    priceChangePercentage24h: Number(row.price_change_percentage_24h),
    marketCap: Number(row.market_cap),
    totalVolume: Number(row.total_volume),
  }));
  setCached(cacheKey, result);
  return result;
}

export interface CoinCandle {
  timestamp: number;
  price: number;
}

/** Fetch historical daily prices for a coin. */
export async function fetchHistorical(
  id: string,
  days: number
): Promise<CoinCandle[]> {
  const cacheKey = `hist:${id}:${days}`;
  const cached = getCached<CoinCandle[]>(cacheKey);
  if (cached) return cached;
  if (isCoinGeckoCircuitOpen()) throw new Error("CoinGecko circuit open (rate limited)");
  await coingeckoLimiter.acquire();
  const data = await withRetry(() =>
    ofetch<{ prices: Array<[number, number]> }>(
      `${COINGECKO_BASE}/coins/${id}/market_chart`,
      {
        headers: COINGECKO_HEADERS,
        timeout: MARKET_REQUEST_TIMEOUT_MS,
        query: {
          vs_currency: "usd",
          days,
          interval: days <= 1 ? "hourly" : "daily",
        },
      }
    )
  );
  const result = data.prices.map(([ts, price]) => ({ timestamp: ts, price }));
  setCached(cacheKey, result);
  return result;
}

export interface GlobalMarket {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24h: number;
  activeCryptocurrencies: number;
  markets: number;
  marketCapPercentageBtc: number;
  marketCapPercentageEth: number;
  lastUpdated: number;
}

/** Fetch the global crypto market summary. */
export async function fetchGlobal(): Promise<GlobalMarket> {
  const cacheKey = "global";
  const cached = getCached<GlobalMarket>(cacheKey);
  if (cached) return cached;
  if (isCoinGeckoCircuitOpen()) throw new Error("CoinGecko circuit open (rate limited)");
  await coingeckoLimiter.acquire();
  const data = await withRetry(() =>
    ofetch<{ data: Record<string, unknown> }>(
      `${COINGECKO_BASE}/global`,
      {
        headers: COINGECKO_HEADERS,
        timeout: MARKET_REQUEST_TIMEOUT_MS,
      }
    )
  );
  const d = data.data ?? data as Record<string, unknown>; // handle both {data:{}} and flat responses
  const totalMarketCap = (d.total_market_cap ?? {}) as Record<string, number>;
  const totalVolume    = (d.total_volume    ?? {}) as Record<string, number>;
  const marketCapPct   = (d.market_cap_percentage ?? {}) as Record<string, number>;
  const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? 0 : x; };
  const result: GlobalMarket = {
    totalMarketCapUsd: n(totalMarketCap.usd),
    totalVolumeUsd: n(totalVolume.usd),
    marketCapChangePercentage24h: n(d.market_cap_change_percentage_24h_usd),
    activeCryptocurrencies: n(d.active_cryptocurrencies),
    markets: n(d.markets),
    marketCapPercentageBtc: n(marketCapPct.btc),
    marketCapPercentageEth: n(marketCapPct.eth),
    lastUpdated: n(d.updated_at),
  };
  setCached(cacheKey, result);
  return result;
}
