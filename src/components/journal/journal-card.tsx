"use client";

import { motion } from "framer-motion";
import { Pencil, Trash2, Lightbulb, AlertCircle } from "lucide-react";
import type { JournalEntryDTO } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDeleteJournalEntry } from "@/hooks/use-journal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OUTCOME_CLS = {
  PROFIT: "text-emerald-500 bg-emerald-500/10",
  LOSS: "text-red-500 bg-red-500/10",
  BREAKEVEN: "text-muted-foreground bg-muted",
};

export function JournalCard({
  entry,
  onEdit,
}: {
  entry: JournalEntryDTO;
  onEdit: (e: JournalEntryDTO) => void;
}) {
  const del = useDeleteJournalEntry();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
    >
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold",
                    OUTCOME_CLS[entry.outcome],
                  )}
                >
                  {entry.outcome}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.tradeType.charAt(0) + entry.tradeType.slice(1).toLowerCase()}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium">{entry.reason || "Untitled trade"}</p>
              <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  entry.outcome === "PROFIT"
                    ? "text-emerald-500"
                    : entry.outcome === "LOSS"
                      ? "text-red-500"
                      : "",
                )}
              >
                {formatCurrency(entry.amount)}
              </p>
            </div>
          </div>

          {entry.screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.screenshotUrl}
              alt="trade screenshot"
              className="max-h-40 w-full rounded-xl object-cover ring-1 ring-border"
            />
          )}

          {(entry.mistakeMade || entry.lessonLearned) && (
            <div className="space-y-1.5 text-xs">
              {entry.mistakeMade && (
                <p className="flex items-start gap-1.5 text-red-400">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {entry.mistakeMade}
                </p>
              )}
              {entry.lessonLearned && (
                <p className="flex items-start gap-1.5 text-emerald-400">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                  {entry.lessonLearned}
                </p>
              )}
            </div>
          )}

          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entry.tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-1 border-t border-border/60 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
              <Pencil className="mr-1 size-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-500"
              disabled={del.isPending}
              onClick={() => del.mutate(entry.id)}
            >
              <Trash2 className="mr-1 size-3.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
