import { z } from "zod";

export const TRANSACTION_TYPES = [
  "DEPOSIT",
  "WITHDRAWAL",
  "PROFIT",
  "LOSS",
] as const;

export const transactionSchema = z.object({
  date: z.coerce.date({ message: "A valid date is required" }),
  amount: z.coerce
    .number({ message: "Amount must be a number" })
    .positive("Amount must be greater than zero")
    .max(1_000_000_000_000, "Amount is unrealistically large"),
  type: z.enum(TRANSACTION_TYPES, { message: "Select a transaction type" }),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// Partial schema for PATCH/edit operations.
export const transactionUpdateSchema = transactionSchema.partial();
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
