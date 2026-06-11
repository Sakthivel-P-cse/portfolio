import { getUser } from "@/lib/auth";
import { undoLast, redoLast, undoRedoState } from "@/lib/db/audit";
import { ok, unauthorized, handleError } from "@/lib/api";

// POST /api/transactions/undo  body: { action: "undo" | "redo" }
export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { action } = await request.json().catch(() => ({ action: "undo" }));
    const entityType =
      action === "redo" ? await redoLast(user.id) : await undoLast(user.id);

    const state = await undoRedoState(user.id);
    return ok({ entityType, ...state });
  } catch (e) {
    return handleError(e);
  }
}

// GET /api/transactions/undo → { canUndo, canRedo }
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    return ok(await undoRedoState(user.id));
  } catch (e) {
    return handleError(e);
  }
}
