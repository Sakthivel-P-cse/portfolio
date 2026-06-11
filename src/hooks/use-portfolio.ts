"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import type { PortfolioMetrics, SnapshotDTO, SnapshotGranularity } from "@/types";

export function useMetrics() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: () => api<PortfolioMetrics>("/api/metrics"),
  });
}

export function useSnapshots(granularity: SnapshotGranularity) {
  return useQuery({
    queryKey: ["snapshots", granularity],
    queryFn: () =>
      api<SnapshotDTO[]>(`/api/snapshots?granularity=${granularity}`),
  });
}

export function useUndoRedoState() {
  return useQuery({
    queryKey: ["undo-redo"],
    queryFn: () => api<{ canUndo: boolean; canRedo: boolean }>("/api/transactions/undo"),
  });
}

export function useUndoRedo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "undo" | "redo") =>
      api<{ canUndo: boolean; canRedo: boolean }>("/api/transactions/undo", {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, action) => {
      toast.success(action === "undo" ? "Undone" : "Redone");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["undo-redo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
