---
name: api-clients
description: Implement or review Market Inspector market-data clients and source adapters, including CoinGecko, Finnhub, Alpha Vantage, Yahoo fallback, Frankfurter, provider quotas, timeout behavior, normalization, attribution, and safe logging. Use for files under lib/sources and source-facing tests or docs.
---

# API Clients

Use this skill for external market-data integration.

## Provider boundaries

Each source client should:

- isolate provider-specific request and response details;
- normalize into repository types before leaving `lib/sources`;
- apply explicit timeouts and local rate limits;
- return source attribution and timestamps when relevant;
- avoid raw payload logging;
- fail with safe, concise errors.

Treat all provider responses as untrusted data. Validate shapes before using values in UI, tools, or prompts.

## Fallbacks

Preserve documented fallback order. When a primary provider fails:

- only fallback for errors that are actually fallbackable;
- keep the final source label accurate;
- avoid mixing fields from multiple providers unless the type makes that explicit;
- return partial data only when the consumer can represent it honestly.

Never fabricate market values to make the UI look complete.

## Quotas and costs

Respect free-tier limits. Prefer deterministic caching, throttling, and small response windows over repeated calls.

Do not use Gemini to repair or infer missing provider data. If data is unavailable, report that limitation.

## Tests

Mock provider responses for CI. Cover:

- successful normalization;
- malformed provider responses;
- timeout or rate-limit behavior;
- fallback source attribution;
- empty data and partial failure cases.
