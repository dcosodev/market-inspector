/**
 * Single source of truth for the Gemini model id.
 *
 * Keeping this in one place avoids the orchestrator, brief generator, and
 * chat client drifting apart (they each used to hardcode the string).
 *
 * `gemini-2.5-flash` is scheduled for shutdown on 2026-10-16, so this points
 * at its successor. The SDK was also migrated from the deprecated
 * `@google/generative-ai` to `@google/genai`.
 * If `gemini-3.5-flash` is not yet available on your API key, revert this one
 * line to `"gemini-2.5-flash"` (still valid until 2026-10-16).
 * See: https://ai.google.dev/gemini-api/docs/deprecations
 */
export const GEMINI_MODEL = "gemini-3.5-flash";
