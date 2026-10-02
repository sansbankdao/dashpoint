// apps/pos/src/lib/config.test.ts
//
// Tests for the POS configuration contract, run with `node --test`.
//
// The money maths (usdToDuff, the confirmThreshold gate, the minimum guard)
// lives inside the inline <script> in src/pages/index.astro and is not
// importable, so it is not covered here. What IS covered is the stored-config
// contract every one of those behaviours reads from: the coercion rules decide
// what the register sees, and a wrong value there changes whether a sale waits
// for on-chain confirmation.
//
// The default `confirmThresholdUsd` is the sharpest edge in this file. ZERO
// MEANS UNLIMITED, not "wait for everything": a corrupt or absent entry must
// fall back to 0 so a sale is never stalled, and that is asserted directly.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
    DEFAULT_CONFIG,
    CONFIG_STORAGE_KEY,
    coerceConfig,
} from './config.ts'

/** Minimal in-memory localStorage, so these tests need no browser. */
function installStorage(initial: Record<string, string> = {}): void {
    const store = new Map(Object.entries(initial))
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
            setItem: (key: string, value: string) => void store.set(key, String(value)),
            removeItem: (key: string) => void store.delete(key),
            clear: () => void store.clear(),
        },
    })
}

test('a missing config yields the defaults', () => {
    const config = coerceConfig(null)

    assert.equal(config.storeName, DEFAULT_CONFIG.storeName)
    assert.equal(config.destinationAddress, '')
    assert.equal(config.currency, DEFAULT_CONFIG.currency)
    assert.deepEqual(config.tipPresets, DEFAULT_CONFIG.tipPresets)
})

test('confirmThresholdUsd defaults to 0, which means UNLIMITED', () => {
    assert.equal(DEFAULT_CONFIG.confirmThresholdUsd, 0)
    assert.equal(coerceConfig(null).confirmThresholdUsd, 0)
})

test('a corrupt confirmThresholdUsd falls back to 0 rather than stalling every sale', () => {
    for (const bad of ['nonsense', null, undefined, NaN, Infinity, -5]) {
        const config = coerceConfig({ confirmThresholdUsd: bad as unknown as number })
        assert.equal(
            config.confirmThresholdUsd,
            0,
            `confirmThresholdUsd ${String(bad)} should coerce to 0 (unlimited)`,
        )
    }
})

test('a positive confirmThresholdUsd is preserved', () => {
    assert.equal(coerceConfig({ confirmThresholdUsd: 50 }).confirmThresholdUsd, 50)
    assert.equal(coerceConfig({ confirmThresholdUsd: 0.01 }).confirmThresholdUsd, 0.01)
})

test('tip presets drop unusable entries and never end up empty', () => {
    const filtered = coerceConfig({ tipPresets: [10, -1, 0, 200, 25] })
    assert.deepEqual(filtered.tipPresets, [10, 25])

    const empty = coerceConfig({ tipPresets: [-1, 0, 500] })
    assert.deepEqual(empty.tipPresets, DEFAULT_CONFIG.tipPresets)

    const notAnArray = coerceConfig({ tipPresets: 'nope' as unknown as number[] })
    assert.deepEqual(notAnArray.tipPresets, DEFAULT_CONFIG.tipPresets)
})

test('currency is upper-cased and blank falls back to the default', () => {
    assert.equal(coerceConfig({ currency: 'usd' }).currency, 'USD')
    assert.equal(coerceConfig({ currency: '  ' }).currency, DEFAULT_CONFIG.currency)
    assert.equal(coerceConfig({ currency: 42 as unknown as string }).currency, DEFAULT_CONFIG.currency)
})

test('a blank store name falls back to the default', () => {
    assert.equal(coerceConfig({ storeName: '  ' }).storeName, DEFAULT_CONFIG.storeName)
    assert.equal(coerceConfig({ storeName: 'Corner Shop' }).storeName, 'Corner Shop')
})

test('non-string address fields become empty strings', () => {
    const config = coerceConfig({
        destinationAddress: 7 as unknown as string,
        refundAddress: null as unknown as string,
        apiKey: {} as unknown as string,
    })

    assert.equal(config.destinationAddress, '')
    assert.equal(config.refundAddress, '')
    assert.equal(config.apiKey, '')
})

test('the storage key is the documented v1 key that /admin writes', () => {
    assert.equal(CONFIG_STORAGE_KEY, 'paymedash.config.v1')
})

test('loadConfig reads the stored entry and coerces it', async () => {
    installStorage({
        [CONFIG_STORAGE_KEY]: JSON.stringify({ storeName: 'Corner Shop', confirmThresholdUsd: 'x' }),
    })

    const { loadConfig } = await import('./config.ts')
    const config = loadConfig()

    assert.equal(config.storeName, 'Corner Shop')
    assert.equal(config.confirmThresholdUsd, 0)
})

test('loadConfig survives unparseable JSON', async () => {
    installStorage({ [CONFIG_STORAGE_KEY]: '{not json' })

    const { loadConfig } = await import('./config.ts')
    assert.equal(loadConfig().storeName, DEFAULT_CONFIG.storeName)
})

test('loadConfig without localStorage returns the defaults', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined })

    const { loadConfig } = await import('./config.ts')
    assert.deepEqual(loadConfig(), { ...DEFAULT_CONFIG })
})

test('saveConfig writes the coerced form, not the raw input', async () => {
    installStorage()

    const { saveConfig } = await import('./config.ts')
    const ok = saveConfig({ ...DEFAULT_CONFIG, storeName: '  ', confirmThresholdUsd: -1 })

    assert.equal(ok, true)

    const written = JSON.parse((globalThis as unknown as { localStorage: { getItem(k: string): string | null } }).localStorage.getItem(CONFIG_STORAGE_KEY)!)
    assert.equal(written.storeName, DEFAULT_CONFIG.storeName)
    assert.equal(written.confirmThresholdUsd, 0)
})
