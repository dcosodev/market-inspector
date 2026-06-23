"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Activity,
  BarChart3,
  Coins,
  Bot,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { callMcpTool } from "@/lib/api-client";
import type { TickerItem } from "@/components/dashboard/market-ticker";
import type {
  GlobalMarketRow,
  CoinPriceRow,
  DashboardOrchestratorState,
} from "@/lib/types/dashboard";
import { formatUsd, formatPercent, formatNumber } from "@/lib/utils/format";

type StockSource = "finnhub" | "alpha_vantage" | "yahoo";

interface StockQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  source?: StockSource;
}

const STOCK_SOURCE_LABEL: Record<StockSource, string> = {
  finnhub: "Finnhub",
  alpha_vantage: "Alpha Vantage",
  yahoo: "Yahoo",
};

const TECH_STOCKS = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "META", name: "Meta" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "AMZN", name: "Amazon" },
];

export function OverviewTab({
  streamState,
  hideBanner = false,
  analysisSlot,
  onTickerItemsChange,
}: {
  streamState: DashboardOrchestratorState | null;
  hideBanner?: boolean;
  analysisSlot?: React.ReactNode;
  onTickerItemsChange?: (items: TickerItem[]) => void;
}) {
  const [stocks, setStocks] = useState<(StockQuote | null)[]>(
    TECH_STOCKS.map(() => null)
  );
  const [global, setGlobal] = useState<GlobalMarketRow | null>(null);
  const [movers, setMovers] = useState<CoinPriceRow[] | null>(null);  // null = loading, [] = loaded but empty
  const [error, setError] = useState<{ message: string; degraded: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Load Big Tech stocks in parallel, then stagger one retry for transient provider limits.
    const stockLoaders = TECH_STOCKS.map(async (s, i) => {
      type QuoteResponse = {
        currentPrice: number;
        change: number;
        changePercent: number;
        highPrice: number;
        lowPrice: number;
        source?: StockSource;
      };

      let quote: QuoteResponse;
      try {
        quote = await callMcpTool<QuoteResponse>("stocks.fetch_quote", {
          symbol: s.symbol,
        });
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (i + 1)));
        quote = await callMcpTool<QuoteResponse>(
          "stocks.fetch_quote",
          { symbol: s.symbol },
          12_000
        );
      }

      if (cancelled) return;
      setStocks((prev) => {
        const next = [...prev];
        next[i] = {
          symbol: s.symbol,
          name: s.name,
          currentPrice: quote.currentPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          high: quote.highPrice,
          low: quote.lowPrice,
          source: quote.source,
        };
        return next;
      });
    });

    // Load crypto global + top movers independently so one failure doesn't block the other
    const globalLoader = callMcpTool<GlobalMarketRow>("crypto.fetch_global", {})
      .then((g) => { if (!cancelled) setGlobal(g); })
      .catch((e) => {
        if (!cancelled)
          setError({ message: e instanceof Error ? e.message : String(e), degraded: true });
      });

    const moversLoader = callMcpTool<CoinPriceRow[]>("crypto.fetch_top_movers", { limit: 10 })
      .then((m) => {
        if (!cancelled) {
          const arr = Array.isArray(m) ? m : Array.isArray((m as Record<string, unknown>).coins) ? (m as { coins: CoinPriceRow[] }).coins : [];
          setMovers(arr);
        }
      })
      .catch(() => {
        if (!cancelled) setMovers([]); // show empty instead of skeleton forever
      });

    void Promise.allSettled([...stockLoaders, globalLoader, moversLoader]);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!onTickerItemsChange) return;

    const stockItems: TickerItem[] = stocks.flatMap((quote) =>
      quote
        ? [{
            id: quote.symbol,
            symbol: quote.symbol,
            price: quote.currentPrice,
            change: quote.changePercent,
            type: "stock" as const,
          }]
        : []
    );
    const cryptoItems: TickerItem[] = (movers ?? []).slice(0, 6).map((coin) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      price: coin.currentPrice,
      change: coin.priceChangePercentage24h ?? 0,
      type: "crypto",
    }));

    onTickerItemsChange([...stockItems, ...cryptoItems]);
  }, [movers, onTickerItemsChange, stocks]);

  const marketUp = (global?.marketCapChangePercentage24h ?? 0) >= 0;

  // Reflect the provider(s) that actually served the loaded quotes rather
  // than hardcoding one. Finnhub is primary, with Alpha Vantage/Yahoo
  // fallbacks, so the label is only honest if derived from the responses.
  const stockSources = Array.from(
    new Set(stocks.flatMap((s) => (s?.source ? [s.source] : [])))
  );
  const stockSourceLabel =
    stockSources.length > 0
      ? `via ${stockSources.map((s) => STOCK_SOURCE_LABEL[s]).join(", ")}`
      : "Live quotes";
  const anomalyCount = streamState?.anomalies.length ?? 0;
  const lastScan = streamState?.lastTickAt ?? null;

  return (
    <div className="space-y-6">

      {/* AI Agent Status banner */}
      {!hideBanner && <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-semibold">AI Agent System</span>
            <span className="flex items-center gap-1 rounded-full border border-chart-2/30 bg-chart-2/10 px-2 py-0.5 text-[10px] font-medium text-chart-2">
              <span className="size-1.5 animate-pulse rounded-full bg-chart-2" />
              Live
            </span>
          </div>
          {anomalyCount > 0 && (
            <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">
              <Zap className="h-3 w-3" />
              <span className="hidden sm:inline">Go to AI Brief →</span>
              <span className="sm:hidden">Brief →</span>
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md bg-background/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Agents</p>
            <p className="mt-0.5 text-sm font-bold">3 active</p>
          </div>
          <div className="rounded-md bg-background/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">MCP Tools</p>
            <p className="mt-0.5 text-sm font-bold">11 tools</p>
          </div>
          <div className="rounded-md bg-background/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Anomalies</p>
            <p className={`mt-0.5 text-sm font-bold ${anomalyCount > 0 ? "text-amber-400" : ""}`}>
              {anomalyCount > 0 ? `${anomalyCount} detected` : "None"}
            </p>
          </div>
          <div className="rounded-md bg-background/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last scan</p>
            <p className="mt-0.5 text-sm font-bold">{lastScan ? relativeTime(lastScan) : "—"}</p>
          </div>
        </div>
      </div>}

      {/* Big Tech Watchlist — hero */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Big Tech — Live Quotes
          </h2>
          <Badge variant="secondary" className="text-[10px]">{stockSourceLabel}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {TECH_STOCKS.map((s, i) => (
            <StockCard key={s.symbol} quote={stocks[i] ?? null} fallback={s} />
          ))}
        </div>
      </div>

      {error && (
        <Alert variant={error.degraded ? "default" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{error.degraded ? "Partial data" : "Error"}</AlertTitle>
          <AlertDescription className="text-xs font-mono">{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Crypto global stats */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Crypto Market Overview
        </h2>
        {global && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/50 bg-card px-4 py-2.5">
            {marketUp ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-chart-2" />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <p className="text-sm">
              Global crypto market cap{" "}
              <span className={marketUp ? "font-semibold text-chart-2" : "font-semibold text-destructive"}>
                {marketUp ? "up" : "down"}{" "}
                {formatPercent(Math.abs(global.marketCapChangePercentage24h ?? 0))}
              </span>{" "}
              in 24 h · {formatNumber(global.activeCryptocurrencies)} active assets
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            icon={<Globe className="h-4 w-4" />}
            label="Total Market Cap"
            value={global ? formatUsd(global.totalMarketCapUsd, { compact: true }) : null}
            sub={global ? formatPercent(global.marketCapChangePercentage24h ?? 0) + " 24h" : undefined}
            tone={global ? ((global.marketCapChangePercentage24h ?? 0) >= 0 ? "up" : "down") : undefined}
          />
          <MetricCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="24h Volume"
            value={global ? formatUsd(global.totalVolumeUsd, { compact: true }) : null}
            sub="Across all exchanges"
          />
          <MetricCard
            icon={<Coins className="h-4 w-4" />}
            label="Active Assets"
            value={global ? formatNumber(global.activeCryptocurrencies) : null}
            sub={global ? `${global.markets ?? "—"} markets` : undefined}
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="BTC Dominance"
            value={global ? `${(global.marketCapPercentageBtc ?? 0).toFixed(1)}%` : null}
            sub={global ? `ETH ${(global.marketCapPercentageEth ?? 0).toFixed(1)}%` : undefined}
          />
        </div>
      </div>

      {analysisSlot}

      {/* Charts row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Market Dominance</CardTitle>
          </CardHeader>
          <CardContent>
            {global === null ? (
              <Skeleton className="mx-auto h-40 w-40 rounded-full" />
            ) : (
              <DominanceChart btc={global.marketCapPercentageBtc ?? 0} eth={global.marketCapPercentageEth ?? 0} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">24h Price Change — Top 10</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            {!Array.isArray(movers) ? (
              <div className="space-y-2 px-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : (
              <MoversBarChart movers={movers} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top 10 crypto table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm">Top 10 Crypto by Market Cap</CardTitle>
            {global && (
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(global.lastUpdated * 1000).toLocaleTimeString()}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!Array.isArray(movers) ? (
            <div className="space-y-0 px-4 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="ml-auto h-4 w-16" />
                  <Skeleton className="h-6 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              {movers.map((m, idx) => (
                <div key={m.id}>
                  <div className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/30 sm:px-6 sm:py-3">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground">{idx + 1}</span>
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold sm:text-sm">{m.symbol}</span>
                        <span className="ml-1.5 hidden text-xs text-muted-foreground sm:inline">{m.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">
                      <span className="font-mono text-xs font-medium sm:text-sm">{formatUsd(m.currentPrice)}</span>
                      <span
                        className={`w-16 text-right font-mono text-xs font-semibold sm:w-20 ${
                          m.priceChangePercentage24h >= 0 ? "text-chart-2" : "text-destructive"
                        }`}
                      >
                        {formatPercent(m.priceChangePercentage24h)}
                      </span>
                    </div>
                  </div>
                  {idx < movers.length - 1 && <Separator className="opacity-30" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  return `${Math.floor(diffM / 60)}h ago`;
}

function StockCard({
  quote,
  fallback,
}: {
  quote: StockQuote | null;
  fallback: { symbol: string; name: string };
}) {
  const up = (quote?.changePercent ?? 0) >= 0;
  const range =
    quote && quote.high > quote.low
      ? Math.min(
          100,
          Math.max(0, ((quote.currentPrice - quote.low) / (quote.high - quote.low)) * 100)
        )
      : 50;

  return (
    <Card
      className={`group relative min-w-0 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        quote
          ? up
            ? "border-chart-2/20 bg-gradient-to-br from-chart-2/10 via-card to-card hover:border-chart-2/40"
            : "border-destructive/20 bg-gradient-to-br from-destructive/10 via-card to-card hover:border-destructive/40"
          : "border-border/50"
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${
          quote ? (up ? "bg-chart-2" : "bg-destructive") : "bg-muted"
        }`}
      />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold tracking-tight">{fallback.symbol}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{fallback.name}</p>
          </div>
          {quote && (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                up
                  ? "border-chart-2/25 bg-chart-2/10 text-chart-2"
                  : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
            >
              {up ? "+" : ""}{quote.changePercent.toFixed(2)}%
            </span>
          )}
        </div>

        {quote === null ? (
          <div className="mt-5 space-y-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-2">
              <p className="font-mono text-xl font-bold leading-none">
                ${quote.currentPrice.toFixed(2)}
              </p>
              <p className={`font-mono text-[10px] ${up ? "text-chart-2" : "text-destructive"}`}>
                {up ? "+" : ""}${quote.change.toFixed(2)}
              </p>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>${quote.low.toFixed(0)}</span>
                <span>Day range</span>
                <span>${quote.high.toFixed(0)}</span>
              </div>
              <div className="relative h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    up ? "bg-chart-2" : "bg-destructive"
                  }`}
                  style={{ width: `${range}%` }}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const DONUT_COLORS = [
  "oklch(0.62 0.21 259)",
  "oklch(0.72 0.17 142)",
  "oklch(0.55 0.02 260)",
];

function DominanceChart({ btc, eth }: { btc: number; eth: number }) {
  const other = Math.max(0, 100 - btc - eth);
  const data = [
    { name: "BTC", value: parseFloat(btc.toFixed(1)) },
    { name: "ETH", value: parseFloat(eth.toFixed(1)) },
    { name: "Others", value: parseFloat(other.toFixed(1)) },
  ];
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="w-full max-w-[160px] shrink-0">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "oklch(0.18 0.02 260)", border: "1px solid oklch(0.28 0.02 260)", borderRadius: "6px", fontSize: "11px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex w-full flex-row justify-center gap-4 sm:flex-col sm:gap-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
            <span className="size-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i] }} />
            <span className="text-[10px] text-muted-foreground sm:text-xs sm:w-12">{d.name}</span>
            <span className="font-mono text-xs font-bold sm:font-semibold">{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoversBarChart({ movers }: { movers: CoinPriceRow[] }) {
  const safe = Array.isArray(movers) ? movers : [];
  const data = safe.slice(0, 8).map((m) => ({
    symbol: m.symbol,
    change: parseFloat((m.priceChangePercentage24h ?? 0).toFixed(2)),
  }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="oklch(0.28 0.02 260)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "oklch(0.6 0.02 260)" }}
          tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="symbol" tick={{ fontSize: 10, fill: "oklch(0.6 0.02 260)" }} width={36} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "oklch(0.18 0.02 260)", border: "1px solid oklch(0.28 0.02 260)", borderRadius: "6px", fontSize: "11px" }}
          formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`, "24h"] as [string, string]}
        />
        <Bar dataKey="change" radius={[0, 3, 3, 0]} maxBarSize={14}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.change >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.58 0.22 25)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="px-4 pb-4 pt-4">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <p className="text-[10px] font-medium uppercase tracking-wide">{label}</p>
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p className="mt-1.5 font-mono text-xl font-bold leading-none sm:text-2xl">{value}</p>
        )}
        {sub && (
          <p className={`mt-1 font-mono text-[10px] sm:text-xs ${tone === "up" ? "text-chart-2" : tone === "down" ? "text-destructive" : "text-muted-foreground"}`}>
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
