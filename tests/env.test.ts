/**
 * `assertProductionEnv` (M7 fix, PR #9 CI-red root cause).
 *
 * Contract this file encodes: production secret/config validation is
 * **fail-closed at server boot** (via `instrumentation.ts register()`) AND
 * **build-safe** — it must NOT throw during `next build` or in dev/test, where
 * a clean environment has no runtime secret and only the dev fallback is
 * present. The regression it prevents is the one that turned PR #9 CI red:
 * `env.ts` threw at module-import under `NODE_ENV=production` in a clean
 * checkout (`AUTH_SECRET` fallback < 32 bytes) → `next build` exit 1.
 *
 * We re-import the module per case (vi.resetModules + dynamic import) so the
 * module-level `isProd` and the captured `env.AUTH_SECRET` / `env.DATABASE_URL`
 * reflect the env we stubbed *before* import. NODE_ENV / NEXT_PHASE / secrets
 * are stubbed and restored each test.
 *
 * We deliberately do NOT assert the dev-only `console.warn` output here — those
 * warnings are DX and already exercised manually; pinning them to snapshots
 * would be brittle for no security value.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "p0C9rGPbLg8fOF9eOmaWgfzhQBa7pvu1UOGFHEnRsa8="; // 44-byte base64 (≥32)
const VALID_DB = "postgres://user:pass@db.example.com:5432/lp?sslmode=require";

async function loadEnv() {
  vi.resetModules();
  return await import("../src/lib/env.js");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertProductionEnv — fail-closed at boot, build-safe", () => {
  it("throws when AUTH_SECRET is shorter than 32 bytes in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", ""); // not a build phase → assertions active
    vi.stubEnv("AUTH_SECRET", "short");
    vi.stubEnv("DATABASE_URL", VALID_DB);
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).toThrow(/shorter than 32 bytes/);
  });

  it("throws when AUTH_SECRET is a known placeholder in production", async () => {
    // The other known placeholder ("dev-secret-change-in-production") is only
    // 31 bytes, so it trips the *length* check first (its own case above). This
    // 41-byte placeholder is ≥32 bytes → exercises the denylist branch.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("AUTH_SECRET", "replace-me-in-production-32-bytes-minimum");
    vi.stubEnv("DATABASE_URL", VALID_DB);
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).toThrow(/known insecure placeholder/);
  });

  it("throws when DATABASE_URL is unparseable in production", async () => {
    // Two `@` shapes confuse the URL parser so `new URL` throws (catch branch).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("DATABASE_URL", "postgres://u:a/b@/lp");
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).toThrow(
      /not a valid PostgreSQL connection URI/
    );
  });

  it("throws when DATABASE_URL parses with no host in production", async () => {
    // A single `@` followed by the path: non-special schemes (postgres) permit
    // an empty host, so this parses with hostname === "" (the no-host branch).
    // The matcher is tolerant: either the no-host message or, on a parser that
    // rejects an empty host, the unparseable-URI message — both prove the same
    // production fail-closed property (an unencoded `/`/`@` in a Railway
    // password must refuse to boot, the lp-app 503 root cause).
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@/lp");
    const { assertProductionEnv } = await loadEnv();
    let caught: unknown = null;
    try {
      assertProductionEnv();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeTruthy();
    expect(String(caught)).toMatch(/no host|not a valid PostgreSQL connection URI/);
  });

  it("does not throw with valid production secrets (happy path)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("AUTH_SECRET", VALID_SECRET);
    vi.stubEnv("DATABASE_URL", VALID_DB);
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("skips assertions during next build (NEXT_PHASE=phase-production-build)", async () => {
    // The clean-build path: production NODE_ENV but a build phase → no throw,
    // even with the insecure default secret. This is the case that ships CI green.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("AUTH_SECRET", "dev-secret-change-in-production");
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).not.toThrow();
  });

  it("skips assertions in non-production (dev/test)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("AUTH_SECRET", "dev-secret-change-in-production");
    const { assertProductionEnv } = await loadEnv();
    expect(() => assertProductionEnv()).not.toThrow();
  });
});
