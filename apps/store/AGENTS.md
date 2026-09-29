<!-- AGENTS.md -->
# AGENTS.md — apps/store (Homemade Crypto storefront)

Guidance for AI coding agents working on the storefront app of the `dashpoint`
monorepo. Monorepo-wide rules (commands, cents convention, why identifiers are
never used as hostnames) are in the root `AGENTS.md`; this file covers the
app itself.

## App facts

- **Purpose:** the storefront. Serves the root of every `*.dashpoint.store`
  host that is not the apex: `demo.dashpoint.store` renders the built-in demo
  fixture, and `<username>.dashpoint.store` renders the merchant's Dash Platform
  store.
- **Stack:** Astro `7.3.5` on the Cloudflare adapter (`@astrojs/cloudflare`) +
  Tailwind CSS `4.3.3` wired through `@tailwindcss/vite`. TypeScript via
  `astro/tsconfigs/strict`. Package manager: pnpm (workspace root
  `pnpm-lock.yaml`; this app has no lockfile of its own).
- **Rendering:** the single route `/` is server-rendered
  (`export const prerender = false`). It must be, because it reads the request
  `Host` header to decide what to serve — the demo fixture on
  `demo.dashpoint.store`, a resolved Dash Platform store on
  `<username>.dashpoint.store`. Cloudflare routes the `*.dashpoint.store` host
  family to this Worker, so `/` IS the storefront for every one of them. See
  `src/pages/index.astro` for the full explanation.
- **Site origin:** `https://dashpoint.store` (set as `site` in
  `astro.config.mjs`; drives canonical + `og:url` in `src/layouts/Layout.astro`).

### Source layout

```text
astro.config.mjs          Astro config; `site`, Cloudflare adapter, Tailwind plugin
package.json              name "@dashpoint/store", version 25.10.4, MIT
tsconfig.json             extends astro/tsconfigs/strict
.prettierrc               Prettier: no semicolons, single quotes, astro + tailwind plugins
public/favicon.svg        site icon
wrangler.jsonc            Cloudflare Worker name + compatibility_date (merged by the adapter)
src/pages/index.astro     the storefront (SSR); demo fixture OR resolved store, chosen by Host
src/layouts/Layout.astro  HTML shell, meta/OG/canonical, imports global.css
src/components/
  Storefront.astro        header, product grid, cart list, footer; DOM wiring only
  ProductCard.astro       single product button (data-id/price-cents/title attributes)
  StoreNotFound.astro     the "Store Not Found" panel and its reason text
src/lib/cart.ts           pure cart logic (addItem/removeItem/totalCents/formatCents)
src/lib/cart.test.ts      node:test unit tests for the pure cart logic
src/lib/store-host.ts     hostname -> DPNS label parsing/validation (STORE_DOMAIN, reserved list, isDemoHost)
src/lib/store-host.test.ts node:test unit tests for the host parser
src/lib/store-api.ts      client for the `dashpoint-api` store + items resolver
src/lib/store-api.test.ts node:test unit tests for the resolver client (injected fetch)
src/data/products.ts      the demo fixture products (single source of truth for the demo)
src/types.ts              shared `Product` interface
src/styles/global.css     contains only: @import "tailwindcss";
public/_headers           Cloudflare security headers + long-cache rules
```

## Shared API server — read this before adding any network call

**`https://dashpoint.sale` and `https://dashpoint.store` share one API server:
the `dashpoint-api` Worker, which is routed at `/v1` on both zones, in front of
each site.** The Worker source is the sibling repo
`../dashpoint-api` (`github.com/sansbankdao/dashpoint-api`, private).

- **The hosted storefront calls two `/v1` endpoints**, both from the SERVER, both
  through `src/lib/store-api.ts`: `GET /v1/store?name=<label>` and
  `GET /v1/store/items?storeId=<store document id>`. The origin is the APEX
  (`https://dashpoint.store/v1/*`, routed to the Worker), even when the page is
  served from `<username>.dashpoint.store`; the call is server-to-server, so
  CORS does not apply. The value is overridable at build time with
  `STORE_API_ORIGIN` for local development only.
  The demo's cart is in-memory and the Pay button still only shows an `alert()`;
  that path makes no network call.
- **URL map:** `dashpoint.store/` is the landing page (`apps/web`),
  `demo.dashpoint.store/` is the demo storefront, `pos.dashpoint.store/` is the
  point of sale (`apps/pos`), and `<USERNAME>.dashpoint.store/` is a merchant's
  hosted storefront. The demo, the POS and the hosted storefronts are all in
  this monorepo, so the demo cannot drift from what the landing page advertises.
  Do not fork the storefront into a second repo.
- Any change to `/v1` behavior affects **both** `dashpoint.sale` (the POS) and
  `dashpoint.store` (this store). A change made for the POS is a change to this
  site's API, and vice versa.
- Endpoints and integration facts are documented in
  `../dashpoint.sale/AGENTS.md` under "Deployed API" (its lines 120-124 state
  the shared routing). Read that file before wiring this storefront to
  payments — do not restate or guess the endpoint contract here.
- **The partner JWT is a Cloudflare Secrets Store binding on the Worker. It is
  never sent to the browser and never committed to any repository.** This
  storefront has no need for it; do not add it to any tracked file.

## Deployment

The site builds to a **Cloudflare Worker** through the `@astrojs/cloudflare`
adapter: `pnpm build` emits `dist/server` (the Worker) and `dist/client` (static
assets), and the adapter merges the `wrangler.jsonc` in this directory into
`dist/server/wrangler.json`. The zone is `dashpoint.store`, shared with the API
Worker: `dashpoint-api/packages/api/wrangler.jsonc` routes `dashpoint.store/v1`
and `dashpoint.store/v1/*` with `"zone_name": "dashpoint.store"`. That Worker
lives in the separate `sansbankdao/dashpoint-api` repository, not in this
monorepo.

- Security headers live in `public/_headers` (copied verbatim to `dist/_headers`
  by the build). Cloudflare Pages reads it; it is **not** an Astro file.
- The CSP in `public/_headers` allows `img-src 'self' https: data:` because a
  store's logo, banner and product image URLs are supplied by the MERCHANT in
  their Dash Platform store document and cannot be enumerated ahead of time;
  `data:` covers inline SVG. `script-src 'unsafe-inline'` is required because
  Astro inlines the cart module. If you add an external script, update the CSP in
  the same change.

## Commands

From the **monorepo root**:

```sh
pnpm install                  # install the whole workspace
pnpm --filter @dashpoint/store build     # -> apps/store/dist/
pnpm --filter @dashpoint/store check     # astro check
pnpm --filter @dashpoint/store test      # node --test src/lib/*.test.ts
pnpm --filter @dashpoint/store dev       # astro dev
pnpm --filter @dashpoint/store preview   # preview the production build
pnpm --filter @dashpoint/store audit     # dependency vulnerability scan
```

## Conventions

- Money is stored **in integer cents** everywhere the cart touches it. A
  resolved Dash Platform item already carries cents (`basePrice`), so
  `ProductCard.astro` emits `data-price-cents` from `priceCents` when present
  and only derives it (`Math.round(price * 100)`) for the demo fixture. Never
  recover cents from the displayed dollar string at click time.
- `src/types.ts` owns the `Product` interface. `ProductCard.astro` and
  `Storefront.astro` both import it — do not redeclare the shape locally.
- Products are edited in `src/data/products.ts`, not in page frontmatter.
- Product images are currently `placehold.co` URLs with explicit
  `width`/`height` attributes. Keep the attributes if you replace the URLs.
- The cart's only live region is `#total-amount` (`aria-live="polite"`); keep it
  if you restructure the footer.

## Gotchas for agents

- **Do not `read` binary assets** (`public/favicon.svg` and any future images,
  PDFs, archives). Verify them with `ls -la`, `file`, or `du` instead. Loading a
  large binary inflates the context window.
- `src/styles/global.css` intentionally contains only the Tailwind import; do
  not add global rules without reason.
- Cart state is held in `src/components/Storefront.astro`; the pure operations
  live in `src/lib/cart.ts`. Put cart math in the module, not the component.
- The cart's remove control is a `−` button per line item in `#cart-items`; it
  decrements `amount` and removes the row at zero.
- The `Pay` button is a demo: it fires `alert()` and does not call any API.
