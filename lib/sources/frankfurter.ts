/**
 * Frankfurter API client (forex, no API key required).
 *
 * Free public API from the European Central Bank. Endpoints:
 *   - /latest?from=USD&to=EUR   → current exchange rate
 *   - /<date>?from=USD&to=EUR   → historical rate at that date
 *   - /<from>..<to>?from=USD&to=EUR → time series
 *   - /currencies              → list of supported currencies
 *
 * No key is required. Requests are locally limited to one per second.
 * Base URL: https://api.frankfurter.app
 */
import { ofetch } from "ofetch";
import { RateLimiter } from "@/lib/utils/rate-limit";
import { MARKET_REQUEST_TIMEOUT_MS } from "@/lib/sources/config";

const FRANKFURTER_BASE = "https://api.frankfurter.app";

/** Frankfurter does not publish a rate limit; requests are capped at 1/sec. */
const frankfurterLimiter = new RateLimiter(1, 1);

export class FrankfurterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrankfurterError";
  }
}

export interface ExchangeRate {
  base: string;
  date: string;
  rates: Record<string, number>;
}

/** Fetch latest exchange rates for a base currency. */
export async function fetchLatestRates(
  base: string,
  symbols?: string[]
): Promise<ExchangeRate> {
  await frankfurterLimiter.acquire();
  const data = await ofetch<{ base: string; date: string; rates: Record<string, number> }>(
    `${FRANKFURTER_BASE}/latest`,
    {
      query: {
        from: base.toUpperCase(),
        ...(symbols && symbols.length > 0 ? { to: symbols.join(",") } : {}),
      },
      timeout: MARKET_REQUEST_TIMEOUT_MS,
      onResponseError({ response }) {
        throw new FrankfurterError(
          `Frankfurter ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`
        );
      },
    }
  );
  return {
    base: data.base,
    date: data.date,
    rates: data.rates,
  };
}

export interface HistoricalRate {
  date: string;
  rates: Record<string, number>;
}

/** Fetch historical time series. */
export async function fetchHistoricalSeries(
  base: string,
  symbols: string[],
  startDate: string, // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD, defaults to today
): Promise<HistoricalRate[]> {
  await frankfurterLimiter.acquire();
  const end = endDate ?? new Date().toISOString().slice(0, 10);
  const data = await ofetch<{
    base: string;
    start_date: string;
    end_date: string;
    rates: Record<string, Record<string, number>>;
  }>(`${FRANKFURTER_BASE}/${startDate}..${end}`, {
    query: {
      from: base.toUpperCase(),
      to: symbols.join(","),
    },
    timeout: MARKET_REQUEST_TIMEOUT_MS,
    onResponseError({ response }) {
      throw new FrankfurterError(
        `Frankfurter ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`
      );
    },
  });
  return Object.entries(data.rates).map(([date, rates]) => ({
    date,
    rates,
  }));
}

export interface Currency {
  code: string;
  name: string;
}

/** List all supported currencies. */
export async function fetchCurrencies(): Promise<Currency[]> {
  await frankfurterLimiter.acquire();
  const data = await ofetch<Record<string, string>>(
    `${FRANKFURTER_BASE}/currencies`,
    {
      timeout: MARKET_REQUEST_TIMEOUT_MS,
      onResponseError({ response }) {
        throw new FrankfurterError(
          `Frankfurter ${response.status}: ${JSON.stringify(response._data ?? "unknown")}`
        );
      },
    }
  );
  return Object.entries(data).map(([code, name]) => ({ code, name }));
}
