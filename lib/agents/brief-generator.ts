/**
 * Gemini brief workflow with a preloaded market snapshot.
 *
 * Seven market results are fetched before the first model request. Gemini
 * receives eight optional tools and should call them only for missing,
 * materially useful context. This keeps normal scans within roughly 1-4
 * Gemini requests and avoids model usage when no notable anomaly exists.
 */
import {
  GoogleGenAI,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import type { Anomaly } from "@/lib/agents/anomaly-detector";
import {
  BRIEF_FUNCTION_DECLARATIONS,
  BRIEF_SYSTEM_INSTRUCTION,
  buildBriefPrompt,
  parseBriefText,
} from "@/lib/agents/brief-prompt";
import {
  executeToolDescriptor,
  type ToolExecutionResult,
} from "@/lib/mcp/execute-tool";
import {
  cryptoFetchGlobalTool,
  cryptoFetchHistoricalTool,
  cryptoFetchPriceTool,
  cryptoFetchTopMoversTool,
} from "@/lib/mcp/tools/crypto";
import {
  forexFetchHistoricalTool,
  forexFetchRateTool,
} from "@/lib/mcp/tools/forex";
import {
  stocksFetchCandlesTool,
  stocksFetchQuoteTool,
} from "@/lib/mcp/tools/stocks";
import { logEvent } from "@/lib/observability/logger";
import { wrapUntrustedContext } from "@/lib/security/untrusted-context";
import { GEMINI_MODEL } from "@/lib/gemini/config";

export interface BriefRequest {
  anomalies: Anomaly[];
  extraContext?: string;
  scanId?: string;
}

export interface Brief {
  generatedAt: string;
  model: string;
  headline: string;
  body: string;
  outlook?: string;
  /** Neutral monitoring priorities. Retained as `actions` for API compatibility. */
  actions: Array<{ symbol: string; severity: string; action: string }>;
  /** MCP tools requested by Gemini for additional market context. */
  toolCalls: string[];
}

const TOOL_MAP: Record<
  string,
  (args: unknown) => Promise<ToolExecutionResult>
> = {
  crypto_fetch_price: (args) =>
    executeToolDescriptor(cryptoFetchPriceTool, args),
  crypto_fetch_top_movers: (args) =>
    executeToolDescriptor(cryptoFetchTopMoversTool, args),
  crypto_fetch_historical: (args) =>
    executeToolDescriptor(cryptoFetchHistoricalTool, args),
  crypto_fetch_global: (args) =>
    executeToolDescriptor(cryptoFetchGlobalTool, args),
  stocks_fetch_quote: (args) =>
    executeToolDescriptor(stocksFetchQuoteTool, args),
  stocks_fetch_candles: (args) =>
    executeToolDescriptor(stocksFetchCandlesTool, args),
  forex_fetch_rate: (args) =>
    executeToolDescriptor(forexFetchRateTool, args),
  forex_fetch_historical: (args) =>
    executeToolDescriptor(forexFetchHistoricalTool, args),
};

interface Snapshot {
  cryptoGlobal: string | null;
  topMovers: string | null;
  stocksAAPL: string | null;
  stocksMSFT: string | null;
  stocksNVDA: string | null;
  stocksGOOGL: string | null;
  forexUSD: string | null;
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  scanId?: string
): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  const execute = TOOL_MAP[name];
  if (!execute) {
    logEvent("warn", "brief.tool.unknown", { scanId, tool: name });
    return { ok: false, text: `Unknown tool: ${name}` };
  }

  const result = await execute(args);
  let provider: string | undefined;
  try {
    const parsed = JSON.parse(result.text) as { source?: unknown };
    if (typeof parsed.source === "string") provider = parsed.source;
  } catch {
    // Non-JSON and error results do not carry provider metadata.
  }
  logEvent(result.ok ? "info" : "warn", "brief.tool.completed", {
    scanId,
    tool: name,
    ok: result.ok,
    provider,
    fallback:
      provider === "alpha_vantage" ||
      provider === "yahoo" ||
      provider === "binance",
    durationMs: Date.now() - startedAt,
  });
  return result;
}

async function fetchSnapshot(
  progress: (message: string) => void,
  scanId?: string
): Promise<Snapshot> {
  const startedAt = Date.now();
  progress("Fetching global crypto market data…");
  progress("Fetching top 10 cryptos by market cap…");
  progress("Fetching Big Tech stock quotes (AAPL, MSFT, NVDA, GOOGL)…");
  progress("Fetching USD forex rates (EUR, GBP, JPY, CHF)…");

  const [global, movers, aapl, msft, nvda, googl, forex] = await Promise.all([
    runTool("crypto_fetch_global", {}, scanId),
    runTool("crypto_fetch_top_movers", { limit: 10 }, scanId),
    runTool("stocks_fetch_quote", { symbol: "AAPL" }, scanId),
    runTool("stocks_fetch_quote", { symbol: "MSFT" }, scanId),
    runTool("stocks_fetch_quote", { symbol: "NVDA" }, scanId),
    runTool("stocks_fetch_quote", { symbol: "GOOGL" }, scanId),
    runTool(
      "forex_fetch_rate",
      { base: "USD", symbols: ["EUR", "GBP", "JPY", "CHF"] },
      scanId
    ),
  ]);

  const results = [global, movers, aapl, msft, nvda, googl, forex];
  const loaded = results.filter((result) => result.ok).length;
  progress(
    `Snapshot ready — ${loaded}/7 sources loaded. Handing off to Gemini agent…`
  );
  logEvent(loaded === results.length ? "info" : "warn", "brief.snapshot.ready", {
    scanId,
    loadedSources: loaded,
    failedSources: results.length - loaded,
    durationMs: Date.now() - startedAt,
  });

  return {
    cryptoGlobal: global.ok ? global.text : null,
    topMovers: movers.ok ? movers.text : null,
    stocksAAPL: aapl.ok ? aapl.text : null,
    stocksMSFT: msft.ok ? msft.text : null,
    stocksNVDA: nvda.ok ? nvda.text : null,
    stocksGOOGL: googl.ok ? googl.text : null,
    forexUSD: forex.ok ? forex.text : null,
  };
}

function buildSnapshotText(snapshot: Snapshot): string {
  const sections: string[] = [];
  if (snapshot.cryptoGlobal) {
    sections.push(`GLOBAL CRYPTO MARKET:\n${snapshot.cryptoGlobal}`);
  }
  if (snapshot.topMovers) {
    sections.push(
      `TOP 10 CRYPTO BY MARKET CAP (24h moves):\n${snapshot.topMovers}`
    );
  }
  const stocks = [
    snapshot.stocksAAPL,
    snapshot.stocksMSFT,
    snapshot.stocksNVDA,
    snapshot.stocksGOOGL,
  ].filter((value): value is string => Boolean(value));
  if (stocks.length > 0) {
    sections.push(
      `BIG TECH STOCKS (AAPL, MSFT, NVDA, GOOGL):\n${stocks.join("\n")}`
    );
  }
  if (snapshot.forexUSD) {
    sections.push(
      `FOREX (USD base rates — EUR, GBP, JPY, CHF):\n${snapshot.forexUSD}`
    );
  }
  return sections.join("\n\n");
}

export async function generateBrief(
  req: BriefRequest,
  model = GEMINI_MODEL,
  onProgress?: (message: string) => void
): Promise<Brief> {
  const startedAt = Date.now();
  const toolCalls: string[] = [];
  const progress = (message: string) => onProgress?.(message);

  if (req.anomalies.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      model,
      headline: "No anomalies detected — markets within configured ranges.",
      body: "All monitored assets moved within the configured thresholds during the latest scan. No Gemini request was needed.",
      actions: [],
      toolCalls: [],
    };
  }

  const snapshot = await fetchSnapshot(progress, req.scanId);
  const prompt = buildBriefPrompt({
    snapshotText: buildSnapshotText(snapshot),
    anomalies: req.anomalies,
    extraContext: req.extraContext,
  });

  progress("Initializing Gemini with the market snapshot…");
  logEvent("info", "brief.gemini.started", {
    scanId: req.scanId,
    model,
    anomaliesCount: req.anomalies.length,
  });

  const ai = new GoogleGenAI({ apiKey: apiKey() });
  const chat = ai.chats.create({
    model,
    config: {
      tools: [{ functionDeclarations: BRIEF_FUNCTION_DECLARATIONS }],
      systemInstruction: BRIEF_SYSTEM_INSTRUCTION,
    },
  });

  progress(
    `Sending context to Gemini (${req.anomalies.length} anomalies + market snapshot)…`
  );

  let heartbeatCount = 0;
  const heartbeatId = setInterval(() => {
    heartbeatCount += 1;
    progress(`Gemini processing… (${heartbeatCount * 8}s)`);
  }, 8_000);

  let response: GenerateContentResponse;
  try {
    response = await chat.sendMessage({ message: prompt });
  } finally {
    clearInterval(heartbeatId);
  }

  let rounds = 1;
  const maxToolRounds = 4;
  while (rounds <= maxToolRounds) {
    const calls = response.functionCalls;
    if (!calls || calls.length === 0) break;

    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        const callName = call.name ?? "";
        const args = (call.args ?? {}) as Record<string, unknown>;
        const argsLabel = Object.values(args)
          .map((value) => (Array.isArray(value) ? value.join(",") : String(value)))
          .join(",");
        const toolLabel = `${callName.replace(/_/g, ".")}(${argsLabel})`;
        toolCalls.push(toolLabel);
        progress(`Gemini requested MCP tool: ${toolLabel}`);
        logEvent("info", "brief.gemini.tool_requested", {
          scanId: req.scanId,
          tool: callName,
          round: rounds,
        });

        const toolResult = await runTool(callName, args, req.scanId);
        progress("Tool result received — Gemini processing…");

        return {
          functionResponse: {
            name: callName,
            response: {
              output: wrapUntrustedContext(
                `tool result ${callName}`,
                toolResult.text
              ),
              ok: toolResult.ok,
            },
          },
        } satisfies Part;
      })
    );

    rounds += 1;
    response = await chat.sendMessage({ message: functionResponses });
  }

  progress("Gemini writing informational market brief…");
  const parsed = parseBriefText(response.text ?? "", req.anomalies);
  logEvent("info", "brief.gemini.completed", {
    scanId: req.scanId,
    model,
    rounds,
    toolCalls: toolCalls.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    generatedAt: new Date().toISOString(),
    model,
    ...parsed,
    toolCalls,
  };
}
