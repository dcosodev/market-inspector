# Code review evaluation rubric

This rubric evaluates code produced or modified by a development agent. It complements `evals/rubric.md`, which evaluates the market brief produced by the application.

The reviewer may be a human or an AI using `.agents/skills/code-check/SKILL.md`. This repository does not claim that a separate judge model runs automatically. Code review remains manual and is excluded from CI; deterministic CI checks remain the merge baseline.

## Evidence

Review the user request, complete diff, relevant specifications, acceptance scenarios, design contract, implementation, tests, documentation, and executed check results. Do not score from a summary alone.

## Scoring

Score each criterion from 0 to 5:

- `0` — absent, critically unsafe, or fundamentally incorrect.
- `1` — major failures dominate the implementation.
- `2` — substantial gaps or likely regressions remain.
- `3` — generally acceptable, with meaningful limitations.
- `4` — strong implementation with minor gaps.
- `5` — complete, well-supported, and aligned with repository contracts.

| Criterion | Weight | Review questions |
|---|---:|---|
| Correctness and edge cases | 25% | Does the change implement the intended behavior without obvious logic errors, unreachable branches, malformed states, or unhandled edge cases? |
| Specification alignment | 15% | Does it follow `specs/market-inspector.md`, `specs/acceptance.feature`, `DESIGN.md`, and documented scope? Were changed contracts updated? |
| Security and privacy | 15% | Are inputs validated, secrets protected, untrusted content contained, logs safe, and destructive or external-write behavior absent? |
| Gemini, MCP, and cost safety | 15% | Are automatic paths Gemini-free, model calls bounded, MCP tools read-only, schemas validated, and provider data treated as untrusted? |
| Tests and regression protection | 10% | Do deterministic tests prove the changed behavior and important failure modes without live model or provider calls? |
| Reliability and observability | 10% | Are timeouts, fallbacks, partial failures, concurrency, attribution, and structured logs handled correctly? |
| Maintainability | 5% | Are types, shared contracts, naming, structure, and framework conventions clear without unnecessary duplication? |
| Documentation | 5% | Are specifications, acceptance criteria, code reference, README, and design documentation updated where required? |

Calculate the weighted result as:

```text
total = sum((criterion score / 5) * criterion weight)
```

Round the total to the nearest whole number.

## Severity

- `P0`: exploitable secret exposure, destructive behavior, data loss, unrestricted external action, or equivalent critical risk.
- `P1`: likely production failure, incorrect financial information, Gemini quota bypass, missing trust boundary, or violation of a core product contract.
- `P2`: meaningful reliability, maintainability, testing, accessibility, or documentation defect.
- `P3`: localized improvement whose absence has limited practical impact.

## Decision

- `Pass`: score at least 80, no `P0` or `P1`, and security plus Gemini/MCP criteria both score at least 4.
- `Conditional pass`: score from 65 to 79, no `P0` or `P1`, and remaining findings have an explicit remediation plan.
- `Fail`: score below 65, any `P0` or `P1`, or a security or Gemini/MCP score below 3.

A passing score does not override a concrete blocking finding.

## Required output

The review must include:

1. findings ordered by severity, with file and line evidence;
2. criterion scores and weighted total;
3. checks actually executed;
4. unverified behavior and residual risks;
5. final decision.

Avoid vague approval, invented issues, and claims unsupported by inspected evidence.
