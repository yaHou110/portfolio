import { NextResponse } from "next/server";
import { readiness } from "@learning-platform/core/api";

export const dynamic = "force-dynamic";

/**
 * Shallow readiness check (M5). Confirms the process is live and required
 * config (AUTH_SECRET, DATABASE_URL) is loaded. Does NOT ping external
 * deps — use `/api/health` for that. v1's reverse proxy (M6) routes to this
 * endpoint to decide membership.
 *
 * Public in middleware so a load balancer without a session can hit it.
 */
export async function GET(): Promise<NextResponse> {
  const result = await readiness.check();
  const status = result.status === "ready" ? 200 : 503;
  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status }
  );
}
