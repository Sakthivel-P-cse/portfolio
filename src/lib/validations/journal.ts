import { z } from "zod";

export const TRADE_TYPES = [
  "LONG",
  "SHORT",
  "SCALP",
  "SWING",
  "INTRADAY",
  "OPTIONS",
  "FUTURES",
] as const;

export const TRADE_OUTCOMES = ["PROFIT", "LOSS", "BREAKEVEN"] as const;

// Suggested tags surfaced in the UI; users may add their own free-form tags.
export const SUGGESTED_TAGS = [
  "Revenge Trade",
  "Breakout",
  "Scalping",
  "Swing",
  "FOMO",
  "Overtrading",
  "News",
  "Reversal",
  "Trend Following",
] as const;

export const journalEntrySchema = z.object({
  date: z.coerce.date({ message: "A valid date is required" }),
  amount: z.coerce
    .number({ message: "Amount must be a number" })
    .nonnegative("Amount cannot be negative")
    .max(1_000_000_000_000, "Amount is unrealistically large"),
  tradeType: z.enum(TRADE_TYPES, { message: "Select a trade type" }),
  outcome: z.enum(TRADE_OUTCOMES, { message: "Select an outcome" }),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  mistakeMade: z.string().trim().max(2000).optional().or(z.literal("")),
  lessonLearned: z.string().trim().max(2000).optional().or(z.literal("")),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export type JournalEntryInput = z.infer<typeof journalEntrySchema>;

export const journalEntryUpdateSchema = journalEntrySchema.partial();
export type JournalEntryUpdateInput = z.infer<typeof journalEntryUpdateSchema>;
