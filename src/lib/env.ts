/**
 * Environment variable validation.
 *
 * IMPORTANT — this module MUST NOT throw at import time.
 *
 * `next build` imports every route module under `NODE_ENV=production` to collect
 * page data, and in a *clean build environment* (CI checkout, Docker build
 * stage, Vercel build) there is no `.env` and no runtime secret. An import-time
 * throw here therefore kills the build in exactly the environments that must be
 * buildable before secrets are provisioned. That is what turned PR #9 CI red: a
 * fresh checkout has no `AUTH_SECRET`, the fallback `dev-secret-change-in-
 * production` is < 32 bytes and on the denylist, so the eager assertion threw
 * while collecting page data for `/api/auth/[...nextauth]` → `next build`
 * exited 1. (The Docker builder stage has the same shape.)
 *
 * Resolution: this module reads env vars with safe dev fallbacks and emits dev
 * warnings (DX — a forgotten `.env` stays loud), but does NOT throw. The
 * fail-closed production check lives in `assertProductionEnv()` below, which is
 * invoked ONCE at server boot via `apps/web/src/instrumentation.ts` `register()`
 * — a hook Next runs when the server starts (and per serverless cold start),
 * NOT during `next build`. A production boot with a missing / short / placeholder
 * `AUTH_SECRET` or an unparseable `DATABASE_URL` then refuses to serve requests
 * rather than silently issuing JWTs signed by a known dev placeholder.
 *
 * So the guarantee is preserved (and localized to runtime), while every clean
 * environment builds. See `instrumentation.ts` and the [Unreleased] changelog
 * entry for the full rationale.
 */

const isProd = process.env.NODE_ENV === "production";

/**
 * Next sets this while `next build` runs. Used as a belt-and-suspenders guard
 * inside `assertProductionEnv()` so the boot-time assertion can never fire
 * during a build even if `register()` were invoked.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Known insecure / placeholder `AUTH_SECRET` values that must never reach a
 * production boot. If an operator copies `.env.example` (which documents
 * `replace-me-in-production-32-bytes-minimum`) into a prod env file, this
 * denylist refuses to boot instead of issuing JWT/session tokens signed by a
 * publicly-known, repo-committed secret (⇒ token forgery = full takeover).
 */
const KNOWN_INSECURE_SECRETS = new Set([
  "dev-secret-change-in-production",
  "replace-me-in-production-32-bytes-minimum",
]);

/** Minimum secret length. Auth.js / JWT signing wants ≥32 bytes of entropy. */
const MIN_SECRET_BYTES = 32;

/**
 * Non-throwing env read with a dev fallback. In dev, warns if the variable is
 * unset (so a forgotten `.env` is loud). In production, returns the fallback
 * silently — the real fail-closed check is `assertProductionEnv()` at boot, not
 * import. Never throws.
 */
function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    console.warn(
      `[env] WARNING: "${name}" is not set. Using insecure dev default. ` +
        "Set this in .env or your environment before deploying."
    );
  }
  return value ?? "";
}

/**
 * Non-throwing `AUTH_SECRET` read. In dev, warns when a placeholder / empty
 * value is in use so a forgotten `.env` doesn't silently ship a weak secret.
 * In production, the value is read without throwing; validity is enforced by
 * `assertProductionEnv()`. Never throws.
 */
function readSecret(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback;
  if (!value || KNOWN_INSECURE_SECRETS.has(value)) {
    console.warn(
      `[env] WARNING: "${name}" is using an insecure dev placeholder. ` +
        "Set a unique value (openssl rand -base64 32) before deploying."
    );
  }
  return value ?? "";
}

/**
 * Non-throwing `DATABASE_URL` read that keeps the URL-form sanity checks from
 * the M7 data-layer audit (an unencoded `/` or stray `@` inside a Railway
 * password terminates the URL authority early → `new URL` reports no host),
 * but only *warns* — never throws at import. Production validity is enforced
 * in `assertProductionEnv()` at boot.
 *
 * Libpq key=value form (no `postgres://` scheme) is left untouched: it has no
 * authority segment and `new URL` would false-positive on it.
 */
function readDatabaseUrl(name: string, fallback: string): string {
  const value = readEnv(name, fallback);
  if (!/^postgres(?:ql)?:\/\//i.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    console.warn(
      `[env] WARNING: "${name}" failed URL parse. If the password has special chars, ` +
        "percent-encode them (`/` -> `%2F`, `@` -> `%40`)."
    );
    return value;
  }

  // An empty hostname means the authority terminated early — the classic
  // signal of an unencoded `/` or stray `@` inside the password segment.
  if (!parsed.hostname) {
    console.warn(
      `[env] WARNING: "${name}" parsed with no host — likely an unencoded char in the ` +
        "DB password. Percent-encode it (see apps/web/.env.example)."
    );
  }
  return value;
}

export const env = {
  AUTH_SECRET: readSecret("AUTH_SECRET", "dev-secret-change-in-production"),
  DATABASE_URL: readDatabaseUrl(
    "DATABASE_URL",
    "postgres://learning_platform:learning_platform@localhost:5432/learning_platform"
  ),
  AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? "true",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
  // SMS provider for the password-reset flow. "mock" logs the code to the
  // server console (and echoes it in non-production API responses);
  // "kavenegar" sends a real SMS (requires KAVENEGAR_API_KEY + SENDER).
  SMS_PROVIDER: process.env.SMS_PROVIDER ?? "mock",
  KAVENEGAR_API_KEY: process.env.KAVENEGAR_API_KEY ?? "",
  KAVENEGAR_SENDER: process.env.KAVENEGAR_SENDER ?? "",
} as const;

/**
 * Fail-closed production config validation. Run ONCE at server boot from
 * `apps/web/src/instrumentation.ts` `register()` — NOT at module import and
 * NOT during `next build`. Throws an actionable `Error` on the first invalid
 * value so a misconfigured production deploy refuses to serve requests rather
 * than silently issuing JWTs signed by a known dev placeholder or connecting to
 * the dev DB.
 *
 * Error messages are kept phrase-stable: they are referenced in operator docs
 * (`docs/07-deployment/DEPLOYMENT_GUIDE.md`) and evidence notes, and surfaced to
 * operators at boot. `isProd` is captured at import (`NODE_ENV=production`),
 * `isBuildPhase` is set by `next build`; either skips the assertion so a clean
 * build can never throw here.
 */
export function assertProductionEnv(): void {
  if (!isProd || isBuildPhase) return;

  // --- AUTH_SECRET ---
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_BYTES) {
    throw new Error(
      `[env] "AUTH_SECRET" is shorter than ${MIN_SECRET_BYTES} bytes. ` +
        "Generate a unique secret with: openssl rand -base64 32"
    );
  }
  if (KNOWN_INSECURE_SECRETS.has(secret)) {
    throw new Error(
      `[env] "AUTH_SECRET" is set to a known insecure placeholder (committed in ` +
        ".env.example / dev fallback). Generate a unique secret with: " +
        "openssl rand -base64 32"
    );
  }

  // --- DATABASE_URL ---
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      '[env] Required environment variable "DATABASE_URL" is not set. ' +
        "Set it in your deployment environment or .env file."
    );
  }
  if (/^postgres(?:ql)?:\/\//i.test(dbUrl)) {
    let parsed: URL;
    try {
      parsed = new URL(dbUrl);
    } catch (e) {
      throw new Error(
        `[env] "DATABASE_URL" is not a valid PostgreSQL connection URI: ${(e as Error).message}. ` +
          "If the DB password contains `/`, `@`, `:`, or `%`, percent-encode it " +
          "(`/` -> `%2F`, `@` -> `%40`, `:` -> `%3A`, `%` -> `%25`)."
      );
    }
    if (!parsed.hostname) {
      throw new Error(
        `[env] "DATABASE_URL" parsed with no host — the DB password likely contains an ` +
          "unencoded `/` or `@` that ends the URL authority before the host. " +
          "Percent-encode it in the connection string (`/` -> `%2F`, `@` -> `%40`)."
      );
    }
  }
}
