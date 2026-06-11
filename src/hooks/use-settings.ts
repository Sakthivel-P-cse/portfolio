"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";
import type { SettingsInput } from "@/lib/validations/settings";

interface SettingsDTO extends SettingsInput {
  id: string;
  userId: string;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SettingsDTO>("/api/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<SettingsInput>) =>
      api<SettingsDTO>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
