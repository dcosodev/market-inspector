"use client";

export interface TickerItem {
  id: string;
  symbol: string;
  price: number;
  change: number;
  type: "crypto" | "stock";
}

export function MarketTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) {
    return (
      <div className="overflow-hidden border-b border-border/40 bg-muted/20 px-4 py-2.5">
        <div className="flex animate-pulse gap-8 text-xs text-muted-foreground">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="inline-block h-3 w-20 rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes market-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: market-ticker ${Math.max(30, items.length * 3.5)}s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation: none;
          }
        }
      `}</style>
      <div
        className="select-none overflow-hidden border-b border-border/40 bg-muted/10 py-2.5"
        aria-label="Live market ticker"
      >
        <div className="ticker-track flex w-max">
          {[0, 1].map((group) => (
            <div key={group} className="flex shrink-0 items-center gap-8 pr-8">
              {items.map((item) => (
                <TickerCell key={`${group}-${item.type}-${item.id}`} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TickerCell({ item }: { item: TickerItem }) {
  const up = item.change >= 0;
  const sign = up ? "+" : "";
  const color = up ? "text-chart-2" : "text-destructive";
  const dot = up ? "▲" : "▼";

  const priceStr =
    item.price >= 1000
      ? `$${item.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : item.price >= 1
      ? `$${item.price.toFixed(2)}`
      : `$${item.price.toFixed(4)}`;

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span
        className={`size-1.5 rounded-full ${
          item.type === "stock" ? "bg-primary" : "bg-amber-400"
        }`}
      />
      <span className="font-mono font-bold text-foreground">{item.symbol}</span>
      <span className="font-mono text-muted-foreground">{priceStr}</span>
      <span className={`font-mono text-[10px] font-semibold ${color}`}>
        {dot} {sign}{Math.abs(item.change).toFixed(2)}%
      </span>
    </span>
  );
}
