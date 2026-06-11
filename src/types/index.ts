// Shared domain types used across client and server.

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "PROFIT" | "LOSS";
export type TradeType =
  | "LONG"
  | "SHORT"
  | "SCALP"
  | "SWING"
  | "INTRADAY"
  | "OPTIONS"
  | "FUTURES";
export type TradeOutcome = "PROFIT" | "LOSS" | "BREAKEVEN";
export type SnapshotGranularity = "DAY" | "WEEK" | "MONTH";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "UNDO" | "REDO" | "IMPORT";

// Plain (serializable) transaction — Decimal/Date converted to number/string at the API boundary.
export interface TransactionDTO {
  id: string;
  date: string; // ISO
  amount: number;
  type: TransactionType;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryDTO {
  id: string;
  date: string;
  amount: number;
  tradeType: TradeType;
  outcome: TradeOutcome;
  reason: string | null;
  notes: string | null;
  mistakeMade: string | null;
  lessonLearned: string | null;
  screenshotUrl: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotDTO {
  date: string;
  granularity: SnapshotGranularity;
  portfolioValue: number;
  equity: number;
  returnPct: number;
  netDeposits: number;
  netPnl: number;
}

// The full analytics payload powering the dashboard summary cards.
export interface PortfolioMetrics {
  currentValue: number;
  netValue: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  returnPct: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  // Trading statistics
  peakEquity: number;
  lowestEquity: number;
  maxDrawdownPct: number;
  averageProfit: number;
  averageLoss: number;
  winRate: number;
  profitFactor: number | null; // null when no losses
  recoveryFactor: number | null;
  riskRewardRatio: number | null;
}
