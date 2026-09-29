// src/lib/config.ts

/**
 * Shared POS configuration.
 *
 * Storage is browser localStorage only. This repository has no backend for
 * these values, so they are per-device display preferences. Payment-critical
 * settings live on the dashpoint-api Worker instead:
 *
 *   - The DASH payout address is entered on /admin for THIS device and is sent
 *     with every quote as `destinationAddress`. The Worker holds none.
 *   - The 1Click partner JWT is a Cloudflare Secrets Store binding.
 *   - Refunds default to the Worker's `REFUND_NEAR_ACCOUNT`.
 *
 * Nothing secret belongs in this file or in any value it stores, because
 * localStorage is readable by anyone who opens the page.
 */

export interface PosConfig {
    /** Shown in the POS header and footer. */
    storeName: string
    /**
     * DASH address for sales taken on THIS device.
     *
     * Sent to the API as `destinationAddress`, which is required: the Worker
     * holds no address of its own. Empty means the terminal is not configured
     * and cannot take a payment.
     */
    destinationAddress: string
    /** Reserved. Refunds are decided by the API, not by the browser. */
    refundAddress: string
    /** Reserved. The partner JWT is server-side and never held here. */
    apiKey: string
    /** Display currency label. The POS prices are currently USD-denominated. */
    currency: string
    /** Tip percentages offered by the tip tab. */
    tipPresets: number[]
    /**
     * Dollar value at or below which a detected deposit is treated as settled
     * immediately, so a routine sale does not make the customer wait.
     *
     * ZERO MEANS UNLIMITED, not "wait for everything": the common case at a
     * counter is a small sale, and the whole point of the setting is to skip
     * the wait for those. A shop that wants every payment confirmed on-chain
     * must set a figure above its largest sale; it cannot express that with
     * this field at 0.
     *
     * Sales ABOVE the figure wait for SUCCESS ("tokens delivered") before the
     * register reports the sale as complete.
     */
    confirmThresholdUsd: number
}

export const DEFAULT_CONFIG: PosConfig = {
    storeName: 'DashPoint POS',
    destinationAddress: '',
    refundAddress: '',
    apiKey: '',
    currency: 'USD',
    tipPresets: [10, 15, 20, 25],
    confirmThresholdUsd: 0
}

export const CONFIG_STORAGE_KEY = 'dashpoint.config.v1'

// Base58 alphabet shared by Bitcoin and Dash (no 0, O, I, l).
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

// Dash mainnet P2PKH version byte. Verified against the NEAR Intents Dash
// treasury address XxA9DbXaFpF4GFY8KUNX7eAxhZPsWtcKhc, which decodes to
// version 0x4C (76) with a valid Base58Check checksum.
const DASH_P2PKH_VERSION = 76

function base58Decode(input: string): Uint8Array | null {
    let value = 0n
    for (const char of input) {
        const index = BASE58_ALPHABET.indexOf(char)
        if (index === -1) return null
        value = value * 58n + BigInt(index)
    }

    let hex = value.toString(16)
    if (hex.length % 2 === 1) hex = '0' + hex
    const body = hex.match(/../g)?.map(byte => parseInt(byte, 16)) ?? []

    let leadingZeros = 0
    for (const char of input) {
        if (char !== '1') break
        leadingZeros++
    }

    return new Uint8Array([...new Array(leadingZeros).fill(0), ...body])
}

/**
 * Validates a Dash mainnet P2PKH address using Base58Check:
 * version byte 76, 21-byte payload, 4-byte double-SHA-256 checksum.
 * Async because it uses SubtleCrypto, which needs a secure context
 * (https or localhost).
 */
export async function isValidDashAddress(address: string): Promise<boolean> {
    if (typeof address !== 'string' || address.length !== 34) return false
    if (!address.startsWith('X')) return false

    const raw = base58Decode(address)
    if (!raw || raw.length !== 25) return false
    if (raw[0] !== DASH_P2PKH_VERSION) return false

    const payload = raw.slice(0, 21)
    const checksum = raw.slice(21)

    const first = await crypto.subtle.digest('SHA-256', payload)
    const second = new Uint8Array(await crypto.subtle.digest('SHA-256', first))

    return second[0] === checksum[0]
        && second[1] === checksum[1]
        && second[2] === checksum[2]
        && second[3] === checksum[3]
}

/*
 * Exported for the unit tests in src/lib/config.test.ts. The coercion rules
 * decide what the register sees, so they are tested directly rather than only
 * through loadConfig().
 */
export function coerceConfig(raw: Partial<PosConfig> | null): PosConfig {
    const merged = { ...DEFAULT_CONFIG, ...(raw ?? {}) }

    merged.storeName = typeof merged.storeName === 'string' && merged.storeName.trim()
        ? merged.storeName
        : DEFAULT_CONFIG.storeName

    merged.destinationAddress = typeof merged.destinationAddress === 'string'
        ? merged.destinationAddress
        : ''

    merged.refundAddress = typeof merged.refundAddress === 'string'
        ? merged.refundAddress
        : ''

    merged.apiKey = typeof merged.apiKey === 'string' ? merged.apiKey : ''

    merged.currency = typeof merged.currency === 'string' && merged.currency.trim()
        ? merged.currency.toUpperCase()
        : DEFAULT_CONFIG.currency

    merged.tipPresets = Array.isArray(merged.tipPresets)
        ? merged.tipPresets.filter(n => typeof n === 'number' && n > 0 && n <= 100)
        : DEFAULT_CONFIG.tipPresets

    if (merged.tipPresets.length === 0) merged.tipPresets = DEFAULT_CONFIG.tipPresets

    /*
     * A stored figure is kept only when it is a usable number. Anything else
     * falls back to 0, which is the "do not wait" default rather than a
     * blocking value, so a corrupt entry cannot stall every sale.
     */
    const threshold = Number(merged.confirmThresholdUsd)
    merged.confirmThresholdUsd = Number.isFinite(threshold) && threshold > 0 ? threshold : 0

    return merged
}

/** Reads config from localStorage, falling back to defaults. */
export function loadConfig(): PosConfig {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_CONFIG }

    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
        if (!stored) return { ...DEFAULT_CONFIG }
        return coerceConfig(JSON.parse(stored) as Partial<PosConfig>)
    } catch {
        return { ...DEFAULT_CONFIG }
    }
}

/** Persists config to localStorage. Returns false when storage is unavailable. */
export function saveConfig(config: PosConfig): boolean {
    if (typeof localStorage === 'undefined') return false

    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(coerceConfig(config)))
        return true
    } catch {
        return false
    }
}

/** Removes stored config so the POS returns to defaults. */
export function clearConfig(): boolean {
    if (typeof localStorage === 'undefined') return false

    try {
        localStorage.removeItem(CONFIG_STORAGE_KEY)
        return true
    } catch {
        return false
    }
}
