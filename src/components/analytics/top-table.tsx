"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Download, Search } from "lucide-react";
import type { TransactionDTO } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortKey = "date" | "amount";
const PAGE_SIZE = 8;

interface Props {
  title: string;
  rows: TransactionDTO[]; // pre-filtered to PROFIT or LOSS
  amountClass: string;
}

// Searchable, sortable, paginated table with a sticky header and CSV export.
export function TopTable({ title, rows, amountClass }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        !q ||
        r.reason?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q),
    );
    list.sort((a, b) => {
      const av = sortKey === "amount" ? a.amount : new Date(a.date).getTime();
      const bv = sortKey === "amount" ? b.amount : new Date(b.date).getTime();
      return asc ? av - bv : bv - av;
    });
    return list;
  }, [rows, search, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const slice = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  function exportCsv() {
    const header = "Date,Amount,Reason,Notes";
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = filtered.map((r) =>
      [r.date.slice(0, 10), r.amount, esc(r.reason ?? ""), esc(r.notes ?? "")].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search…"
              className="h-8 w-36 pl-8"
            />
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={exportCsv} title="Export CSV">
            <Download className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <SortHead label="Date" active={sortKey === "date"} onClick={() => toggleSort("date")} />
                <SortHead label="Amount" active={sortKey === "amount"} onClick={() => toggleSort("amount")} />
                <TableHead>Reason</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slice.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No entries.
                  </TableCell>
                </TableRow>
              ) : (
                slice.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                    <TableCell className={cn("font-semibold tabular-nums", amountClass)}>
                      {formatCurrency(r.amount)}
                    </TableCell>
                    <TableCell className="max-w-40 truncate">{r.reason || "—"}</TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {r.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {current + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SortHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-1 font-medium hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  );
}
