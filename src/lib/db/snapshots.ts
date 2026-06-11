// Snapshot engine. Recomputes a user's PortfolioSnapshot rows from their
// transactions. Charts read from these rows, never from raw transactions.
import type { Prisma, PrismaClient, SnapshotGranularity } from "@prisma/client";
import { deriveSnapshots } from "@/lib/calc/portfolio";
import { serializeTransaction } from "@/lib/db/serialize";

type Tx = Prisma.TransactionClient;

const GRANULARITIES: SnapshotGranularity[] = ["DAY", "WEEK", "MONTH"];

/**
 * Fully rebuild snapshots for a user across all granularities.
 * Runs inside the provided transaction client so it's atomic with the mutation.
 */
export async function rebuildSnapshots(
  tx: Tx,
  userId: string,
): Promise<void> {
  const rows = await tx.transaction.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  const txns = rows.map(serializeTransaction);

  // Clear and regenerate. Snapshot counts are small (one per bucket), so a
  // full rebuild keeps the logic simple and always-correct after any edit.
  await tx.portfolioSnapshot.deleteMany({ where: { userId } });

  if (txns.length === 0) return;

  const data = GRANULARITIES.flatMap((g) =>
    deriveSnapshots(txns, g).map((s) => ({
      userId,
      date: s.date,
      granularity: g,
      portfolioValue: s.portfolioValue,
      equity: s.equity,
      returnPct: s.returnPct,
      netDeposits: s.netDeposits,
      netPnl: s.netPnl,
    })),
  );

  if (data.length > 0) {
    await tx.portfolioSnapshot.createMany({ data });
  }
}

/** Convenience wrapper that opens its own transaction. */
export async function rebuildSnapshotsStandalone(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.$transaction((tx) => rebuildSnapshots(tx, userId));
}
