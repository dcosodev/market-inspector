export type LogLevel = "debug" | "info" | "warn" | "error";

type LogDetails = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  return value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
    ? value
    : "info";
}

/**
 * Mask secret-like substrings embedded in free text (e.g. a provider error
 * that echoes a `?token=...` query string or an `Authorization: Bearer ...`
 * header). Key-name redaction alone misses these.
 */
function scrubSecrets(text: string): string {
  return text
    .replace(/(bearer\s+)[A-Za-z0-9._\-]{8,}/gi, "$1[redacted]")
    .replace(
      /(\b(?:api[_-]?key|apikey|access[_-]?token|token|secret|password|authorization|key)["']?\s*[:=]\s*["']?)[A-Za-z0-9._\-]{6,}/gi,
      "$1[redacted]"
    );
}

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (/(api.?key|token|secret|password|authorization)/i.test(key)) {
    return "[redacted]";
  }
  if (depth > 4) return "[max-depth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: scrubSecrets(value.message).slice(0, 500),
    };
  }
  if (typeof value === "string") {
    const scrubbed = scrubSecrets(value);
    return scrubbed.length > 500 ? `${scrubbed.slice(0, 500)}…` : scrubbed;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey, depth + 1),
      ])
    );
  }
  return value;
}

export function createOperationId(prefix: string): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.().slice(0, 8) ??
    Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function logEvent(
  level: LogLevel,
  event: string,
  details: LogDetails = {}
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel()]) return;

  const sanitizedDetails = sanitize(details);
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(sanitizedDetails &&
    typeof sanitizedDetails === "object" &&
    !Array.isArray(sanitizedDetails)
      ? (sanitizedDetails as LogDetails)
      : {}),
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    console.debug(line);
  } else {
    console.info(line);
  }
}
