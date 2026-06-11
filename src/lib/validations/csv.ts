import { z } from "zod";
import { TRANSACTION_TYPES } from "./transaction";

// Normalize human-entered type strings (e.g. "deposit", "Profit ") to enum values.
const normalizeType = (raw: string) => raw?.trim().toUpperCase();

export const csvRowSchema = z.object({
  Date: z.string().trim().min(1, "Date is required"),
  Amount: z.string().trim().min(1, "Amount is required"),
  Type: z.string().trim().min(1, "Type is required"),
  Reason: z.string().trim().optional().default(""),
  Notes: z.string().trim().optional().default(""),
});

export type CsvRow = z.infer<typeof csvRowSchema>;

// A row after parsing/coercion, ready to insert (or carrying an error).
export interface ParsedCsvRow {
  index: number; // 0-based row index within the data rows
  date: Date | null;
  amount: number | null;
  type: (typeof TRANSACTION_TYPES)[number] | null;
  reason: string;
  notes: string;
  errors: string[];
}

export function parseCsvRow(raw: Record<string, string>, index: number): ParsedCsvRow {
  const errors: string[] = [];

  const dateStr = (raw.Date ?? raw.date ?? "").trim();
  const amountStr = (raw.Amount ?? raw.amount ?? "").trim();
  const typeStr = normalizeType(raw.Type ?? raw.type ?? "");
  const reason = (raw.Reason ?? raw.reason ?? "").trim();
  const notes = (raw.Notes ?? raw.notes ?? "").trim();

  const date = dateStr ? new Date(dateStr) : null;
  if (!date || Number.isNaN(date.getTime())) {
    errors.push(`Invalid date: "${dateStr}"`);
  }

  const amount = amountStr ? Number(amountStr.replace(/[,₹\s]/g, "")) : null;
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    errors.push(`Invalid amount: "${amountStr}"`);
  }

  const type = (TRANSACTION_TYPES as readonly string[]).includes(typeStr)
    ? (typeStr as ParsedCsvRow["type"])
    : null;
  if (!type) {
    errors.push(`Invalid type: "${typeStr}" (expected Deposit/Withdrawal/Profit/Loss)`);
  }

  return {
    index,
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    amount,
    type,
    reason,
    notes,
    errors,
  };
}
