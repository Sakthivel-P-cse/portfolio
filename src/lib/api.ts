import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function err(message: string, status = 400, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

export function unauthorized() {
  return err("Unauthorized", 401);
}

/** Maps thrown errors (Zod, generic) to a JSON response. */
export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err("Validation failed", 422, e.flatten());
  }
  if (e instanceof Error) {
    return err(e.message, 500);
  }
  return err("Unexpected error", 500);
}
