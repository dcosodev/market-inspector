/** Dashboard-friendly response types used by client components. */

export interface CoinPriceRow {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  totalVolume: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  lastUpdated: string;
}

export interface CoinCandle {
  timestamp: number;
  price: number;
}

export interface StockQuoteRow {
  source: "finnhub" | "alpha_vantage" | "yahoo";
  symbol: string;
  currentPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  timestamp?: number;
  volume?: number;
}

export interface ExchangeRateRow {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface GlobalMarketRow {
  totalMarketCapUsd: number;
  totalVolumeUsd: number;
  marketCapChangePercentage24h: number;
  activeCryptocurrencies: number;
  /** Absent when served by a fallback provider that does not report it. */
  markets?: number;
  marketCapPercentageBtc: number;
  marketCapPercentageEth: number;
  lastUpdated: number;
}

export interface DashboardAnomaly {
  id: string;
  asset: { symbol: string; name: string; type: "crypto" };
  value: number;
  severity: string;
  summary: string;
  priceUsd: number;
}

export interface DashboardBrief {
  model?: string;
  headline: string;
  body: string;
  outlook?: string;
  /** Neutral monitoring priorities; API name retained for compatibility. */
  actions: Array<{ symbol: string; severity: string; action: string }>;
  generatedAt: string;
  /** MCP tools Gemini chose to call during analysis (e.g. "crypto.fetch_historical(btc, 7)") */
  toolCalls?: string[];
}

export interface DashboardOrchestratorState {
  lastTickAt: string;
  anomalies: DashboardAnomaly[];
  brief: DashboardBrief | null;
  tickCount: number;
  lastError: string | null;
}
