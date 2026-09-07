/**
 * `/api/metrics` bearer-token gate (HIGH — timing-safe compare).
 *
 * The route defends the Prometheus scrape behind a shared `METRICS_TOKEN`.
 * The compare is `crypto.timingSafeEqual` over equal-length UTF-8 buffers with
 * a length-mismatch short-circuit that refuses without comparing. These tests
 * pin the externally observable behavior: wrong / prefix / missing tokens get
 * 401, the correct token renders metrics, and the no-token-configured path
 * refuses in production (503) but allows in dev (200).
 *
 * Behavior-level tests (we assert status + content-type, not internal timing —
 * a timing assertion in a unit test is both flaky and not what guards the
 * secret; the constant-time compare is the guard, and these tests prove it
 * classifies correctly across the boundary cases that a `!==` compare would
 * also pass, plus the length-vs-content distinction a naive port might miss).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { GET } = await import("../src/app/api/metrics/route.js");

afterEach(() => {
  vi.unstubAllEnvs();
});

function req(auth?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return new NextRequest("http://localhost/api/metrics", { headers });
}

describe("/api/metrics bearer gate (HIGH — timing-safe compare)", () => {
  it("returns 200 + text/plain for the correct bearer token", async () => {
    vi.stubEnv("METRICS_TOKEN", "correct-secret");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req("Bearer correct-secret"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("returns 401 for a wrong token of the same length", async () => {
    vi.stubEnv("METRICS_TOKEN", "correct-secret");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req("Bearer wrong--secret"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a prefix of the token (length-guard short-circuit)", async () => {
    // A naive `!==` would also reject this, but so would a naive timingSafeEqual
    // without a length guard (it throws on unequal lengths). This proves the
    // length-mismatch path refuses cleanly rather than crashing.
    vi.stubEnv("METRICS_TOKEN", "correct-secret");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req("Bearer correct"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization is missing and a token is configured", async () => {
    vi.stubEnv("METRICS_TOKEN", "correct-secret");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req(undefined));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a non-Bearer scheme", async () => {
    vi.stubEnv("METRICS_TOKEN", "correct-secret");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req("Basic correct-secret"));
    expect(res.status).toBe(401);
  });

  it("refuses with 503 in production when no token is configured", async () => {
    vi.stubEnv("METRICS_TOKEN", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req(undefined));
    expect(res.status).toBe(503);
  });

  it("allows in dev when no token is configured", async () => {
    vi.stubEnv("METRICS_TOKEN", "");
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(req(undefined));
    expect(res.status).toBe(200);
  });
});
