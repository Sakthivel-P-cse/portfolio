// Display formatting. All amounts are INR by default with Indian digit grouping.

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 2,
});

const numFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";
  return opts?.compact ? inrCompact.format(value) : inrFormatter.format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return numFormatter.format(value);
}

/** Signed currency, e.g. "+₹24,500" / "-₹1,200". */
export function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${inrFormatter.format(Math.abs(value))}`;
}

/** Signed percentage, e.g. "+24%" / "-5.4%". null/NaN → "—". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function signClass(value: number): "text-emerald-500" | "text-red-500" | "text-muted-foreground" {
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-red-500";
  return "text-muted-foreground";
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
