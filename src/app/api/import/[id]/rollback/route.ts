import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { rebuildSnapshots } from "@/lib/db/snapshots";
import { ok, err, unauthorized, handleError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// POST /api/import/:id/rollback — delete every transaction created by an import.
export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await params;

    const history = await prisma.importHistory.findFirst({
      where: { id, userId: user.id },
    });
    if (!history) return err("Import not found", 404);
    if (history.status === "ROLLED_BACK")
      return err("Import already rolled back", 409);

    const count = await prisma.$transaction(async (tx) => {
      const del = await tx.transaction.deleteMany({
        where: { id: { in: history.createdIds }, userId: user.id },
      });
      await tx.importHistory.update({
        where: { id },
        data: { status: "ROLLED_BACK" },
      });
      await rebuildSnapshots(tx, user.id);
      return del.count;
    });

    return ok({ rolledBack: count });
  } catch (e) {
    return handleError(e);
  }
}
