/**
 * Request input validation for route handlers (M4.2).
 *
 * Mirrors `requireRole`'s discriminated-union convention so route handlers
 * get a one-line guard they can early-return from:
 *
 *   const q = parseQuery<{ limit: number }>(request, QuerySchema);
 *   if (!q.ok) return q.response;
 *   // q.data is now typed
 *
 * Why this exists even though `/api/users` and `/api/auth/session` take no
 * request input today: it is the reusable harness the backlog calls out so
 * every *future* route that accepts query params or a JSON body gets
 * validation "for free" and cannot accidentally trust raw input. We also use
 * it defensively on `/api/users` against the day it grows pagination params.
 *
 * Schemas use `zod` (already a dependency of `apps/web`.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ZodType } from "zod";

export type ParseOk<T> = { ok: true; data: T };
export type ParseErr = {
  ok: false;
  response: NextResponse;
  /** Zod issues from the failed parse — surfaced so routes can reuse them. */
  issues: unknown;
};
export type ParseResult<T> = ParseOk<T> | ParseErr;

/** Parse + validate `request.nextUrl.searchParams` against a Zod schema. */
export function parseQuery<T>(
  request: NextRequest,
  schema: ZodType<T>
): ParseResult<T> {
  const raw: Record<string, string | string[]> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    const existing = raw[key];
    raw[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const issues = parsed.error.issues;
  return {
    ok: false,
    issues,
    response: NextResponse.json(
      { error: "Invalid query parameters", issues },
      { status: 400 }
    ),
  };
}

/** Parse + validate a JSON request body against a Zod schema. */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<ParseResult<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return {
      ok: false,
      issues: [],
      response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const issues = parsed.error.issues;
  return {
    ok: false,
    issues,
    response: NextResponse.json(
      { error: "Invalid request body", issues },
      { status: 400 }
    ),
  };
}
