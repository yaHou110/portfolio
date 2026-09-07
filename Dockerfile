# Production Dockerfile for @learning-platform/web
#
# Multi-stage build:
#   1. builder — installs all deps (incl. devDeps), runs `next build` with output: 'standalone'
#   2. runner  — copies only the standalone output + node_modules for runtime
#
# Requirements (from ARCHITECTURE_CONSTRAINTS):
#   C1 — single VPS ≤ 4 GB RAM → minimal layers, no dev tools in runner
#   C3 — self-hosted → no vendor-specific base images
#   C6 — low operational complexity → single container, no sidecars
#
# The `output: 'standalone'` in next.config.mjs produces a self-contained
# `.next/standalone` directory with only production node_modules.
# This keeps the runner image small (~200 MB) and start-up fast.

# =====================================================================
# Stage 1: Builder
# =====================================================================
FROM node:20-alpine AS builder

# Install pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace manifests first (better cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build only the web app (standalone output). NEXTJS_STANDALONE=1 tells
# next.config.mjs to emit the standalone layout this runner image expects.
# Vercel/cloud builds don't set it, so they get the default `.next` layout.
ENV NEXTJS_STANDALONE=1

# Build only the web app (standalone output)
RUN pnpm --filter web build

# Persist the migrations + the migrate entrypoint for the `migrate` image target
# (ADR-0017). These stay in the builder stage; the `migrate` target below copies
# the builder's workspace wholesale (source + dev toolchain + node_modules), so
# it can run the real Drizzle `migrate()` helper via tsx — no Drizzle-internal
# `__drizzle_migrations` re-implementation, full compatibility with the dev
# `pnpm db:migrate` flow.
ENV MIGRATE_SCRIPT=/app/packages/core/scripts/migrate.ts
ENV MIGRATIONS_DIR=/app/packages/core/src/db/migrations

# =====================================================================
# Stage 2: Runner (the app image — ghcr.io/.../web:latest)
# =====================================================================
FROM node:20-alpine AS runner

# Non-root user (security)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output (includes server.js + minimal node_modules).
# In a pnpm monorepo, Next.js standalone preserves the workspace tree, so the
# entrypoint lands at /app/apps/web/server.js (NOT /app/server.js). Copy the
# static + public assets under that same apps/web path and run from there so the
# server's relative-path resolution matches the source layout.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# The standalone output does NOT include these; copy explicitly if needed:
# - .env.example (template)
# - any runtime config files (none in v1)

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run from the app's original workspace dir so server.js and its relative
# .next/static + public paths resolve (monorepo standalone layout).
WORKDIR /app/apps/web

# Next.js standalone entrypoint
CMD ["node", "server.js"]

# =====================================================================
# Stage 3: Migrate (a one-shot image target — ADR-0017)
# =====================================================================
# Reuses the BUILDER stage (which already has the source, devDependencies —
# including `tsx` and `drizzle-orm` — and `pg`) rather than bundling these into
# the slimmer runner. Why: the prod image is a Next.js `standalone` output that
# traces only the web app's runtime imports, which excludes `drizzle-orm` /
# `tsx`; rebuilding that tracing to include them would bloat the runner for no
# runtime benefit. Instead this target is a separate, never-served image the
# `migrate` compose service uses once per deploy to apply the committed Drizzle
# migrations against the prod DATABASE_URL, then exit. It is NOT pushed to GHCR
# and never serves traffic (the build only pushes the `runner` target — see the
# compose `image:` on `app` and the `migrate` service below which builds locally).
#
# Compatibility: runs the SAME migrate.ts + the SAME Drizzle `migrate()` helper that
# the local `pnpm db:migrate` uses, sharing the `__drizzle_migrations` tracking
# table — so dev and deploy cannot diverge on which migrations are applied.
FROM builder AS migrate
# Run from packages/core so the migrate script's relative `migrationsFolder:
# ./src/db/migrations` (relative to cwd, the dev convention) resolves correctly
# to /app/packages/core/src/db/migrations — where the builder copied the source.
WORKDIR /app/packages/core

# DATABASE_URL is provided by the compose env (host `postgres`, prod password) —
# see docker-compose.prod.yml `migrate` service. loadEnvOnce() sees DATABASE_URL
# already set and skips its .env walk (no .git/.env in the image), so the dev
# localhost default never applies here.
ENV NODE_ENV=production

# Apply migrations, then exit. --import tsx lets tsx register as the .ts loader.
# (tsx is a devDependency of @learning-platform/core, present from the builder's
# `pnpm install --frozen-lockfile`.)
CMD ["node", "--import", "tsx", "scripts/migrate.ts"]