/**
 * Authorization helpers for Next.js App Router route handlers.
 *
 * Routes that touch tenant data MUST go through `requireRole()` instead of
 * the bare `auth()` call. This is the single place where the
 * "is the caller allowed to do this?" decision lives. New routes get
 * authorization for free; existing routes are tightened in M4-0
 * (see `evidence/M4-security/M4-0-authz-data-leak.md`).
 *
 * Design notes:
 * - We return a discriminated union (`{ ok: true, user } | { ok: false, response }`)
 *   so the route handler can early-return the prebuilt 401/403 NextResponse.
 *   No exceptions; the caller does not need a try/catch and cannot accidentally
 *   forget to set a status code.
 * - The role list is the allowlist. Roles not in the list are rejected.
 *   There is no "deny" list — only "this role is allowed".
 * - The helper does NOT check the per-request `isActive` flag. That lives
 *   in the Auth.js `session` callback (see `apps/web/src/auth.ts`). By the
 *   time `requireRole()` reads `auth()`, the session is already either
 *   present and valid, or absent (deactivated users get null here).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@learning-platform/core/db/schema";

/** Shape of the authenticated user the routes can rely on. */
export type AuthzUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
};

export type AuthzOk = { ok: true; user: AuthzUser };
export type AuthzErr = { ok: false; response: NextResponse };
export type AuthzResult = AuthzOk | AuthzErr;

/**
 * Gate a route handler behind an allowlist of roles.
 *
 * Usage:
 *   export async function GET() {
 *     const gate = await requireRole(["center_admin", "super_admin"]);
 *     if (!gate.ok) return gate.response;
 *     // ... gate.user is typed and safe to use ...
 *   }
 */
export async function requireRole(allowed: readonly Role[]): Promise<AuthzResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!allowed.includes(session.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user: session.user };
}
