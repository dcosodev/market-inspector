"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { callMcpTool, McpToolError } from "@/lib/api-client";
import type { ExchangeRateRow } from "@/lib/types/dashboard";

const SYMBOLS = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY"];

const CURRENCY_NAMES: Record<string, string> = {
  EUR: "Euro",
  GBP: "British Pound",
  JPY: "Japanese Yen",
  CHF: "Swiss Franc",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CNY: "Chinese Yuan",
};

export function ForexTab() {
  const [rates, setRates] = useState<ExchangeRateRow | null>(null);
  const [error, setError] = useState<{ message: string; degraded: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await callMcpTool<ExchangeRateRow>("forex.fetch_rate", {
          base: "USD",
          symbols: SYMBOLS,
        });
        if (!cancelled) setRates(r);
      } catch (e) {
        if (!cancelled)
          setError({
            message: e instanceof Error ? e.message : String(e),
            degraded: e instanceof McpToolError ? e.isDegraded : false,
          });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <Alert variant={error.degraded ? "default" : "destructive"}>
        <AlertTitle>{error.degraded ? "Data unavailable" : "Error"}</AlertTitle>
        <AlertDescription className="text-xs font-mono">{error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">USD Exchange Rates</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Official ECB reference rates via Frankfurter API
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Frankfurter (ECB)
              </Badge>
              {rates && (
                <span className="font-mono text-xs text-muted-foreground" role="status">
                  {rates.date ?? "Latest"}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Rate cards */}
      <div className="grid grid-cols-2 gap-3 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {SYMBOLS.map((s) => (
          <RateCard
            key={s}
            symbol={s}
            name={CURRENCY_NAMES[s] ?? s}
            rate={rates?.rates?.[s] ?? null}
            loading={rates === null || !rates.rates}
          />
        ))}
      </div>
    </div>
  );
}

function RateCard({
  symbol,
  name,
  rate,
  loading,
}: {
  symbol: string;
  name: string;
  rate: number | null;
  loading: boolean;
}) {
  const decimals = rate !== null && rate >= 10 ? 2 : 4;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground">USD</span>
          <ArrowRight className="h-3 w-3" />
          <span className="font-mono font-semibold text-primary">{symbol}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p className="mt-1.5 font-mono text-2xl font-bold tracking-tight">
            {rate === undefined || rate === null ? "—" : rate.toFixed(decimals)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{name}</p>
      </CardContent>
    </Card>
  );
}
