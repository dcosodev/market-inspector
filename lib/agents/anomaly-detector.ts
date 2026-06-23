/**
 * Anomaly Detector agent.
 *
 * Polls data sources on a schedule, compares against thresholds, and
 * emits anomaly events. The agent is stateless across runs: each
 * tick re-reads the world and emits events for what it sees.
 *
 * The current detector covers crypto markets; the orchestrator streams
 * each pass to the dashboard over Server-Sent Events.
 */
import { fetchTopMovers, isCoinGeckoCircuitOpen } from "@/lib/sources/coingecko";
import { fetchCoinCapTopMovers } from "@/lib/sources/coincap";
import { logEvent } from "@/lib/observability/logger";

export type AnomalySeverity = "low" | "medium" | "high" | "extreme";

export interface Anomaly {
  id: string;
  detectedAt: string;
  asset: {
    symbol: string;
    name: string;
    type: "crypto";
  };
  metric: "priceChange24h";
  value: number;
  threshold: number;
  severity: AnomalySeverity;
  summary: string;
  priceUsd: number;
  marketCap?: number;
  totalVolume?: number;
}

export interface AnomalyDetectorConfig {
  /** |24h change| >= this percent is considered. Default 2.0 */
  thresholdPercent: number;
  /** How many top coins to scan. Default 30 */
  limit: number;
  /** Top N to actually emit (after sort). Default 5 */
  topN: number;
  /**
   * Map |change| to severity. Default: 3=medium, 10=high, 20+=extreme.
   * The band between the detection threshold (2%) and the medium floor (3%)
   * classifies as low, so a scan can legitimately surface only low-severity
   * movement — matching the "only low-severity" acceptance scenario and
   * keeping Gemini reserved for genuinely notable (medium+) anomalies.
   */
  severityBuckets: Array<{ min: number; severity: AnomalySeverity }>;
}

const DEFAULT_CONFIG: AnomalyDetectorConfig = {
  thresholdPercent: 2.0,
  limit: 30,
  topN: 5,
  severityBuckets: [
    { min: 20, severity: "extreme" },
    { min: 10, severity: "high" },
    { min: 3, severity: "medium" },
    { min: 0, severity: "low" },
  ],
};

function classifySeverity(
  absoluteChange: number,
  buckets: AnomalyDetectorConfig["severityBuckets"]
): AnomalySeverity {
  for (const bucket of buckets) {
    if (absoluteChange >= bucket.min) return bucket.severity;
  }
  return "low";
}

/** Single detection pass. Returns up to topN anomalies, sorted by |change| desc. */
export async function detectAnomalies(
  config: Partial<AnomalyDetectorConfig> = {}
): Promise<Anomaly[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const circuitOpen = isCoinGeckoCircuitOpen();
  let provider = "coingecko";
  let fallback = false;
  let movers: Awaited<ReturnType<typeof fetchTopMovers>>;
  if (circuitOpen) {
    provider = "coinpaprika";
    fallback = true;
    movers = await fetchCoinCapTopMovers(cfg.limit);
  } else {
    try {
      movers = await fetchTopMovers(cfg.limit);
    } catch {
      provider = "coinpaprika";
      fallback = true;
      movers = await fetchCoinCapTopMovers(cfg.limit);
    }
  }
  logEvent(fallback ? "warn" : "info", "detector.source.selected", {
    provider,
    fallback,
    circuitOpen,
    requestedAssets: cfg.limit,
  });
  const candidates = movers
    .map((m) => {
      const change = m.priceChangePercentage24h;
      const abs = Math.abs(change);
      return {
        symbol: m.symbol,
        name: m.name,
        type: "crypto" as const,
        price: m.currentPrice,
        change,
        abs,
        marketCap: m.marketCap,
        totalVolume: m.totalVolume,
      };
    })
    .filter((c) => c.abs >= cfg.thresholdPercent)
    .sort((a, b) => b.abs - a.abs)
    .slice(0, cfg.topN);

  const detectedAt = new Date().toISOString();
  return candidates.map((c) => {
    const severity = classifySeverity(c.abs, cfg.severityBuckets);
    const direction = c.change >= 0 ? "up" : "down";
    return {
      id: `${c.symbol.toLowerCase()}-${detectedAt}`,
      detectedAt,
      asset: { symbol: c.symbol, name: c.name, type: c.type },
      metric: "priceChange24h" as const,
      value: c.change,
      threshold: cfg.thresholdPercent,
      severity,
      summary: `${c.name} (${c.symbol}) ${direction} ${c.change.toFixed(2)}% in 24h (threshold ${cfg.thresholdPercent}%)`,
      priceUsd: c.price,
      marketCap: c.marketCap,
      totalVolume: c.totalVolume,
    };
  });
}
