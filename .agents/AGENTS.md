# Market Inspector agent workflow

Use this file as the deterministic operating protocol for the project. The skills in `.agents/skills/` describe the working modes that would be used across the project lifecycle: planning, scaffolding, MCP tools, provider clients, Gemini, multi-agent behavior, UI design, and review.

## Authority order

When requirements conflict, apply this order:

1. The explicit user request.
2. `specs/market-inspector.md`, the product source of truth.
3. `specs/acceptance.feature`, the observable acceptance contract.
4. `DESIGN.md`, for interface behavior and visual language.
5. `AGENTS.md`, repository-wide product and safety boundaries.
6. Existing tests and documentation.
7. Existing implementation.

If requested behavior changes a higher-level contract, update that contract in the same change.

## Skill routing

Use only the relevant skills for the task:

- `market-inspector-context`: project scope, Kaggle alignment, architecture, documentation, and submission narrative.
- `code-conventions`: TypeScript, Next.js, repository structure, tests, logging, and general implementation standards.
- `api-clients`: market-data source clients, fallback chains, quotas, timeouts, and source attribution.
- `mcp-tool-pattern`: MCP server routes, read-only tool contracts, Zod schemas, and tool result shapes.
- `gemini-integration`: Gemini client code, prompts, tool-calling, manual evaluations, and quota protection.
- `multi-agent-pattern`: detector, brief generator, orchestrator, stream updates, and agent responsibilities.
- `shadcn-usage`: React/Next dashboard UI, shadcn components, Tailwind styling, responsive states, and copy.
- `code-check`: audit, review, security, reliability, tests, documentation, and LLM-as-judge style evaluation.

Do not treat the presence of a skill as proof that a specific tool was used externally. Skills are reusable project operating instructions.

## Before editing

1. Read `AGENTS.md`, this file, and the relevant skill or skills.
2. Read the affected specification, acceptance, and design sections.
3. For Next.js behavior, read the relevant installed guide under `node_modules/next/dist/docs/`.
4. Inspect affected implementation, callers, tests, types, and documentation.
5. Check the working tree and preserve unrelated user changes.

Do not edit until the change can be described as an input, an observable output, and a verification method.

## Implementation sequence

1. Map the task to the product contract or add/update the contract when behavior changes.
2. Add or adjust deterministic tests before or alongside risky logic.
3. Implement the smallest coherent change.
4. Update specs, design documentation, README content, or code reference material when contracts changed.
5. Run the required verification for the affected layer.
6. Apply `code-check` to the final diff before integration.
7. Review the final diff for scope creep, secrets, unsupported claims, and accidental Gemini calls.

Avoid opportunistic refactors. Separate unrelated cleanup from the requested behavior.

## Product boundaries

- Keep the project read-only and informational.
- Do not reintroduce portfolio tracking, positions, orders, wallets, brokerage actions, or personalized financial advice.
- Keep health checks, CI, `system.ping`, and automatic scans Gemini-free.
- Keep the project database-free unless the specification explicitly changes.
- Treat browser `localStorage` quota controls as demo controls, not as security controls.

## Verification matrix

Run the smallest applicable checks while iterating, then the full completion suite when the change affects behavior, build configuration, dependencies, or UI.

| Change type | Required verification |
|---|---|
| Documentation or agent instructions only | Link/path review, `pnpm lint` |
| TypeScript logic, agents, MCP, providers, or routes | `pnpm lint`, `pnpm typecheck`, `pnpm test` |
| UI behavior or styling | Previous checks plus `pnpm test:e2e` |
| Dependencies, build configuration, or framework behavior | Previous applicable checks plus `pnpm build` |
| Product behavior | Previous applicable checks plus acceptance/specification review |

Repository-wide completion suite:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Manual Gemini evaluations require `RUN_GEMINI_EVALS=1` and must never run implicitly or in CI.

## Completion gate

A change is complete only when:

- implementation, docs, specs, and acceptance behavior agree;
- relevant deterministic tests pass;
- no unrelated files were modified;
- no secrets, raw provider payloads, unsupported facts, or hidden external writes were introduced;
- automatic paths still avoid Gemini;
- the final diff passed `code-check` or all blocking findings were resolved.

If a required check cannot run, report the exact reason. Do not describe an unexecuted check as passing.
