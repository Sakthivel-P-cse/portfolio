"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  transactionSchema,
  type TransactionInput,
  TRANSACTION_TYPES,
} from "@/lib/validations/transaction";
import type { TransactionDTO, TransactionType } from "@/types";
import {
  useCreateTransaction,
  useUpdateTransaction,
} from "@/hooks/use-transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  defaultType?: TransactionType;
  existing?: TransactionDTO;
  onDone: () => void;
}

const TYPE_LABEL: Record<TransactionType, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  PROFIT: "Profit",
  LOSS: "Loss",
};

function toDateInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  return d.toISOString().slice(0, 10);
}

export function TransactionForm({ defaultType, existing, onDone }: Props) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();

  // Let useForm infer types from the resolver: fields use the schema's INPUT type
  // (strings from <input>), while handleSubmit yields the coerced OUTPUT type.
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: toDateInput(existing?.date),
      amount: existing?.amount,
      type: existing?.type ?? defaultType ?? "DEPOSIT",
      reason: existing?.reason ?? "",
      notes: existing?.notes ?? "",
    },
  });

  const type = watch("type");

  const onSubmit = handleSubmit(async (values) => {
    const input = values as TransactionInput;
    if (existing) {
      await update.mutateAsync({ id: existing.id, input });
    } else {
      await create.mutateAsync(input);
    }
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setValue("type", v as TransactionType)}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSACTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (₹)</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("amount")}
        />
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          placeholder="e.g. Salary, Breakout trade, Stop loss hit"
          {...register("reason")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {existing ? "Save changes" : "Add transaction"}
        </Button>
      </div>
    </form>
  );
}
