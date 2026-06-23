/**
 * Browser-side API client.
 *
 * The browser dashboard calls the application's API routes. Tool calls go
 * through POST /api/mcp; orchestrator scans use
 * POST /api/anomalies.
 */
import type { McpToolResult } from "@/lib/mcp/client";
import type { DashboardOrchestratorState } from "@/lib/types/dashboard";

let requestSequence = 0;

/**
 * Error class that carries a structured failure reason from a tool
 * call. callMcpTool() surfaces it so the UI can render a
 * proper "degraded" badge instead of an unhandled JSON parse error.
 */
export class McpToolError extends Error {
  constructor(
    readonly toolName: string,
    readonly reason: string,
    readonly isDegraded: boolean = false
  ) {
    super(`${toolName}: ${reason}`);
    this.name = "McpToolError";
  }
}

/**
 * Call an MCP tool by name via the HTTP endpoint. Browser-safe.
 *
 * Handles three error shapes:
 *   1. JSON-RPC error (no `result`, has `error`) -> McpToolError
 *   2. Tool result with isError: true and text starting with "Error:"
 *      -> McpToolError with the message extracted
 *   3. Tool result with text that is not valid JSON and does not match the
 *      expected error shape -> return the raw text
 */
export async function callMcpTool<T = unknown>(
  name: string,
  arguments_: Record<string, unknown>,
  timeoutMs = 20_000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch("/api/mcp", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${++requestSequence}`,
        method: "tools/call",
        params: { name, arguments: arguments_ },
      }),
    });
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === "AbortError";
    throw new McpToolError(
      name,
      isTimeout ? `Request timed out after ${timeoutMs / 1000}s` : `Network error: ${e instanceof Error ? e.message : String(e)}`,
      true
    );
  }
  clearTimeout(timeoutId);
  if (!response.ok) {
    throw new McpToolError(
      name,
      `HTTP ${response.status} ${response.statusText}`,
      response.status === 429 || response.status >= 500
    );
  }
  const text = await response.text();
  const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
  if (!dataLine) throw new McpToolError(name, "No data line in SSE response");
  const json = JSON.parse(dataLine.slice(5).trim()) as {
    result?: { content: McpToolResult["content"]; isError?: boolean };
    error?: { message: string };
  };
  if (json.error) {
    throw new McpToolError(name, json.error.message);
  }
  if (!json.result) {
    throw new McpToolError(name, "No result in MCP response");
  }
  const textPart = json.result.content.find(
    (c): c is { type: "text"; text: string } => c.type === "text"
  );
  if (!textPart) throw new McpToolError(name, "No text content in tool result");
  // If the tool itself returned an error string, surface it cleanly
  // instead of letting JSON.parse throw a generic SyntaxError.
  if (json.result.isError || textPart.text.startsWith("Error:")) {
    throw new McpToolError(name, textPart.text, true);
  }
  // If the payload is not JSON, return the raw string typed as T.
  try {
    return JSON.parse(textPart.text) as T;
  } catch {
    return textPart.text as unknown as T;
  }
}

/**
 * Run a full AI scan. Streams progress events and resolves with the
 * final orchestrator state when done.
 *
 * @param onStep - called with each progress message as it arrives
 */
export async function runTick(
  onStep?: (msg: string) => void
): Promise<DashboardOrchestratorState> {
  let response: Response;
  try {
    response = await fetch("/api/anomalies", { method: "POST", cache: "no-store" });
  } catch (e) {
    throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!response.ok) {
    throw new Error(`Scan failed: HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let payload: { type: string; msg?: string; state?: DashboardOrchestratorState };
      try {
        payload = JSON.parse(line.slice(6)) as typeof payload;
      } catch {
        continue;
      }
      if (payload.type === "step" && payload.msg) {
        onStep?.(payload.msg);
      } else if (payload.type === "done" && payload.state) {
        return payload.state;
      } else if (payload.type === "error") {
        throw new Error(payload.msg ?? "Unknown scan error");
      }
    }
  }

  throw new Error("Scan stream ended without a result");
}
