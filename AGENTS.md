<!-- AGENTS.md -->
# AGENTS.md — dashpoint.store (Homemade Crypto)

Guidance for AI coding agents working in this repository.

## Repository facts

- **Purpose:** Browser-based kombucha storefront for the **Homemade Crypto**
  brand. The customer views a grid of products and builds a cart; payment is not
  yet wired to a backend.
- **Stack:** Astro `7.3.5` (static site) + Tailwind CSS `4.3.3` wired through
  `@tailwindcss/vite`. TypeScript via `astro/tsconfigs/strict`. Package manager:
  pnpm (see `pnpm-lock.yaml`, lockfileVersion `9.0`).
- **Site origin:** `https://dashpoint.store` (set as `site` in
  `astro.config.mjs`; drives canonical + `og:url` in `src/layouts/Layout.astro`).

### Source layout

```text
astro.config.mjs          Astro config; `site`, registers the Tailwind Vite plugin
package.json              name "dashpoint-store", version 25.10.4, MIT
tsconfig.json             extends astro/tsconfigs/strict
.prettierrc               Prettier: no semicolons, single quotes, astro + tailwind plugins
pnpm-workspace.yaml       allowBuilds for @tailwindcss/oxide, esbuild, sharp
public/favicon.svg        site icon
src/pages/index.astro     page shell; imports products + <Storefront />
src/layouts/Layout.astro  HTML shell, meta/OG/canonical, imports global.css
src/components/
  Storefront.astro        header, product grid, cart list, footer; DOM wiring only
  ProductCard.astro       single product button (data-id/price/title attributes)
src/lib/cart.ts           pure cart logic (addItem/removeItem/totalCents/formatCents)
src/lib/cart.test.ts      node:test unit tests for the pure cart logic
src/data/products.ts      the 6 products (single source of truth)
src/types.ts              shared `Product` interface
src/styles/global.css     contains only: @import "tailwindcss";
public/_headers           Cloudflare Pages security headers + long-cache rules
```

## Shared API server — read this before adding any network call

**`https://dashpoint.sale` and `https://dashpoint.store` share one API server:
the `dashpoint-api` Worker, which is routed at `/v1` on both zones, in front of
each static Pages site.** The Worker source is the sibling repo
`../dashpoint-api` (`github.com/sansbankdao/dashpoint-api`, private).

- **This storefront makes no `/v1` calls today.** The cart is in-memory and the
  Pay button only shows an `alert()` (see `src/components/Storefront.astro`).
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

The site is served from **Cloudflare Pages** on zone `dashpoint.store`. Evidence:
`../dashpoint-api/packages/api/wrangler.jsonc` routes `dashpoint.store/v1` and
`dashpoint.store/v1/*` with `"zone_name": "dashpoint.store"`. The sibling
`../dashqt.org/public/_headers` and `../sansbank.org/public/_headers` use the
same Cloudflare Pages `_headers` mechanism this repo now mirrors.

- Security headers live in `public/_headers` (copied verbatim to `dist/_headers`
  by the build). Cloudflare Pages reads it; it is **not** an Astro file.
- The CSP in `public/_headers` allows `img-src https://placehold.co` because the
  product and logo images are still hosted there, and `script-src 'unsafe-inline'`
  because Astro inlines the single cart module into `index.html` (there is no
  emitted `_astro/*.js`). If you add an external script or move images, update
  the CSP in the same change.

## Commands

Run from the repo root:

```sh
pnpm install          # install dependencies
pnpm dev              # astro dev, http://localhost:4321
pnpm build            # astro build -> ./dist/
pnpm preview          # preview the production build
pnpm check            # astro check (types + content)
pnpm test             # node --test src/lib/cart.test.ts
pnpm audit            # dependency vulnerability scan
```

## Conventions

- Money is stored **in dollars** in `src/data/products.ts` and converted to
  integer **cents** inside the cart in `src/components/Storefront.astro`
  (`Math.round(price * 100)`). Never accumulate floating-point dollars.
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
