"use client";

import {
  Bot,
  Cpu,
  Sparkles,
  ArrowRight,
  Database,
  Layers,
  Zap,
  TrendingUp,
  BarChart3,
  ArrowLeftRight,
  Globe,
  Bitcoin,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const AGENTS = [
  {
    icon: Activity,
    name: "Anomaly Detector",
    role: "Data Scanner",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    description:
      "Polls the top 30 crypto assets through the CoinGecko/CoinPaprika source adapters every 60 s. Classifies any move > 2% in 24 h by severity and emits structured anomaly events.",
    tools: ["fetchTopMovers", "fetchCoinCapTopMovers"],
    sources: ["CoinGecko → CoinPaprika fallback"],
  },
  {
    icon: Cpu,
    name: "Orchestrator",
    role: "Coordinator",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    description:
      "Serializes detection runs, holds in-memory state, broadcasts updates through Server-Sent Events, and delegates brief generation when analysis is requested.",
    tools: ["detectAnomalies", "generateBrief", "subscribe / emit"],
    sources: ["Internal — coordinates the other agents"],
  },
  {
    icon: Sparkles,
    name: "Brief Generator",
    role: "Gemini Analyst",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
    description:
      "Gemini 3.5 Flash receives the anomaly list and a seven-result market snapshot. It can request additional context through eight selected MCP tools before producing a grounded informational brief.",
    tools: [
      "crypto.fetch_price",
      "crypto.fetch_top_movers",
      "crypto.fetch_historical",
      "crypto.fetch_global",
      "stocks.fetch_quote",
      "stocks.fetch_candles",
      "forex.fetch_rate",
      "forex.fetch_historical",
    ],
    sources: ["Google Gemini 3.5 Flash with MCP function calling"],
  },
];

const MCP_TOOLS = [
  {
    category: "Crypto",
    icon: Bitcoin,
    color: "text-amber-400",
    tools: [
      { name: "crypto.fetch_price", desc: "Current USD price + 24 h stats for any coin. Fallback: Binance." },
      { name: "crypto.fetch_top_movers", desc: "Top N coins by market cap with 24 h change. Fallback: CoinPaprika." },
      { name: "crypto.fetch_historical", desc: "Historical daily price series (1–365 days) for a coin." },
      { name: "crypto.fetch_global", desc: "Global snapshot: total market cap, BTC/ETH dominance, active assets. Fallback: CoinPaprika." },
    ],
  },
  {
    category: "Stocks",
    icon: TrendingUp,
    color: "text-chart-2",
    tools: [
      { name: "stocks.fetch_quote", desc: "Current OHLC quote for a US stock. Fallback chain: Finnhub → Alpha Vantage → Yahoo Finance." },
      { name: "stocks.search_symbol", desc: "Search Finnhub for US stock symbols by ticker or company name." },
      { name: "stocks.fetch_candles", desc: "Daily OHLCV candles for a stock over the last N days." },
    ],
  },
  {
    category: "Forex",
    icon: ArrowLeftRight,
    color: "text-blue-400",
    tools: [
      { name: "forex.fetch_rate", desc: "ECB reference rate for any currency pair via Frankfurter API." },
      { name: "forex.fetch_historical", desc: "Historical exchange rates for a pair over a date range." },
      { name: "forex.fetch_currencies", desc: "List of all supported currency codes." },
    ],
  },
];

const DATA_SOURCES = [
  { name: "CoinGecko", desc: "Primary crypto data (5 req/min local limiter + 60 s cache)", role: "crypto" },
  { name: "CoinPaprika", desc: "Fallback for global/top-movers when CoinGecko is rate-limited", role: "crypto" },
  { name: "Binance", desc: "Fallback for individual coin prices (local limiter 20/min, no key)", role: "crypto" },
  { name: "Finnhub", desc: "Primary stock quotes (API key required)", role: "stocks" },
  { name: "Alpha Vantage", desc: "Secondary stock data fallback (local cap: 5 calls/day)", role: "stocks" },
  { name: "Yahoo Finance", desc: "Last-resort stock fallback (query1 → query2 endpoints)", role: "stocks" },
  { name: "Frankfurter / ECB", desc: "Latest available ECB reference rates, no key required", role: "forex" },
  { name: "Google Gemini 3.5 Flash", desc: "LLM for brief generation — called only on user request", role: "ai" },
];

const SOURCE_COLORS: Record<string, string> = {
  crypto: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  stocks: "border-chart-2/30 bg-chart-2/10 text-chart-2",
  forex: "border-blue-400/30 bg-blue-400/10 text-blue-400",
  ai: "border-violet-400/30 bg-violet-400/10 text-violet-400",
};

export function AgentsTab() {
  return (
    <div className="space-y-8">

      {/* Pipeline hero */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>Agent Architecture</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Market Inspector uses three coordinated roles for detection, state management,
            and analysis. Gemini is used only by the Brief Generator; the detector and
            orchestrator are deterministic TypeScript components.
          </p>
        </CardHeader>
        <CardContent>
          {/* Flow diagram */}
          {/* Pipeline diagrams — stacked, scrollable on mobile */}
          <div className="space-y-4">
            {/* Auto-tick */}
            <div className="rounded-lg border border-border/50 bg-background/60 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Auto-tick · every 60 s · no AI cost
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <FlowNode icon={<Database className="h-3.5 w-3.5" />} label="Data" sub="7 feeds" color="text-muted-foreground" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Layers className="h-3.5 w-3.5" />} label="Sources" sub="fallbacks" color="text-primary" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Activity className="h-3.5 w-3.5" />} label="Detector" sub="TypeScript" color="text-amber-400" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Zap className="h-3.5 w-3.5" />} label="SSE" sub="60 s" color="text-chart-2" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Globe className="h-3.5 w-3.5" />} label="UI" sub="Live" color="text-blue-400" />
              </div>
            </div>
            {/* Agentic loop */}
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
                AI analysis loop · on request · optional MCP tool calls
              </p>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <FlowNode icon={<Bot className="h-3.5 w-3.5" />} label="Anomalies" sub="detected" color="text-amber-400" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Sparkles className="h-3.5 w-3.5" />} label="Gemini" sub="analyzes" color="text-violet-400" />
                <div className="flex shrink-0 flex-col items-center gap-0.5 px-0.5">
                  <ArrowRight className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[8px] text-violet-400 whitespace-nowrap">↔ tools</span>
                </div>
                <FlowNode icon={<Layers className="h-3.5 w-3.5" />} label="MCP" sub="8 tools" color="text-primary" />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <FlowNode icon={<Globe className="h-3.5 w-3.5" />} label="Brief" sub="+ tool log" color="text-blue-400" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          3 Coordinated Roles
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            return (
              <Card key={agent.name} className={`border ${agent.bg}`}>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 shrink-0 ${agent.color}`} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight text-sm">{agent.name}</p>
                      <p className={`truncate text-[10px] ${agent.color}`}>{agent.role}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{agent.description}</p>
                  <Separator className="opacity-30" />
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                      Tools / Functions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {agent.tools.slice(0, 4).map((t) => (
                        <span key={t} className="font-mono text-[10px] text-foreground/70 bg-background/50 rounded px-1 py-0.5 border border-border/30">
                          {t}
                        </span>
                      ))}
                      {agent.tools.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">+{agent.tools.length - 4} more</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                      Source
                    </p>
                    {agent.sources.map((s) => (
                      <p key={s} className="text-[10px] text-muted-foreground">{s}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* MCP Tools catalog */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          10 Market Data Tools
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {MCP_TOOLS.map((cat) => {
            const Icon = cat.icon;
            return (
              <Card key={cat.category}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                    <CardTitle className="text-sm">{cat.category}</CardTitle>
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      {cat.tools.length} tools
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cat.tools.map((tool, i) => (
                    <div key={tool.name}>
                      {i > 0 && <Separator className="mb-3 opacity-30" />}
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {tool.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tool.desc}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Data Sources */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Data Sources & Fallback Chains
        </h3>
        <Card>
          <CardContent className="pt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {DATA_SOURCES.map((src) => (
                <div
                  key={src.name}
                  className="flex items-start gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-2"
                >
                  <Badge
                    variant="outline"
                    className={`mt-0.5 shrink-0 text-[9px] uppercase ${SOURCE_COLORS[src.role] ?? ""}`}
                  >
                    {src.role}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{src.name}</p>
                    <p className="text-[11px] text-muted-foreground">{src.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kaggle context */}
      <Card className="border-dashed border-border/50 bg-muted/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Kaggle AI Agents Capstone</p>
              <p>
                Built for the &ldquo;Agents for Business&rdquo; track. The project demonstrates
                a tool-augmented analysis workflow using the Model Context Protocol (MCP).
                Deterministic components monitor the market and coordinate state, while Gemini
                converts crypto, equity, and foreign-exchange context into a grounded,
                informational brief with neutral monitoring priorities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FlowNode({
  icon,
  label,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 rounded-md border border-border/50 bg-card px-3 py-2 text-center">
      <span className={color}>{icon}</span>
      <p className="text-[10px] font-semibold leading-tight whitespace-nowrap">{label}</p>
      <p className="text-[9px] text-muted-foreground whitespace-nowrap">{sub}</p>
    </div>
  );
}
