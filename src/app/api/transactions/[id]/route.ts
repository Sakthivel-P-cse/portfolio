import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";
import { rebuildSnapshots } from "@/lib/db/snapshots";
import { serializeTransaction } from "@/lib/db/serialize";
import { transactionUpdateSchema } from "@/lib/validations/transaction";
import { ok, err, unauthorized, handleError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/transactions/:id
export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return err("Transaction not found", 404);

    const body = await request.json();
    const input = transactionUpdateSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.transaction.update({
        where: { id },
        data: {
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.amount !== undefined
            ? { amount: new Prisma.Decimal(input.amount) }
            : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.reason !== undefined ? { reason: input.reason || null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        },
      });
      await recordAudit(tx, {
        userId: user.id,
        action: "UPDATE",
        entityType: "TRANSACTION",
        entityId: id,
        oldData: serializeTransaction(existing) as unknown as Prisma.InputJsonValue,
        newData: serializeTransaction(row) as unknown as Prisma.InputJsonValue,
      });
      await rebuildSnapshots(tx, user.id);
      return row;
    });

    return ok(serializeTransaction(updated));
  } catch (e) {
    if (e instanceof SyntaxError) return err("Invalid JSON body", 400);
    return handleError(e);
  }
}

// DELETE /api/transactions/:id
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const existing = await prisma.transaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return err("Transaction not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id } });
      await recordAudit(tx, {
        userId: user.id,
        action: "DELETE",
        entityType: "TRANSACTION",
        entityId: id,
        oldData: serializeTransaction(existing) as unknown as Prisma.InputJsonValue,
      });
      await rebuildSnapshots(tx, user.id);
    });

    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
