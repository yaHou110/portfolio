import { NextResponse } from "next/server";
import { health } from "@learning-platform/core/api";

export const dynamic = "force-dynamic";

/**
 * Deep health check (M5). Pings external dependencies. Returns 200 when
 * every configured check passes, 503 otherwise. The route is a public
 * pass-through in middleware (see `middleware.ts`) so a reverse proxy in
 * M6 can scrape it without a session.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = await health.check();
    const status = result.status === "ok" ? 200 : 503;
    return NextResponse.json(
      { ...result, timestamp: new Date().toISOString() },
      { status }
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        checks: { db: false, auth: false, storage: "skipped" },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
