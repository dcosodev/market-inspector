---
name: code-conventions
description: Apply Market Inspector coding standards for TypeScript, Next.js App Router, repository structure, tests, logging, errors, documentation, and maintainability. Use when writing or refactoring application code, API routes, shared types, utilities, tests, configuration, or comments.
---

# Code Conventions

Use this skill to keep implementation work consistent and reviewable.

## TypeScript and structure

- Preserve strict typing. Prefer concrete types, schema-derived types, or `unknown` over `any`.
- Keep server-only credentials and provider clients out of Client Components.
- Validate external input at route, tool, and provider boundaries.
- Reuse shared types and constants instead of duplicating contracts.
- Keep modules focused: source clients fetch data, MCP tools expose read-only operations, agents coordinate behavior, UI renders state.
- Keep comments current and useful. Remove stale phase notes, private conversational comments, and “to myself” language.

## Next.js

Before changing framework behavior, read the relevant installed guide under `node_modules/next/dist/docs/`.

For routes:

- return explicit serializable responses;
- set cache behavior intentionally;
- keep health checks and pings cheap;
- never expose environment values, API keys, provider payloads, prompts, or authorization headers.

## Observability

Use `lib/observability/logger.ts` for structured logs. Log operation names, source names, durations, and safe error summaries.

Never log:

- prompts or model outputs in full;
- raw provider payloads;
- API keys, tokens, cookies, or authorization headers;
- user text as trusted instructions.

## Tests

Prefer deterministic tests that mock providers and Gemini. Do not add live market-provider calls or live Gemini calls to CI.

When behavior changes, update the smallest relevant test first or in the same change. Keep acceptance language aligned with the implemented behavior.

## Documentation

Update specs, design docs, README files, and code reference material when their contracts changed. Do not leave old feature names, removed portfolio language, or outdated model names in docs or UI copy.
