/**
 * Minimal Gemini client.
 *
 * Wraps @google/genai to:
 *   1. Convert MCP tool descriptors to Gemini function declarations.
 *   2. Send a prompt with those tools.
 *   3. If Gemini returns a function call, execute it via an injected
 *      executor and send the result back to Gemini.
 *   4. Return Gemini's final text response.
 *
 * The client stays small by accepting an injected MCP executor.
 */
import {
  GoogleGenAI,
  type FunctionDeclaration,
  type Tool as GeminiTool,
  type Content,
  type Part,
} from "@google/genai";
import type { McpToolDescriptor, McpToolResult } from "@/lib/mcp/client";
import { wrapUntrustedContext } from "@/lib/security/untrusted-context";
import { GEMINI_MODEL } from "@/lib/gemini/config";

/** Executor that knows how to call a named MCP tool. */
export type ToolExecutor = (
  name: string,
  arguments_: Record<string, unknown>
) => Promise<McpToolResult>;

/** Convert an MCP tool descriptor to a Gemini FunctionDeclaration. */
function mcpToGeminiFunction(
  tool: McpToolDescriptor,
  functionName: string
): FunctionDeclaration {
  return {
    name: functionName,
    description: tool.description ?? "",
    // MCP inputSchema is a JSON Schema object. Gemini's `parameters`
    // accepts a similar OpenAPI 3.0 / JSON Schema subset, but it
    // rejects fields that are common in JSON Schema (and that Zod
    // emits by default) such as `additionalProperties` and `$schema`.
    // Strip those before sending.
    parameters: sanitizeJsonSchemaForGemini(
      tool.inputSchema
    ) as unknown as FunctionDeclaration["parameters"],
  };
}

function toGeminiFunctionName(toolName: string): string {
  return toolName.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Remove fields Gemini rejects from a JSON Schema.
 *
 * Only keys outside the supported Gemini schema subset are removed.
 * Keep standard constraints such as minLength, minItems, maxItems,
 * pattern, and format; the current tool schemas emit minItems, and
 * removing supported validation keywords would weaken the contracts.
 */
const GEMINI_REJECTED_KEYS = new Set([
  "additionalProperties",
  "$schema",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

function sanitizeJsonSchemaForGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeJsonSchemaForGemini);
  }
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (GEMINI_REJECTED_KEYS.has(key)) continue;
      out[key] = sanitizeJsonSchemaForGemini(value);
    }
    return out;
  }
  return schema;
}

/** Extract plain text from a tool result. */
function toolResultToText(result: McpToolResult): string {
  return result.content
    .map((c) => {
      if (c.type === "text") return c.text;
      if (c.type === "image") return `[image ${c.mimeType} ${c.data.length}b]`;
      if (c.type === "resource") return `[resource]`;
      return "";
    })
    .join("\n");
}

/**
 * Run a single-turn conversation with Gemini, allowing function calls.
 *
 * Returns Gemini's final text response. Any tool calls Gemini makes
 * are dispatched via the provided executor.
 */
export async function chatWithTools(options: {
  apiKey: string;
  prompt: string;
  systemInstruction?: string;
  tools: McpToolDescriptor[];
  executor: ToolExecutor;
  model?: string;
  maxTurns?: number;
}): Promise<string> {
  const {
    apiKey,
    prompt,
    systemInstruction,
    tools,
    executor,
    model = GEMINI_MODEL,
    maxTurns = 4,
  } = options;

  const ai = new GoogleGenAI({ apiKey });
  const toolNames = new Map<string, string>();
  const functionDeclarations = tools.map((tool) => {
    const functionName = toGeminiFunctionName(tool.name);
    const existing = toolNames.get(functionName);
    if (existing && existing !== tool.name) {
      throw new Error(
        `MCP tool names "${existing}" and "${tool.name}" map to the same Gemini function name`
      );
    }
    toolNames.set(functionName, tool.name);
    return mcpToGeminiFunction(tool, functionName);
  });
  const geminiTools: GeminiTool[] =
    tools.length > 0
      ? [{ functionDeclarations }]
      : [];

  const config = {
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
  };

  const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];

  let turns = 0;
  while (turns < maxTurns) {
    turns += 1;
    const response = await ai.models.generateContent({ model, contents, config });
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error("Gemini returned no candidates");
    }
    const parts = candidate.content?.parts ?? [];

    const functionCalls = response.functionCalls ?? [];
    if (functionCalls.length === 0) {
      return (
        response.text ??
        parts.flatMap((part) => (part.text ? [part.text] : [])).join("\n")
      );
    }

    const functionResponses = await Promise.all(
      functionCalls.map(async (call) => {
        if (!call.name) {
          throw new Error("Gemini returned a function call with no name");
        }
        const toolName = toolNames.get(call.name);
        if (!toolName) {
          throw new Error(`Gemini requested an unknown function: ${call.name}`);
        }
        const args = (call.args ?? {}) as Record<string, unknown>;
        const toolResult = await executor(toolName, args);
        const toolText = toolResultToText(toolResult);

        return {
          functionResponse: {
            name: call.name,
            response: {
              result: wrapUntrustedContext(
                `tool result ${toolName}`,
                toolText
              ),
            },
          },
        } satisfies Part;
      })
    );

    // The new SDK sends function results back in a "user" content
    // (the API role must be "user" or "model").
    contents.push({ role: "model", parts });
    contents.push({ role: "user", parts: functionResponses });
  }

  throw new Error(`Exceeded max tool-call turns (${maxTurns})`);
}
