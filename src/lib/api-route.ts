/**
 * Shared route-handler envelope for apps/web API routes.
 *
 * SPRINT-002 introduced this so new bounded-context routes (catalog,
 * learning) get the same observability + error-capture contract as the
 * M5-wired `/api/users` route without duplicating ~25 lines of envelope per
 * file: correlation request id, Prometheus counters/histograms, structured
 * request logs, and `captureError` sanitization on the throw path.
 *
 * Each route still owns its auth gate (`requireRole`), rate limit, input
 * validation (`parseQuery`/`parseBody`), and domain call — this helper only
 * standardizes the I/O envelope around them.
 */
import {
  captureError,
  generateRequestId,
  incCounter,
  observeHistogram,
  requestLogger,
  RESPONSE_REQUEST_ID_HEADER,
} from "@learning-platform/core/observability";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RouteCtx = { tenantId?: string; userId?: string };

export function routeEnvelope(request: NextRequest, route: string) {
  const startedAt = Date.now();
  const requestId = generateRequestId(request.headers.get("x-request-id"));
  const log = requestLogger({ requestId, route, method: request.method });

  /** Record metrics + completion log for an outgoing status. */
  const finish = (status: number, ctx?: RouteCtx): void => {
    const durSec = (Date.now() - startedAt) / 1000;
    incCounter("http_requests_total", 1, `${request.method}:${route}:${status}`);
    observeHistogram("http_request_duration_seconds", durSec);
    const logWithCtx =
      ctx && (ctx.tenantId || ctx.userId)
        ? requestLogger({ requestId, route, method: request.method, ...ctx })
        : log;
    logWithCtx.info(
      { status, durationMs: Date.now() - startedAt },
      "request_completed"
    );
  };

  /** JSON response with request-id header + metrics/logs recorded. */
  const respond = (
    body: unknown,
    status: number,
    ctx?: RouteCtx
  ): NextResponse => {
    const resp = NextResponse.json(body, { status });
    resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
    finish(status, ctx);
    return resp;
  };

  /** Sanitized 5xx path: captureError + metrics, same envelope shape. */
  const capture = (err: unknown): NextResponse => {
    const pubErr = captureError(err, {
      requestId,
      route,
      method: request.method,
      logger: log,
    });
    const resp = NextResponse.json({ ...pubErr }, { status: pubErr.status });
    resp.headers.set(RESPONSE_REQUEST_ID_HEADER, requestId);
    incCounter(
      "http_requests_total",
      1,
      `${request.method}:${route}:${pubErr.status}`
    );
    observeHistogram(
      "http_request_duration_seconds",
      (Date.now() - startedAt) / 1000
    );
    return resp;
  };

  return { requestId, log, finish, respond, capture };
}
