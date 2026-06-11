"use client";

import { useMetrics } from "@/hooks/use-portfolio";
import { useTransactions } from "@/hooks/use-transactions";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { StatStrip } from "@/components/dashboard/stat-strip";

export default function DashboardPage() {
  const metrics = useMetrics();
  const transactions = useTransactions({ limit: 50 });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Quick Actions
        </h2>
        <QuickActions />
      </section>

      <SummaryCards metrics={metrics.data} loading={metrics.isLoading} />

      <StatStrip metrics={metrics.data} loading={metrics.isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity
          transactions={transactions.data}
          loading={transactions.isLoading}
        />
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="text-base font-semibold">Performance snapshot</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View the full money-flow, growth, and cash-flow charts on the{" "}
            <a href="/analytics" className="text-primary underline-offset-2 hover:underline">
              Analytics
            </a>{" "}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
