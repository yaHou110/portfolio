/** @type {import('next').NextConfig} */
const nextConfig = {
  // Internal workspace packages need transpilation under App Router.
  transpilePackages: [
    "@learning-platform/core",
    "@learning-platform/contracts",
    "@learning-platform/plugin-auth",
    "@learning-platform/plugin-catalog",
    "@learning-platform/plugin-learning",
    "@learning-platform/plugin-credentials",
    "@learning-platform/plugin-localization",
  ],
  // Native Node modules used by workspace packages must NOT be bundled
  // by webpack — they are required at runtime.
  // Note: `bcrypt` was replaced by `bcryptjs` (pure JS) in M1. Kept
  // empty for future native modules if needed.
  serverExternalPackages: [],
  reactStrictMode: true,
  // Produce a standalone output ONLY for the Docker image build (M6 deployment).
  // On Vercel (serverless), `standalone` is unnecessary and can perturb the
  // build-output mapping — Vercel builds its own serverless functions from the
  // standard `.next` output. Gate it on a build-time flag the Dockerfile sets
  // (NEXTJS_STANDALONE=1) so a cloud build gets the default `.next` layout.
  ...(process.env.NEXTJS_STANDALONE === "1" ? { output: "standalone" } : {}),
  // Hide the X-Powered-By header (security best practice).
  poweredByHeader: false,
  // Security headers are set per-request in `middleware.ts` (S3 hardening)
  // with CSP nonces. The middleware matcher covers all routes except
  // _next/static, _next/image, favicon.ico, and *.png — those static assets
  // inherit the security headers Vercel/CDN adds and don't need CSP.
  // (The previous static `headers()` block was removed because Next.js
  // applies `headers()` *after* middleware and would overwrite the
  // per-request CSP nonce with the static CSP — defeating the nonce.)

  // TypeScript NodeNext convention: source uses `.js` extensions that
  // resolve to `.ts` files. Webpack must alias this for Next.js to
  // bundle workspace packages that follow that pattern (e.g. @learning-platform/core).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
