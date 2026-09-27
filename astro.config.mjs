// astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
//
// The demo (`/demo`) is prerendered to static HTML. The landing page (`/`) and
// the hosted store route (`/store`) opt out with `prerender = false`.
//
// `/store` must be server-rendered because it reads the request `Host` header
// to decide which Dash Platform store to serve; a static build cannot see that
// header. `/` must be server-rendered too, but for a subtler reason: Astro's
// Cloudflare entry serves a matching static file BEFORE the route renderer runs,
// so a prerendered `/` would never reach `src/middleware.ts`, and the middleware
// is what rewrites `<username>.dashpoint.store/` to `/store`. Server-rendering
// `/` keeps the landing page identical while letting the middleware see it.
export default defineConfig({
    site: 'https://dashpoint.store',
    adapter: cloudflare(),
    vite: {
      plugins: [tailwindcss()]
    }
})
