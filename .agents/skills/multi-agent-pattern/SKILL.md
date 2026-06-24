

# Multi-Agent Pattern

Use this skill when work touches the agent pipeline or its observable behavior.

## Agent roles

Keep responsibilities separated:

- detector: deterministic market-movement analysis;
- brief generator: manual Gemini-backed narrative for notable anomalies;
- orchestrator: state coordination, tick lifecycle, listener notification, and safe snapshots;
- reporter/UI stream: transport current state to the dashboard.

Do not blur deterministic collection/detection with LLM narrative. Gemini should enrich a notable event, not decide whether every automatic update is worth a paid call.

## Tick and stream behavior

Automatic paths must be cheap and predictable:

- automatic scans must not call Gemini unless the explicit manual notable-anomaly path is triggered;
- concurrent scans should avoid duplicated provider/model work when practical;
- SSE streams should reuse current state and avoid multiplying provider calls per viewer;
- module-level memory is acceptable for the demo, but document cold-start limitations honestly.

## Agent output

Generated market language must be:

- neutral and informational;
- conditional when uncertainty exists;
- grounded in supplied context;
- free of personalized financial advice;
- clear about failed or partial sources.

Avoid language that sounds like an agent speaking privately to the developer. The UI and docs should read like a professional product.

## Evaluation

Use deterministic tests for logic and contract behavior. Use manual Gemini evaluations only when deliberately enabled with `RUN_GEMINI_EVALS=1`.

When evaluating agent output, judge correctness, grounding, uncertainty, safety, tone, and quota discipline. Do not rely only on exact-string tests for model text.
