"use client";

import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { TransactionDTO, TransactionType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ICON: Record<TransactionType, { icon: typeof ArrowDownToLine; cls: string }> = {
  DEPOSIT: { icon: ArrowDownToLine, cls: "text-emerald-500 bg-emerald-500/10" },
  WITHDRAWAL: { icon: ArrowUpFromLine, cls: "text-red-500 bg-red-500/10" },
  PROFIT: { icon: TrendingUp, cls: "text-emerald-500 bg-emerald-500/10" },
  LOSS: { icon: TrendingDown, cls: "text-red-500 bg-red-500/10" },
};

const SIGN: Record<TransactionType, string> = {
  DEPOSIT: "+",
  PROFIT: "+",
  WITHDRAWAL: "-",
  LOSS: "-",
};

export function RecentActivity({
  transactions,
  loading,
}: {
  transactions?: TransactionDTO[];
  loading: boolean;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))
        ) : !transactions?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Use the quick actions above to add your first one.
          </p>
        ) : (
          transactions.slice(0, 8).map((t, i) => {
            const { icon: Icon, cls } = ICON[t.type];
            const positive = t.type === "DEPOSIT" || t.type === "PROFIT";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/50"
              >
                <span className={cn("flex size-9 items-center justify-center rounded-full", cls)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.reason || t.type.charAt(0) + t.type.slice(1).toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    positive ? "text-emerald-500" : "text-red-500",
                  )}
                >
                  {SIGN[t.type]}
                  {formatCurrency(t.amount)}
                </span>
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
