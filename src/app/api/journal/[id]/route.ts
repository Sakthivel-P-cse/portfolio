import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";
import { serializeJournalEntry } from "@/lib/db/serialize";
import { journalEntryUpdateSchema } from "@/lib/validations/journal";
import { ok, err, unauthorized, handleError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const existing = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return err("Journal entry not found", 404);

    const input = journalEntryUpdateSchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.journalEntry.update({
        where: { id },
        data: {
          ...(input.date !== undefined ? { date: input.date } : {}),
          ...(input.amount !== undefined
            ? { amount: new Prisma.Decimal(input.amount) }
            : {}),
          ...(input.tradeType !== undefined ? { tradeType: input.tradeType } : {}),
          ...(input.outcome !== undefined ? { outcome: input.outcome } : {}),
          ...(input.reason !== undefined ? { reason: input.reason || null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(input.mistakeMade !== undefined
            ? { mistakeMade: input.mistakeMade || null }
            : {}),
          ...(input.lessonLearned !== undefined
            ? { lessonLearned: input.lessonLearned || null }
            : {}),
          ...(input.screenshotUrl !== undefined
            ? { screenshotUrl: input.screenshotUrl || null }
            : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
        },
      });
      await recordAudit(tx, {
        userId: user.id,
        action: "UPDATE",
        entityType: "JOURNAL_ENTRY",
        entityId: id,
        oldData: serializeJournalEntry(existing) as unknown as Prisma.InputJsonValue,
        newData: serializeJournalEntry(row) as unknown as Prisma.InputJsonValue,
      });
      return row;
    });

    return ok(serializeJournalEntry(updated));
  } catch (e) {
    if (e instanceof SyntaxError) return err("Invalid JSON body", 400);
    return handleError(e);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const existing = await prisma.journalEntry.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return err("Journal entry not found", 404);

    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.delete({ where: { id } });
      await recordAudit(tx, {
        userId: user.id,
        action: "DELETE",
        entityType: "JOURNAL_ENTRY",
        entityId: id,
        oldData: serializeJournalEntry(existing) as unknown as Prisma.InputJsonValue,
      });
    });

    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
