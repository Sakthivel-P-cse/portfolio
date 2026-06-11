"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSnapshots } from "@/hooks/use-portfolio";
import { useTransactions } from "@/hooks/use-transactions";
import { TopTable } from "@/components/analytics/top-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { SnapshotGranularity } from "@/types";

// Charts touch the DOM/canvas — load them client-only to avoid SSR mismatch.
const MoneyFlowChart = dynamic(
  () => import("@/components/charts/money-flow-chart").then((m) => m.MoneyFlowChart),
  { ssr: false, loading: () => <Skeleton className="h-[440px] rounded-2xl" /> },
);
const GrowthChart = dynamic(
  () => import("@/components/charts/growth-chart").then((m) => m.GrowthChart),
  { ssr: false, loading: () => <Skeleton className="h-[440px] rounded-2xl" /> },
);
const CashflowChart = dynamic(
  () => import("@/components/charts/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <Skeleton className="h-[440px] rounded-2xl" /> },
);

export default function AnalyticsPage() {
  const [granularity, setGranularity] = useState<SnapshotGranularity>("DAY");
  const snapshots = useSnapshots(granularity);
  const transactions = useTransactions({ limit: 2000 });

  const data = snapshots.data ?? [];
  const txns = transactions.data ?? [];
  const profits = txns.filter((t) => t.type === "PROFIT");
  const losses = txns.filter((t) => t.type === "LOSS");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <MoneyFlowChart
        data={data}
        transactions={txns}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthChart data={data} />
        <CashflowChart transactions={txns} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TopTable title="Top Profits" rows={profits} amountClass="text-emerald-500" />
        <TopTable title="Top Losses" rows={losses} amountClass="text-red-500" />
      </div>
    </div>
  );
}
