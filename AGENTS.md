<!-- AGENTS.md -->
# AGENTS.md — dashpoint.store (DashPoint Store)

Guidance for AI coding agents working in this repository.

## Repository facts

- **Purpose:** Browser-based kombucha storefront. The customer views a grid of
  products and builds a cart; payment is not yet wired to a backend.
- **Stack:** Astro `5.14.1` (static site) + Tailwind CSS `4.1.14` wired through
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
  Storefront.astro        header, product grid, cart footer, ALL client cart state
  ProductCard.astro       single product button (data-id/price/title attributes)
src/data/products.ts      the 6 products (single source of truth)
src/types.ts              shared `Product` interface
src/styles/global.css     contains only: @import "tailwindcss";
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

## Commands

Run from the repo root:

```sh
pnpm install          # install dependencies
pnpm dev              # astro dev, http://localhost:4321
pnpm build            # astro build -> ./dist/
pnpm preview          # preview the production build
pnpm check            # astro check (types + content)
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
- The cart has **no remove/quantity UI**; additions aggregate into `cartItems`
  by `id` and increment `amount`. Removing an item is not implemented.
- The `Pay` button is a demo: it fires `alert()` and does not call any API.
