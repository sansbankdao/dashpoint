<!-- docs/paymedash-deployment.md -->

# paymedash.xyz deployment

The `dashpoint.store` / `dashpoint.sale` host family was redeployed under
`paymedash.xyz`. The old deployments are deliberately LEFT IN PLACE as mirrors
until the expired domains are renewed; nothing in this move removed them.

## What runs where

| Host | Kind | Project / Worker | Origin |
| --- | --- | --- | --- |
| `paymedash.xyz` | Pages | `paymedash-web` | `paymedash-web.pages.dev` |
| `www.paymedash.xyz` | Pages | `paymedash-web` | `paymedash-web.pages.dev` |
| `pos.paymedash.xyz` | Pages | `paymedash-pos` | `paymedash-pos.pages.dev` |
| `demo.paymedash.xyz` | Worker | `paymedash-store` | fixture, no network |
| `<username>.paymedash.xyz` | Worker | `paymedash-store` | DPNS -> store document |
| `paymedash.xyz/v1`, `/v1/*` | Worker | `paymedash-api` | API |

The `paymedash-store` Worker owns the route `*.paymedash.xyz/*` and proxies
`www.` and `pos.` to the two Pages origins (`src/lib/pages-proxy.ts`). The apex
is NOT in that wildcard -- it is the landing page, served by `paymedash-web`.

## Mirrors left running

`dashpoint-web` (Pages), `dashpoint-sale` (Pages), `dashpoint-store` (Pages +
Worker) and `dashpoint-api` (Worker) are all still deployed and unchanged.

`pos.dashpoint.store` and `demo.dashpoint.store` currently resolve to parking
IPs (`2.59.170.20`, `104.219.250.37`) because the `dashpoint.store` domain is
past expiry at the registrar. That is the pre-existing outage documented in
`docs/dashpoint-store-domain-offline.md`; it is a DNS/registrar condition and
not a consequence of this move. `dashpoint.sale` resolves normally.

## Why `paymedash-api` is a second config

One wrangler config file defines one Worker. Editing `wrangler.jsonc` to rename
the Worker would have retargeted the existing `dashpoint-api` deployment and
taken the mirror down with it, so the new Worker deploys from
`wrangler.paymedash.jsonc` instead:

    npx wrangler deploy --config wrangler.paymedash.jsonc

Both configs deploy the SAME source. Neither is a copy of the other's code.

## Why the route must be declared in the store config

`wrangler deploy` attaches a route only when the config declares one. The
wildcard DNS record alone is not sufficient -- a Worker with no route receives
no traffic. The pattern is `*.paymedash.xyz/*` and it deliberately excludes the
apex.

## Deployed versions

| Worker | Version ID |
| --- | --- |
| `paymedash-api` | `b137e9b8-4ddf-4512-ab67-75b537441fdf` |
| `paymedash-store` | `380c8082-e31c-4e38-9c29-9a45ecffd06e` |

`paymedash-store` was redeployed for the rebrand because the store favicon's
`aria-label` changed. The initial deploy was `8d780d6e-0ac5-4886-8107-20b08e71711e`.

## Verified live

- `demo.paymedash.xyz` -> 200, "Homemade Crypto -- Demo", fixture renders,
  zero `dashpoint.store` references in the body.
- `pos.paymedash.xyz` -> 200, "PayMeDash POS"; `/_astro/` and
  `/manifest.webmanifest` return 200 through the proxy. `/admin/`, `/terms/`
  and `/privacy/` -> 200, all titled "PayMeDash".
- `www.paymedash.xyz` and `paymedash.xyz` -> 200, "PayMeDash".
- `paymedash.xyz/v1/shield/quote?amount=0.05` -> 200 with a real quote.
- `paymedash.xyz/v1/store?name=homemadecrypto` -> 404
  `No identity has registered this name.` The resolver was REACHED via the
  service binding, which is what the binding exists to prove: the failure is a
  real upstream answer, not the HTML-loop the binding prevents.

## Product name

The user-visible product name is **PayMeDash** (commit `7d32608`). It is not
`DashPoint` anywhere in the source, and a repo-wide grep for `DashPoint`
returns zero.

The npm identifiers were renamed to `@paymedash/*` with the root workspace
package named `paymedash`. This needs no lockfile change: the lockfile keys
workspace members by PATH, and nothing depends on another package by name, so
`pnpm install --frozen-lockfile` still passes.

Identifiers that CONTAIN the old spelling are deliberately unchanged, because
they are infrastructure or persisted state rather than branding:

- `dashpoint.config.v1` and `dashpoint.checkout.v1` (localStorage keys).
  Renaming either would orphan saved settings and in-flight checkouts on
  terminals already in the field.
- `dashpoint-static-v1` (service worker cache name), which the SW uses to find
  and evict its own old entries.
- The `dashpoint-*` Worker, Pages and host names, which are still serving as
  the mirror.
- The `sansbankdao/dashpoint-api` repository name, which is a separate repo and
  the mirror Worker that serves it.
