/**
 * CoinPaprika public API — no key required, very reliable.
 *
 * Rate limit: ~30 req/min free. Used as a fallback when CoinGecko is rate-limited.
 * Base URL: https://api.coinpaprika.com/v1
 */
import { ofetch } from "ofetch";
import { RateLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const COINPAPRIKA_BASE = "https://api.coinpaprika.com/v1";
const coincapLimiter = new RateLimiter(15, 15 / 60);

interface CoinPaprikaGlobal {
  market_cap_usd: number;
  volume_24h_usd: number;
  bitcoin_dominance_percentage: number;
  cryptocurrencies_number: number;
  market_cap_change_24h: number;
}

interface CoinPaprikaTicker {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_24h: number;
    };
  };
}

export interface CoinCapMarketRow {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  totalVolume: number;
}

export interface CoinCapGlobal {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24h: number;
  activeCryptocurrencies: number;
  /**
   * Exchange-market count. CoinPaprika's /global endpoint does not expose
   * this, so it is omitted in the fallback rather than fabricated. The
   * dashboard renders "—" when it is absent.
   */
  markets?: number;
  marketCapPercentageBtc: number;
  marketCapPercentageEth: number;
  lastUpdated: number;
}

/** Fetch top N coins by market cap from CoinPaprika. */
export async function fetchCoinCapTopMovers(limit = 10): Promise<CoinCapMarketRow[]> {
  await coincapLimiter.acquire();
  const data = await ofetch<CoinPaprikaTicker[]>(
    `${COINPAPRIKA_BASE}/tickers`,
    { query: { limit }, timeout: MARKET_REQUEST_TIMEOUT_MS }
  );
  return data.slice(0, limit).map((t) => ({
    id: t.id,
    symbol: t.symbol.toUpperCase(),
    name: t.name,
    currentPrice: t.quotes.USD.price,
    priceChangePercentage24h: t.quotes.USD.percent_change_24h,
    marketCap: t.quotes.USD.market_cap,
    totalVolume: t.quotes.USD.volume_24h,
  }));
}

/** Fetch global crypto market stats from CoinPaprika. */
export async function fetchCoinCapGlobal(): Promise<CoinCapGlobal> {
  await coincapLimiter.acquire();
  const [g, tickers] = await Promise.all([
    ofetch<CoinPaprikaGlobal>(`${COINPAPRIKA_BASE}/global`, {
      timeout: MARKET_REQUEST_TIMEOUT_MS,
    }),
    ofetch<CoinPaprikaTicker[]>(`${COINPAPRIKA_BASE}/tickers`, {
      query: { limit: 5 },
      timeout: MARKET_REQUEST_TIMEOUT_MS,
    }),
  ]);
  const eth = tickers.find((t) => t.symbol === "ETH");
  const ethDom = eth && g.market_cap_usd > 0
    ? (eth.quotes.USD.market_cap / g.market_cap_usd) * 100
    : 0;
  return {
    totalMarketCapUsd: g.market_cap_usd,
    totalVolumeUsd: g.volume_24h_usd,
    marketCapChangePercentage24h: g.market_cap_change_24h,
    activeCryptocurrencies: g.cryptocurrencies_number,
    marketCapPercentageBtc: g.bitcoin_dominance_percentage,
    marketCapPercentageEth: ethDom,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
}
