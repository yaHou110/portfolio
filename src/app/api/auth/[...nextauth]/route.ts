import { handlers } from "@/auth";
import { rateLimit, ipKey } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

export const { GET } = handlers;

/**
 * POST /api/auth/[...nextauth] — Auth.js credentials submission.
 *
 * HIGH-1 fix: this is the credential-submit path and the only in-app surface
 * where Auth.js runs `bcrypt.compare` for a password guess. Without throttling
 * an attacker gets unlimited guesses per account (brute-force / credential
 * stuffing). We gate it with the in-memory token-bucket limiter, keyed by the
 * *un-spoofable* caller IP (see `ipKey` HIGH-2). This caps guess rate from any
 * single source.
 *
 * Capacity is intentionally tighter than the session/users limiters: 10 burst
 * with 1 token per 5s sustained. A real user retries a wrong password a
 * handful of times then pauses; a bot hammering guesses exhausts the bucket
 * and gets 429 + Retry-After. Per-account database-backed lockout (distributed
 * stuffing, many IPs vs one account) is a founder decision recorded below.
 *
 * Note: middleware exempts /api/auth/* from the auth redirect (so the POST can
 * be reached unauthenticated); this wrapper is the chokepoint that actually
 * throttles the credential flow.
 *
 * Founder decision (surfaced, not auto-applied): add a per-account lockout —
 * track failedLoginAttempts + lockedUntil on the user row, lock after N fails
 * for a cool-down, reset on success. This complements the IP limiter against
 * distributed guessing. Not added here because it needs a schema migration and
 * a policy decision (N, cool-down, self-service unlock) that is the user's.
 */
export async function POST(request: NextRequest) {
  const limiter = rateLimit({
    key: `login:${ipKey(request)}`,
    capacity: 10,
    refillPerSec: 0.2, // 1 token per 5s sustained after the burst
  });
  if (!limiter.ok) return limiter.response;
  return handlers.POST(request);
}
