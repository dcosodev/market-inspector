/**
 * Integration test for the MCP system.ping tool.
 *
 * Registers the application descriptor in a test-only McpServer, then calls
 * it through the SDK's in-memory transport.
 */
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { systemPingTool } from "@/lib/mcp/tools/system";

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "market-inspector-test", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );
  server.tool(
    systemPingTool.name,
    systemPingTool.description,
    systemPingTool.input.shape,
    systemPingTool.handler
  );
  return server;
}

async function callSystemPing(): Promise<string> {
  const server = buildServer();
  const client = new Client(
    { name: "test-client", version: "0.0.1" },
    { capabilities: {} }
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const result = await client.callTool({
    name: "system.ping",
    arguments: {},
  });

  const text = (result.content as Array<{ type: string; text: string }>).find(
    (c) => c.type === "text"
  )?.text;
  if (!text) throw new Error("No text content in tool result");
  return text;
}

describe("system.ping tool", () => {
  it("returns service status without exposing credentials", async () => {
    const text = await callSystemPing();
    const payload = JSON.parse(text) as {
      status: string;
      service: string;
      version: string;
      configured: Record<string, boolean>;
      publicSources: string[];
      timestamp: string;
    };

    expect(payload).toMatchObject({
      status: "ok",
      service: "market-inspector",
      version: "0.1.0",
    });
    expect(payload.configured).toEqual({
      gemini: Boolean(process.env.GEMINI_API_KEY),
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      alphaVantage: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
    });
    expect(payload.publicSources).toEqual([
      "coingecko",
      "coinpaprika",
      "binance",
      "yahoo",
      "frankfurter",
    ]);
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    for (const secret of [
      process.env.GEMINI_API_KEY,
      process.env.FINNHUB_API_KEY,
      process.env.ALPHA_VANTAGE_API_KEY,
    ]) {
      if (secret) expect(text).not.toContain(secret);
    }
  });
});
