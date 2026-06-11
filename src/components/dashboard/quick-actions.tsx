"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  BookPlus,
  Upload,
} from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import type { TransactionType } from "@/types";

const ACTIONS: {
  label: string;
  icon: typeof ArrowDownToLine;
  onClick: (open: ReturnType<typeof useUIStore.getState>["openModal"]) => void;
  className: string;
}[] = [
  {
    label: "Add Deposit",
    icon: ArrowDownToLine,
    className: "text-emerald-500",
    onClick: (o) => o({ type: "transaction", txnType: "DEPOSIT" as TransactionType }),
  },
  {
    label: "Add Withdrawal",
    icon: ArrowUpFromLine,
    className: "text-red-500",
    onClick: (o) => o({ type: "transaction", txnType: "WITHDRAWAL" as TransactionType }),
  },
  {
    label: "Add Profit",
    icon: TrendingUp,
    className: "text-emerald-500",
    onClick: (o) => o({ type: "transaction", txnType: "PROFIT" as TransactionType }),
  },
  {
    label: "Add Loss",
    icon: TrendingDown,
    className: "text-red-500",
    onClick: (o) => o({ type: "transaction", txnType: "LOSS" as TransactionType }),
  },
  {
    label: "Journal Entry",
    icon: BookPlus,
    className: "text-primary",
    onClick: (o) => o({ type: "journal" }),
  },
  {
    label: "Import CSV",
    icon: Upload,
    className: "text-muted-foreground",
    onClick: (o) => o({ type: "import" }),
  },
];

export function QuickActions() {
  const openModal = useUIStore((s) => s.openModal);

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {ACTIONS.map((a) => (
        <Button
          key={a.label}
          variant="outline"
          onClick={() => a.onClick(openModal)}
          className="flex h-auto flex-col gap-2 rounded-2xl py-4"
        >
          <a.icon className={`size-5 ${a.className}`} />
          <span className="text-xs font-medium">{a.label}</span>
        </Button>
      ))}
    </div>
  );
}
