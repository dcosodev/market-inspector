import { z } from "zod";

export interface ToolTextResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ToolExecutionResult {
  ok: boolean;
  text: string;
}

/**
 * Validate tool arguments with the descriptor's Zod schema before invoking
 * its in-process handler. This preserves defaults and constraints that would
 * otherwise only be applied by the MCP transport.
 */
export async function executeToolDescriptor<TOutput, TInput = unknown>(
  tool: {
    input: z.ZodType<TOutput, z.ZodTypeDef, TInput>;
    handler: (input: TOutput) => Promise<ToolTextResult>;
  },
  args: unknown
): Promise<ToolExecutionResult> {
  try {
    const input = tool.input.parse(args);
    const result = await tool.handler(input);
    const text = result.content.find((item) => item.type === "text")?.text;

    if (!text) {
      return { ok: false, text: "Tool returned no text content." };
    }

    return {
      ok: result.isError !== true && !text.startsWith("Error:"),
      text,
    };
  } catch (error) {
    return {
      ok: false,
      text: error instanceof Error ? error.message : String(error),
    };
  }
}
