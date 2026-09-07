# apps/web — Next.js 15 (App Router) host

This is the **only deployable** in the monorepo. Everything else is a
package consumed by it.

## Plugins

Plugins are registered at module load time in `src/lib/plugins.ts`. Each
plugin exports a typed `manifest`; we register all of them with
`@learning-platform/core`'s `PluginRegistry`. There is no runtime loader.

## Auth

`src/auth.ts` builds the Auth.js v5 config. It uses the Drizzle adapter
(pointing at the same Postgres) and a Credentials provider that delegates
to `@learning-platform/core/auth/credentials.verifyPassword`.

## Local dev

1. From the repo root, start Postgres + Adminer:
   ```
   docker compose up -d
   ```
2. Apply migrations and seed:
   ```
   pnpm db:migrate
   pnpm db:seed:dev
   ```
3. Start the web app:
   ```
   pnpm dev
   ```
4. Visit `http://localhost:3000`:
   - `/api/health` — DB health check
   - `/login` — login form
   - default credentials: tenant `demo`, email `admin@lp.local`, password `changeme`
