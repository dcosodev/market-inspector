# Code reference

This document describes the current implementation.

## MCP tools

### System status

- `system.ping()` — verifies MCP connectivity and reports service metadata,
  configured credentials, and public sources without external API requests.

### Cryptocurrency

- `crypto.fetch_price(symbol)` — current USD price and 24-hour metrics. CoinGecko with Binance fallback on rate limits.
- `crypto.fetch_top_movers(limit?)` — top assets by market capitalization and daily change. CoinGecko with CoinPaprika fallback.
- `crypto.fetch_historical(symbol, days?)` — historical USD prices from CoinGecko.
- `crypto.fetch_global()` — global capitalization, volume, and dominance. CoinGecko with CoinPaprika fallback.

### Equities

- `stocks.fetch_quote(symbol)` — current quote through Finnhub, Alpha Vantage, then Yahoo Finance.
- `stocks.search_symbol(query)` — Finnhub symbol search.
- `stocks.fetch_candles(symbol, days?)` — daily OHLCV through the equity fallback chain.

### Foreign exchange

- `forex.fetch_rate(base, symbols?)` — latest available ECB-backed reference rates.
- `forex.fetch_historical(base, symbols, startDate, endDate?)` — reference-rate time series.
- `forex.fetch_currencies()` — supported Frankfurter currencies.

## Agent modules

### `lib/agents/anomaly-detector.ts`

Exports `detectAnomalies(config)`. The detector:

- scans up to 30 cryptocurrency assets
- filters absolute 24-hour changes against a threshold
- sorts candidates by absolute movement
- classifies severity as low, medium, high, or extreme
- returns up to five anomalies by default

### `lib/agents/orchestrator.ts`

Exports `Orchestrator` and `getOrchestrator()`.

- serializes concurrent ticks
- reuses an active scan when an equivalent request arrives
- waits for a detector-only scan before starting a requested AI brief
- stores the latest anomalies, brief, error, timestamp, and tick count
- notifies in-process subscribers

### `lib/agents/brief-generator.ts`

Exports `generateBrief(request, model?, onProgress?)`.

- preloads seven market-data results
- excludes failed tool results from the snapshot
- includes optional additional context
- provides Gemini with eight selected function declarations
- validates tool arguments through their Zod schemas before calling handlers
- supports up to four function-calling rounds
- parses the final response into headline, analysis, neutral monitoring priorities, and outlook

### `lib/agents/brief-prompt.ts`

Owns the shared system instruction, eight Gemini function declarations, untrusted-context prompt builder, and response parser. The manual evaluation runner imports this contract so production and evaluation cannot silently drift.

### `lib/observability/logger.ts`

Emits level-filtered structured JSON, generates operation identifiers, truncates large fields, and redacts secret-like keys.

### `lib/security/untrusted-context.ts`

Delimits and truncates external text before it enters Gemini context. Nested delimiter tags are neutralized.

## MCP infrastructure

- `lib/mcp/server.ts` — registers the 11 MCP tools with the Vercel adapter.
- `lib/mcp/client.ts` — minimal Streamable HTTP client for initialize, tools/list, and tools/call.
- `lib/mcp/execute-tool.ts` — validates in-process tool calls and normalizes successful and failed text results.
- `lib/mcp/tools/system.ts` — zero-cost system status descriptor.
- `lib/mcp/tools/crypto.ts` — cryptocurrency descriptors.
- `lib/mcp/tools/stocks.ts` — equity descriptors and fallback behavior.
- `lib/mcp/tools/forex.ts` — foreign-exchange descriptors.

## Gemini integrations

- `lib/agents/brief-generator.ts` — specialized market-brief workflow with eight selected tools.
- `lib/gemini/client.ts` — generic adapter used by `/api/chat`, with MCP schema conversion and a four-turn tool loop.

## API routes

| Route | Methods | Purpose |
|---|---|---|
| `app/api/[transport]/route.ts` | GET, POST | MCP adapter transport |
| `app/api/anomalies/route.ts` | GET, POST | Current state and streamed manual scan |
| `app/api/stream/route.ts` | GET | Continuous orchestrator-state SSE stream |
| `app/api/chat/route.ts` | POST | Optional Gemini chat backed by all MCP tools; disabled in production unless enabled |
| `app/api/health/route.ts` | GET | Service health response |

## Active dashboard components

- `components/dashboard/dashboard-client.tsx` — dashboard shell, shared SSE connection, connection state, and view switching.
- `components/dashboard/market-ticker.tsx` — animated equity and cryptocurrency ticker.
- `components/dashboard/tabs/overview-tab.tsx` — equity cards, global cryptocurrency metrics, charts, movers, and AI analysis slot.
- `components/dashboard/tabs/brief-tab.tsx` — manual scan control, browser quota, progress log, anomaly list, and brief.
- `components/dashboard/tabs/forex-tab.tsx` — USD foreign-exchange reference-rate cards.
- `components/dashboard/tabs/agents-tab.tsx` — architecture, role, tool, and provider overview.

## Source adapters

- `coingecko.ts`
- `coincap.ts` — CoinPaprika adapter; filename retained for compatibility.
- `binance.ts`
- `finnhub.ts`
- `alpha-vantage.ts`
- `yahoo.ts`
- `frankfurter.ts`

## Tests

- `tests/integration/mcp/system-ping.test.ts` — application status descriptor through the in-memory MCP transport.
- `tests/integration/mcp/execute-tool.test.ts` — schema defaults, validation failures, and tool-level errors.
- `tests/integration/sources/yahoo.test.ts` — deterministic quote, candle, and unknown-symbol normalization.
- `tests/integration/sources/alpha-vantage.test.ts` — local daily fallback cap.
- `tests/integration/agents/anomaly-detector.test.ts` — filtering, severity, and ordering.
- `tests/integration/agents/orchestrator.test.ts` — state updates, emissions, concurrent scan coalescing, and Gemini failures.
- `tests/integration/agents/brief-prompt.test.ts` — untrusted-data delimiters and neutral priority parsing.
- `tests/integration/observability/logger.test.ts` — structured output, redaction, and operation identifiers.
- `tests/e2e/dashboard.spec.ts` — landing page, mocked market data, manual scan streaming, brief, and disclaimer.

## Specifications and evaluation

- `specs/market-inspector.md` — versioned product and engineering contract.
- `specs/acceptance.feature` — BDD scenarios for quota, fallbacks, concurrency, safety, and CI.
- `DESIGN.md` — UI and interaction contract for people and agents.
- `evals/run-evaluation.ts` — explicitly gated Gemini evaluation with frozen market fixtures and no live provider requests.
