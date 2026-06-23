/**
 * Forex MCP tools (Frankfurter-backed, no API key).
 *
 *   - forex.fetch_rate: current exchange rate for a base currency
 *   - forex.fetch_historical: historical rates over a date range
 *   - forex.fetch_currencies: list of supported currency codes
 */
import { z } from "zod";
import {
  fetchLatestRates,
  fetchHistoricalSeries,
  fetchCurrencies,
} from "@/lib/sources/frankfurter";

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

export const forexFetchRateTool = {
  name: "forex.fetch_rate",
  description:
    "Get the current exchange rate for a base currency against one or " +
    "more target currencies. Uses the European Central Bank reference " +
    "rates via Frankfurter. Base is a 3-letter ISO 4217 code (e.g. 'USD', " +
    "'EUR', 'GBP').",
  input: z.object({
    base: z.string().describe("Base currency code, e.g. 'USD', 'EUR'."),
    symbols: z
      .array(z.string())
      .optional()
      .describe(
        "Optional list of target currency codes (e.g. ['EUR','GBP','JPY']). " +
          "Omit for all supported currencies."
      ),
  }),
  handler: async (input: { base: string; symbols?: string[] }) => {
    try {
      const rate = await fetchLatestRates(input.base, input.symbols);
      return jsonResult(rate);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

export const forexFetchHistoricalTool = {
  name: "forex.fetch_historical",
  description:
    "Get historical exchange rates between a base currency and one or " +
    "more target currencies over a date range. Useful for plotting " +
    "FX trends. Dates are YYYY-MM-DD. The range is inclusive.",
  input: z.object({
    base: z.string().describe("Base currency code, e.g. 'USD'."),
    symbols: z
      .array(z.string())
      .min(1)
      .describe("Target currency codes, e.g. ['EUR','GBP']."),
    startDate: z
      .string()
      .describe("Start date in YYYY-MM-DD format, e.g. '2026-06-01'."),
    endDate: z
      .string()
      .optional()
      .describe(
        "End date in YYYY-MM-DD format. Defaults to today."
      ),
  }),
  handler: async (input: {
    base: string;
    symbols: string[];
    startDate: string;
    endDate?: string;
  }) => {
    try {
      const series = await fetchHistoricalSeries(
        input.base,
        input.symbols,
        input.startDate,
        input.endDate
      );
      return jsonResult(series);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

export const forexFetchCurrenciesTool = {
  name: "forex.fetch_currencies",
  description:
    "List all currencies supported by Frankfurter, with their codes " +
    "and human-readable names.",
  input: z.object({}),
  handler: async () => {
    try {
      const currencies = await fetchCurrencies();
      return jsonResult(currencies);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : String(e));
    }
  },
};

export const forexTools = [
  forexFetchRateTool,
  forexFetchHistoricalTool,
  forexFetchCurrenciesTool,
] as const;
