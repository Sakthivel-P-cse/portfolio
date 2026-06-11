// Convert Prisma rows (Decimal, Date) into serializable DTOs for the client.
import type { Prisma } from "@prisma/client";
import type { JournalEntryDTO, SnapshotDTO, TransactionDTO } from "@/types";

type Decimalish = Prisma.Decimal | number | string;

export const toNum = (d: Decimalish): number =>
  typeof d === "number" ? d : Number(d.toString());

type TxnRow = {
  id: string;
  date: Date;
  amount: Decimalish;
  type: TransactionDTO["type"];
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeTransaction(t: TxnRow): TransactionDTO {
  return {
    id: t.id,
    date: t.date.toISOString(),
    amount: toNum(t.amount),
    type: t.type,
    reason: t.reason,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

type JournalRow = {
  id: string;
  date: Date;
  amount: Decimalish;
  tradeType: JournalEntryDTO["tradeType"];
  outcome: JournalEntryDTO["outcome"];
  reason: string | null;
  notes: string | null;
  mistakeMade: string | null;
  lessonLearned: string | null;
  screenshotUrl: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export function serializeJournalEntry(j: JournalRow): JournalEntryDTO {
  return {
    id: j.id,
    date: j.date.toISOString(),
    amount: toNum(j.amount),
    tradeType: j.tradeType,
    outcome: j.outcome,
    reason: j.reason,
    notes: j.notes,
    mistakeMade: j.mistakeMade,
    lessonLearned: j.lessonLearned,
    screenshotUrl: j.screenshotUrl,
    tags: j.tags,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

type SnapshotRow = {
  date: Date;
  granularity: SnapshotDTO["granularity"];
  portfolioValue: Decimalish;
  equity: Decimalish;
  returnPct: Decimalish;
  netDeposits: Decimalish;
  netPnl: Decimalish;
};

export function serializeSnapshot(s: SnapshotRow): SnapshotDTO {
  return {
    date: s.date.toISOString(),
    granularity: s.granularity,
    portfolioValue: toNum(s.portfolioValue),
    equity: toNum(s.equity),
    returnPct: toNum(s.returnPct),
    netDeposits: toNum(s.netDeposits),
    netPnl: toNum(s.netPnl),
  };
}
