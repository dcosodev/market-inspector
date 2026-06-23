import createMcpRouteHandler from "@vercel/mcp-adapter/next";
import { z } from "zod";
import { systemPingTool } from "@/lib/mcp/tools/system";
import { cryptoTools } from "@/lib/mcp/tools/crypto";
import { stockTools } from "@/lib/mcp/tools/stocks";
import { forexTools } from "@/lib/mcp/tools/forex";

/**
 * Market Inspector MCP Server.
 *
 * Exposes market intelligence tools to any MCP-compatible client
 * (Gemini, Claude, custom agents). The transport is configured
 * per-route; see app/api/[transport]/route.ts.
 *
 * The handler is created with createMcpRouteHandler from
 * @vercel/mcp-adapter (Vercel MCP Adapter), which uses the official
 * @modelcontextprotocol/sdk under the hood. The adapter wires up
 * the Streamable HTTP transport automatically.
 *
 * basePath: "/api" tells the adapter that its default endpoints
 * (streamableHttpEndpoint, sseEndpoint, sseMessageEndpoint) should
 * be prefixed with "/api" so they resolve to:
 *   - /api/mcp   (Streamable HTTP)
 *   - /api/sse   (Server-Sent Events)
 *   - /api/message (SSE messages)
 * That matches the [transport] dynamic segment in the Next.js
 * route at app/api/[transport]/route.ts.
 *
 * MCP Streamable HTTP spec requires clients to send BOTH
 * "application/json" and "text/event-stream" in the Accept header.
 * Real MCP clients (Gemini, Claude, mcp-remote) do this
 * automatically; curl must include it explicitly.
 */

const handler = createMcpRouteHandler(
  (server) => {
    registerTool(server, systemPingTool);

    // --- Crypto tools (CoinGecko-backed) ---
    for (const tool of cryptoTools) {
      registerTool(server, tool as unknown as Parameters<typeof registerTool>[1]);
    }

    // --- Stock tools (Finnhub primary, Alpha Vantage fallback) ---
    for (const tool of stockTools) {
      registerTool(server, tool as unknown as Parameters<typeof registerTool>[1]);
    }

    // --- Forex tools (Frankfurter, no key) ---
    for (const tool of forexTools) {
      registerTool(server, tool as unknown as Parameters<typeof registerTool>[1]);
    }

  },
  {
    // No custom serverInfo in 0.4.0 — the adapter sets defaults.
  },
  {
    basePath: "/api",
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

export const mcpHandler = handler;

/**
 * Helper to register a tool with the MCP server.
 *
 * The SDK's `server.tool(name, description, shape, handler)` expects:
 *   - shape: a ZodRawShape (the inner shape object of z.object({...}))
 *   - handler: (args, extra) => { content: [...], isError?: boolean }
 *
 * Tool descriptors in lib/mcp/tools/* export a Zod schema as
 * `input` and a handler that returns MCP-formatted content. This
 * helper bridges the two representations.
 */
function registerTool(
  server: Parameters<Parameters<typeof createMcpRouteHandler>[0]>[0],
  tool: {
    name: string;
    description: string;
    input: z.ZodTypeAny;
    handler: (args: Record<string, unknown>) => Promise<{
      content: Array<{
        type: "text";
        text: string;
        data?: string;
        mimeType?: string;
      }>;
      isError?: boolean;
    }>;
  }
) {
  // z.object(...).shape gives the raw shape that server.tool wants.
  // Non-object schemas are wrapped as a single value field.
  const shape =
    "shape" in tool.input && tool.input.shape
      ? (tool.input.shape as z.ZodRawShape)
      : ({ value: tool.input } as unknown as z.ZodRawShape);
  const handler = tool.handler as unknown as (
    args: Record<string, unknown>
  ) => Promise<{
    content: Array<{
      type: "text";
      text: string;
      data?: string;
      mimeType?: string;
    }>;
    isError?: boolean;
  }>;
  server.tool(tool.name, tool.description, shape, handler);
}
