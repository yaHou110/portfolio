/**
 * In-memory rate limiter for Node-runtime route handlers (M4.2).
 *
 * Why this lives in route handlers (not middleware): Next.js middleware runs
 * on the Edge runtime, which has no durable per-instance state and no
 * setTimeout-based timers. A token-bucket there is unreliable. This helper
 * is imported by Node route handlers (apps/web/src/app/api/.../route.ts),
 * which run on the Node.js runtime. A single-process deployment (v1, per
 * ARCHITECTURE_CONSTRAINTS C1: single VPS up to 4 GB) gets an effective,
 * dependency-free limiter.
 *
 * Trade-offs (recorded in evidence/M4-security/M4-2-hardening.md):
 * - State is per-process and resets on restart / redeploy.
 * - Not shared across multiple instances or PM2 workers. v1 deploys one
 *   process, so this is acceptable. If we ever fan out to multiple Node
 *   processes, swap the store for Redis (OSS-first, self-hosted) - the
 *   rateLimit call-site shape stays identical.
 * - Buckets are keyed by caller identity. Unauthenticated callers are
 *   keyed by x-forwarded-for (socket address as fallback); authenticated
 *   callers should be keyed by userId.
 *
 * Design: token-bucket with lazy refill. We track tokens + the last refill
 * timestamp per key and refill lazily on each call (no timers, so nothing
 * to clean up on shutdown). Idle buckets are swept periodically.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type RateLimitOk = {
  ok: true;
  /** Remaining tokens after this call. Useful for X-RateLimit headers. */
  remaining: number;
};

export type RateLimitErr = {
  ok: false;
  response: NextResponse;
  /** Seconds until at least one token is available (mirrors Retry-After). */
  retryAfterSec: number;
};

export type RateLimitResult = RateLimitOk | RateLimitErr;

type Bucket = {
  tokens: number;
  /** Last refill time, in epoch ms (kept monotonic enough for a limiter). */
  updatedAt: number;
};

export type RateLimitOptions = {
  /** Bucket key. Caller chooses (user id, ip, tenant+ip, ...). */
  key: string;
  /** Max tokens (burst capacity). */
  capacity: number;
  /** Tokens added per second (sustained rate). */
  refillPerSec: number;
};

// Module-level store. One map per process. Keyed by caller identity.
const buckets = new Map<string, Bucket>();

// Sweep stale buckets at most once per SWEEP_INTERVAL_MS to bound memory in
// the face of many distinct caller keys (e.g. flood of unique IPs).
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

// Date.now() is available in plain Node route handlers (it is only forbidden
// inside Workflow scripts). Rate-limit math needs wall time; correct here.
const now = (): number => Date.now();

function sweepIfNeeded(threshold: number): void {
  if (threshold - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = threshold;
  for (const [k, b] of buckets) {
    if (threshold - b.updatedAt > SWEEP_INTERVAL_MS) {
      buckets.delete(k);
    }
  }
}

/**
 * Consume one token from the bucket. Returns a discriminated union so the
 * route handler can early-return the prebuilt 429 response, mirroring the
 * requireRole helper's shape.
 *
 * Usage:
 *   const gate = rateLimit({ key: user.id, capacity: 30, refillPerSec: 1 });
 *   if (!gate.ok) return gate.response;
 */
export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const { key, capacity, refillPerSec } = opts;
  if (refillPerSec <= 0) {
    throw new Error("[rateLimit] refillPerSec must be > 0");
  }

  const t = now();
  sweepIfNeeded(t);

  const b = buckets.get(key);
  if (b) {
    // Lazy refill: add tokens proportional to elapsed time, capped at capacity.
    const elapsedSec = Math.max(0, (t - b.updatedAt) / 1000);
    const tokens = Math.min(capacity, b.tokens + elapsedSec * refillPerSec);
    if (tokens >= 1) {
      const remaining = tokens - 1;
      buckets.set(key, { tokens: remaining, updatedAt: t });
      return { ok: true, remaining: Math.floor(remaining) };
    }
    // Empty: deny. Retry-After = time to gain one token.
    const retryAfterSec = Math.max(1, Math.ceil((1 - tokens) / refillPerSec));
    buckets.set(key, { tokens, updatedAt: t });
    return {
      ok: false,
      retryAfterSec,
      response: NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      ),
    };
  }

  // No bucket yet: start full, consume one.
  const remaining = capacity - 1;
  buckets.set(key, { tokens: remaining, updatedAt: t });
  return { ok: true, remaining: Math.floor(remaining) };
}

/**
 * Derive a limiter key from a request for unauthenticated calls.
 *
 * Trust the peer IP as the **reverse proxy recorded it** — never the
 * client-supplied leftmost `x-forwarded-for`. nginx (M6 nginx.conf) sets
 * `X-Real-IP: $remote_addr` and **overwrites** `X-Forwarded-For` with
 * `$remote_addr` (so the header carries a single hop = the real client,
 * discarding any forged value the client sent). Prefer `X-Real-IP`; fall back
 * to that single-hop `X-Forwarded-For`; fall back to a constant so the limiter
 * never accidentally no-ops on a missing identity.
 *
 * Why not the leftmost XFF chain entry: a proxy that appends
 * (`proxy_add_x_forwarded_for`) keeps a client-supplied chain, so an attacker
 * can mint a fresh leftmost entry per request and reset their own rate-limit
 * bucket — defeating every ip-keyed limiter (login brute-force, session
 * probing). The overwrite + this resolver make those buckets un-spoofable.
 */
export function ipKey(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const ip = realIp.trim();
    if (ip) return "ip:" + ip;
  }
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // After the nginx overwrite fix, XFF is a single hop = the real client.
    // Leftmost is the real client because no append occurs.
    const first = xff.split(",")[0]?.trim();
    if (first) return "ip:" + first;
  }
  return "ip:anonymous";
}

/**
 * Test-only helper: clear all buckets (between test cases).
 */
export function __resetRateLimitStoreForTests(): void {
  buckets.clear();
  lastSweep = 0;
}
