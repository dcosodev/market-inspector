/**
 * Minimal MCP Streamable HTTP client.
 *
 * The MCP Streamable HTTP transport expects:
 *   - Accept: application/json, text/event-stream
 *   - Body: JSON-RPC 2.0 messages
 *   - Response: text/event-stream with `event: message\ndata: <json>\n\n`
 *
 * This client intentionally supports only initialize, tools/list, and
 * tools/call. It uses global fetch and does not implement reconnection
 * or resumability.
 */

/** JSON-RPC 2.0 request payload. */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 success response. */
interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result: T;
}

/** JSON-RPC 2.0 error response. */
interface JsonRpcError {
  jsonrpc: "2.0";
  id: number | null;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcMessage<T> = JsonRpcResponse<T> | JsonRpcError;

/** Tool descriptor as returned by `tools/list`. */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Tool call result. */
export interface McpToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: unknown }
  >;
  isError?: boolean;
}

/**
 * Parse a text/event-stream body and return the JSON of the first
 * `event: message\ndata: ...` chunk. The Vercel MCP adapter emits one
 * message per response in the Streamable HTTP mode.
 */
function parseSseMessage(body: string): string {
  // The SSE format is: "event: <type>\ndata: <payload>\n\n"
  // Extract the first data line and return its payload.
  const lines = body.split("\n");
  let dataPayload: string | null = null;
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataPayload = line.slice("data:".length).trim();
      break;
    }
  }
  if (dataPayload === null) {
    throw new Error(
      `SSE response has no data line. Full body:\n${body.slice(0, 500)}`
    );
  }
  return dataPayload;
}

/** Default per-request timeout. Prevents a hung server from stalling a scan. */
const DEFAULT_TIMEOUT_MS = 30_000;

export class McpHttpClient {
  private nextId = 1;

  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS
  ) {}

  private async send<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    const body: JsonRpcRequest = params
      ? { jsonrpc: "2.0", id, method, params }
      : { jsonrpc: "2.0", id, method };

    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // MCP Streamable HTTP requires BOTH content types in Accept.
          "Accept": "application/json, text/event-stream",
          ...this.headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new Error(
          `MCP request "${method}" timed out after ${this.timeoutMs}ms`
        );
      }
      throw e;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `MCP request failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const responseText = await response.text();
    const jsonText = parseSseMessage(responseText);
    const message = JSON.parse(jsonText) as JsonRpcMessage<T>;

    if ("error" in message) {
      throw new Error(
        `MCP JSON-RPC error ${message.error.code}: ${message.error.message}`
      );
    }

    return message.result;
  }

  /** Perform the MCP initialize handshake. */
  async initialize(): Promise<{
    protocolVersion: string;
    serverInfo: { name: string; version: string };
  }> {
    return this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "market-inspector-mcp-client", version: "0.1.0" },
    });
  }

  /** List all tools exposed by the server. */
  async listTools(): Promise<McpToolDescriptor[]> {
    const result = await this.send<{ tools: McpToolDescriptor[] }>(
      "tools/list",
      {}
    );
    return result.tools;
  }

  /** Invoke a tool by name with the given arguments. */
  async callTool(
    name: string,
    arguments_: Record<string, unknown>
  ): Promise<McpToolResult> {
    return this.send<McpToolResult>("tools/call", {
      name,
      arguments: arguments_,
    });
  }
}
