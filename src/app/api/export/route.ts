import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { serializeTransaction } from "@/lib/db/serialize";
import { unauthorized, handleError } from "@/lib/api";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// GET /api/export → downloads all transactions as CSV (Date,Amount,Type,Reason,Notes).
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const rows = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    });

    const header = "Date,Amount,Type,Reason,Notes";
    const lines = rows.map(serializeTransaction).map((t) =>
      [
        t.date.slice(0, 10),
        t.amount.toString(),
        t.type,
        csvEscape(t.reason ?? ""),
        csvEscape(t.notes ?? ""),
      ].join(","),
    );
    const csv = [header, ...lines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${Date.now()}.csv"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
