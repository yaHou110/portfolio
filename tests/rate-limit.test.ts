/**
 * M4.2 — the in-memory token-bucket rate limiter. Pins:
 *   - first call succeeds and starts the bucket at capacity-1
 *   - calls beyond capacity (within the refill window) return 429 + Retry-After
 *   - the bucket refills at the configured rate over time
 *   - distinct keys have independent buckets
 *
 * Pure + deterministic: buckets live in a module-level map which we reset
 * between cases; time is advanced with fake timers for the refill assertions.
 *
 * Note on asserting the 429 body: NextResponse.json stores the JSON as a
 * ReadableStream body (Web Fetch API), so we assert on status + headers
 * rather than JSON.stringify(response.body).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { rateLimit, ipKey, __resetRateLimitStoreForTests } = await import(
  "../src/lib/rate-limit.js"
);

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  __resetRateLimitStoreForTests();
  vi.setSystemTime(0);
});

describe("rateLimit (M4.2)", () => {
  it("allows up to capacity and then denies with 429 + Retry-After", () => {
    const capacity = 3;
    const results: boolean[] = [];
    for (let i = 0; i < capacity; i++) {
      results.push(
        rateLimit({ key: "k", capacity, refillPerSec: 1 }).ok
      );
    }
    expect(results).toEqual([true, true, true]);

    const denied = rateLimit({ key: "k", capacity, refillPerSec: 1 });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.response.status).toBe(429);
      expect(denied.response.headers.get("Retry-After")).toBeTruthy();
      // content-type confirms it is a JSON error response
      expect(denied.response.headers.get("content-type")).toContain(
        "application/json"
      );
    }
  });

  it("refills at the configured rate", () => {
    // capacity 2: spend both, advance time, spend again without 429.
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(true);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(true);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(false);

    // 1 second at 1 token/sec restores exactly 1 token.
    vi.advanceTimersByTime(1000);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(true);

    // Advance enough to fully refill (cap at capacity) + 1 more sustained.
    vi.advanceTimersByTime(4000);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(true);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(true);
    expect(
      rateLimit({ key: "refill", capacity: 2, refillPerSec: 1 }).ok
    ).toBe(false);
  });

  it("keeps buckets independent per key", () => {
    expect(
      rateLimit({ key: "a", capacity: 1, refillPerSec: 1 }).ok
    ).toBe(true);
    // key "a" is now empty; key "b" is untouched.
    expect(
      rateLimit({ key: "a", capacity: 1, refillPerSec: 1 }).ok
    ).toBe(false);
    expect(
      rateLimit({ key: "b", capacity: 1, refillPerSec: 1 }).ok
    ).toBe(true);
  });

  it("rejects a non-positive refill rate", () => {
    expect(() =>
      rateLimit({ key: "x", capacity: 1, refillPerSec: 0 })
    ).toThrow();
  });
});

/**
 * ipKey resolves the caller's IP from what the reverse proxy recorded, NOT
 * from a client-supplied X-Forwarded-For chain (which an attacker mints a
 * fresh leftmost entry of to reset their rate-limit bucket). See HIGH-2 fix.
 */
import type { NextRequest } from "next/server";

function reqWith(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("ipKey (HIGH-2: un-spoofable caller IP)", () => {
  it("prefers X-Real-IP even when a forged XFF claims a different leftmost", () => {
    const key = ipKey(
      reqWith({
        "x-real-ip": "203.0.113.9",
        // attacker tried to forge the leftmost hop:
        "x-forwarded-for": "1.1.1.1, 203.0.113.9",
      })
    );
    expect(key).toBe("ip:203.0.113.9");
  });

  it("falls back to the single-hop XFF leftmost when X-Real-IP is absent", () => {
    // After the nginx overwrite fix, XFF carries one entry = the real client.
    const key = ipKey(reqWith({ "x-forwarded-for": "198.51.100.7" }));
    expect(key).toBe("ip:198.51.100.7");
  });

  it("ignores a forged XFF whenever a trusted X-Real-IP is present", () => {
    const key = ipKey(
      reqWith({
        "x-real-ip": "  10.0.0.5  ",
        "x-forwarded-for": "spoofed-attacker-ip",
      })
    );
    expect(key).toBe("ip:10.0.0.5"); // trims whitespace
  });

  it("falls back to a constant when neither IP header is present", () => {
    expect(ipKey(reqWith({}))).toBe("ip:anonymous");
  });
});
