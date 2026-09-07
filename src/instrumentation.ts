/**
 * Next.js instrumentation hook — `register()` runs ONCE when the Next.js server
 * boots (`next start`, or a serverless cold start), AFTER `next build` has
 * finished. It does NOT run during `next build`, which makes it the correct
 * home for fail-closed boot checks rather than module-import time.
 *
 * WHY THIS FILE EXISTS
 *
 * `apps/web/src/lib/env.ts` previously asserted `AUTH_SECRET` length and
 * `DATABASE_URL` validity at *module-import* time (the eager `env` object).
 * `next build` imports every route module under `NODE_ENV=production` to collect
 * page data, and in a *clean* environment (CI checkout, the Docker builder
 * stage, Vercel build) there is no `.env` / runtime secret, so the env fallback
 * (`dev-secret-change-in-production`, < 32 bytes and on the denylist) tripped
 * the import-time assertion and the build exited 1 — PR #9 CI red / Vercel
 * deploy failed.
 *
 * The guarantee was relocated here: `env.ts` no longer throws at import (it
 * keeps dev warnings for DX); `assertProductionEnv()` is called from this
 * `register()` at server boot, so a production deploy with a missing / short /
 * placeholder `AUTH_SECRET` or an unparseable `DATABASE_URL` refuses to start
 * — and therefore refuses to serve any request — rather than silently signing
 * JWTs with a known dev secret. Every clean environment can now build; the
 * security property holds at runtime.
 *
 * PHASE GUARD
 *
 * `process.env.NEXT_PHASE === "phase-production-build"` is set by `next build`.
 * `register()` does not run during build in Next 15, but the guard is an explicit
 * backstop: even if a future change invoked register during a build phase, the
 * boot assertion skips so it can never re-introduce the build break.
 *
 * The `assertProductionEnv` import is dynamic so this file's top level stays
 * side-effect-free on bundle (nothing executes at import — only `register`,
 * when called). See `apps/web/src/lib/env.ts` for the checks and messages.
 */
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertProductionEnv } = await import("./lib/env");
  assertProductionEnv();
}
