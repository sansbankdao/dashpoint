<!-- AGENTS.md -->
# AGENTS.md — dashpoint (monorepo)

Guidance for AI coding agents working in this repository.

## Repository facts

- **Purpose:** the DashPoint front ends. One landing page, one storefront
  Worker that serves both the demo and every merchant's hosted shop, and one
  point of sale.
- **Layout:** pnpm workspace, `apps/*`, on branch `master`.
- **Package manager:** pnpm `10.15.0`, pinned in `packageManager`. The single
  root `pnpm-lock.yaml` is the only lockfile. Do not add another.
- **Node:** `>=22.12.0` (`.nvmrc`). Astro 7 requires it.
- **License:** MIT.

### The apps

```text
apps/web     static landing page, apex only. No adapter, no server route.
apps/store   Cloudflare Worker. `/` is server-rendered and reads the Host header.
apps/pos     static point of sale.
```

`apps/store` serves the root of every `*.dashpoint.store` host:
`demo.dashpoint.store` renders the local fixture in `src/data/products.ts`
without any network call, and `<username>.dashpoint.store` resolves a Dash
Platform store through the API. Reserved labels (`www`, `demo`, `pos`) are never
treated as usernames — see `apps/store/src/lib/store-host.ts`.

### Not in this repository

The API Worker is `sansbankdao/dashpoint-api`, a **separate repository**. It is
routed at `/v1/*` on both zones and owns DPNS resolution, grovedb proof
verification and store listings. Nothing here can deploy it, and a change to
`/v1` behaviour cannot be made from this repo.

## Commands (run from the repository root)

```sh
pnpm install
pnpm -r check
pnpm -r test
pnpm -r build
pnpm dev:web | dev:store | dev:pos
```

Target one app with `pnpm --filter @dashpoint/<app> <script>`.

## Rules for changes

- **Money is integer cents** internally. A resolved Dash Platform item stores
  cents (`basePrice`); carry that value through rather than recomputing it from
  a dollar display.
- **Never resolve a store by identifier.** Use the DPNS username. Identifiers
  are base58 and case-sensitive, and every HTTP stack lower-cases the `Host`
  header, so an identifier cannot survive a DNS label round trip. The reasoning
  is documented at the top of `apps/store/src/lib/store-host.ts`.
- **The `client:load` warnings in `apps/pos` are pre-existing.** Four Astro
  components are rendered with a hydration directive. Astro warns and the build
  still completes; Astro 7.3.5 does not fail on them. Do not "clean these up"
  as a drive-by — see the POS section below.
- **`Layout.astro` and `global.css` are duplicated per app on purpose.** The
  apps must stay independently deployable. Do not extract them to a shared
  package without deciding that trade-off explicitly.
- **Do not unify dependency versions across apps casually.** `apps/store`,
  `apps/web` and `apps/pos` are all on Astro `^7.3.5` and Tailwind `^4.3.3`.
  Changing one app's Astro major is a migration, not a bump.

### Reserved subdomains

`www`, `demo` and `pos` are reserved in
`apps/store/src/lib/store-host.ts` and must stay that way. `pos` in particular
is reserved because `pos.dashpoint.store` is `apps/pos`; without it the store
Worker would try to resolve a merchant literally named `pos`.

## Deploy reality

- `apps/web` and `apps/pos` are static; `apps/store` is a Cloudflare Worker
  (`wrangler.jsonc`, name `dashpoint-store`).
- `dashpoint.store` and `dashpoint.sale` are the two Cloudflare zones. Both
  apexes serve `/v1/*` from the same API Worker.
- The API is deployed from its own repository, not this one.

Per-app guidance lives in `apps/store/AGENTS.md` and `apps/pos/AGENTS.md`.
