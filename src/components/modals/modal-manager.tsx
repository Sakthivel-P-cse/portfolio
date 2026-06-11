"use client";

import { useUIStore } from "@/stores/ui-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { JournalForm } from "@/components/journal/journal-form";
import { ImportDialog } from "@/components/transactions/import-dialog";

const TXN_TITLE = {
  DEPOSIT: "Add Deposit",
  WITHDRAWAL: "Add Withdrawal",
  PROFIT: "Add Profit",
  LOSS: "Add Loss",
} as const;

// Single source of truth for all modals, driven by the Zustand UI store.
export function ModalManager() {
  const modal = useUIStore((s) => s.modal);
  const close = useUIStore((s) => s.closeModal);
  const open = modal !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {modal?.type === "transaction" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {modal.editId
                  ? "Edit Transaction"
                  : TXN_TITLE[modal.txnType ?? "DEPOSIT"]}
              </DialogTitle>
              <DialogDescription>
                Record a deposit, withdrawal, profit, or loss.
              </DialogDescription>
            </DialogHeader>
            <TransactionForm defaultType={modal.txnType} onDone={close} />
          </>
        )}

        {modal?.type === "journal" && (
          <>
            <DialogHeader>
              <DialogTitle>
                {modal.editId ? "Edit Journal Entry" : "Add Journal Entry"}
              </DialogTitle>
              <DialogDescription>
                Log your trade, mistakes, lessons, and tags.
              </DialogDescription>
            </DialogHeader>
            <JournalForm onDone={close} />
          </>
        )}

        {modal?.type === "import" && (
          <>
            <DialogHeader>
              <DialogTitle>Import CSV</DialogTitle>
              <DialogDescription>
                Upload, preview, and confirm your transactions.
              </DialogDescription>
            </DialogHeader>
            <ImportDialog onDone={close} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
