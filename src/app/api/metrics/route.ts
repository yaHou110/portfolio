import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { renderPrometheus } from "@learning-platform/core/observability";

export const dynamic = "force-dynamic";

/**
 * Prometheus-format metrics endpoint (M5).
 *
 * Access control: v1 is a single self-hosted dedicated VPS (ADR-0007). The
 * metrics endpoint is meant for an internal scrape target behind the reverse
 * proxy (M6), not the public internet. We gate on a shared bearer token
 * (`METRICS_TOKEN`); when that env var is set, callers must send it as
 * `Authorization: Bearer <token>`. When it is unset, the endpoint refuses in
 * production (no accidental public metrics) and allows in development.
 *
 * Timing-safe compare (HIGH): the bearer check uses `crypto.timingSafeEqual`
 * over equal-length UTF-8 buffers, with a length-mismatch short-circuit that
 * returns 401 *without* comparing (unequal-length buffers throw). A plain `!==`
 * string compare short-circuits on the first differing byte, leaking the
 * correct-token prefix byte-by-byte via response latency — a side channel on a
 * shared secret, even on an internal scrape target.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expectedToken = process.env.METRICS_TOKEN;
  const isProd = process.env.NODE_ENV === "production";

  if (expectedToken) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!secretEqual(provided, expectedToken)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (isProd) {
    // No token configured in prod → refuse rather than expose metrics.
    return NextResponse.json({ error: "metrics disabled" }, { status: 503 });
  }

  return new NextResponse(renderPrometheus(), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}

/**
 * Constant-time equality for two secret strings. Early-returns on length
 * mismatch WITHOUT comparing buffers — `timingSafeEqual` throws on unequal
 * lengths, and the early return itself reveals only that the lengths differ
 * (not the contents), which is unavoidable and not reusable as a prefix
 * oracle. The happy path compares all bytes in constant time.
 */
function secretEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
