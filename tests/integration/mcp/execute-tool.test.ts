import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { executeToolDescriptor } from "@/lib/mcp/execute-tool";

describe("executeToolDescriptor", () => {
  it("applies Zod defaults before invoking a handler", async () => {
    const handler = vi.fn(async (input: { symbol: string; days: number }) => ({
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(input),
        },
      ],
    }));
    const tool = {
      input: z.object({
        symbol: z.string(),
        days: z.number().int().default(7),
      }),
      handler,
    };

    const result = await executeToolDescriptor(tool, { symbol: "btc" });

    expect(result.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith({ symbol: "btc", days: 7 });
  });

  it("returns validation and tool errors as failed executions", async () => {
    const tool = {
      input: z.object({ limit: z.number().int().min(1).max(10) }),
      handler: vi.fn(async () => ({
        content: [{ type: "text" as const, text: "Error: upstream unavailable" }],
        isError: true,
      })),
    };

    await expect(executeToolDescriptor(tool, { limit: 0 })).resolves.toMatchObject({
      ok: false,
    });
    await expect(executeToolDescriptor(tool, { limit: 5 })).resolves.toEqual({
      ok: false,
      text: "Error: upstream unavailable",
    });
  });
});
