import { z } from "zod";

export const systemPingTool = {
  name: "system.ping",
  description:
    "Verify MCP registration and transport connectivity without calling external services. Returns service metadata, configured credentials, public data sources, and the current timestamp.",
  input: z.object({}),
  handler: async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            status: "ok",
            service: "market-inspector",
            version: "0.1.0",
            configured: {
              gemini: Boolean(process.env.GEMINI_API_KEY),
              finnhub: Boolean(process.env.FINNHUB_API_KEY),
              alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
            },
            publicSources: [
              "coingecko",
              "coinpaprika",
              "binance",
              "yahoo",
              "frankfurter",
            ],
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
      },
    ],
  }),
};
