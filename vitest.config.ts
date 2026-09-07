import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM-compatible __dirname (apps/web is "type": "module").
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const webSrc = path.resolve(__dirname, "src");

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      // apps/web internal path aliases (mirror tsconfig "paths").
      // @learning-platform/* and other workspace packages resolve via pnpm symlinks
      // + their own `exports` field, so they are NOT aliased here.
      { find: "@/auth", replacement: path.join(webSrc, "auth.ts") },
      { find: "@/lib/env", replacement: path.join(webSrc, "lib/env.ts") },
      { find: "@/lib/authz", replacement: path.join(webSrc, "lib/authz.ts") },
      { find: "@/lib/plugins", replacement: path.join(webSrc, "lib/plugins.ts") },
      { find: "@/lib/validation", replacement: path.join(webSrc, "lib/validation.ts") },
      { find: "@/lib/rate-limit", replacement: path.join(webSrc, "lib/rate-limit.ts") },
      { find: "@/lib/api-route", replacement: path.join(webSrc, "lib/api-route.ts") },
    ],
  },
});
