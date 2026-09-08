/* Lightweight offline shell for the public portfolio. */
const CACHE_VERSION = "v2";
const STATIC_CACHE = `yahou-static-${CACHE_VERSION}`;
const PAGE_CACHE = `yahou-pages-${CACHE_VERSION}`;

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
  // Seed only the public portfolio route.
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add("/")).catch(() => {})
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

  // Never cache API or framework data requests.
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
