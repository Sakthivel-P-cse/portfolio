import { z } from "zod";

export const THEMES = ["LIGHT", "DARK", "SYSTEM"] as const;
export const DATE_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const;

export const settingsSchema = z.object({
  theme: z.enum(THEMES).default("DARK"),
  currency: z.string().trim().min(1).max(8).default("INR"),
  timezone: z.string().trim().min(1).max(64).default("Asia/Kolkata"),
  defaultRange: z.enum(DATE_RANGES).default("3M"),
  autoRefreshSecs: z.coerce.number().int().min(0).max(3600).default(0),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
