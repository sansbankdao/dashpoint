// scripts/exclude-admin.mjs

/*
 * Remove the locally-served admin page from the build output.
 *
 * `src/pages/admin.astro` is kept in the repository so that `astro dev` serves
 * it at http://localhost:4321/admin on the merchant's own machine. The POS
 * Charge flow does not depend on it: the checkout panel in `src/pages/index.astro`
 * collects the payout address for each sale.
 *
 * Cloudflare Pages runs `npm run build` and uploads the whole `dist` directory,
 * so an admin page left in the output would be published and reachable at
 * https://dashpoint.sale/admin. That page can direct merchant payouts, so it is
 * deleted here rather than committed to the internet. Deleting the built file
 * keeps the dev route working and makes the published surface smaller.
 */

import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'dist', 'admin')

if (existsSync(target)) {
    await rm(target, { recursive: true, force: true })
    console.log('[exclude-admin] removed dist/admin from the published output')
} else {
    console.log('[exclude-admin] dist/admin was not present, nothing to remove')
}
