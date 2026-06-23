/**
 * Orchestrator agent.
 *
 * Coordinates the AnomalyDetector and BriefGenerator. Exposes:
 *   - tick(): run a single detection + (if needed) brief generation cycle
 *   - latestState(): in-memory cache of the last brief + anomalies
 *   - subscribe(): register a listener for state updates (used by SSE)
 *
 * State is in memory only. The SSE route schedules ticks and streams
 * snapshots to the browser.
 */
import { detectAnomalies, type Anomaly, type AnomalyDetectorConfig } from "@/lib/agents/anomaly-detector";
import { generateBrief, type Brief } from "@/lib/agents/brief-generator";
import { createOperationId, logEvent } from "@/lib/observability/logger";
import { GEMINI_MODEL } from "@/lib/gemini/config";

export interface OrchestratorState {
  lastTickAt: string;
  anomalies: Anomaly[];
  brief: Brief | null;
  tickCount: number;
  lastError: string | null;
}

type Listener = (state: OrchestratorState) => void;

export class Orchestrator {
  private state: OrchestratorState = {
    lastTickAt: new Date(0).toISOString(),
    anomalies: [],
    brief: null,
    tickCount: 0,
    lastError: null,
  };
  private listeners = new Set<Listener>();
  private activeTick: Promise<OrchestratorState> | null = null;
  private activeTickIncludesBrief = false;

  constructor(
    private readonly detectorConfig: Partial<AnomalyDetectorConfig> = {},
    private readonly briefExtraContext?: string
  ) {}

  /** Register a listener. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Read the current state (immutable copy). */
  latestState(): OrchestratorState {
    return { ...this.state, anomalies: [...this.state.anomalies] };
  }

  /**
   * Run a single tick.
   *
   * When `forceBrief` is false (default), only anomaly detection runs —
   * no Gemini call. Pass `forceBrief: true` from the "Run scan now"
   * button to generate an AI brief on demand.
   */
  async tick(
    opts: {
      forceBrief?: boolean;
      onProgress?: (msg: string) => void;
      scanId?: string;
    } = {}
  ): Promise<OrchestratorState> {
    if (this.activeTick) {
      if (opts.forceBrief && !this.activeTickIncludesBrief) {
        opts.onProgress?.("Waiting for the current market scan to finish…");
        logEvent("info", "scan.waiting_for_active", {
          scanId: opts.scanId,
          forceBrief: true,
        });
        await this.activeTick;
        return this.tick(opts);
      }

      opts.onProgress?.("A market scan is already running; reusing its result…");
      logEvent("info", "scan.reused", {
        scanId: opts.scanId,
        forceBrief: opts.forceBrief === true,
      });
      return this.activeTick;
    }

    this.activeTickIncludesBrief = opts.forceBrief === true;
    const activeTick = this.runTick(opts).finally(() => {
      if (this.activeTick === activeTick) {
        this.activeTick = null;
        this.activeTickIncludesBrief = false;
      }
    });
    this.activeTick = activeTick;
    return activeTick;
  }

  private async runTick(
    opts: {
      forceBrief?: boolean;
      onProgress?: (msg: string) => void;
      scanId?: string;
    }
  ): Promise<OrchestratorState> {
    const { forceBrief = false, onProgress } = opts;
    const scanId = opts.scanId ?? createOperationId("scan");
    const startedAt = Date.now();
    this.state.tickCount += 1;
    logEvent("info", "scan.started", {
      scanId,
      forceBrief,
      tickCount: this.state.tickCount,
    });
    try {
      onProgress?.("Scanning market for anomalies via MCP tools…");
      const anomalies = await detectAnomalies(this.detectorConfig);
      onProgress?.(`${anomalies.length > 0 ? `${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} detected` : "No anomalies"} — market scan complete`);
      logEvent("info", "scan.anomalies_detected", {
        scanId,
        anomaliesCount: anomalies.length,
        severities: anomalies.map((anomaly) => anomaly.severity),
      });
      let brief: Brief | null = this.state.brief;
      const hasNotable =
        anomalies.length > 0 &&
        anomalies.some((a) => a.severity !== "low");
      if (forceBrief && hasNotable) {
        brief = await generateBrief(
          {
            anomalies,
            ...(this.briefExtraContext ? { extraContext: this.briefExtraContext } : {}),
            scanId,
          },
          GEMINI_MODEL,
          onProgress
        );
      } else if (forceBrief && anomalies.length > 0) {
        brief = {
          generatedAt: new Date().toISOString(),
          model: "stub",
          headline: `${anomalies.length} minor move${anomalies.length === 1 ? "" : "s"} detected.`,
          body: "All anomalies are below medium severity. No brief generated.",
          actions: anomalies.map((a) => ({
            symbol: a.asset.symbol,
            severity: a.severity,
            action:
              "Monitor for confirmation, reversal, and changes in market-wide context.",
          })),
          toolCalls: [],
        };
      }
      this.state = {
        lastTickAt: new Date().toISOString(),
        anomalies,
        brief,
        tickCount: this.state.tickCount,
        lastError: null,
      };
      logEvent("info", "scan.completed", {
        scanId,
        anomaliesCount: anomalies.length,
        briefGenerated: forceBrief && hasNotable,
        briefModel: brief?.model ?? null,
        durationMs: Date.now() - startedAt,
      });
    } catch (e) {
      logEvent("error", "scan.failed", {
        scanId,
        forceBrief,
        durationMs: Date.now() - startedAt,
        error: e,
      });
      this.state = {
        ...this.state,
        lastError: e instanceof Error ? e.message : String(e),
        lastTickAt: new Date().toISOString(),
      };
    }
    this.emit();
    return this.latestState();
  }

  private emit(): void {
    const snapshot = this.latestState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener failures must not interrupt the orchestrator.
      }
    }
  }
}

/**
 * Singleton orchestrator for the API routes to share state.
 * Created lazily on first access.
 */
let _instance: Orchestrator | null = null;
export function getOrchestrator(): Orchestrator {
  if (!_instance) {
    _instance = new Orchestrator();
  }
  return _instance;
}
