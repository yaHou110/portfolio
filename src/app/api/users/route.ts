import { identity } from "@learning-platform/core/api";
import {
  generateRequestId,
  requestLogger,
  incCounter,
  observeHistogram,
  RESPONSE_REQUEST_ID_HEADER,
} from "@learning-platform/core/observability";
import { requireRole } from "@/lib/authz";
import { rateLimit } from "@/lib/rate-limit";
import { parseQuery } from "@/lib/validation";
import { captureError } from "@learning-platform/core/observability";
import { z } from "zod";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/users
 *
 * Lists users in the caller's tenant. M4-0 (Session 015) tightened this
 * route in two ways:
 *
 *   1. The Drizzle projection in `identity.listUsers` is explicit and does
 *      NOT select `passwordHash`. The `UserPublic` return type also does
 *      not include `passwordHash`. Defense in depth: SQL, the type system,
 *      and the JSON serializer all agree.
 *
 *   2. The route is gated by `requireRole(["center_admin", "super_admin"])`.
 *      A `student` or `teacher` (or any caller without a session) gets 401
 *      or 403, not a list of users.
 *
 * M4.2 (2026-07-15) added:
 *   3. Per-admin rate limiting (30 req / sustained 1 req/s) keyed by user id.
 *   4. Defensive query-string validation against `UsersQuerySchema`. The
 *      schema currently allows only an optional no-op so future pagination
 *      params get validated "for free" instead of reaching the DB raw.
 *
 * M5 (2026-07-20) added:
 *   5. Per-request structured logging (requestId, tenantId, userId, route)
 *      and Prometheus metrics (request count + latency histogram). A request
 *      id is surfaced back on the response so a support report correlates
 *      to a server log line.
 *
 * See `evidence/M4-security/M4-0-authz-data-leak.md`,
 * `evidence/M4-security/M4-2-hardening.md`, and
 * `evidence/M5-observability/notes.md` for the full records.
 */

const UsersQuerySchema = z
  .object({
    // Reserved for future pagination. Accepted only as a no-op today so the
    // route does not silently start trusting unvalidated params later.
  })
  .strict();

const ROUTE = "/api/users";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = generateRequestId(request.headers.get("x-request-id"));
  const start = () => Date.now();

  // We can only build the full context (tenantId/userId) after the auth gate
  // resolves; until then log with requestId + route so the authz path is
  // traceable too.
  const earlyLog = requestLogger({
    requestId,
    route: ROUTE,
    method: request.method,
  });

  const finish = (status: number, ctx?: { tenantId?: string; userId?: string }) => {
    const durSec = (Date.now() - startedAt) / 1000;
    const labels = `${request.method}:${ROUTE}:${status}`;
    incCounter("http_requests_total", 1, labels);
    observeHistogram("http_request_duration_seconds", durSec);
    const log =
      ctx && (ctx.tenantId || ctx.userId)
        ? requestLogger({ requestId, route: ROUTE, method: request.method, ...ctx })
        : earlyLog;
    log.info({ status, durationMs: Date.now() - startedAt }, "request_completed");
    return status;
  };

  try {
    const gate = await requireRole(["center_admin", "super_admin"] as const);
    if (!gate.ok) {
      const status = gate.response.status;
      const resp = NextResponse.json(
        { error: status === 401 ? "Unauthorized" : "Forbidden", requestId },
        { status }
      );
      resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
      finish(status);
      return resp;
    }

    const limiter = rateLimit({
      key: `users:${gate.user.id}`,
      capacity: 30,
      refillPerSec: 1,
    });
    if (!limiter.ok) {
      const status = 429;
      const resp = limiter.response;
      resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
      finish(status, { tenantId: gate.user.tenantId, userId: gate.user.id });
      return resp;
    }

    const q = parseQuery(request, UsersQuerySchema);
    if (!q.ok) {
      const status = 400;
      const resp = NextResponse.json(
        { error: "Bad request", requestId },
        { status }
      );
      resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
      finish(status, { tenantId: gate.user.tenantId, userId: gate.user.id });
      return resp;
    }

    const users = await identity.listUsers(gate.user.tenantId);
    const resp = NextResponse.json(users);
    resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
    finish(200, { tenantId: gate.user.tenantId, userId: gate.user.id });
    return resp;
  } catch (err) {
    const pubErr = captureError(err, {
      requestId,
      route: ROUTE,
      method: request.method,
      logger: earlyLog,
    });
    const resp = NextResponse.json({ ...pubErr }, { status: pubErr.status });
    resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
    incCounter("http_requests_total", 1, `${request.method}:${ROUTE}:${pubErr.status}`);
    observeHistogram(
      "http_request_duration_seconds",
      (start() - (startedAt as unknown as number)) / 1000
    );
    return resp;
  }
}
