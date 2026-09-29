// apps/web/astro.config.mjs
// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'

// https://astro.build/config
//
// The landing page is a fully static build: there is no adapter and no
// server-rendered route. It owns the apex (`dashpoint.store`) only. The demo
// storefront and the hosted `<username>.dashpoint.store` storefronts are a
// separate Worker (`apps/store`), so nothing here needs to read a Host header
// or rewrite a route.
export default defineConfig({
    site: 'https://dashpoint.store',
    vite: {
      plugins: [tailwindcss()]
    }
})
