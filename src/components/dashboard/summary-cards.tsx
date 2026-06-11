"use client";

import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Scale,
} from "lucide-react";
import type { PortfolioMetrics } from "@/types";
import { formatCurrency, formatSignedCurrency, signClass } from "@/lib/format";
import { CountUp } from "./count-up";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CardDef {
  label: string;
  value: number;
  icon: typeof Wallet;
  signed?: boolean;
  accent?: boolean;
}

export function SummaryCards({
  metrics,
  loading,
}: {
  metrics?: PortfolioMetrics;
  loading: boolean;
}) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  const cards: CardDef[] = [
    { label: "Current Value", value: metrics.currentValue, icon: Wallet, accent: true },
    { label: "Net P&L", value: metrics.netPnl, icon: Scale, signed: true },
    { label: "Total Deposits", value: metrics.totalDeposits, icon: ArrowDownToLine },
    { label: "Total Withdrawals", value: metrics.totalWithdrawals, icon: ArrowUpFromLine },
    { label: "Total Profit", value: metrics.totalProfit, icon: TrendingUp },
    { label: "Total Loss", value: metrics.totalLoss, icon: TrendingDown },
    { label: "Daily P&L", value: metrics.dailyPnl, icon: CalendarDays, signed: true },
    { label: "Weekly P&L", value: metrics.weeklyPnl, icon: CalendarRange, signed: true },
    { label: "Monthly P&L", value: metrics.monthlyPnl, icon: CalendarClock, signed: true },
    { label: "Net Value", value: metrics.netValue, icon: Coins },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.35 }}
        >
          <Card
            className={cn(
              "flex flex-col gap-3 rounded-2xl p-4",
              c.accent && "bg-primary/10 ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {c.label}
              </span>
              <c.icon
                className={cn(
                  "size-4",
                  c.accent ? "text-primary" : "text-muted-foreground",
                )}
              />
            </div>
            <div
              className={cn(
                "text-xl font-semibold tabular-nums",
                c.signed ? signClass(c.value) : "text-foreground",
              )}
            >
              <CountUp
                value={c.value}
                format={c.signed ? formatSignedCurrency : (n) => formatCurrency(n)}
              />
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
