# Synthetic code-review calibration cases

These fixtures calibrate `.agents/skills/code-check/SKILL.md`. They are intentionally fabricated examples, not defects found in Market Inspector and not stored judge results.

Use them when changing the review skill or rubric. A useful reviewer should identify the expected minimum finding without inventing unrelated problems.

## CR-01: Model call in health check

Synthetic change:

```diff
 export async function GET() {
+  const brief = await generateBrief([]);
   return Response.json({ status: "ok" });
 }
```

Expected minimum finding:

- `P1`: violates the zero-cost health contract and can consume Gemini quota through deployment probes.

Relevant criterion: Gemini, MCP, and cost safety.

## CR-02: Secret included in structured logs

Synthetic change:

```diff
-logger.info("provider.request.failed", { provider, message });
+logger.info("provider.request.failed", {
+  provider,
+  apiKey: process.env.FINNHUB_API_KEY,
+  message,
+});
```

Expected minimum finding:

- `P0`: exposes a provider credential in logs.

Relevant criterion: Security and privacy.

## CR-03: Writable MCP tool

Synthetic change:

```diff
+server.tool("portfolio_place_order", schema, async ({ symbol, quantity }) => {
+  return broker.placeOrder({ symbol, quantity });
+});
```

Expected minimum findings:

- `P0`: introduces an unrestricted external financial action.
- Violates the read-only tool and no-trading product boundaries.

Relevant criteria: Security and privacy; Gemini, MCP, and cost safety; specification alignment.

## CR-04: Unsupported market fact

Synthetic change:

```diff
 return {
   totalMarketCapUsd: payload.market_cap_usd,
+  activeMarkets: 500,
 };
```

Expected minimum finding:

- `P1`: fabricates a market value that can be presented as provider-backed data.

Relevant criteria: Correctness and edge cases; specification alignment.

## CR-05: Behavior changed without contract coverage

Synthetic change:

```diff
-const anomalyThreshold = 2;
+const anomalyThreshold = 5;
```

Assume no test, acceptance scenario, or specification changed.

Expected minimum finding:

- `P2`, raised to `P1` if the new threshold makes a required acceptance path unreachable: product behavior changed without aligned contracts or regression protection.

Relevant criteria: Specification alignment; tests and regression protection.

## CR-06: Clean refactor

Synthetic change:

```diff
-const symbols = ["AAPL", "MSFT", "NVDA", "GOOGL"];
+const symbols = DEFAULT_EQUITY_SYMBOLS;
```

Assume `DEFAULT_EQUITY_SYMBOLS` contains the same immutable values, existing tests pass, and no behavior or public contract changes.

Expected result:

- No finding.
- The reviewer may mention verification limits but must not invent a defect.

Relevant criterion: False-positive discipline.
