"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/fetcher";
import { parseCsvRow } from "@/lib/validations/csv";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  onDone: () => void;
}

type Raw = Record<string, string>;

export function ImportDialog({ onDone }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Raw[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  // Local preview validation mirrors the server's parseCsvRow.
  const parsed = rows.map((r, i) => parseCsvRow(r, i));
  const validCount = parsed.filter((p) => p.errors.length === 0).length;
  const errorCount = parsed.length - validCount;

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Raw>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data),
      error: () => toast.error("Could not parse CSV"),
    });
  }

  async function confirmImport() {
    setImporting(true);
    try {
      const res = await api<{ historyId: string; imported: unknown[]; errors: unknown[] }>(
        "/api/import",
        { method: "POST", body: JSON.stringify({ fileName, rows }) },
      );
      toast.success(`Imported ${res.imported.length} transactions`);
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-12 text-center hover:border-primary">
          <Upload className="size-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop a CSV or click to upload</p>
            <p className="text-xs text-muted-foreground">
              Columns: Date, Amount, Type, Reason, Notes
            </p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </label>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{fileName}</span>
            <span className="text-muted-foreground">
              {validCount} valid · {errorCount} errors
            </span>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.slice(0, 100).map((p) => (
                  <TableRow key={p.index} className={p.errors.length ? "bg-destructive/10" : ""}>
                    <TableCell>{p.date?.toLocaleDateString("en-IN") ?? "—"}</TableCell>
                    <TableCell>{p.amount ?? "—"}</TableCell>
                    <TableCell>{p.type ?? "—"}</TableCell>
                    <TableCell className="max-w-32 truncate">{p.reason}</TableCell>
                    <TableCell>
                      {p.errors.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="size-3" />
                          {p.errors[0]}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setRows([])}>
              Choose another file
            </Button>
            <Button onClick={confirmImport} disabled={importing || validCount === 0}>
              {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
              Import {validCount} rows
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
