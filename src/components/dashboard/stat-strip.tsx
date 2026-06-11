"use client";

import type { PortfolioMetrics } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Trading statistics row: win rate, profit factor, drawdown, etc.
export function StatStrip({
  metrics,
  loading,
}: {
  metrics?: PortfolioMetrics;
  loading: boolean;
}) {
  if (loading || !metrics) {
    return <Skeleton className="h-24 rounded-2xl" />;
  }

  const stats: { label: string; value: string }[] = [
    { label: "Win Rate", value: formatPercent(metrics.winRate, 0) },
    {
      label: "Profit Factor",
      value: metrics.profitFactor === null ? "—" : metrics.profitFactor.toFixed(2),
    },
    { label: "Max Drawdown", value: formatPercent(-metrics.maxDrawdownPct, 1) },
    { label: "Peak Equity", value: formatCurrency(metrics.peakEquity, { compact: true }) },
    { label: "Avg Profit", value: formatCurrency(metrics.averageProfit, { compact: true }) },
    { label: "Avg Loss", value: formatCurrency(metrics.averageLoss, { compact: true }) },
    {
      label: "Risk/Reward",
      value: metrics.riskRewardRatio === null ? "—" : metrics.riskRewardRatio.toFixed(2),
    },
    {
      label: "Recovery",
      value: metrics.recoveryFactor === null ? "—" : metrics.recoveryFactor.toFixed(2),
    },
  ];

  return (
    <Card className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/60 p-0 sm:grid-cols-4 lg:grid-cols-8">
      {stats.map((s) => (
        <div key={s.label} className="bg-card p-4">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{s.value}</p>
        </div>
      ))}
    </Card>
  );
}
