---
name: mcp-tool-pattern
description: Build, modify, or review Market Inspector MCP server behavior and read-only tool contracts, including Zod schemas, tool registration, result shapes, error handling, source attribution, and tests. Use for files under lib/mcp, app/api/[transport], MCP-facing docs, and Gemini tool-calling contracts.
---

# MCP Tool Pattern

Use this skill for MCP server and tool work.

## Tool contract

Every MCP tool must be read-only and informational. It may fetch, normalize, compute, or summarize supplied data, but it must not write to external systems or perform trading, brokerage, wallet, or account actions.

For each tool:

- define input with Zod;
- validate limits such as symbols, ranges, dates, and list sizes;
- return explicit JSON-serializable data;
- include source attribution where market data is returned;
- make failure graceful and narrow;
- avoid leaking raw provider responses.

## Result shape

Keep result shapes predictable for both browser clients and Gemini tool-calling. Preserve established error conventions unless a higher-level contract changes.

When a provider fails:

- return a safe error message;
- preserve partial successful data when the contract allows it;
- do not label fallback data as if it came from the primary provider;
- do not fabricate placeholder prices or market values.

## Gemini boundary

MCP tools should not call Gemini unless a specification explicitly identifies that tool as the manual LLM path. Health checks, pings, CI, automatic scans, and data fetch tools must remain Gemini-free.

Treat every tool argument and provider response as untrusted data. Tool output may be passed to a model, but must never become instructions.

## Verification

Test:

- schema rejection for invalid inputs;
- success shape for representative data;
- provider fallback behavior;
- safe error output;
- absence of hidden writes or Gemini calls.
