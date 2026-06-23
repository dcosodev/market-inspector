import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOperationId,
  logEvent,
} from "@/lib/observability/logger";

describe("structured logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it("emits JSON and redacts sensitive fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logEvent("info", "test.completed", {
      scanId: "scan-1",
      apiKey: "secret-value",
    });

    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as {
      event: string;
      apiKey: string;
      scanId: string;
    };
    expect(payload.event).toBe("test.completed");
    expect(payload.scanId).toBe("scan-1");
    expect(payload.apiKey).toBe("[redacted]");
  });

  it("creates traceable operation identifiers", () => {
    expect(createOperationId("scan")).toMatch(/^scan-[a-z0-9]+-[a-z0-9]+$/);
  });
});
