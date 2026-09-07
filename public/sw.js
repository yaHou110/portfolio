/* Rooyesh PWA service worker.
 *
 * Strategy:
 *  - Navigations (HTML documents): network-first, fall back to the
 *    last-cached copy for offline support.
 *  - Hashed static assets (_next/static, /icons, images): cache-first —
 *    content-addressed filenames are immutable, so the cache never goes stale.
 *  - API / auth / health routes: never cached, always network.
 *
 * Bump CACHE_VERSION to invalidate the whole cache on a breaking change.
 */
const CACHE_VERSION = "v1";
const STATIC_CACHE = `rooyesh-static-${CACHE_VERSION}`;
const PAGE_CACHE = `rooyesh-pages-${CACHE_VERSION}`;

const STATIC_URL_PATTERNS = [
  /\/_next\/static\/.*/,
  /\/icons\/.*\.png$/,
  /\/apple-touch-icon\.png$/,
  /\.(?:png|jpe?g|webp|avif|svg|ico|woff2?)$/,
];

const NEVER_CACHE_URL_PATTERNS = [/^\/api\//, /^\/_next\/data\//];

self.addEventListener("install", (event) => {
  // Activate immediately — don't wait for other tabs to close.
  self.skipWaiting();
  // Seed the shell so a cold offline open still renders the app.
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.addAll(["/", "/login", "/forgot-password"]))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.includes(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never touch API / data / auth traffic — always go to the network.
  if (NEVER_CACHE_URL_PATTERNS.some((re) => re.test(url.pathname))) return;

  // Navigation requests: network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Last resort: serve the cached shell.
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // Hashed/static assets: cache-first (immutable by filename).
  if (STATIC_URL_PATTERNS.some((re) => re.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else: default network behavior (no interception).
});
