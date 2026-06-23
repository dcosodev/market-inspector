---
name: market-inspector-context
description: Establish Market Inspector project context for Kaggle planning, architecture, scope decisions, documentation, submission narrative, repository structure, and product-boundary alignment. Use when starting work, reviewing whether the project matches the Kaggle capstone, updating README/docs/specs, or deciding whether a feature belongs in the demo.
---

# Market Inspector Context

Use this skill to keep work aligned with the capstone story and project scope.

## Core project frame

Treat Market Inspector as a read-only market-monitoring agent demo for Kaggle. The product monitors crypto, stocks, and forex, detects notable market movement, and presents neutral informational analysis through a dashboard.

Emphasize:

- multi-asset monitoring;
- read-only MCP tools;
- deterministic anomaly detection before Gemini;
- sparse, deliberate Gemini usage;
- localStorage as a demo quota and preference mechanism;
- professional documentation suitable for evaluators.

Do not describe the product as a trading app, brokerage app, portfolio manager, wallet, or personalized financial advisor.

## Source-of-truth order

Read the relevant files before changing narrative or scope:

1. `specs/market-inspector.md`
2. `specs/acceptance.feature`
3. `DESIGN.md`
4. `README.md`
5. `docs/README.md`
6. `docs/architecture.md`

If the code, README, and spec disagree, update the stale artifact instead of preserving drift.

## Kaggle alignment

Frame decisions around:

- meaningful use of agents;
- explicit MCP tool use;
- safe handling of API keys and external data;
- clear architecture and implementation documentation;
- deployability without requiring paid infrastructure;
- transparent limitations of demo controls and free API tiers.

Prefer simple, credible claims over inflated language. Say what the system does today and identify future work separately.

## Scope discipline

Reject or defer changes that would add:

- orders, trades, brokerage actions, wallets, or holdings management;
- database persistence;
- personalized financial advice;
- hidden background Gemini calls;
- claims that localStorage protects server-side quota.

When a feature is useful but out of scope, document it as future work rather than implementing it.
