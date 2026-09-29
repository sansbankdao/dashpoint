// src/env.d.ts
//
// Ambient types for this Astro app.
//
// WHY THIS FILE EXISTS
// `src/pages/index.astro` reaches the store resolver through a Cloudflare
// SERVICE BINDING. The @astrojs/cloudflare adapter removed
// `Astro.locals.runtime.env` in Astro v6 (the getter throws), and the supported
// replacement is the `cloudflare:workers` module. That module is provided by
// workerd at runtime and has no types of its own, so TypeScript needs this
// declaration to type the dynamic import.
//
// The binding surface is declared loosely on purpose. Only the `API` binding is
// read, and it is probed with `'fetch' in binding` at runtime before use, so a
// precise type here would restate a check that already happens.

declare module 'cloudflare:workers' {
    /** The Worker's bindings, keyed by the names in `wrangler.jsonc`. */
    export const env: Record<string, unknown>
}