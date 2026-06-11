import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/db/audit";
import { serializeJournalEntry } from "@/lib/db/serialize";
import { journalEntrySchema } from "@/lib/validations/journal";
import { ok, err, unauthorized, handleError } from "@/lib/api";

// GET /api/journal?outcome=&tag=&limit=
export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const outcome = searchParams.get("outcome") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 500);

    const where: Prisma.JournalEntryWhereInput = { userId: user.id };
    if (outcome) where.outcome = outcome as Prisma.JournalEntryWhereInput["outcome"];
    if (tag) where.tags = { has: tag };

    const rows = await prisma.journalEntry.findMany({
      where,
      orderBy: { date: "desc" },
      take: Math.min(limit, 2000),
    });

    return ok(rows.map(serializeJournalEntry));
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/journal
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const body = await request.json();
    const input = journalEntrySchema.parse(body);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.journalEntry.create({
        data: {
          userId: user.id,
          date: input.date,
          amount: new Prisma.Decimal(input.amount),
          tradeType: input.tradeType,
          outcome: input.outcome,
          reason: input.reason || null,
          notes: input.notes || null,
          mistakeMade: input.mistakeMade || null,
          lessonLearned: input.lessonLearned || null,
          screenshotUrl: input.screenshotUrl || null,
          tags: input.tags ?? [],
        },
      });
      await recordAudit(tx, {
        userId: user.id,
        action: "CREATE",
        entityType: "JOURNAL_ENTRY",
        entityId: row.id,
        newData: serializeJournalEntry(row) as unknown as Prisma.InputJsonValue,
      });
      return row;
    });

    return ok(serializeJournalEntry(created), { status: 201 });
  } catch (e) {
    if (e instanceof SyntaxError) return err("Invalid JSON body", 400);
    return handleError(e);
  }
}
