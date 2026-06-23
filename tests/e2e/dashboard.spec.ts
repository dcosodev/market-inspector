import { expect, test, type Page, type Route } from "@playwright/test";

const initialState = {
  lastTickAt: "2026-06-23T10:00:00.000Z",
  anomalies: [],
  brief: null,
  tickCount: 1,
  lastError: null,
};

const completedState = {
  ...initialState,
  lastTickAt: "2026-06-23T10:01:00.000Z",
  tickCount: 2,
  anomalies: [
    {
      id: "btc-e2e",
      asset: { symbol: "BTC", name: "Bitcoin", type: "crypto" },
      value: 4.2,
      severity: "medium",
      summary: "Bitcoin moved 4.20% in 24h",
      priceUsd: 67020,
    },
  ],
  brief: {
    generatedAt: "2026-06-23T10:01:05.000Z",
    model: "gemini-3.5-flash",
    headline: "BITCOIN OUTPERFORMS A MODESTLY POSITIVE CRYPTO MARKET",
    body: "Bitcoin is up 4.20% at $67,020 while the wider market is up 1.10%. The move may require confirmation from volume and broader participation.",
    outlook:
      "Momentum could persist if market breadth improves, but reversal risk remains.",
    actions: [
      {
        symbol: "BTC",
        severity: "medium",
        action:
          "Monitor whether $67,000 remains supported and whether market breadth confirms the move.",
      },
    ],
    toolCalls: [],
  },
};

function mcpPayload(name: string, arguments_: Record<string, unknown>): unknown {
  if (name === "stocks.fetch_quote") {
    const symbol = String(arguments_.symbol);
    const base = {
      AAPL: 210,
      MSFT: 480,
      GOOGL: 180,
      META: 510,
      NVDA: 145,
      AMZN: 205,
    }[symbol] ?? 100;
    return {
      source: "yahoo",
      symbol,
      currentPrice: base,
      openPrice: base - 1,
      highPrice: base + 2,
      lowPrice: base - 3,
      previousClose: base - 0.5,
      change: 0.5,
      changePercent: 0.24,
    };
  }
  if (name === "crypto.fetch_global") {
    return {
      totalMarketCapUsd: 2_500_000_000_000,
      totalVolumeUsd: 95_000_000_000,
      marketCapChangePercentage24h: 1.1,
      activeCryptocurrencies: 14_000,
      markets: 900,
      marketCapPercentageBtc: 56,
      marketCapPercentageEth: 13,
      lastUpdated: 1_750_675_200,
    };
  }
  if (name === "crypto.fetch_top_movers") {
    return [
      {
        id: "bitcoin",
        symbol: "BTC",
        name: "Bitcoin",
        currentPrice: 67020,
        marketCap: 1_320_000_000_000,
        totalVolume: 32_000_000_000,
        priceChange24h: 2740,
        priceChangePercentage24h: 4.2,
        lastUpdated: "2026-06-23T10:00:00.000Z",
      },
      {
        id: "ethereum",
        symbol: "ETH",
        name: "Ethereum",
        currentPrice: 3590,
        marketCap: 430_000_000_000,
        totalVolume: 18_000_000_000,
        priceChange24h: 42,
        priceChangePercentage24h: 1.2,
        lastUpdated: "2026-06-23T10:00:00.000Z",
      },
    ];
  }
  if (name === "forex.fetch_rate") {
    return {
      base: "USD",
      date: "2026-06-22",
      rates: {
        EUR: 0.92,
        GBP: 0.79,
        JPY: 157.4,
        CHF: 0.82,
        CAD: 1.37,
        AUD: 1.52,
        CNY: 7.18,
      },
    };
  }
  return {};
}

async function mockApplicationApis(page: Page): Promise<void> {
  await page.route("**/api/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache" },
      body: `event: state\ndata: ${JSON.stringify(initialState)}\n\n`,
    });
  });

  await page.route("**/api/mcp", async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON() as {
      id: string;
      params: { name: string; arguments: Record<string, unknown> };
    };
    const payload = mcpPayload(body.params.name, body.params.arguments);
    const response = {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        content: [{ type: "text", text: JSON.stringify(payload) }],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify(response)}\n\n`,
    });
  });

  await page.route("**/api/anomalies", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        `data: ${JSON.stringify({ type: "step", msg: "Scanning market for anomalies…" })}\n\n` +
        `data: ${JSON.stringify({ type: "done", state: completedState })}\n\n`,
    });
  });
}

test("landing page and mocked market scan remain usable", async ({ page }) => {
  await mockApplicationApis(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Market Intelligence/i })
  ).toBeVisible();
  await page.getByRole("link", { name: /Open Market Dashboard/i }).first().click();

  await expect(
    page.getByRole("heading", { name: "Current Market Data" })
  ).toBeVisible();
  await expect(page.getByText("AAPL", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Top 10 Crypto by Market Cap")).toBeVisible();

  await page.getByRole("button", { name: "Run AI Scan" }).click();

  await expect(
    page.getByText("BITCOIN OUTPERFORMS A MODESTLY POSITIVE CRYPTO MARKET")
  ).toBeVisible();
  await expect(page.getByText("Monitoring Priorities")).toBeVisible();
  await expect(
    page.getByText(/not personalized financial advice/i)
  ).toBeVisible();
});
