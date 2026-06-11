"use client";

import { Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUndoRedo, useUndoRedoState } from "@/hooks/use-portfolio";

// Global undo/redo controls backed by the AuditLog (survives reloads).
export function UndoRedo() {
  const { data } = useUndoRedoState();
  const mutation = useUndoRedo();

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        disabled={!data?.canUndo || mutation.isPending}
        onClick={() => mutation.mutate("undo")}
        title="Undo"
      >
        <Undo2 className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!data?.canRedo || mutation.isPending}
        onClick={() => mutation.mutate("redo")}
        title="Redo"
      >
        <Redo2 className="size-5" />
      </Button>
    </div>
  );
}
