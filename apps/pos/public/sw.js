// public/sw.js
//
// Minimal service worker for PayMeDash POS.
//
// Its job is deliberately small:
//
//   1. Satisfy the installability requirement. A browser will not offer to
//      install the app without a service worker that handles fetch, so this
//      handler must exist even though the POS is useless offline.
//   2. Cache the immutable hashed assets under /_astro, so a repeat visit on a
//      slow connection does not re-download the same JavaScript.
//   3. Keep the payment API off the cache entirely.
//
// It is NOT an offline cache. A quote, a deposit address, and a swap status are
// all live values, and a cached price or a cached "Waiting for your payment"
// would be worse than an honest failure, so anything under /v1 goes to the
// network and a network failure is allowed to surface.

const CACHE_NAME = 'paymedash-static-v1'

// The one document worth having on hand. Everything else is discovered from the
// HTML that is fetched fresh, or is a hashed asset cached on first use.
const PRECACHE_URLS = ['/']

/*
 * Requests that must never be served from the cache.
 *
 * The API lives on the same origin under /v1, so without this check the cache
 * would happily store a quote. Admin settings are local to the browser and are
 * not fetched over HTTP, but the rule is written by path so any future
 * server-side configuration endpoint is covered as well.
 */
function isNeverCached(url) {
    return url.pathname.startsWith('/v1/') || url.pathname === '/v1'
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            /*
             * A failed precache must not block installation. The cache is a
             * convenience here, not a requirement, and the app is fully
             * functional without it.
             */
            .catch(() => undefined)
            .then(() => self.skipWaiting())
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.map((key) => (key === CACHE_NAME ? undefined : caches.delete(key)))
            ))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    const request = event.request

    // Only GET responses are cacheable at all.
    if (request.method !== 'GET') return

    const url = new URL(request.url)

    // Leave other origins alone.
    if (url.origin !== self.location.origin) return

    // Never cache the API. Let the network answer, and let it fail loudly.
    if (isNeverCached(url)) return

    /*
     * Navigations are network-first.
     *
     * The POS is served as a static HTML document that names hashed asset
     * files. Serving a remembered document after a deploy would point at
     * bundles that no longer exist, so the network wins whenever it answers and
     * the cache is only the fallback for an actual failure.
     */
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone()
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put('/', copy))
                        .catch(() => undefined)
                    return response
                })
                .catch(() => caches.match('/').then((cached) => cached ?? Response.error()))
        )
        return
    }

    /*
     * Static assets are cache-first.
     *
     * Astro writes them under /_astro with a content hash in the file name, so a
     * given URL always means the same bytes and there is nothing to invalidate.
     * The icon and manifest files are named the same way across deploys, so they
     * refresh through the network when the cache misses.
     */
    const isHashedAsset = url.pathname.startsWith('/_astro/')
    const isStaticFile = /\.(?:css|js|png|svg|webmanifest|ico|woff2?)$/.test(url.pathname)

    if (isHashedAsset || isStaticFile) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached
                return fetch(request).then((response) => {
                    /* Do not cache an error page in place of an asset. */
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response
                    }
                    const copy = response.clone()
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(request, copy))
                        .catch(() => undefined)
                    return response
                })
            })
        )
    }
})