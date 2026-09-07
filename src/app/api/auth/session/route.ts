import { auth } from "@/auth";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import {
  generateRequestId,
  requestLogger,
  incCounter,
  observeHistogram,
  captureError,
  RESPONSE_REQUEST_ID_HEADER,
} from "@learning-platform/core/observability";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session
 *
 * Returns the caller's session. M4.2 (2026-07-15) added an IP-keyed rate
 * limit so an unauthenticated attacker cannot hammer this endpoint to
 * probe session validity. Buckets: 60 req burst, 1 req/s sustained. Authjs
 * internals (`/api/auth/*` catch-all) are exempted from middleware and rely
 * on their own handling, but this thin session route is ours to guard.
 *
 * M5 observability parity (MED fix): this route now uses the same
 * request-id + metrics + `captureError` envelope as `/api/users`, so a support
 * report on a 401/429/5xx here correlates to a server log line and every
 * response carries the `x-request-id` header. The 401/429 bodies return the
 * same `{ error, requestId }` shape as `/api/users` (the public `code` field
 * only appears on `captureError` 5xx, so neither 401 route invented one).
 */
const ROUTE = "/api/auth/session";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const requestId = generateRequestId(request.headers.get("x-request-id"));

  const earlyLog = requestLogger({
    requestId,
    route: ROUTE,
    method: request.method,
  });

  const finish = (status: number, ctx?: { userId?: string }) => {
    const durSec = (Date.now() - startedAt) / 1000;
    const labels = `${request.method}:${ROUTE}:${status}`;
    incCounter("http_requests_total", 1, labels);
    observeHistogram("http_request_duration_seconds", durSec);
    const log =
      ctx && ctx.userId
        ? requestLogger({ requestId, route: ROUTE, method: request.method, ...ctx })
        : earlyLog;
    log.info({ status, durationMs: Date.now() - startedAt }, "request_completed");
    return status;
  };

  const setRid = (resp: NextResponse): NextResponse => {
    resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
    return resp;
  };

  try {
    const limiter = rateLimit({
      key: `session:${ipKey(request)}`,
      capacity: 60,
      refillPerSec: 1,
    });
    if (!limiter.ok) {
      const status = 429;
      setRid(limiter.response);
      finish(status);
      return limiter.response;
    }

    const session = await auth();
    if (!session?.user) {
      const status = 401;
      finish(status);
      return setRid(
        NextResponse.json({ error: "Unauthorized", requestId }, { status })
      );
    }

    finish(200, { userId: session.user.id });
    return setRid(
      NextResponse.json({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role,
          tenantId: session.user.tenantId,
        },
      })
    );
  } catch (err) {
    const pubErr = captureError(err, {
      requestId,
      route: ROUTE,
      method: request.method,
      logger: earlyLog,
    });
    const resp = NextResponse.json({ ...pubErr }, { status: pubErr.status });
    setRid(resp);
    incCounter("http_requests_total", 1, `${request.method}:${ROUTE}:${pubErr.status}`);
    observeHistogram(
      "http_request_duration_seconds",
      (Date.now() - startedAt) / 1000
    );
    return resp;
  }
}
