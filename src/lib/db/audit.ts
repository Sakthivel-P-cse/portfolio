// Audit + undo/redo engine. Source of truth is the AuditLog table, so undo/redo
// survives reloads and works across devices.
import type {
  AuditAction,
  EntityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { rebuildSnapshots } from "@/lib/db/snapshots";

type Tx = Prisma.TransactionClient;

interface RecordArgs {
  userId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  oldData?: Prisma.InputJsonValue | null;
  newData?: Prisma.InputJsonValue | null;
}

/** Write an audit log row. Call inside the same transaction as the mutation. */
export async function recordAudit(tx: Tx, args: RecordArgs) {
  return tx.auditLog.create({
    data: {
      userId: args.userId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      oldData: args.oldData ?? undefined,
      newData: args.newData ?? undefined,
    },
  });
}

// Cast JSON back to a Prisma create/update payload. Stored snapshots are
// already serialized (Decimal→string, Date→ISO); Prisma accepts these.
type JsonRecord = Record<string, unknown>;

function toTransactionData(json: JsonRecord) {
  return {
    id: json.id as string,
    userId: json.userId as string,
    date: new Date(json.date as string),
    amount: json.amount as string,
    type: json.type as Prisma.TransactionCreateInput["type"],
    reason: (json.reason as string) ?? null,
    notes: (json.notes as string) ?? null,
  };
}

/**
 * Undo the most recent un-undone action for a user.
 * Returns the affected entityType, or null if nothing to undo.
 */
export async function undoLast(userId: string): Promise<EntityType | null> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.auditLog.findFirst({
      where: { userId, undoneAt: null, action: { in: ["CREATE", "UPDATE", "DELETE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!last) return null;

    await applyInverse(tx, last);

    await tx.auditLog.update({
      where: { id: last.id },
      data: { undoneAt: new Date() },
    });

    if (last.entityType === "TRANSACTION") await rebuildSnapshots(tx, userId);
    return last.entityType;
  });
}

/** Redo the most recently undone action. */
export async function redoLast(userId: string): Promise<EntityType | null> {
  return prisma.$transaction(async (tx) => {
    const last = await tx.auditLog.findFirst({
      where: { userId, undoneAt: { not: null }, action: { in: ["CREATE", "UPDATE", "DELETE"] } },
      orderBy: { undoneAt: "desc" },
    });
    if (!last) return null;

    await applyForward(tx, last);

    await tx.auditLog.update({
      where: { id: last.id },
      data: { undoneAt: null },
    });

    if (last.entityType === "TRANSACTION") await rebuildSnapshots(tx, userId);
    return last.entityType;
  });
}

// Reverse the effect of an action (used by undo).
async function applyInverse(
  tx: Tx,
  log: { action: AuditAction; entityType: EntityType; entityId: string; oldData: unknown; newData: unknown },
) {
  if (log.entityType !== "TRANSACTION") return; // only transactions are undoable here

  if (log.action === "CREATE") {
    // Inverse of create = delete.
    await tx.transaction.deleteMany({ where: { id: log.entityId } });
  } else if (log.action === "DELETE") {
    // Inverse of delete = recreate from oldData.
    if (log.oldData) {
      await tx.transaction.create({ data: toTransactionData(log.oldData as JsonRecord) });
    }
  } else if (log.action === "UPDATE") {
    // Inverse of update = restore oldData.
    if (log.oldData) {
      const d = toTransactionData(log.oldData as JsonRecord);
      await tx.transaction.update({
        where: { id: log.entityId },
        data: { date: d.date, amount: d.amount, type: d.type, reason: d.reason, notes: d.notes },
      });
    }
  }
}

// Re-apply the effect of an action (used by redo).
async function applyForward(
  tx: Tx,
  log: { action: AuditAction; entityType: EntityType; entityId: string; oldData: unknown; newData: unknown },
) {
  if (log.entityType !== "TRANSACTION") return;

  if (log.action === "CREATE") {
    if (log.newData) {
      await tx.transaction.create({ data: toTransactionData(log.newData as JsonRecord) });
    }
  } else if (log.action === "DELETE") {
    await tx.transaction.deleteMany({ where: { id: log.entityId } });
  } else if (log.action === "UPDATE") {
    if (log.newData) {
      const d = toTransactionData(log.newData as JsonRecord);
      await tx.transaction.update({
        where: { id: log.entityId },
        data: { date: d.date, amount: d.amount, type: d.type, reason: d.reason, notes: d.notes },
      });
    }
  }
}

/** Whether undo/redo are currently available for a user (drives button state). */
export async function undoRedoState(userId: string) {
  const [canUndo, canRedo] = await Promise.all([
    prisma.auditLog.count({
      where: { userId, undoneAt: null, action: { in: ["CREATE", "UPDATE", "DELETE"] } },
    }),
    prisma.auditLog.count({
      where: { userId, undoneAt: { not: null }, action: { in: ["CREATE", "UPDATE", "DELETE"] } },
    }),
  ]);
  return { canUndo: canUndo > 0, canRedo: canRedo > 0 };
}
