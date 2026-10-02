// astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

// https://astro.build/config
//
// Every route in this app is server-rendered. The single route (`/`) must read
// the request `Host` header to decide what to serve — the demo fixture on
// `demo.paymedash.xyz`, the resolved store on `<USERNAME>.paymedash.xyz` —
// and a static build cannot see that header. Cloudflare routes the
// `*.paymedash.xyz` host family here, so `/` is the storefront for all of them.
export default defineConfig({
    site: 'https://paymedash.xyz',
    adapter: cloudflare(),
    vite: {
      plugins: [tailwindcss()]
    }
})
