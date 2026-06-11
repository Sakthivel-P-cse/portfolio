"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import type { TransactionDTO } from "@/types";
import type { TransactionInput } from "@/lib/validations/transaction";

const KEY = ["transactions"];

export function useTransactions(params?: { type?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();

  return useQuery({
    queryKey: [...KEY, params ?? {}],
    queryFn: () =>
      api<TransactionDTO[]>(`/api/transactions${query ? `?${query}` : ""}`),
  });
}

// Invalidate everything a transaction mutation can affect.
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["metrics"] });
  qc.invalidateQueries({ queryKey: ["snapshots"] });
  qc.invalidateQueries({ queryKey: ["undo-redo"] });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionInput) =>
      api<TransactionDTO>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success("Transaction added");
      invalidateAll(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TransactionInput> }) =>
      api<TransactionDTO>(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success("Transaction updated");
      invalidateAll(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/api/transactions/${id}`, { method: "DELETE" }),
    // Optimistic: drop the row from every cached list immediately.
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEY });
      const snapshots = qc.getQueriesData<TransactionDTO[]>({ queryKey: KEY });
      snapshots.forEach(([key, data]) => {
        if (data) qc.setQueryData(key, data.filter((t) => t.id !== id));
      });
      return { snapshots };
    },
    onError: (e: Error, _id, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Transaction deleted"),
    onSettled: () => invalidateAll(qc),
  });
}
