/**
 * Same-origin redirect resolver (open-redirect defense).
 *
 * `next-auth` v5 `signIn({ redirectTo })` flows straight into `redirect(url)`
 * (`node_modules/next-auth/src/lib/actions.ts`); a caller-supplied
 * `callbackUrl` is passed through with no same-origin constraint. This helper
 * collapses any value whose resolved origin ≠ the app origin to "/":
 *
 *   - absolute external URLs (`https://evil.com`) → "/"
 *   - protocol-relative (`//evil.com`) → "/"
 *   - backslash (`\\evil.com`) — browsers normalize `\` to `/`, yielding
 *     `//evil.com` (protocol-relative) → "/"
 *   - malformed values → "/"
 *
 * Same-origin paths keep their pathname + search + hash only (we never forward
 * the caller's `?callbackUrl=…` to a redirect that could still carry a query
 * side channel). The consumer computes `origin` from the request's forwarded
 * host/proto so the check holds behind the reverse proxy and on Vercel.
 */
export function safeCallbackUrl(raw: string | undefined, origin: string): string {
  const fallback = "/";
  if (!raw) return fallback;
  if (!origin) return fallback;
  try {
    const resolved = new URL(raw, origin);
    return resolved.origin === origin
      ? resolved.pathname + resolved.search + resolved.hash
      : fallback;
  } catch {
    return fallback;
  }
}
