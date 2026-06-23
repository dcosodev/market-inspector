const DEFAULT_MAX_CHARS = 24_000;

/**
 * Delimits provider and user-supplied text before it enters an LLM prompt.
 * The model is instructed to treat everything inside these tags as data,
 * never as instructions.
 */
export function wrapUntrustedContext(
  label: string,
  value: string,
  maxChars = DEFAULT_MAX_CHARS
): string {
  const safeLabel = label.replace(/[^a-zA-Z0-9 _.-]/g, "").trim() || "data";
  const normalized = value
    .replace(/\u0000/g, "")
    .replace(/<\/?untrusted-data\b/gi, "[filtered-tag]");
  const truncated =
    normalized.length > maxChars
      ? `${normalized.slice(0, maxChars)}\n[truncated]`
      : normalized;

  return `<untrusted-data label="${safeLabel}">\n${truncated}\n</untrusted-data>`;
}
