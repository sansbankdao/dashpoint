// apps/web/astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
//
// The landing page is a fully static build: there is no adapter and no
// server-rendered route. It owns the apex (`paymedash.xyz`) only. The demo
// storefront and the hosted `<username>.paymedash.xyz` storefronts are a
// separate Worker (`apps/store`), so nothing here needs to read a Host header
// or rewrite a route.
export default defineConfig({
    site: 'https://paymedash.xyz',
    vite: {
      plugins: [tailwindcss()]
    }
})
