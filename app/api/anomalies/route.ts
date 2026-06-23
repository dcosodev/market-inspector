/**
 * Anomalies API
 *
 * GET  /api/anomalies  — returns the last cached orchestrator state
 * POST /api/anomalies  — runs a full AI scan and streams progress via SSE
 *
 * The POST response is a text/event-stream. Each event is one of:
 *   data: {"type":"step","msg":"..."}   — progress message
 *   data: {"type":"done","state":{...}} — final state, stream ends
 *   data: {"type":"error","msg":"..."}  — fatal error, stream ends
 */
import { NextResponse } from "next/server";
import { getOrchestrator } from "@/lib/agents/orchestrator";
import { checkRateLimit, clientIp } from "@/lib/utils/api-rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// A notable scan can trigger up to five Gemini calls. Match the public demo
// budget shown in the UI: four manual scans per client per local day. This is
// still in-memory and per-instance, so it is a mitigation rather than a hard
// global billing control.
const SCAN_LIMIT = 4;
const SCAN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  return NextResponse.json(getOrchestrator().latestState());
}

export async function POST(req: Request) {
  const limit = checkRateLimit(`anomalies:${clientIp(req)}`, SCAN_LIMIT, SCAN_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many scans. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      try {
        const state = await getOrchestrator().tick({
          forceBrief: true,
          onProgress: (msg) => send({ type: "step", msg }),
        });
        if (state.lastError) {
          send({ type: "error", msg: state.lastError });
        } else {
          send({ type: "done", state });
        }
      } catch (e) {
        send({ type: "error", msg: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
