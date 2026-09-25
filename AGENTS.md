<!-- AGENTS.md -->
# AGENTS.md — dashpoint.sale (DashPoint POS)

Guidance for AI coding agents working in this repository.

## Repository facts

- **Purpose:** Browser-based USD point-of-sale keypad UI. A clerk enters a dollar
  amount, optionally applies a discount and a tip, and presses **Charge**.
- **Stack:** Astro `5.14.1` (static site, `output` default) + Tailwind CSS
  `4.1.14` wired through `@tailwindcss/vite`. TypeScript via
  `astro/tsconfigs/strict`. Package manager: pnpm (see `pnpm-lock.yaml`).
- **No backend exists in this repo.** There is no invoicing, quoting, payments,
  webhooks, or database code. `POST /v1/invoices` and the rest of the DashPoint
  API described in the engineering handoff are not implemented here.
- **Crypto is Dash-only in the current UI.** There is no cross-chain swap code.

### Source layout

```text
astro.config.mjs          Astro config; registers the Tailwind Vite plugin
package.json              name "dashpoint-sale", version 25.10.3, MIT
tsconfig.json             extends astro/tsconfigs/strict
public/favicon.svg        site icon
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
- The Charge button is disabled until `total > 0 && hasBaseAmount`.
- `calculateTotal()` = `base * (1 - discount/100) * (1 + tip/100)`.

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

## Integration context: NEAR Intents (for planned any-crypto payments)

The `ANY-crypto -> DASH` POS feature is **not implemented**. The following facts
were verified live from the NEAR Intents documentation and API on 2026-09-25 and
must be used instead of the figures in the legacy engineering handoff, which
contained several errors.

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
