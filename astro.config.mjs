// astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
//
// The landing page (`/`) and the demo (`/demo`) are prerendered to static
// HTML. The hosted store route (`/store`) opts out with `prerender = false`
// because it must read the request `Host` header to decide which Dash
// Platform store to serve; a static build cannot see that header.
export default defineConfig({
    site: 'https://dashpoint.store',
    adapter: cloudflare(),
    vite: {
      plugins: [tailwindcss()]
    }
})
