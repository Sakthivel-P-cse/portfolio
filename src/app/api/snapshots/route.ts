import type { Prisma, SnapshotGranularity } from "@prisma/client";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { serializeSnapshot } from "@/lib/db/serialize";
import { ok, unauthorized, handleError } from "@/lib/api";

// GET /api/snapshots?granularity=DAY|WEEK|MONTH → ordered series for the charts.
export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const granularity = (searchParams.get("granularity") ??
      "DAY") as SnapshotGranularity;

    const where: Prisma.PortfolioSnapshotWhereInput = {
      userId: user.id,
      granularity,
    };

    const rows = await prisma.portfolioSnapshot.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return ok(rows.map(serializeSnapshot));
  } catch (e) {
    return handleError(e);
  }
}
