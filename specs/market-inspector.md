# Market Inspector product specification

Version: 1.0  
Status: source of truth for the Kaggle demonstration

## Objective

Market Inspector demonstrates an agentic, multi-asset market-monitoring workflow while minimizing paid model usage. Deterministic code collects and normalizes market data, detects cryptocurrency anomalies, coordinates concurrent scans, and streams state. Gemini is reserved for manual, grounded summaries when a notable anomaly exists.

## Users and roles

- Evaluator: explores the public dashboard and triggers a limited manual AI scan.
- Developer: maintains providers, MCP contracts, deterministic logic, prompts, tests, and documentation.
- Market Inspector agent: reads market data and produces informational analysis. It never trades, changes external state, or provides personalized financial advice.

## In scope

- Cryptocurrency anomaly detection over top market-cap assets.
- Current equity quotes and daily candles with provider fallbacks.
- ECB-backed foreign-exchange reference rates.
- Eleven read-only MCP tools, including a zero-cost `system.ping`.
- Continuous state updates through Server-Sent Events.
- Manual Gemini briefs grounded in a preloaded snapshot and optional MCP calls.
- Browser-local demonstration quota, in-memory server state, structured logs, deterministic tests, and manually activated model evaluations.

## Out of scope

- Portfolio tracking, positions, orders, execution, wallets, authentication, or brokerage integration.
- Personalized investment recommendations or guaranteed forecasts.
- Database persistence, multi-user quota enforcement, or historical audit storage.
- Automatic Gemini calls from background scans, health checks, CI, or deployment probes.
- Claims that public market endpoints are official trading feeds.

## Runtime workflow

1. The dashboard opens the state SSE stream.
2. The deterministic detector scans cryptocurrency movers every 60 seconds.
3. Concurrent equivalent scans are coalesced by the orchestrator.
4. Automatic scans never call Gemini.
5. A manual scan refreshes anomalies.
6. No anomaly results in no Gemini call.
7. Low-severity-only anomalies produce a deterministic local summary.
8. A medium-or-higher anomaly preloads seven market results in parallel.
9. Gemini receives delimited, untrusted market data and eight optional read-only tools.
10. Gemini may use up to four tool-call rounds and returns an informational brief.
11. The dashboard presents analysis, monitoring priorities, uncertainty, and a financial-information disclaimer.

## Data and tool contracts

- MCP tool inputs are validated with Zod before their handlers run.
- Tool failures are returned as readable error results so the model can degrade gracefully.
- Provider data and user text are untrusted context, never instructions.
- Tool outputs must not expose API keys, authorization headers, or environment values.
- The current tool catalog is documented in `docs/README.md` and `docs/code-reference.md`.

## Provider policy

- Crypto price: CoinGecko, then Binance on rate limits.
- Crypto movers and global metrics: CoinGecko, then CoinPaprika.
- Equities: Finnhub, then Alpha Vantage, then Yahoo Finance.
- Foreign exchange: Frankfurter using ECB reference rates.
- Partial snapshot failure is acceptable; successful sections continue to Gemini and limitations should be visible in the analysis.

## Gemini budget

- Model: `gemini-3.5-flash`.
- Automatic detector: zero Gemini calls.
- Manual notable-anomaly scan: one initial request plus at most four tool-call rounds.
- Browser demo budget: four scans per local day, representing a worst-case ceiling of twenty calls.
- The server applies a matching four-scan in-memory per-client limit over a 24-hour window. It is a demo mitigation, not a hard global billing control.
- The generic `/api/chat` route is disabled in production unless `ENABLE_PUBLIC_CHAT=true` is set.
- `localStorage` is a demonstration aid, not a security or billing control.
- CI and health checks must remain Gemini-free.
- Model evaluation requires explicit `RUN_GEMINI_EVALS=1`.

## Safety and quality requirements

- No buy, sell, hold, entry, exit, target, take-profit, or guaranteed-return instructions.
- No unsupported facts, fabricated numbers, or hidden assumptions.
- Observations and interpretations must be distinguishable.
- Uncertainty, stale data, failed sources, and partial context should be stated when material.
- The user-facing brief must be labeled informational and not personalized financial advice.

## Reliability requirements

- Health and `system.ping` checks do not contact external providers.
- Upstream calls use timeouts, local rate limits, and documented fallbacks.
- Logs are structured JSON and redact sensitive keys.
- Concurrent scans do not duplicate equivalent Gemini work.
- The project must pass lint, type checking, unit/integration tests, mocked E2E, and production build on Node.js 22.

## Documentation ownership

When behavior changes, update this specification, `specs/acceptance.feature`, `DESIGN.md` when relevant, the README, and the appropriate document under `docs/` in the same change.
