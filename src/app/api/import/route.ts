import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";
import { rebuildSnapshots } from "@/lib/db/snapshots";
import { serializeTransaction } from "@/lib/db/serialize";
import { parseCsvRow } from "@/lib/validations/csv";
import { ok, err, unauthorized, handleError } from "@/lib/api";

interface ImportBody {
  fileName: string;
  rows: Record<string, string>[]; // raw parsed CSV rows (PapaParse output)
}

// POST /api/import — validates and inserts all valid rows in one transaction,
// recording an ImportHistory row (with createdIds for rollback).
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const body = (await request.json()) as ImportBody;
    if (!Array.isArray(body.rows)) return err("rows[] is required", 400);

    const parsed = body.rows.map((r, i) => parseCsvRow(r, i));
    const valid = parsed.filter((p) => p.errors.length === 0);
    const errors = parsed
      .filter((p) => p.errors.length > 0)
      .map((p) => ({ row: p.index + 1, message: p.errors.join("; ") }));

    if (valid.length === 0) {
      const history = await prisma.importHistory.create({
        data: {
          userId: user.id,
          fileName: body.fileName ?? "import.csv",
          rowCount: parsed.length,
          successCount: 0,
          errorCount: errors.length,
          status: "FAILED",
          errors,
        },
      });
      return err("No valid rows to import", 422, { historyId: history.id, errors });
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await Promise.all(
        valid.map((p) =>
          tx.transaction.create({
            data: {
              userId: user.id,
              date: p.date!,
              amount: new Prisma.Decimal(p.amount!),
              type: p.type!,
              reason: p.reason || null,
              notes: p.notes || null,
            },
          }),
        ),
      );

      const createdIds = created.map((c) => c.id);

      const history = await tx.importHistory.create({
        data: {
          userId: user.id,
          fileName: body.fileName ?? "import.csv",
          rowCount: parsed.length,
          successCount: created.length,
          errorCount: errors.length,
          status: "COMPLETED",
          errors: errors.length ? errors : undefined,
          createdIds,
        },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "IMPORT",
        entityType: "TRANSACTION",
        entityId: history.id,
        newData: { createdIds } as unknown as Prisma.InputJsonValue,
      });

      await rebuildSnapshots(tx, user.id);
      return { history, created };
    });

    return ok({
      historyId: result.history.id,
      imported: result.created.map(serializeTransaction),
      errors,
    });
  } catch (e) {
    if (e instanceof SyntaxError) return err("Invalid JSON body", 400);
    return handleError(e);
  }
}
