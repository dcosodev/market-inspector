# Market Inspector documentation

Market Inspector combines deterministic market monitoring with Gemini-assisted analysis. The application uses MCP as the shared contract between the dashboard, the generic chat endpoint, and the Brief Generator's optional function calls.

## Documentation map

| Document | Contents |
|---|---|
| [Project README](../README.md) | Product scope, setup, routes, and deployment |
| [Architecture](./architecture.md) | Components, data flows, fallbacks, state, and runtime behavior |
| [Code reference](./code-reference.md) | Current modules, tools, routes, components, and tests |
| [Product specification](../specs/market-inspector.md) | Scope, contracts, quota, safety, and reliability requirements |
| [Acceptance scenarios](../specs/acceptance.feature) | Executable-style behavior examples |
| [Design contract](../DESIGN.md) | Visual language, interaction patterns, accessibility, and agent workflow |
| [Gemini evaluation rubric](../evals/rubric.md) | Manually activated model-quality checks |
| [Code-review rubric](../evals/code-review-rubric.md) | Manual semantic review of agent-produced code changes |
| [Code-review calibration cases](../evals/code-review-cases.md) | Synthetic examples for severity and false-positive calibration |
| [Agent engineering protocol](../.agents/AGENTS.md) | Deterministic implementation and completion gates |
| [Code-check skill](../.agents/skills/code-check/SKILL.md) | Portable senior-engineer review workflow |

## MCP tool catalog

| Tool | Purpose |
|---|---|
| `system.ping` | Verify MCP connectivity and report configured integrations without external requests. |
| `crypto.fetch_price` | Current USD price and 24-hour metrics for a supported cryptocurrency. |
| `crypto.fetch_top_movers` | Top cryptocurrencies by market capitalization and daily change. |
| `crypto.fetch_historical` | Historical USD price points for a cryptocurrency. |
| `crypto.fetch_global` | Global cryptocurrency capitalization, volume, and dominance. |
| `stocks.fetch_quote` | Current equity quote with a three-provider fallback. |
| `stocks.search_symbol` | Search Finnhub for equity symbols. |
| `stocks.fetch_candles` | Daily equity OHLCV candles with provider fallback. |
| `forex.fetch_rate` | Latest available ECB-backed reference rates. |
| `forex.fetch_historical` | Foreign-exchange reference-rate time series. |
| `forex.fetch_currencies` | Currencies supported by Frankfurter. |

The Brief Generator exposes eight selected tools to Gemini: four cryptocurrency tools, two equity tools, and two foreign-exchange tools.

## Runtime summary

- The Anomaly Detector runs without Gemini and currently covers cryptocurrency assets.
- Manual scans use Gemini only when a medium-or-higher anomaly is present.
- Dashboard state is delivered through Server-Sent Events.
- Source adapters apply local rate limits and provider-specific fallback behavior.
- The four-scan demonstration quota is stored in the browser and mirrored by a four-scan in-memory server limit to conserve a worst-case twenty-call Gemini allowance.
- Structured JSON logs capture scan, provider, tool, model-round, duration, and error events without storing prompts or secrets.
- Provider, user, and tool text is treated as untrusted model context.
