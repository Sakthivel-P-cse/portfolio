"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, BookOpen } from "lucide-react";
import { useJournalEntries } from "@/hooks/use-journal";
import { useUIStore } from "@/stores/ui-store";
import { TRADE_OUTCOMES } from "@/lib/validations/journal";
import type { JournalEntryDTO } from "@/types";
import { JournalCard } from "@/components/journal/journal-card";
import { JournalForm } from "@/components/journal/journal-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function JournalPage() {
  const openModal = useUIStore((s) => s.openModal);
  const [outcome, setOutcome] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState<JournalEntryDTO | null>(null);

  const { data, isLoading } = useJournalEntries(outcome ? { outcome } : undefined);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
          <FilterChip label="All" active={!outcome} onClick={() => setOutcome(undefined)} />
          {TRADE_OUTCOMES.map((o) => (
            <FilterChip
              key={o}
              label={o.charAt(0) + o.slice(1).toLowerCase()}
              active={outcome === o}
              onClick={() => setOutcome(o)}
            />
          ))}
        </div>
        <Button onClick={() => openModal({ type: "journal" })}>
          <Plus className="mr-1 size-4" />
          New Entry
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-20 text-center">
          <BookOpen className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No journal entries yet. Log your first trade.
          </p>
          <Button onClick={() => openModal({ type: "journal" })}>
            <Plus className="mr-1 size-4" />
            New Entry
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {data.map((e) => (
              <JournalCard key={e.id} entry={e} onEdit={setEditing} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit dialog (separate from the global create modal). */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Journal Entry</DialogTitle>
          </DialogHeader>
          {editing && <JournalForm existing={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
