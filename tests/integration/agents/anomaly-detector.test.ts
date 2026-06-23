import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTopMovers } from "@/lib/sources/coingecko";
import { detectAnomalies } from "@/lib/agents/anomaly-detector";

vi.mock("@/lib/sources/coingecko", () => ({
  fetchTopMovers: vi.fn(),
  isCoinGeckoCircuitOpen: vi.fn(() => false),
}));

const mockedFetchTopMovers = vi.mocked(fetchTopMovers);

describe("AnomalyDetector", () => {
  beforeEach(() => {
    mockedFetchTopMovers.mockResolvedValue([
      {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        currentPrice: 60_000,
        priceChangePercentage24h: 5,
        marketCap: 1_200_000_000_000,
        totalVolume: 30_000_000_000,
      },
      {
        id: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        currentPrice: 3_000,
        priceChangePercentage24h: -3,
        marketCap: 360_000_000_000,
        totalVolume: 15_000_000_000,
      },
      {
        id: "solana",
        symbol: "SOL",
        name: "Solana",
        currentPrice: 140,
        priceChangePercentage24h: 1,
        marketCap: 65_000_000_000,
        totalVolume: 3_000_000_000,
      },
    ]);
  });

  it("filters, classifies, and sorts movers by absolute change", async () => {
    const anomalies = await detectAnomalies({ thresholdPercent: 2 });

    expect(anomalies).toHaveLength(2);
    expect(anomalies.map((item) => item.asset.symbol)).toEqual(["BTC", "ETH"]);
    expect(anomalies[0]?.severity).toBe("medium");
    expect(anomalies[1]?.severity).toBe("medium");
  });
});
