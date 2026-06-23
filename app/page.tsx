import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Cpu,
  Database,
  Globe,
  LineChart,
  Sparkles,
  TrendingUp,
  Zap,
  GitBranch,
  Layers,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-chart-2/5 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-80 w-80 -translate-y-1/2 rounded-full bg-chart-5/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
          </div>
          <span className="font-bold tracking-tight">Market Inspector</span>
        </div>
        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
          Kaggle AI Agents Capstone
        </Badge>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <Badge
          variant="outline"
          className="gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-primary"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Gemini 3.5 Flash · MCP · Server-Sent Events
        </Badge>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Market Intelligence
            <br />
            <span className="text-primary">Grounded Analysis</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Three coordinated roles combine continuous crypto anomaly detection
            with current equity data, global crypto metrics, and ECB reference
            rates to generate grounded informational briefs.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
        >
          <Activity className="h-4 w-4" />
          Open Market Dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Agent Architecture */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16">
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">Three-Role Architecture</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Detection, coordination, and Gemini-assisted analysis remain separate responsibilities.
          </p>
        </div>

        {/* Agent flow diagram */}
        <div className="mb-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <AgentCard
            icon={<Database className="h-5 w-5 text-chart-2" />}
            name="Anomaly Detector"
            role="Scans top 30 crypto assets every 60 s through the source adapters. Flags moves above threshold as anomalies."
            color="chart-2"
          />
          <div className="hidden text-muted-foreground sm:block">→</div>
          <AgentCard
            icon={<GitBranch className="h-5 w-5 text-primary" />}
            name="Orchestrator"
            role="Coordinates agents. Manages tick schedule, state, and SSE broadcast to all connected clients."
            color="primary"
          />
          <div className="hidden text-muted-foreground sm:block">→</div>
          <AgentCard
            icon={<Bot className="h-5 w-5 text-amber-400" />}
            name="Brief Generator"
            role="Receives a preloaded market snapshot and can request additional context through eight selected MCP tools."
            color="amber-400"
          />
        </div>

        {/* MCP Tools grid */}
        <div className="mb-8 rounded-xl border border-border/50 bg-card/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">10 Market Tools + system.ping</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ToolGroup
              label="Crypto (4)"
              tools={["crypto.fetch_price", "crypto.fetch_global", "crypto.fetch_top_movers", "crypto.fetch_historical"]}
              color="amber"
            />
            <ToolGroup
              label="Stocks (3)"
              tools={["stocks.fetch_quote", "stocks.search_symbol", "stocks.fetch_candles"]}
              color="blue"
            />
            <ToolGroup
              label="Forex (3)"
              tools={["forex.fetch_rate", "forex.fetch_historical", "forex.fetch_currencies"]}
              color="green"
            />
          </div>
        </div>

        {/* Tech stack */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TechCard
            icon={<Cpu className="h-5 w-5 text-primary" />}
            title="Gemini 3.5 Flash"
            description="Function calling allows Gemini to request additional market data when the preloaded snapshot is insufficient."
          />
          <TechCard
            icon={<Globe className="h-5 w-5 text-chart-2" />}
            title="7 Market Data Providers"
            description="CoinGecko → CoinPaprika/Binance for crypto, Finnhub → Alpha Vantage → Yahoo for stocks, and ECB Frankfurter for forex."
          />
          <TechCard
            icon={<Zap className="h-5 w-5 text-amber-400" />}
            title="SSE Status Streaming"
            description="Server-Sent Events publish orchestrator state and execution progress to connected dashboard clients."
          />
        </div>

        {/* Stack footer */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          {["Next.js 16 + Turbopack", "TypeScript", "Tailwind v4", "shadcn/ui", "Recharts", "Google GenAI SDK", "ofetch"].map((s) => (
            <span key={s} className="rounded-full border border-border/50 bg-muted/30 px-2.5 py-1">
              {s}
            </span>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-6 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <LineChart className="h-4 w-4" />
            Open the dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        Market Inspector · 3 coordinated roles · 11 MCP tools · Kaggle AI Agents Capstone
      </footer>
    </main>
  );
}

function AgentCard({
  icon,
  name,
  role,
}: {
  icon: React.ReactNode;
  name: string;
  role: string;
  color: string;
}) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-border/50 bg-card/50 p-4 sm:max-w-[200px]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{name}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{role}</p>
    </div>
  );
}

function ToolGroup({
  label,
  tools,
  color,
}: {
  label: string;
  tools: string[];
  color: "amber" | "blue" | "green";
}) {
  const dot: Record<string, string> = {
    amber: "bg-amber-400",
    blue: "bg-primary",
    green: "bg-chart-2",
  };
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {tools.map((t) => (
        <div key={t} className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[color]}`} />
          <span className="font-mono text-[10px] text-muted-foreground">{t}</span>
        </div>
      ))}
    </div>
  );
}

function TechCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
