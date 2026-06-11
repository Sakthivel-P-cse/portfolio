"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import type { JournalEntryDTO } from "@/types";
import type { JournalEntryInput } from "@/lib/validations/journal";

const KEY = ["journal"];

export function useJournalEntries(params?: { outcome?: string; tag?: string }) {
  const qs = new URLSearchParams();
  if (params?.outcome) qs.set("outcome", params.outcome);
  if (params?.tag) qs.set("tag", params.tag);
  const query = qs.toString();

  return useQuery({
    queryKey: [...KEY, params ?? {}],
    queryFn: () =>
      api<JournalEntryDTO[]>(`/api/journal${query ? `?${query}` : ""}`),
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JournalEntryInput) =>
      api<JournalEntryDTO>("/api/journal", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success("Journal entry saved");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<JournalEntryInput> }) =>
      api<JournalEntryDTO>(`/api/journal/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success("Journal entry updated");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/api/journal/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Journal entry deleted");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
