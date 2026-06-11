import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { serializeTransaction } from "@/lib/db/serialize";
import { computeMetrics } from "@/lib/calc/portfolio";
import { ok, unauthorized, handleError } from "@/lib/api";

// GET /api/metrics → full PortfolioMetrics payload for the dashboard cards.
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const rows = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    const metrics = computeMetrics(rows.map(serializeTransaction));
    return ok(metrics);
  } catch (e) {
    return handleError(e);
  }
}
