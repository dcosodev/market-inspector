/**
 * Server-Sent Events stream for live orchestrator state.
 *
 * GET /api/stream
 *   → returns Content-Type: text/event-stream
 *   → emits one event per orchestrator tick
 *   → the dashboard subscribes to this for live updates
 *
 * The orchestrator runs on a single 60-second tick that is SHARED across all
 * connected clients (ref-counted below) rather than one interval per
 * connection. New viewers receive the current state immediately and only the
 * first viewer, or a viewer that finds stale state, refreshes it. State is not
 * persisted between server restarts. The browser reconnects automatically.
 *
 * Cleanup: when the client disconnects, the runtime invokes
 * ReadableStream.cancel(). A closure clears the per-connection heartbeat,
 * unsubscribes the orchestrator listener, and releases its hold on the shared
 * tick, regardless of how the connection ended.
 */
import { getOrchestrator, type OrchestratorState } from "@/lib/agents/orchestrator";

export const dynamic = "force-dynamic";
// Vercel Functions cannot stream indefinitely. Hobby supports up to 300 s;
// EventSource reconnects automatically when the platform rotates the stream.
export const maxDuration = 300;

const TICK_MS = 60_000;
const HEARTBEAT_MS = 25_000;

// Shared across all open SSE connections on this instance.
let sharedTick: ReturnType<typeof setInterval> | null = null;
let activeStreams = 0;

function shouldRefreshOnConnect(state: OrchestratorState): boolean {
  if (activeStreams === 0) return true;
  const lastTick = Date.parse(state.lastTickAt);
  return Number.isNaN(lastTick) || Date.now() - lastTick > TICK_MS;
}

/** Start the shared tick on the first subscriber. */
function acquireSharedTick(): void {
  activeStreams += 1;
  if (sharedTick === null) {
    sharedTick = setInterval(() => {
      getOrchestrator()
        .tick()
        .catch(() => {
          // errors are already in the state
        });
    }, TICK_MS);
  }
}

/** Stop the shared tick once the last subscriber leaves. */
function releaseSharedTick(): void {
  activeStreams = Math.max(0, activeStreams - 1);
  if (activeStreams === 0 && sharedTick) {
    clearInterval(sharedTick);
    sharedTick = null;
  }
}

export async function GET(): Promise<Response> {
  const orchestrator = getOrchestrator();
  const encoder = new TextEncoder();
  // Cleanup state is held in the route closure rather than attached to
  // the stream controller.
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsubscribe: (() => void) | null = null;
  let closed = false;

  // Idempotent teardown shared by the error path and the runtime's cancel().
  // Releases this connection's hold on the shared tick exactly once.
  const finalize = () => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (unsubscribe) unsubscribe();
    releaseSharedTick();
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const cleanup = () => {
        const wasOpen = !closed;
        finalize();
        if (wasOpen) {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      const send = (event: string, data: OrchestratorState) => {
        if (closed) return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // controller closed mid-write; clean up
          cleanup();
        }
      };

      // Initial state (without running a tick).
      const initialState = orchestrator.latestState();
      const refreshOnConnect = shouldRefreshOnConnect(initialState);
      send("state", initialState);

      // Subscribe to in-process updates and re-emit.
      unsubscribe = orchestrator.subscribe((state) => {
        send("state", state);
      });

      // Join the shared periodic tick instead of starting a per-connection one.
      acquireSharedTick();

      // Refresh only for the first subscriber or when the existing state is
      // stale; otherwise a new viewer should not multiply provider calls.
      if (refreshOnConnect) {
        orchestrator.tick().catch(() => {
          // errors are already in the state
        });
      }

      // Heartbeat every 25s to keep proxies from closing the connection.
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
    },
    cancel() {
      // Runtime invokes this when the client disconnects.
      finalize();
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
