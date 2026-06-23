# Market Inspector

Market Inspector is a multi-asset market intelligence workflow built with Next.js 16, the Model Context Protocol (MCP), and Gemini 3.5 Flash. It monitors cryptocurrency movements, combines them with current equity data and ECB foreign-exchange reference rates, and produces structured market briefs.

The project was created for the Google × Kaggle AI Agents Intensive capstone, in the **Agents for Business** track.

## System overview

Market Inspector exposes 11 MCP tools:

- 4 cryptocurrency tools
- 3 equity tools
- 3 foreign-exchange tools
- 1 zero-cost system status tool

Three coordinated roles divide the workflow:

| Role | Responsibility |
|---|---|
| Anomaly Detector | Scans the top cryptocurrency assets and classifies significant 24-hour movements. |
| Orchestrator | Serializes scans, stores the latest in-memory state, and publishes updates through Server-Sent Events. |
| Brief Generator | Provides Gemini with a seven-result market snapshot and eight optional MCP tools for additional context. |

Market-data fallbacks:

- Crypto price: CoinGecko → Binance when CoinGecko is rate-limited.
- Crypto global data and top movers: CoinGecko → CoinPaprika.
- Equity quotes and candles: Finnhub → Alpha Vantage → Yahoo Finance.
- Foreign exchange: Frankfurter using ECB reference rates.

## Asset coverage

| Asset class | Dashboard | Automatic anomaly detection | Gemini snapshot |
|---|---|---|---|
| Cryptocurrency | Global metrics, top movers, ticker | Yes, every 60 seconds | Global market and top 10 assets |
| Equities | Six large-cap technology quotes and ticker | No | AAPL, MSFT, NVDA, GOOGL |
| Foreign exchange | Seven USD reference rates | No | USD against EUR, GBP, JPY, CHF |

## Quick start

Requirements:

- Node.js 22.x
- pnpm 10.34.4

```bash
git clone https://github.com/dcosodev/market-inspector.git
cd market-inspector
corepack enable
pnpm install --frozen-lockfile
cp .env.local.example .env.local
pnpm dev
```

The application is available at `http://localhost:3000`.

### Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `GEMINI_API_KEY` | Manual AI briefs and the chat endpoint | For Gemini features |
| `FINNHUB_API_KEY` | Primary equity source | Recommended |
| `ALPHA_VANTAGE_API_KEY` | Secondary equity fallback | Optional |
| `LOG_LEVEL` | Structured JSON logging threshold | Optional (`info`) |
| `ENABLE_PUBLIC_CHAT` | Enables `/api/chat` in production when set to `true` | Optional (`false`) |

Yahoo Finance provides the final no-key equity fallback. CoinGecko, CoinPaprika, Binance, and Frankfurter also require no key.

## Main routes

| Route | Purpose |
|---|---|
| `/` | Project overview |
| `/dashboard` | Market dashboard and architecture view |
| `/api/mcp` | MCP Streamable HTTP endpoint |
| `/api/anomalies` | Current state and manual AI scan stream |
| `/api/stream` | Continuous anomaly-state SSE stream |
| `/api/chat` | Optional Gemini chat backed by the MCP tool catalog; disabled in production unless `ENABLE_PUBLIC_CHAT=true` |
| `/api/health` | Zero-cost service health response; no external API calls |

## Agent workflow

1. The deterministic detector scans cryptocurrency movements without calling Gemini.
2. A manual AI scan refreshes anomalies and preloads seven market-data results.
3. Gemini receives the snapshot and can request one or more of eight selected MCP tools when additional context is needed.
4. Execution progress, requested tools, and the final informational brief are streamed to the dashboard.
5. Source-level rate limits, caching, circuit breaking, and fallbacks reduce the effect of upstream failures.

The dashboard stores a four-scan daily demonstration quota in `localStorage`. The server applies a matching four-scan in-memory per-client limit over a 24-hour window. Each notable-anomaly scan uses one to five Gemini requests, so the visible worst-case budget is twenty calls. This deliberately lightweight control conserves the demo allowance; it is a demo mitigation, not authentication, billing enforcement, or a hard global limit.

Generated briefs are informational only and are not personalized financial advice. Provider data, tool output, and user text are delimited as untrusted model context.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Gemini evaluation is manual and never runs in CI:

```bash
RUN_GEMINI_EVALS=1 EVAL_CASE=broad-crypto-selloff pnpm eval:gemini
```

## Documentation

- [Documentation overview](./docs/README.md)
- [Architecture](./docs/architecture.md)
- [Code reference](./docs/code-reference.md)
- [Product specification](./specs/market-inspector.md)
- [BDD acceptance scenarios](./specs/acceptance.feature)
- [Design contract](./DESIGN.md)
- [Repository agent rules](./AGENTS.md)
- [Deterministic engineering protocol](./.agents/AGENTS.md)
- [Project context skill](./.agents/skills/market-inspector-context/SKILL.md)
- [Code conventions skill](./.agents/skills/code-conventions/SKILL.md)
- [MCP tool pattern skill](./.agents/skills/mcp-tool-pattern/SKILL.md)
- [Market data API clients skill](./.agents/skills/api-clients/SKILL.md)
- [Gemini integration skill](./.agents/skills/gemini-integration/SKILL.md)
- [Multi-agent pattern skill](./.agents/skills/multi-agent-pattern/SKILL.md)
- [React/Next dashboard design skill](./.agents/skills/shadcn-usage/SKILL.md)
- [Code review and evaluation skill](./.agents/skills/code-check/SKILL.md)
- [Manual Gemini evaluation rubric](./evals/rubric.md)
- [Code-review evaluation rubric](./evals/code-review-rubric.md)
- [Synthetic code-review calibration cases](./evals/code-review-cases.md)

## Deployment

The repository includes a Vercel configuration for the Frankfurt region. Configure the required environment variables in the deployment platform; API keys must not be committed to the repository.

## License

MIT
