<!-- docs/consolidation-handoff.md -->
# Handoff — consolidating dashpoint.sale and dashpoint.store into dashpoint

Written 2026-09-28 for the agent picking up the consolidation.
Every claim below was verified by running a command in this workspace; the
command is named so it can be re-run rather than trusted.

## 1. What this repo is

`/Workspace/sansbank/dashpoint` is a pnpm monorepo, remote
`git@github.com:sansbankdao/dashpoint.git`, branch `master`.

History, newest first (`git log --oneline`):

```
f4cfdd0 chore: import dashpoint.sale as apps/pos
7f6e30a chore: import dashpoint.store as apps/store
dc3e67e chore: initialise the monorepo skeleton
```

Both imports are **`git subtree` merges**, not copies. `f4cfdd0` records
`git-subtree-dir: apps/pos` and `git-subtree-split:
23b2f0893411bec3b60616627ee50222a4bf1cb0`, which is exactly the tip of
`dashpoint.sale` at the time of the import. Full upstream history is therefore
already present in this repo, and the old repos remain reachable as remotes
named `sale` and `store` (`git remote -v`).

The two imports are byte-identical to their sources. Verified with:

```
diff -rq --exclude=.git --exclude=node_modules --exclude=dist \
  --exclude=.astro --exclude=.wrangler \
  apps/pos /Workspace/sansbank/dashpoint.sale
diff -rq --exclude=.git --exclude=node_modules --exclude=dist \
  --exclude=.astro --exclude=.wrangler \
  --exclude=pnpm-workspace.yaml --exclude=pnpm-lock.yaml \
  apps/store /Workspace/sansbank/dashpoint.store
```

Both produce no output. Do not re-import; the content is already correct.

## 2. What the consolidated repo does NOT contain

**The `dashpoint-api` Worker is not in this repo.** It is a separate
repository, `/Workspace/sansbank/dashpoint-api`
(`git@github.com:sansbankdao/dashpoint-api.git`), currently at `24da790`.

This matters more than any other item here, because **`dashpoint.sale` serves
`/v1/*` from that Worker, and this repo cannot deploy it.** From
`dashpoint-api/packages/api/wrangler.jsonc`:

```
"routes": [
  { "pattern": "dashpoint.sale/v1",    "zone_name": "dashpoint.sale" },
  { "pattern": "dashpoint.sale/v1/*",  "zone_name": "dashpoint.sale" },
  { "pattern": "dashpoint.store/v1",   "zone_name": "dashpoint.store" },
  { "pattern": "dashpoint.store/v1/*", "zone_name": "dashpoint.store" }
]
```

The POS calls `/v1/minimum`, `/v1/assets`, `/v1/price`, `/v1/quote` and
`/v1/status` (`apps/pos/src/pages/index.astro`, `apiFetch` at line 1145). Those
routes are provisioned outside this repository.

The consolidation has **not** addressed whether `dashpoint-api` should also move
to `apps/api`. That decision is open; see section 8.

## 3. Verified working state

Run from the repo root. `pnpm -v` reported **10.15.0**; `.nvmrc` pins Node
**22.23.2** and the interpreter present was **v24.18.1**.

- `pnpm install --no-frozen-lockfile` — **succeeds** (2m 8s, 774 resolved). It
  produced a **new untracked `pnpm-lock.yaml`** at the root. There was no root
  lockfile before this; the two per-app lockfiles were the only ones.
- `pnpm -r build` — **succeeds**. `apps/pos` builds 4 pages; `apps/store`
  builds and completes its server build.
- `pnpm -r test` — **48 pass, 0 fail**, all in `apps/store`.
- `pnpm -r check` — `apps/store` reports 0 errors, 0 warnings, 0 hints.

## 4. Defects to fix, in priority order

### 4.1 The root `package.json` names an app that does not exist

`apps/` contains exactly `pos` and `store` (`ls apps/`). The root
`package.json` nevertheless defines `dev:web`, `build:web`, and a `build` script
that runs `pnpm -r build`, and `pnpm -r check` reported **"Scope: 2 of 3
workspace projects"** — the third being `@dashpoint/web`, which has no
directory.

Also note the POS package is named `dashpoint-sale`, not `@dashpoint/pos`, and
the store is `dashpoint-store`, not `@dashpoint/store`. Every `--filter
@dashpoint/pos` and `--filter @dashpoint/store` in the root scripts matches
nothing. Verified:

```
grep -o '@dashpoint/[a-z]*' package.json | sort -u   # pos, store, web
python3 -c "import json;print(json.load(open('apps/pos/package.json'))['name'])"   # dashpoint-sale
python3 -c "import json;print(json.load(open('apps/store/package.json'))['name'])" # dashpoint-store
```

Decide one naming scheme and apply it to all three files. `apps/web` does not
exist at all, so either create it (the `dashpoint.store` repo also holds a
landing page and a demo) or delete the `web` scripts.

### 4.2 The POS is excluded from `check` and `test`

`apps/pos/package.json` has only `dev`, `build`, `preview`, `astro`.
`apps/store/package.json` has `check`, `test` and `audit` as well. So
`pnpm -r check` and `pnpm -r test` silently skip the POS, and the checkout,
polling and register logic carries no test coverage in this repo.

The POS is the app with the most behaviour worth pinning down: the
`confirmThresholdUsd` gate, the celebration firing exactly once, the 8-decimal
rounding, the `Below minimum` guard. Add at least `check` (`astro check`, which
needs `@astrojs/check` and `typescript` as devDependencies — the POS has
neither) and a `test` script.

### 4.3 Two nested workspace/lockfile sets fight the root

`apps/store/pnpm-workspace.yaml` still exists *inside a workspace member*, and
it is not the same file as the root one:

```
# root pnpm-workspace.yaml
onlyBuiltDependencies: [esbuild, sharp, workerd, '@tailwindcss/oxide']

# apps/store/pnpm-workspace.yaml
allowBuilds: {'@tailwindcss/oxide': true, esbuild: true, sharp: true, workerd: true}
minimumReleaseAgeExclude: [astro@7.3.5]
overrides:
  picomatch@<2.3.2: '>=2.3.2'
  mdast-util-to-hast@<13.2.1: '>=13.2.1'
```

The store's `overrides` (two security floors) and `minimumReleaseAgeExclude`
are **not** reflected in the root workspace file. A nested
`pnpm-workspace.yaml` is also a pnpm configuration boundary; decide whether to
delete it after porting `overrides` and `minimumReleaseAgeExclude` to the root,
or keep it deliberately.

The stale per-app lockfiles `apps/pos/pnpm-lock.yaml` (120 KB) and
`apps/store/pnpm-lock.yaml` (139 KB) are tracked and now contradict the root
lockfile. They will confuse `--frozen-lockfile`, which is what CI uses.

### 4.4 CI lives inside a workspace member

`apps/store/.github/workflows/ci.yml` is the only CI file; there is no root
`.github/` (`ls -d .github` fails). Its steps are:

```
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Run from the repo root those commands now mean the workspace, but the file sits
in a member, where GitHub will not read it. It also pins `pnpm/action-setup`
to `version: 9` while the root declares `packageManager: pnpm@10.15.0` and the
install above actually used v10.15.0. That mismatch will fail
`--frozen-lockfile`, because the lockfile is v10-format.

Move the workflow to `.github/workflows/` at the root, pin pnpm to the version
in `packageManager`, and add the POS to the matrix once 4.2 is done.

### 4.5 `pnpm install` needs `--no-frozen-lockfile` until the root lockfile is committed

There is currently no root `pnpm-lock.yaml` in git. It is untracked
(`git status --short` shows `?? pnpm-lock.yaml`) and not gitignored
(`git check-ignore -v pnpm-lock.yaml` reports nothing). Commit it, then delete
the two per-app lockfiles, then CI's `--frozen-lockfile` will work.

### 4.6 Minor: version drift between the two apps

`apps/pos/package.json` is `version 25.10.3` with Astro `5.14.1` and Tailwind
`4.1.14` (all exact pins). `apps/store/package.json` is `version 25.10.4` with
Astro `^7.3.5` and Tailwind `^4.3.3` (carets). They cannot share one hoisted
dependency set cleanly. `pnpm install` already warned:

```
apps/pos
└─┬ @tailwindcss/vite 4.1.14
  └── ✕ unmet peer vite@"^5.2.0 || ^6 || ^7": found 8.3.1
```

The POS is on Astro 5 and the store on Astro 7. Aligning them is a real
migration, not a version bump. **Do not do it as a drive-by**; file it, and get
the rest of the consolidation landed first.

## 5. Pre-existing warnings that are NOT regressions

`pnpm -r build` prints four warnings from `apps/pos`:

```
You are attempting to render <Display client:load />, but Display is an Astro
component. ... Please use a framework component for client rendering.
```

The same four appear for `ModeContent`, `ModeTabs` and `Keypad`. They predate
the consolidation and the build still completes. Do not "fix" these while doing
consolidation work; they are unrelated and touching them risks the POS.

## 6. Facts about the POS that the next agent will need

Taken from `apps/pos/` and from live calls made during the previous work.

- The POS is a **static** Astro 5 site; it has no server of its own. `/v1/*` is
  the separate Worker from section 2.
- **The DASH payout address is per device.** There is no
  `MERCHANT_DASH_ADDRESS` on the Worker. The clerk sets it on `/admin`, it is
  stored in `localStorage` under `dashpoint.config.v1`, and the POS sends it as
  `destinationAddress` with every quote. `POST /v1/quote` returns 400 without
  it.
- **`confirmThresholdUsd` defaults to `0`, which means UNLIMITED** — every sale
  settles on deposit detection. It does **not** mean "wait for everything". A
  positive figure makes sales **above** that figure wait for `SUCCESS`.
- **1Click has no separate confirmation state.** The enum is `PENDING_DEPOSIT`,
  `KNOWN_DEPOSIT_TX` ("Deposit transaction detected"), `PROCESSING`, `SUCCESS`
  ("Tokens delivered to destination address"), plus `INCOMPLETE_DEPOSIT`,
  `REFUNDED` and `FAILED`. The POS treats `KNOWN_DEPOSIT_TX` as detected and
  `SUCCESS` as settled.
- **The `/v1/status` lookup key is `depositAddress`.** There is no `quoteId` and
  no `/v0/refund`. `explorerUrl` can be the empty string; never build a link
  from it without checking.
- **Confetti is hand-written on a canvas, deliberately.** `qrcode` is the only
  third-party runtime dependency in the POS. Do not add an animation library.
- **The worker holds the 1Click JWT** in Cloudflare Secrets Store
  (`NEAR_INTENTS_1CLICK_JWT`). It is never written into a committed file and
  must never be entered into `/admin`, which is publicly reachable.
- `apps/pos/AGENTS.md` (316 lines) documents the POS in detail. It still
  describes the old layout and the old package name; it needs updating, but it
  is accurate about behaviour.

## 7. Deploy reality

- **The POS deploys as a Cloudflare Pages project**, `dashpoint-sale`, from the
  built `dist/`. It is a static site. Deploying from inside `apps/pos` works;
  deploying from the monorepo root needs the Pages build settings pointed at the
  subdirectory.
- **The store deploys as a Worker**, `dashpoint-store`, via
  `@astrojs/cloudflare` (`apps/store/wrangler.jsonc`, `"name":
  "dashpoint-store"`).
- **The API deploys as a Worker**, `dashpoint-api`, from the separate repo.
- Account id `cff27acd0f4e86139f6cf3f1a295d4b0`. Zone ids: `dashpoint.sale` =
  `85f1112d53ffad633c1192756b672d52`, `dashpoint.store` =
  `9901802469a0c63bf42b9252032fcd1f`.
- **Deploying the API needs a credential carrying `secrets_store:write`,** not
  just Workers Scripts:Edit. The token in `~/.cloudflare/api-token` lacks it and
  fails with Cloudflare error `10021`; the wrangler OAuth session in
  `~/.wrangler/config/default.toml` has it. Unset `CLOUDFLARE_API_TOKEN` to use
  the OAuth session. This is documented so the next agent does not rediscover it
  mid-deploy.
- **No deploy was performed while writing this handoff.** Nothing in this repo
  has been deployed from the monorepo layout yet, and no root lockfile has been
  committed. The consolidation is landed in git but not yet proven as a deploy
  source.

## 8. Open decisions — do not guess these

1. Does `dashpoint-api` move into this repo as `apps/api`? (Section 2. It is
   currently a separate repo with a separate remote.)
2. Does `apps/web` get created, or are the `web` scripts deleted? (4.1.)
3. One package-name scheme: `@dashpoint/pos` or `dashpoint-sale`? (4.1.)
4. Is `apps/store/pnpm-workspace.yaml` kept, or its `overrides` ported to the
   root and the file deleted? (4.3.)
5. Are the two per-app lockfiles deleted in favour of one root lockfile? (4.5.)
6. When, if ever, is the store migrated from Astro 7 down/up to match the POS on
   Astro 5? (4.6.)
7. Are the old `dashpoint.sale` / `dashpoint.store` GitHub repos archived, kept
   as remotes, or left to diverge? They are currently remotes named `sale` and
   `store`, and `apps/pos` is at their exact tip.

## 9. Suggested order of work

1. Commit the root `pnpm-lock.yaml`; decide and act on the per-app lockfiles
   (4.5, 4.3).
2. Fix naming so `--filter` targets resolve (4.1). Confirm with `pnpm -r check`
   reporting 3 of 3 projects, or 2 of 2 if `apps/web` is dropped.
3. Add `check` and `test` to `apps/pos` (4.2).
4. Move CI to the root, pin pnpm to `packageManager` (4.4).
5. Do one end-to-end deploy from the monorepo layout and verify the POS on
   `dashpoint.sale` still reaches `/v1/*` (section 7).
6. Only then consider the Astro version alignment (4.6), as its own change.

## 10. Housekeeping

`apps/pos/AGENTS.md` and `apps/store/AGENTS.md` both still describe their app as
a standalone repo at the old paths (`/Workspace/sansbank/dashpoint.sale`).
`apps/pos/AGENTS.md` also names the package `dashpoint-sale`, which will be
wrong once 4.1 is decided. Update both, and consider a short root `AGENTS.md`
covering the monorepo itself.
