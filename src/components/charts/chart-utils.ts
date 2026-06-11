import type { UTCTimestamp } from "lightweight-charts";
import type { TransactionDTO } from "@/types";

// ── Equity-curve segment colors ───────────────────────────────────────────
// The equity LINE itself changes color per time unit. One color per unit;
// the segment ending at a point inherits that point's color. Shared by the
// chart, the legend, and the example mini-graphic so there's a single source.
export type EventKind = "PROFIT" | "LOSS" | "DEPOSIT" | "WITHDRAWAL";

export const EVENT_COLORS: Record<EventKind, string> = {
  PROFIT: "#22C55E", // bright green
  LOSS: "#EF4444", // bright red
  DEPOSIT: "#EAB308", // gold/yellow
  WITHDRAWAL: "#6B7280", // gray (reference uses gray, not black)
};

export const EVENT_LABEL: Record<EventKind, string> = {
  PROFIT: "Profit",
  LOSS: "Loss",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
};

/**
 * Classify one equity point by its time unit. Fund flow (deposit/withdrawal)
 * on that bucket wins; otherwise the sign of the bucket's P&L delta decides
 * profit vs. loss. `dayTxns` are the raw transactions falling on this bucket.
 */
export function classifyPoint(dayTxns: TransactionDTO[] | undefined, pnlDelta: number): EventKind {
  let netFlow = 0;
  if (dayTxns) {
    for (const t of dayTxns) {
      if (t.type === "DEPOSIT") netFlow += t.amount;
      else if (t.type === "WITHDRAWAL") netFlow -= t.amount;
    }
  }
  if (netFlow > 0) return "DEPOSIT";
  if (netFlow < 0) return "WITHDRAWAL";
  return pnlDelta < 0 ? "LOSS" : "PROFIT";
}

// lightweight-charts wants either a 'yyyy-mm-dd' business day or a UTC timestamp.
// We use UTC timestamps (seconds) everywhere for consistent intraday + daily handling.
export function toUtcTs(iso: string): UTCTimestamp {
  return Math.floor(new Date(iso).getTime() / 1000) as UTCTimestamp;
}

// Sort ascending and drop duplicate timestamps — lightweight-charts throws otherwise.
export function dedupeSortByTime<T extends { time: number }>(points: T[]): T[] {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const out: T[] = [];
  let lastTime: number | null = null;
  for (const p of sorted) {
    if (p.time === lastTime) {
      out[out.length - 1] = p; // keep last value for that timestamp
    } else {
      out.push(p);
      lastTime = p.time;
    }
  }
  return out;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
