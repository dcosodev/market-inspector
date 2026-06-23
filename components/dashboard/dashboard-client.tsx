"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Bot,
  Sparkles,
  TrendingUp,
  RefreshCw,
  ChevronLeft,
  BarChart3,
  Layers3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MarketTicker,
  type TickerItem,
} from "@/components/dashboard/market-ticker";
import { OverviewTab } from "@/components/dashboard/tabs/overview-tab";
import { ForexTab } from "@/components/dashboard/tabs/forex-tab";
import { AgentsTab } from "@/components/dashboard/tabs/agents-tab";
import {
  BriefTab,
  type ConnectionStatus,
} from "@/components/dashboard/tabs/brief-tab";
import type { DashboardOrchestratorState } from "@/lib/types/dashboard";

export function DashboardClient() {
  const [now, setNow] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const [streamState, setStreamState] =
    useState<DashboardOrchestratorState | null>(null);
  const [streamStatus, setStreamStatus] =
    useState<ConnectionStatus>("connecting");
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current.toLocaleTimeString());
      setNowMs(current.getTime());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const stream = new EventSource("/api/stream");
    stream.addEventListener("state", (event) => {
      try {
        const incoming = JSON.parse(
          (event as MessageEvent).data
        ) as DashboardOrchestratorState;
        setStreamState((current) => ({
          ...incoming,
          // Vercel may reconnect the SSE request on a fresh function instance.
          // Preserve the last generated brief until a newer one arrives.
          brief: incoming.brief ?? current?.brief ?? null,
        }));
        setLastRefreshAt(Date.now());
        setStreamStatus("live");
      } catch {
        setStreamStatus("error");
      }
    });
    stream.onerror = () => setStreamStatus("error");
    return () => {
      stream.close();
      setStreamStatus("closed");
    };
  }, []);

  const secondsSinceRefresh =
    lastRefreshAt === null
      ? null
      : Math.max(0, Math.floor((nowMs - lastRefreshAt) / 1000));

  const handleTickerItemsChange = useCallback((items: TickerItem[]) => {
    setTickerItems(items);
  }, []);

  const handleScanStateChange = useCallback((state: DashboardOrchestratorState) => {
    setStreamState(state);
    setLastRefreshAt(Date.now());
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href="/"
                className="flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Back to home"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary">
                  <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" aria-hidden="true" />
                </div>
                <span className="font-bold tracking-tight">Market Inspector</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConnectionBadge status={streamStatus} />
              <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                <span role="status">
                  {secondsSinceRefresh === null ? "—" : `${secondsSinceRefresh}s ago`}
                </span>
              </div>
              <span
                className="hidden font-mono text-xs text-muted-foreground lg:block"
                role="status"
                aria-label={`Current time ${now}`}
              >
                {now}
              </span>
            </div>
          </div>
        </div>
      </header>

      <MarketTicker items={tickerItems} />

      <div className="container mx-auto max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <Tabs defaultValue="market" className="w-full">
          <TabsList className="mb-8 grid h-11 w-full grid-cols-2 sm:w-[420px]">
            <TabsTrigger value="market" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Market Dashboard
            </TabsTrigger>
            <TabsTrigger value="architecture" className="gap-2">
              <Layers3 className="h-4 w-4" />
              Agents & MCP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-0">
            <div className="space-y-14">
              <section id="market">
                <SectionHeader
                  icon={<BarChart3 className="h-4 w-4 text-chart-2" />}
                  title="Current Market Data"
                  badge="11 MCP tools"
                />
                <OverviewTab
                  streamState={streamState}
                  hideBanner
                  onTickerItemsChange={handleTickerItemsChange}
                  analysisSlot={
                    <section
                      id="ai"
                      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-violet-500/5 p-4 shadow-sm sm:p-6"
                    >
                      <div className="mb-5 flex flex-col gap-2 border-b border-primary/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-sm font-semibold">AI Market Intelligence</h2>
                            <p className="text-xs text-muted-foreground">
                              Gemini analyzes the current market snapshot and streams execution progress.
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="w-fit border-primary/30 text-primary">
                          Gemini 3.5 Flash
                        </Badge>
                      </div>
                      <BriefTab
                        state={streamState}
                        status={streamStatus}
                        hideInfoCard
                        onStateChange={handleScanStateChange}
                      />
                    </section>
                  }
                />
              </section>

              <section id="forex">
                <SectionHeader
                  icon={<ArrowLeftRight className="h-4 w-4 text-amber-400" />}
                  title="Forex Rates"
                  badge="ECB Frankfurter"
                />
                <ForexTab />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="architecture" className="mt-0">
            <AgentsTab />
          </TabsContent>
        </Tabs>
      </div>

      <footer className="border-t border-border/50 py-3 text-center text-xs text-muted-foreground">
        Market Inspector · 11 MCP tools · 3 coordinated roles · Gemini 3.5 Flash
        <span className="mx-2 text-border">·</span>
        <Link href="/" className="hover:text-foreground transition-colors">
          <Bot className="inline h-3 w-3 mr-1" />
          How it works
        </Link>
      </footer>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3 border-b border-border/40 pb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      </div>
      {badge && (
        <Badge variant="secondary" className="text-[10px]">
          {badge}
        </Badge>
      )}
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "live") {
    return (
      <Badge className="gap-1.5 bg-chart-2/15 text-chart-2 border-chart-2/30 hover:bg-chart-2/20">
        <span className="size-1.5 animate-pulse rounded-full bg-chart-2" />
        Live
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <span className="size-1.5 rounded-full bg-current" />
        Reconnecting
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
      Connecting
    </Badge>
  );
}
