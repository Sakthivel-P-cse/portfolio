import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";
import { rebuildSnapshots } from "@/lib/db/snapshots";
import { serializeTransaction } from "@/lib/db/serialize";
import { transactionSchema } from "@/lib/validations/transaction";
import { ok, err, unauthorized, handleError } from "@/lib/api";

// GET /api/transactions?type=&from=&to=&limit=
export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Number(searchParams.get("limit") ?? 500);

    const where: Prisma.TransactionWhereInput = { userId: user.id };
    if (type) where.type = type as Prisma.TransactionWhereInput["type"];
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const rows = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: Math.min(limit, 2000),
    });

    return ok(rows.map(serializeTransaction));
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/transactions
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const input = transactionSchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.transaction.create({
        data: {
          userId: user.id,
          date: input.date,
          amount: new Prisma.Decimal(input.amount),
          type: input.type,
          reason: input.reason || null,
          notes: input.notes || null,
        },
      });
      await recordAudit(tx, {
        userId: user.id,
        action: "CREATE",
        entityType: "TRANSACTION",
        entityId: row.id,
        newData: serializeTransaction(row) as unknown as Prisma.InputJsonValue,
      });
      await rebuildSnapshots(tx, user.id);
      return row;
    });

    return ok(serializeTransaction(created), { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return err("Invalid JSON body", 400);
    return handleError(e);
  }
}
