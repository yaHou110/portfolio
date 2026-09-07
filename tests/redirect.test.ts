/**
 * Open-redirect defense unit tests (HIGH).
 *
 * `safeCallbackUrl` collapses any `callbackUrl` whose resolved origin differs
 * from the app origin to "/". This pins every bypass class the AI's weaker
 * `startsWith("/") && !startsWith("//")` guard missed:
 *   - protocol-relative `//evil.com` → "/"
 *   - backslash `\\evil.com` (browsers normalize to `//evil.com`) → "/"
 *   - absolute external `https://evil.com` → "/"
 *   - while preserving same-origin paths incl. query/hash.
 *
 * See apps/web/src/lib/redirect.ts.
 */
import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "../src/lib/redirect.js";

const ORIGIN = "https://app.example.com";

describe("safeCallbackUrl (open-redirect defense — HIGH)", () => {
  it("collapses absolute external URLs to /", () => {
    expect(safeCallbackUrl("https://evil.com", ORIGIN)).toBe("/");
    expect(safeCallbackUrl("https://evil.example.com", ORIGIN)).toBe("/");
  });

  it("collapses protocol-relative //evil to /", () => {
    expect(safeCallbackUrl("//evil.com", ORIGIN)).toBe("/");
  });

  it("collapses backslash \\evil to / (browsers normalize to //evil)", () => {
    expect(safeCallbackUrl("\\\\evil.com", ORIGIN)).toBe("/");
    expect(safeCallbackUrl("/\\evil.com", ORIGIN)).toBe("/");
  });

  it("keeps same-origin root-relative paths", () => {
    expect(safeCallbackUrl("/", ORIGIN)).toBe("/");
    expect(safeCallbackUrl("/dashboard", ORIGIN)).toBe("/dashboard");
    expect(safeCallbackUrl("/login?error=1", ORIGIN)).toBe("/login?error=1");
  });

  it("keeps same-origin paths with hash and query", () => {
    expect(safeCallbackUrl("/courses/12#lesson-3", ORIGIN)).toBe(
      "/courses/12#lesson-3"
    );
  });

  it("keeps an absolute same-origin URL but strips the origin", () => {
    expect(safeCallbackUrl(`${ORIGIN}/dashboard`, ORIGIN)).toBe("/dashboard");
  });

  it("collapses a cross-scheme attack (javascript:alert(1)) to /", () => {
    // `javascript:` URLs carry an opaque origin (null) ≠ the app origin, so the
    // same-origin check rejects them — a real redirect-to-XSS/gadget vector that
    // a same-origin-based filter is the correct defense against.
    expect(safeCallbackUrl("javascript:alert(1)", ORIGIN)).toBe("/");
  });

  it("keeps a same-origin relative path even if it looks odd (harmless 404)", () => {
    // `:::not-a-url` is a relative reference → same origin, pathname /:::not-a-url
    // (a 404 on the app). Same-origin, so not an open redirect: kept as-is.
    // WHATWG `new URL` with a base rarely throws for relative strings; the impl's
    // try/catch stays as cheap defense-in-depth for the rare parse failure.
    expect(safeCallbackUrl(":::not-a-url", ORIGIN)).toBe("/:::not-a-url");
  });

  it("falls back to / when origin is unknown (no header spoofing path)", () => {
    expect(safeCallbackUrl("/dashboard", "")).toBe("/");
  });

  it("falls back to / when raw is missing", () => {
    expect(safeCallbackUrl(undefined, ORIGIN)).toBe("/");
  });
});
