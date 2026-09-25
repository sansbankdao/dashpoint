<!-- AGENTS.md -->
# AGENTS.md — dashpoint.sale (DashPoint POS)

Guidance for AI coding agents working in this repository.

## Repository facts

- **Purpose:** Browser-based USD point-of-sale keypad UI. A clerk enters a dollar
  amount, optionally applies a discount and a tip, and presses **Pay Now**.
- **Stack:** Astro `5.14.1` (static site, `output` default) + Tailwind CSS
  `4.1.14` wired through `@tailwindcss/vite`. TypeScript via
  `astro/tsconfigs/strict`. Package manager: pnpm (see `pnpm-lock.yaml`).
- **No backend exists in this repo.** The payment API is the separate
  `dashpoint-api` Worker (see "Deployed API" below), reached same-origin at
  `/v1`. `POST /v1/invoices` from the legacy engineering handoff does not exist.
- **Crypto is any-asset in, DASH out.** The POS accepts the origin assets listed
  by `GET /v1/assets` and settles DASH to the merchant address.

### Source layout

```text
astro.config.mjs          Astro config; registers the Tailwind Vite plugin
package.json              name "dashpoint-sale", version 25.10.3, MIT
tsconfig.json             extends astro/tsconfigs/strict
public/favicon.svg        site icon
public/manifest.webmanifest  PWA manifest (start_url "/", display standalone)
public/sw.js              minimal service worker: installability + asset cache
public/icon-192.png        PWA icon (192x192)
public/icon-512.png        PWA icon (512x512)
public/icon-maskable-512.png  PWA maskable icon (512x512)
public/apple-touch-icon.png   iOS home-screen icon (180x180)
src/pages/index.astro     page shell + ALL client state (amount/discount/tip)
src/components/
  Display.astro           renders USD amount, total, calculation text
  ModeTabs.astro          Amount / Discount / Tip tabs (Discount & Tip disabled
                          until hasBaseAmount is true)
  ModeContent.astro       per-mode helper content
  Keypad.astro            0-9 keypad plus Clear and Add buttons
  TipSelector.astro       tip preset buttons
src/styles/global.css     contains only: @import "tailwindcss";
```

### How the UI works (verified from source)

- `src/pages/index.astro` owns all state in an inline `<script>`: `amountStr`
  (integer **cents**, e.g. `"500"` = `$5.00`), `discountPercent`, `tipPercent`,
  `baseAmount`, `activeMode`, `hasBaseAmount`.
- Components communicate through DOM `CustomEvent`s dispatched on `#pos-app`:
  `stateupdate`, `modechange`, `keypad:input`, `keypad:clear`, `keypad:add`,
  `tip:preset`. Events always use `bubbles: true, composed: true`.
- `Display.astro` divides `amountStr` by 100 to show dollars. Keep this contract:
  `amountStr` is **cents as an integer string** everywhere.
- The Pay Now button is disabled until `total > 0`.
- `calculateTotal()` = `(baseAmount + amountStr/100) * (1 - discount/100) * (1 + tip/100)`.
  `baseAmount` holds the running subtotal accumulated with the `+` key, and
  `amountStr` is the amount currently on the display. Both must be summed: a
  version that read only `amountStr` made `+` a one-way trip that zeroed the
  total and disabled Pay Now permanently. `Display.astro` renders the same sum,
  so keep the two in step.

## Commands

Run from the repo root:

```sh
pnpm install          # install dependencies
pnpm dev              # astro dev, http://localhost:4321
pnpm build            # astro build -> ./dist/
pnpm preview          # preview the production build
pnpm astro check      # astro/TypeScript diagnostics
```

## Conventions

- Match the existing 4-space indentation in `.astro` files.
- Keep money as integers where possible (`amountStr` cents); never introduce
  floating-point dollars into state.
- Preserve the `stateupdate` event payload contract; components depend on it.
- The UI is USD-denominated (`Display.astro` hardcodes the `USD` label).

## Gotchas for agents

- **Do not `read` binary assets** (`public/favicon.svg` and any future images,
  PDFs, archives). Verify them with `ls -la`, `file`, or `du` instead. Loading a
  large binary inflates the context window.
- `src/styles/global.css` intentionally contains only the Tailwind import; do
  not add global rules without reason.
- `src/pages/index.astro` holds the single source of truth for POS state. When
  extending behavior (for example a payment/charge flow), route new state
  through `updateDOM()` rather than adding parallel state holders.

## PWA / installability

The terminal is installable as a standalone app.

- `start_url` is **`/`**, the payment terminal, not `/admin`. An installed app is
  the point of sale.
- `public/sw.js` is a **minimal** service worker. It exists to satisfy the
  browser's install criteria, to cache the content-hashed `/_astro` assets, and
  for nothing else. It is deliberately **not** an offline cache.
- **Never cache `/v1`.** A cached quote, price, or swap status would show the
  clerk a stale amount or an already-settled sale. The worker returns before
  handling any `/v1` request so the network answers and can fail visibly.
- Navigations are network-first, so a deploy cannot leave a client running HTML
  that points at deleted bundles. Only `/_astro` and static file extensions are
  cache-first.
- `beforeinstallprompt` is **Chromium-only**. iOS Safari has no programmatic
  install, so `/admin` shows share-sheet steps instead of a button that cannot
  act. Do not claim a button can install on iOS.
- Registration happens on `/`, not `/admin`, because `start_url` is `/`.

## Integration context: NEAR Intents (for planned any-crypto payments)

The `ANY-crypto -> DASH` POS feature **is implemented and live** as of
2026-09-25. The POS Charge flow calls the `dashpoint-api` Worker (see
"Deployed API" below). The following facts were verified live from the NEAR
Intents documentation and API on 2026-09-25 and must be used instead of the
figures in the legacy engineering handoff, which contained several errors.

### Deployed API

The checkout is served by the `dashpoint-api` Worker, which is routed at `/v1`
on this zone and on `dashpoint.store`, in front of the static Pages site.

| Endpoint | Purpose |
| --- | --- |
| `GET /v1/health` | Liveness, destination asset, `partnerKeyPresent` |
| `GET /v1/assets` | Origin chains the POS can accept |
| `GET /v1/price` | DASH spot price in USD, read from the 1Click token list |
| `POST /v1/quote` | Create an `EXACT_OUTPUT` swap paying out to a DASH address |
| `GET /v1/status` | Track a swap by deposit address (and memo) |
| `GET /v1/docs`, `/v1/redoc`, `/v1/openapi.json` | Generated API browser and spec |

- Source: `github.com/sansbankdao/dashpoint-api` (private).
- The partner JWT lives in a Cloudflare Secrets Store binding on the Worker.
  It is never sent to the browser and never committed to this repository. Do
  not add it to any tracked file; the POS has no need for it.
- `partnerKeyPresent: true` from `/v1/health` and `authenticated: true` on a
  quote are the observable proof that the binding resolves.
- `/admin` **is deployed** at `https://dashpoint.sale/admin`. It is marked
  `noindex, nofollow` and is not linked from the POS, but it is publicly
  reachable, so **no secret may ever be entered into it**. It stores display
  settings and the merchant payout address in localStorage, which is
  device-local, not shared between devices, and not authoritative.
- **The partner JWT is never in this repository or in the browser.** It is a
  Cloudflare Secrets Store binding on the Worker. `/admin` shows only a boolean
  read from `GET /v1/health`. Do not add a field that accepts it.
- The authoritative payout address is `MERCHANT_DASH_ADDRESS` on the Worker,
  set with `wrangler secret put`. A quote that carries no `destinationAddress`
  falls back to it, and is refused with a 400 if it is unset.
- Refunds default to NEAR Intents to `REFUND_NEAR_ACCOUNT`
  (`sansbank-dao.near`); 1Click requires `refundTo` to be non-empty for every
  quote. A quote that carries a `refundAddress` refunds on the origin chain
  instead.

### What NEAR Intents is, and which surface to integrate

- **NEAR Intents is the protocol.** It defines *intents* ("I have X, I want Y"),
  with market makers (solvers) competing to fulfill them, and atomic on-chain
  settlement via the `intents.near` Verifier contract.
- **1Click Swap API is the REST distribution channel for NEAR Intents** — the
  production integration surface for a POS. Per the official docs: *"1Click Swap
  is a REST API that automates routing and settlement on NEAR Intents."* If asked
  to "integrate NEAR Intents", the correct layer is the 1Click API; the
  lower-level **Message Bus** (solver JSON-RPC/WebSocket) and **Verifier
  contract** are protocol internals that a POS does not need.
- Docs index: `https://docs.near-intents.org/llms.txt`
  Full text: `https://docs.near-intents.org/llms-full.txt`
  OpenAPI: `https://1click.chaindefuser.com/docs/v0/openapi.yaml`

### Verified API facts

| Fact | Value |
| --- | --- |
| Base URL | `https://1click.chaindefuser.com` |
| Tokens | `GET /v0/tokens` (live; 197 assets at time of check) |
| Quote | `POST /v0/quote` — returns **HTTP 201** on success (not 200) |
| Status | `GET /v0/status?depositAddress=...` (add `depositMemo` if `depositMode` = `MEMO`) |
| Optional deposit hint | `POST /v0/deposit/submit` with `{depositAddress, txHash}` |
| Quote identity | **There is no `quoteId`.** Track a swap by its `depositAddress` (and `depositMemo`). |
| Auth | Optional JWT via `X-API-Key` (or `Authorization: Bearer`). Unauthenticated adds **0.25%**. |
| Unauthenticated rate limit | **1200 requests / 60s (20 RPS)** — observed via `x-ratelimit-limit-unauth` header, not ~5 RPS. |
| DASH asset id | `nep141:dash.omft.near` (decimals 8). Dash is supported on the Bitcoin & Forks tab. |
| Dash treasury address | `XxA9DbXaFpF4GFY8KUNX7eAxhZPsWtcKhc` |

**Required `/v0/quote` fields** (missing any returns HTTP 400):
`dry` (boolean), `swapType`, `originAsset`, `destinationAsset`, `amount`
(integer string, base units), `depositType`, `recipient`, `recipientType`,
`refundTo`, `refundType`, `deadline` (ISO-8601).

**Response fields used for pricing/timing:** `amountIn`, `amountInFormatted`,
`amountInUsd`, `minAmountIn`, `amountOut`, `amountOutFormatted`, `amountOutUsd`,
`minAmountOut`, `timeEstimate` (seconds), `depositAddress`, `depositMode`,
`depositMemo`, `deadline` (ISO-8601), `refundFee`, `withdrawFee`.

- `amountOut` is in **base units** (e.g. duff for DASH). There is no `minAmount`
  or `maxAmount` field; the minimum is `minAmountIn`.
- Every quote payload carries `signature` + `timestamp`. Verify with
  `verifyQuoteSignature()` from `@defuse-protocol/one-click-sdk-typescript`
  (>= 0.1.24): signed message is
  `stringify({ ...quoteRequest, ...quoteResponse, timestamp })`, SHA-256, Base58.

### Status values (`GET /v0/status`)

`KNOWN_DEPOSIT_TX`, `PENDING_DEPOSIT`, `INCOMPLETE_DEPOSIT`, `PROCESSING`,
`SUCCESS`, `REFUNDED`, `FAILED`.

### Refunds are automatic — there is no refund endpoint

- `POST /v0/refund` **does not exist**. Refunds go to the `refundTo` address
  captured at quote time. Underpayment below `amountIn`/`minAmountIn` is refunded
  by the `deadline`; overpayment is swapped and the excess refunded.
- `EXACT_INPUT`: below `amountIn` -> refunded; above `amountIn` -> excess refunded.
- `EXACT_OUTPUT`: below `minAmountIn` -> refunded; above `amountIn` -> excess refunded.
- `FLEX_INPUT`: accepted within a slippage band on both sides; below `minAmountIn`
  refunded after deadline.
- `ANY_INPUT`: deposit-and-sweep, authorized partners only, ~$1,000 USD sweep
  threshold, never refunds (retries), `appFees` not allowed.

### Fees (verified)

- Protocol fee: **0.0001% (1 pip)**, on-chain.
- Unauthenticated 1Click: **+0.25%** on non-`ANY_INPUT` quotes.
- Authenticated with no `appFees`: **0.20%**, or **0.01%** on stablecoin /
  same-asset multichain routes.
- Authenticated with `appFees`: 50/50 split, 1Click keeps >= 20 bps (>= 1 bp for
  stablecoins); combined total capped at **500 bps (5%)**.

### Operational caveats that break POS assumptions

- **No testnet exists for NEAR Intents.** Test on mainnet with small amounts.
- **`$1,000` minimum on nine chains** (temporary, from 2026-09-09): BSC, Polygon,
  TON, Optimism, Avalanche, Stellar, Monad, XLayer, ADI. **Dash is not on that
  list**, but re-check `https://docs.near-intents.org/changelog/overview` before
  shipping.
- **Tron** has a separate temporary `$100` minimum.
- **No InstantSend here.** InstantSend is a Dash-network mechanism and is absent
  from NEAR Intents docs. `GET /v0/status` reports when tokens are delivered to
  the merchant DASH address; InstantSend detection requires a Dash node/Insight
  layer in a separate `watcher` component.
- **Compliance screening runs on non-dry quotes** (TRM Labs and others). A swap
  can be delayed or blocked; design a graceful degradation path.

## Citable protocol claims (do not restate unsourced figures)

Do not repeat the legacy handoff's stale claims. Specifically:

- Wrong: `https://api.1inch.dev/swap/v6.1/1/quote` — that is the unrelated **1inch**
  (EVM DEX aggregator) API, not NEAR Intents.
- Wrong: "`/v0/refund` on 1Click" — no such endpoint.
- Wrong: `quoteId` on a quote — track by `depositAddress`.
- Wrong: "~5 RPS" — observed limit is 20 RPS unauthenticated.
- Wrong: `duwei` for DASH — the DASH base unit is the **duff** (1 DASH = 1e8 duff).
- Unverified: the Dash blog post "Dash Is Live on NEAR Intents" (URL not located);
  verify before citing. DASH support itself is confirmed live via `GET /v0/tokens`.
