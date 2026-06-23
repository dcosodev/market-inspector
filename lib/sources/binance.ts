/**
 * Binance public REST API — no key required.
 *
 * Rate limit: 1200 req/min on the /api/v3 endpoints.
 * Used as a fallback when CoinGecko is rate-limited.
 *
 * Symbol mapping: CoinGecko symbol → Binance trading pair (USDT).
 */
import { ofetch } from "ofetch";
import { RateLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const BINANCE_BASE = "https://api.binance.com/api/v3";

const binanceLimiter = new RateLimiter(20, 20 / 60);

const HEADERS = {
  Accept: "application/json",
};

const SYMBOL_TO_PAIR: Record<string, string> = {
  btc: "BTCUSDT",
  eth: "ETHUSDT",
  sol: "SOLUSDT",
  usdc: "USDCUSDT",
  bnb: "BNBUSDT",
  xrp: "XRPUSDT",
  ada: "ADAUSDT",
  doge: "DOGEUSDT",
  dot: "DOTUSDT",
  matic: "MATICUSDT",
  link: "LINKUSDT",
  avax: "AVAXUSDT",
  trx: "TRXUSDT",
  uni: "UNIUSDT",
};

export function binancePair(symbol: string): string | null {
  return SYMBOL_TO_PAIR[symbol.toLowerCase()] ?? null;
}

export interface BinanceTicker {
  symbol: string;
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  name: string;
  lastUpdated: string;
  marketCap: number;
  totalVolume: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  id: string;
}

interface Binance24hrResponse {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChange: string;
  priceChangePercent: string;
  quoteVolume: string;
  volume: string;
}

export async function fetchBinanceTicker(symbol: string): Promise<BinanceTicker> {
  const pair = binancePair(symbol);
  if (!pair) throw new Error(`No Binance pair for symbol "${symbol}"`);
  await binanceLimiter.acquire();
  const data = await ofetch<Binance24hrResponse>(`${BINANCE_BASE}/ticker/24hr`, {
    query: { symbol: pair },
    headers: HEADERS,
    timeout: MARKET_REQUEST_TIMEOUT_MS,
  });
  const price = Number(data.lastPrice);
  const changePercent = Number(data.priceChangePercent);
  const volumeUsd = Number(data.quoteVolume);

  return {
    id: symbol.toLowerCase(),
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    currentPrice: price,
    highPrice: Number(data.highPrice),
    lowPrice: Number(data.lowPrice),
    priceChange: Number(data.priceChange),
    priceChangePercent: changePercent,
    volume: Number(data.volume),
    marketCap: 0,
    totalVolume: volumeUsd,
    priceChange24h: Number(data.priceChange),
    priceChangePercentage24h: changePercent,
    lastUpdated: new Date().toISOString(),
  };
}
