import { mcpHandler } from "@/lib/mcp/server";

/**
 * MCP route handler.
 *
 * The [transport] dynamic segment is intentional: the Vercel MCP adapter
 * determines the actual endpoint (mcp / sse / message) from req.url.
 * Requests are delegated to the shared handler.
 */
export { mcpHandler as GET, mcpHandler as POST };
