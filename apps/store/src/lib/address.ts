// src/lib/address.ts
//
// Dash address classification.
//
// Given a string a user pastes, decide whether it is an L1 Dash Core address, an
// L2 Dash Platform transparent address, or an L2 Platform shielded (Orchard)
// address, so the UI can label the destination before funds move.
//
// The rule is DECODE, THEN READ THE TYPE BYTE — never match a prefix. L2
// transparent and L2 shielded SHARE the HRP (`dash`/`tdash`) and differ only in
// the first payload byte, so a prefix match cannot separate the case that
// matters most. Full spec and its verification history:
//   dashpoint-api/docs/dash-address-classification.md
//
// Sources for every constant below:
//   platform/packages/rs-dpp/src/address_funds/platform_address.rs:262,276,278
//   platform/packages/rs-dpp/src/address_funds/orchard_address.rs:38,82,105-118
//   dash/src/blockdata/constants.rs:45,48,51,54
//
// Base58 decoding is REUSED from ./identifier.ts, which is already tested
// against the platform reference implementation, rather than reimplemented here.

import { decodeBase58 } from './identifier.ts'

/** What kind of Dash address a string is. */
export type DashAddressKind =
    | 'core-p2pkh' // L1 Core, pay-to-pubkey-hash
    | 'core-p2sh' // L1 Core, pay-to-script-hash
    | 'platform-p2pkh' // L2 Platform transparent, pay-to-pubkey-hash
    | 'platform-p2sh' // L2 Platform transparent, pay-to-script-hash
    | 'platform-shielded' // L2 Platform shielded (Orchard)
    | 'unknown' // not a Dash address

/** Which network the address belongs to, when the encoding makes it knowable. */
export type DashNetwork = 'mainnet' | 'testnet-or-devnet-or-regtest' | 'unknown'

/** Result of classifying a pasted string. */
export interface DashAddressClassification {
    /** The decoded kind, or 'unknown' when the string is not a Dash address. */
    kind: DashAddressKind
    /** 'L1' Core, 'L2' Platform, or null when unknown. */
    layer: 'L1' | 'L2' | null
    /** Network, when the encoding distinguishes it. */
    network: DashNetwork
    /** Human-facing label for the UI. Empty string when unknown. */
    label: string
    /** True only for the L2 Platform shielded (Orchard) case. */
    shielded: boolean
}

/**
 * L1 Core version bytes, from `dash/src/blockdata/constants.rs:45,48,51,54`.
 * `PUBKEY_ADDRESS` / `SCRIPT_ADDRESS` are mainnet; the `_TESTNET` pair are the
 * testnet/regtest values.
 */
const CORE_VERSION_MAINNET_P2PKH = 0x4c // 76
const CORE_VERSION_MAINNET_P2SH = 0x10 // 16
const CORE_VERSION_TESTNET_P2PKH = 0x8c // 140
const CORE_VERSION_TESTNET_P2SH = 0x13 // 19

/** L2 Platform payload type bytes (`platform_address.rs:276,278`, `orchard_address.rs:38`). */
const PLATFORM_TYPE_P2PKH = 0xb0
const PLATFORM_TYPE_P2SH = 0x80
const PLATFORM_TYPE_ORCHARD = 0x10

/** A base58check address is 1 version byte + 20 hash bytes + 4 checksum bytes. */
const BASE58CHECK_LENGTH = 25

/** A bech32m Platform payload is 1 type byte + the address body. */
const PLATFORM_PAYLOAD_P2PKH_LENGTH = 1 + 20
const PLATFORM_PAYLOAD_P2SH_LENGTH = 1 + 20
/** Orchard: 1 type byte + 43 raw bytes (diversifier(11) ‖ pk_d(32)). */
const PLATFORM_PAYLOAD_ORCHARD_LENGTH = 1 + 43

/** Bech32m character set. Used to split HRP from data without a full decoder. */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

/**
 * The HRPs that identify a Dash Platform address (`platform_address.rs:262`,
 * `classify_platform_hrp`). Per DIP-0018 Testnet, Devnet and Regtest ALL share
 * `tdash`, so a `tdash` address cannot be pinned to one of them.
 */
const PLATFORM_HRP_MAINNET = 'dash'
const PLATFORM_HRP_TESTNET = 'tdash'

/**
 * Verify the 4-byte double-SHA256 checksum on a 25-byte base58check payload.
 *
 * Async because WebCrypto's `digest` is async; the classifier is async for this
 * reason alone. The checksum is what makes the classification trustworthy — a
 * typo'd or truncated string fails here rather than being mislabelled.
 */
async function base58CheckIsValid(decoded: Uint8Array): Promise<boolean> {
    if (decoded.length !== BASE58CHECK_LENGTH) return false

    const body = decoded.slice(0, BASE58CHECK_LENGTH - 4)
    const checksum = decoded.slice(BASE58CHECK_LENGTH - 4)

    const first = new Uint8Array(await crypto.subtle.digest('SHA-256', body))
    const second = new Uint8Array(await crypto.subtle.digest('SHA-256', first))

    for (let i = 0; i < 4; i++) {
        if (second[i] !== checksum[i]) return false
    }

    return true
}

/**
 * Split a bech32m string into its lowercased HRP and its data part, and read
 * the FIRST DATA CHARACTER (5 bits) as the payload type byte's high bits.
 *
 * bech32 encodes the payload most-significant-bit first, and a type byte is
 * 8 bits, so the first data character carries the top 5 bits of that byte. For
 * the three type bytes we care about the top 5 bits are unambiguous:
 *
 *   0xb0 = 1011 0000 -> top 5 bits 10110 = 22 -> charset[22] = 'k'
 *   0x80 = 1000 0000 -> top 5 bits 10000 = 16 -> charset[16] = 's'
 *   0x10 = 0001 0000 -> top 5 bits 00010 =  2 -> charset[2]  = 'z'
 *
 * The 0x10 -> 'z' mapping is confirmed against real output: the verified
 * round-trip address in the spec begins `dash1zry9e...`, and
 * charset.indexOf('z') === 2.
 *
 * This is a SPLIT, not a validation: the caller must still confirm the payload
 * length, and no claim about the remainder of the payload is made here. Returns
 * null when the string is not shaped like bech32 at all.
 */
function splitBech32(input: string): { hrp: string; data: string } | null {
    if (typeof input !== 'string') return null

    /* bech32 forbids mixed case; a mixed-case string is invalid, not a
     * candidate. Reject rather than normalise, so we never "fix" a typo. */
    const lower = input.toLowerCase()
    const upper = input.toUpperCase()
    if (input !== lower && input !== upper) return null

    const normalised = lower

    /* The separator is the LAST '1'; the HRP itself may not contain one. */
    const separator = normalised.lastIndexOf('1')
    if (separator < 1) return null

    const hrp = normalised.slice(0, separator)
    const data = normalised.slice(separator + 1)

    /* A valid bech32 data part is at least 6 checksum characters. */
    if (data.length < 6) return null

    /* Every data character must be in the bech32 charset. */
    for (const character of data) {
        if (!BECH32_CHARSET.includes(character)) return null
    }

    return { hrp, data }
}

/** Build the classification for a recognised Platform bech32m address. */
function platformClassification(
    hrp: string,
    typeByte: number,
    payloadLength: number
): DashAddressClassification | null {
    const network: DashNetwork =
        hrp === PLATFORM_HRP_MAINNET
            ? 'mainnet'
            : hrp === PLATFORM_HRP_TESTNET
              ? /* Testnet, Devnet and Regtest are indistinguishable here. */
                'testnet-or-devnet-or-regtest'
              : 'unknown'

    if (network === 'unknown') return null

    if (typeByte === PLATFORM_TYPE_ORCHARD) {
        /* A wrong length is a hard decode error upstream
         * (`orchard_address.rs:105-118`), so it must not be accepted here. */
        if (payloadLength !== PLATFORM_PAYLOAD_ORCHARD_LENGTH) return null

        return {
            kind: 'platform-shielded',
            layer: 'L2',
            network,
            label: 'Dash Platform shielded (Orchard)',
            shielded: true,
        }
    }

    if (typeByte === PLATFORM_TYPE_P2PKH) {
        if (payloadLength !== PLATFORM_PAYLOAD_P2PKH_LENGTH) return null

        return {
            kind: 'platform-p2pkh',
            layer: 'L2',
            network,
            label: 'Dash Platform transparent (P2PKH)',
            shielded: false,
        }
    }

    if (typeByte === PLATFORM_TYPE_P2SH) {
        if (payloadLength !== PLATFORM_PAYLOAD_P2SH_LENGTH) return null

        return {
            kind: 'platform-p2sh',
            layer: 'L2',
            network,
            label: 'Dash Platform transparent (P2SH)',
            shielded: false,
        }
    }

    /* A bech32m `dash`/`tdash` string with an unrecognised type byte is not a
     * Dash address we can vouch for. Do not guess. */
    return null
}

/** The result for a string that is not a Dash address. */
function unknownClassification(): DashAddressClassification {
    return {
        kind: 'unknown',
        layer: null,
        network: 'unknown',
        label: '',
        shielded: false,
    }
}

/**
 * Classify a pasted string as an L1 Core, L2 Platform transparent, or L2
 * Platform shielded Dash address.
 *
 * Order matters and mirrors the spec: try base58check first (L1), then bech32m
 * (L2), otherwise unknown. The two encodings cannot collide — base58 and bech32
 * have disjoint characters for the relevant positions, and each path verifies
 * its own integrity (checksum / charset + length) before any kind is returned.
 */
export async function classifyDashAddress(
    input: unknown
): Promise<DashAddressClassification> {
    if (typeof input !== 'string') return unknownClassification()

    /* Surrounding whitespace is a paste artefact, not part of the address. */
    const candidate = input.trim()
    if (candidate.length === 0) return unknownClassification()

    /* --- 1. L1 Core: base58check. --- */
    const decoded = decodeBase58(candidate)

    if (decoded !== null && (await base58CheckIsValid(decoded))) {
        const version = decoded[0]

        if (version === CORE_VERSION_MAINNET_P2PKH) {
            return {
                kind: 'core-p2pkh',
                layer: 'L1',
                network: 'mainnet',
                label: 'Dash Core (L1) P2PKH',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_MAINNET_P2SH) {
            return {
                kind: 'core-p2sh',
                layer: 'L1',
                network: 'mainnet',
                label: 'Dash Core (L1) P2SH',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_TESTNET_P2PKH) {
            return {
                kind: 'core-p2pkh',
                layer: 'L1',
                network: 'testnet-or-devnet-or-regtest',
                label: 'Dash Core (L1) P2PKH',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_TESTNET_P2SH) {
            return {
                kind: 'core-p2sh',
                layer: 'L1',
                network: 'testnet-or-devnet-or-regtest',
                label: 'Dash Core (L1) P2SH',
                shielded: false,
            }
        }

        /* Checksum-valid base58 with an unknown version byte: some other
         * base58check chain. Not a Dash address. */
        return unknownClassification()
    }

    /* --- 2. L2 Platform: bech32m. --- */
    const bech = splitBech32(candidate)

    if (bech !== null) {
        const first = bech.data[0]
        const fiveBits = BECH32_CHARSET.indexOf(first)

        /* The first data character carries the top 5 bits of the type byte. */
        const typeByte = fiveBits << 3

        /* Payload length in bytes: the data part is 5-bit groups; drop the 6
         * checksum characters, then convert bits to bytes. */
        const payloadChars = bech.data.length - 6
        const payloadLength = Math.floor((payloadChars * 5) / 8)

        const platform = platformClassification(bech.hrp, typeByte, payloadLength)
        if (platform !== null) return platform
    }

    /* --- 3. Not a Dash address. Do not guess. --- */
    return unknownClassification()
}
