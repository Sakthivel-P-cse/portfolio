// Seed demo data. Run with: npm run db:seed
// Creates a demo user with ~6 months of transactions + journal entries + snapshots.
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { deriveSnapshots } from "../src/lib/calc/portfolio";
import { serializeTransaction } from "../src/lib/db/serialize";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "demo@portfolio.local";

type TxnType = "DEPOSIT" | "WITHDRAWAL" | "PROFIT" | "LOSS";

// Deterministic pseudo-random so seeds are reproducible.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

const PROFIT_REASONS = ["Breakout trade", "Trend continuation", "Earnings play", "Reversal scalp", "Swing winner"];
const LOSS_REASONS = ["Stop loss hit", "Failed breakout", "Revenge trade", "Choppy market", "Overtraded"];

async function main() {
  console.log("Seeding demo data…");

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      name: "Demo Trader",
      settings: { create: {} },
    },
  });

  // Clear existing demo data for idempotency.
  await prisma.transaction.deleteMany({ where: { userId: DEMO_USER_ID } });
  await prisma.journalEntry.deleteMany({ where: { userId: DEMO_USER_ID } });
  await prisma.portfolioSnapshot.deleteMany({ where: { userId: DEMO_USER_ID } });

  const txns: { date: Date; amount: number; type: TxnType; reason: string }[] = [];

  const start = new Date();
  start.setMonth(start.getMonth() - 6);

  // Initial deposit.
  txns.push({ date: new Date(start), amount: 100000, type: "DEPOSIT", reason: "Initial capital" });

  // ~180 days of activity.
  for (let day = 1; day <= 180; day++) {
    const date = new Date(start);
    date.setDate(date.getDate() + day);

    // Occasional top-up deposit.
    if (day % 45 === 0) {
      txns.push({ date: new Date(date), amount: 25000, type: "DEPOSIT", reason: "Monthly top-up" });
    }
    // Occasional withdrawal.
    if (day % 60 === 0) {
      txns.push({ date: new Date(date), amount: 15000, type: "WITHDRAWAL", reason: "Profit withdrawal" });
    }

    // Trades on ~60% of days.
    if (rand() < 0.6) {
      const win = rand() < 0.56; // ~56% win rate
      if (win) {
        txns.push({
          date: new Date(date),
          amount: Math.round(500 + rand() * 4500),
          type: "PROFIT",
          reason: pick(PROFIT_REASONS),
        });
      } else {
        txns.push({
          date: new Date(date),
          amount: Math.round(400 + rand() * 3000),
          type: "LOSS",
          reason: pick(LOSS_REASONS),
        });
      }
    }
  }

  await prisma.transaction.createMany({
    data: txns.map((t) => ({
      userId: DEMO_USER_ID,
      date: t.date,
      amount: new Prisma.Decimal(t.amount),
      type: t.type,
      reason: t.reason,
    })),
  });
  console.log(`  ${txns.length} transactions`);

  // Journal entries from a sample of the trades.
  const tradeTxns = txns.filter((t) => t.type === "PROFIT" || t.type === "LOSS");
  const TAGS = ["Breakout", "Scalping", "Swing", "FOMO", "Revenge Trade", "Overtrading"];
  const journalData = tradeTxns.slice(0, 40).map((t) => ({
    userId: DEMO_USER_ID,
    date: t.date,
    amount: new Prisma.Decimal(t.amount),
    tradeType: pick(["LONG", "SHORT", "SCALP", "SWING", "INTRADAY"]) as
      | "LONG" | "SHORT" | "SCALP" | "SWING" | "INTRADAY",
    outcome: (t.type === "PROFIT" ? "PROFIT" : "LOSS") as "PROFIT" | "LOSS",
    reason: t.reason,
    mistakeMade: t.type === "LOSS" ? "Entered without confirmation" : null,
    lessonLearned: t.type === "LOSS" ? "Wait for the retest next time" : "Let winners run",
    tags: [pick(TAGS), pick(TAGS)].filter((v, i, a) => a.indexOf(v) === i),
  }));
  await prisma.journalEntry.createMany({ data: journalData });
  console.log(`  ${journalData.length} journal entries`);

  // Build snapshots.
  const rows = await prisma.transaction.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { date: "asc" },
  });
  const dtos = rows.map(serializeTransaction);
  const snapshotData = (["DAY", "WEEK", "MONTH"] as const).flatMap((g) =>
    deriveSnapshots(dtos, g).map((s) => ({
      userId: DEMO_USER_ID,
      date: s.date,
      granularity: g,
      portfolioValue: new Prisma.Decimal(s.portfolioValue.toFixed(2)),
      equity: new Prisma.Decimal(s.equity.toFixed(2)),
      returnPct: new Prisma.Decimal(s.returnPct.toFixed(4)),
      netDeposits: new Prisma.Decimal(s.netDeposits.toFixed(2)),
      netPnl: new Prisma.Decimal(s.netPnl.toFixed(2)),
    })),
  );
  await prisma.portfolioSnapshot.createMany({ data: snapshotData });
  console.log(`  ${snapshotData.length} snapshots`);

  console.log("Done. Demo user:", DEMO_EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
