"use client";

import { useState, useEffect } from "react";
import { LoaderCircle, Sparkles, AlertTriangle, Zap, Eye, Wrench, Info, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { runTick } from "@/lib/api-client";
import { formatPercent, relativeTime } from "@/lib/utils/format";
import type {
  DashboardBrief,
  DashboardOrchestratorState,
} from "@/lib/types/dashboard";

export type ConnectionStatus = "connecting" | "live" | "error" | "closed";

// ---------------------------------------------------------------------------
// Quota helpers — stored in localStorage, reset at midnight
// ---------------------------------------------------------------------------
const QUOTA_KEY = "market-inspector:scan-quota:v2";
const MAX_SCANS = 4;
const MAX_CALLS_PER_SCAN = 5;

interface QuotaEntry { date: string; used: number }

function getQuota(): QuotaEntry {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (!raw) return { date: new Date().toDateString(), used: 0 };
    const entry = JSON.parse(raw) as QuotaEntry;
    if (entry.date !== new Date().toDateString()) return { date: new Date().toDateString(), used: 0 };
    return entry;
  } catch { return { date: new Date().toDateString(), used: 0 }; }
}

function consumeQuota(currentRemaining: number): number {
  const q = getQuota();
  try {
    localStorage.setItem(
      QUOTA_KEY,
      JSON.stringify({ date: q.date, used: q.used + 1 })
    );
    return remaining();
  } catch {
    return Math.max(0, currentRemaining - 1);
  }
}

function remaining(): number {
  return Math.max(0, MAX_SCANS - getQuota().used);
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------
const SEVERITY_DOT: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  extreme: "bg-destructive",
};

const SEVERITY_BADGE: Record<string, string> = {
  low: "border-border text-muted-foreground",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  extreme: "border-destructive/30 bg-destructive/10 text-destructive",
};

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------
export function BriefTab({
  state,
  status,
  onStateChange,
  hideInfoCard = false,
}: {
  state: DashboardOrchestratorState | null;
  status: ConnectionStatus;
  onStateChange: (state: DashboardOrchestratorState) => void;
  hideInfoCard?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [scansLeft, setScansLeft] = useState(MAX_SCANS);
  const [steps, setSteps] = useState<{ msg: string; done: boolean }[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  // Read quota from localStorage after hydration
  useEffect(() => {
    const timeout = window.setTimeout(() => setScansLeft(remaining()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Live elapsed timer while running
  useEffect(() => {
    if (!running || startedAt === null) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [running, startedAt]);

  async function handleRunNow() {
    if (scansLeft <= 0) return;
    setRunning(true);
    setRunError(null);
    setSteps([]);
    setElapsed(null);
    const t0 = Date.now();
    setStartedAt(t0);
    try {
      setScansLeft(consumeQuota(scansLeft));
      const finalState = await runTick((msg) => {
        setSteps((prev) => {
          const next = prev.map((s, i) =>
            i === prev.length - 1 ? { msg: s.msg, done: true } : s
          );
          return [...next, { msg, done: false }];
        });
      });
      setSteps((prev) => prev.map((s) => ({ msg: s.msg, done: true })));
      setElapsed(Math.floor((Date.now() - t0) / 1000));
      onStateChange(finalState);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
      setSteps((prev) => prev.map((s) => ({ msg: s.msg, done: true })));
    } finally {
      setRunning(false);
    }
  }

  const canRun = scansLeft > 0 && !running;

  return (
    <div className="space-y-6">

      {/* How it works explanation */}
      {!hideInfoCard && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">How AI Brief works</p>
                <p>
                  When you press <span className="font-mono text-foreground">Run AI Scan</span>, a{" "}
                  <span className="text-primary font-medium">Gemini 3.5 Flash agent</span> is invoked.
                  It receives the detected anomalies and a preloaded market snapshot. When
                  additional context is required, it can request{" "}
                  <span className="text-primary font-medium">MCP tools</span> for price history,
                  global market data, stock quotes, or exchange rates before producing a
                  structured informational brief.
                </p>
                <p className="text-[11px]">
                  Each scan uses 1–{MAX_CALLS_PER_SCAN} Gemini API requests depending on
                  tool-call rounds. Daily demo budget: {MAX_SCANS} scans (20 calls maximum) ·
                  resets at midnight.
                </p>
                <p className="text-[11px] text-amber-500">
                  Informational analysis only — not personalized financial advice.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {state && (
              <span className="hidden text-xs text-muted-foreground sm:inline" role="status">
                {relativeTime(state.lastTickAt)} · {state.tickCount} ticks
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-2.5 py-1">
            <Zap className={`h-3 w-3 ${scansLeft <= 2 ? "text-amber-400" : "text-muted-foreground"}`} />
            <span className={`font-mono text-xs font-bold ${
              scansLeft === 0 ? "text-destructive" : scansLeft <= 2 ? "text-amber-400" : "text-foreground"
            }`}>{scansLeft}</span>
            <span className="text-xs text-muted-foreground">/ {MAX_SCANS} today</span>
          </div>
        </div>
        <Button
          onClick={handleRunNow}
          disabled={!canRun}
          className="w-full gap-2"
        >
          {running ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {running ? "Gemini analysing…" : scansLeft === 0 ? "Daily quota reached" : "Run AI Scan"}
          {!running && scansLeft > 0 && (
            <span className="ml-auto text-xs opacity-60">
              1–{MAX_CALLS_PER_SCAN} API calls
            </span>
          )}
        </Button>
      </div>

      {/* Execution progress log */}
      {(running || steps.length > 0) && (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Agent activity log
            </p>
            {running ? (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
                {elapsed !== null ? `${elapsed}s` : "starting…"}
              </span>
            ) : elapsed !== null ? (
              <span className="text-[10px] text-chart-2">Done in {elapsed}s</span>
            ) : null}
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-chart-2" />
                ) : (
                  <LoaderCircle className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" />
                )}
                <span className="font-mono text-[11px] leading-tight text-muted-foreground">{step.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {scansLeft === 0 && !running && steps.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Daily quota reached</AlertTitle>
          <AlertDescription className="text-xs">
            {MAX_SCANS} scans used today (up to {MAX_SCANS * MAX_CALLS_PER_SCAN} Gemini API calls).
            Quota resets at midnight. The anomaly detector continues running automatically every 60 s.
          </AlertDescription>
        </Alert>
      )}

      {(runError ?? state?.lastError) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scan error</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {runError ?? state?.lastError}
          </AlertDescription>
        </Alert>
      )}

      {/* AI Brief */}
      <BriefCard brief={state?.brief ?? null} />

      {/* Anomalies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              Live Anomalies
              {state && (
                <Badge variant="secondary" className="ml-2 font-mono text-xs">
                  {state.anomalies.length}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {state === null ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : state.anomalies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Eye className="h-8 w-8 opacity-30" />
              <p className="text-sm">No anomalies detected in the latest scan.</p>
              <p className="text-xs">Markets appear to be within normal ranges.</p>
            </div>
          ) : (
            <ScrollArea className="h-72">
              <div className="space-y-0 pr-4">
                {state.anomalies.map((anomaly, index) => (
                  <div key={anomaly.id}>
                    {index > 0 && <Separator className="opacity-40" />}
                    <div className="flex items-center gap-3 py-3">
                      <span
                        className={`size-2 shrink-0 rounded-full ${SEVERITY_DOT[anomaly.severity] ?? "bg-muted-foreground"}`}
                        title={anomaly.severity}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {anomaly.asset.name}{" "}
                          <span className="font-mono text-xs text-muted-foreground">{anomaly.asset.symbol}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{anomaly.summary}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`font-mono text-xs ${SEVERITY_BADGE[anomaly.severity] ?? ""}`}
                        >
                          {formatPercent(anomaly.value)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">{anomaly.severity}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brief card
// ---------------------------------------------------------------------------
function BriefCard({ brief }: { brief: DashboardBrief | null }) {
  if (brief === null) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">AI Market Brief</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Press <span className="font-mono">Run AI Scan</span> to analyze the current
            market snapshot. Gemini can request additional data through MCP tools before
            producing the informational brief.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </CardContent>
      </Card>
    );
  }

  const isStub = brief.model === "stub";

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <CardTitle className="text-sm">AI Market Brief</CardTitle>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
              {isStub ? "Auto-detected" : "Gemini 3.5 Flash"}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground">
              {relativeTime(brief.generatedAt)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Headline */}
        <p className="text-balance text-xl font-extrabold uppercase leading-tight tracking-wide text-foreground sm:text-2xl">
          {brief.headline}
        </p>

        {/* Body — highlight numbers inline */}
        <div className="space-y-2">
          {brief.body.split("\n").filter(Boolean).map((para, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              <HighlightNumbers text={para} />
            </p>
          ))}
        </div>

        {/* Outlook */}
        {brief.outlook && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              24–48h Outlook
            </p>
            <p className="text-sm text-muted-foreground">{brief.outlook}</p>
          </div>
        )}

        {/* Actions */}
        {brief.actions.length > 0 && (
          <>
            <Separator className="opacity-40" />
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Monitoring Priorities
              </p>
              <div className="space-y-2">
                {brief.actions.map((action) => (
                  <div key={action.symbol} className="flex items-start gap-3 rounded-md border border-border/40 bg-background/50 px-3 py-2.5">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${SEVERITY_DOT[action.severity] ?? "bg-muted-foreground"}`} />
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-bold text-foreground">{action.symbol}</span>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{action.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Informational analysis only. This brief is not personalized financial advice
          and may contain incomplete or delayed market data.
        </p>

        {/* MCP tools log */}
        {brief.toolCalls && brief.toolCalls.length > 0 && (
          <>
            <Separator className="opacity-40" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  MCP Tools called by Gemini
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brief.toolCalls.map((call, i) => (
                  <span key={i} className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
                    {call}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Wraps numbers/percentages/dollar amounts in a highlighted span */
function HighlightNumbers({ text }: { text: string }) {
  const parts = text.split(/(\$[\d,.]+[BMTKbmtk]?|[-+]?\d+\.?\d*%|\$[\d,.]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /(\$[\d,.]+|[-+]?\d+\.?\d*%)/.test(part) ? (
          <span key={i} className="font-mono font-semibold text-foreground">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "live") {
    return (
      <Badge variant="outline" className="gap-1.5 border-chart-2/30 bg-chart-2/10 text-chart-2" role="status">
        <span className="size-1.5 animate-pulse rounded-full bg-chart-2" />
        Live
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5" role="status">
        <LoaderCircle className="h-3 w-3 animate-spin" />
        Reconnecting
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1.5" role="status">
      <LoaderCircle className="h-3 w-3 animate-spin" />
      Connecting
    </Badge>
  );
}
