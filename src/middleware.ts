// src/middleware.ts
//
// Route a store subdomain's root to the storefront.
//
// Astro serves `/` from `src/pages/index.astro`, which is the marketing landing
// page. A merchant's address, however, is `<username>.dashpoint.store/` — the
// customer should land on the SHOP, not on our landing page. This middleware
// rewrites that one path to `/store`, which is where the resolver runs.
//
// WHY A REWRITE AND NOT A REDIRECT
// A redirect would put `/store` in the address bar and add a round trip. A
// rewrite keeps the merchant's URL intact — `m0m0.dashpoint.store` stays
// `m0m0.dashpoint.store` — which is what a storefront address should be.
//
// The apex is left alone: it is our landing page, not a store. Reserved
// subdomains — `www` and `demo` — are left alone too, because they are our
// pages. Everything else is a candidate store address and goes to `/store`,
// including syntactically invalid labels: `/store` already renders the "not a
// valid username" reason, and keeping that decision in ONE place is why this
// middleware does not second-guess the label. The reserved list and the
// hostname parsing both come from `store-host.ts`, the same module the `/store`
// page uses, so a host is classified in exactly one place.
//
// This runs for every request, so it must stay cheap: it reads a header and, in
// the common case (apex, www, a path other than `/`), returns immediately.

import { defineMiddleware } from 'astro:middleware'
import { storeNameFromHostname } from './lib/store-host'

export const onRequest = defineMiddleware((context, next) => {
    const hostname = context.request.headers.get('host') ?? ''
    const candidate = storeNameFromHostname(hostname)

    /* Not a store subdomain (apex, www, demo, or some other domain): serve as-is. */
    if (candidate === null) return next()

    /* Only the root is rewritten; `/store` and assets pass through untouched. */
    if (context.url.pathname !== '/') return next()

    return context.rewrite('/store')
})
