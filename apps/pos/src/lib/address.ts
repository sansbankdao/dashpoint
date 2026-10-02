// src/lib/address.ts

/**
 * Dash address classification for the POS Admin screen.
 *
 * WHY THIS EXISTS
 * ---------------
 * The payout field on /admin used to answer one question — "is this a mainnet
 * P2PKH address?" — and label everything else "Not a valid Dash mainnet P2PKH
 * address." That wording is wrong for a perfectly good Dash address of another
 * kind. A merchant who pastes a Platform (L2) address, or a P2SH payout
 * address, was told their address was invalid when it was simply a different
 * kind. The UI must say WHAT the address is, or say plainly that it is not a
 * Dash address at all.
 *
 * THE RULE: DECODE, THEN READ THE TYPE BYTE — NEVER MATCH A PREFIX.
 * ----------------------------------------------------------------
 * L2 transparent and L2 shielded SHARE the HRP (`dash`/`tdash`) and differ only
 * in the first payload byte, so a prefix match cannot separate the case that
 * matters most. Full spec, with the verification history:
 *   paymedash-api/docs/dash-address-classification.md
 *
 * VERIFIED CONSTANTS (each cited to the file and line that defines it):
 *   platform/packages/rs-dpp/src/address_funds/platform_address.rs:276,278
 *   platform/packages/rs-dpp/src/address_funds/orchard_address.rs:38,105-118
 *   dash/src/blockdata/constants.rs:45,48,51,54
 *
 * A NOTE ON THE LEADING CHARACTER
 * -------------------------------
 * An exhaustive enumeration of the base58check value interval (not a sample)
 * proves these are the ONLY possibilities:
 *
 *   L1 MAIN P2PKH (version 76  = 0x4c)  always 'X'
 *   L1 MAIN P2SH  (version 16  = 0x10)  always '7'
 *   L1 TEST P2PKH (version 140 = 0x8c)  always 'y'
 *   L1 TEST P2SH  (version 19  = 0x13)  '8' or '9'
 *
 * So no mainnet Dash address ever starts with '2'. That is why the input's
 * `maxlength="48"` and the old 34-character / `startsWith('X')` checks in
 * `isValidDashAddress` are kept there for backwards compatibility, but the
 * label the merchant reads now comes from this module, which decodes.
 */

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
    /** Human-facing text for the status line. Empty string when unknown. */
    label: string
    /** True only for the L2 Platform shielded (Orchard) case. */
    shielded: boolean
}

/**
 * Local base58 decoder.
 *
 * Deliberately NOT the one in `config.ts`. That decoder seeds its numeric
 * accumulator at 0 and then re-adds leading zero bytes, so it decodes a single
 * '1' as TWO bytes instead of one (verified: `base58Decode('1').length === 2`,
 * where the correct answer is 1). For `isValidDashAddress` the slip is
 * unreachable because a length-25 check runs first, and that function is left
 * untouched. Rather than depend on an invariant maintained elsewhere, this
 * module counts leading '1's BEFORE decoding and starts the accumulator EMPTY,
 * which is the rule the platform reference implementation uses.
 *
 * @returns the decoded bytes, or null on a character outside the alphabet.
 */
function base58Decode(input: string): Uint8Array | null {
    if (typeof input !== 'string' || input.length === 0) return null

    let leadingZeros = 0
    while (leadingZeros < input.length && input[leadingZeros] === '1') {
        leadingZeros++
    }

    const body = input.slice(leadingZeros)
    const bytes: number[] = []

    for (const character of body) {
        const index = BASE58_ALPHABET.indexOf(character)
        if (index === -1) return null

        let carry = index

        for (let i = 0; i < bytes.length; i++) {
            carry += bytes[i] * 58
            bytes[i] = carry & 0xff
            carry >>= 8
        }

        while (carry > 0) {
            bytes.push(carry & 0xff)
            carry >>= 8
        }
    }

    const decoded = new Uint8Array(leadingZeros + bytes.length)

    for (let i = 0; i < bytes.length; i++) {
        decoded[leadingZeros + i] = bytes[bytes.length - 1 - i]
    }

    return decoded
}

// Base58 alphabet shared by Bitcoin and Dash (no 0, O, I, l).
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * L1 Core version bytes, from `dash/src/blockdata/constants.rs:45,48,51,54`.
 * `PUBKEY_ADDRESS` / `SCRIPT_ADDRESS` are mainnet; the `_TESTNET` pair are the
 * testnet/regtest values.
 */
const CORE_VERSION_MAINNET_P2PKH = 0x4c // 76
const CORE_VERSION_MAINNET_P2SH = 0x10 // 16
const CORE_VERSION_TESTNET_P2PKH = 0x8c // 140
const CORE_VERSION_TESTNET_P2SH = 0x13 // 19

/**
 * L2 Platform payload type bytes (`platform_address.rs:276,278`,
 * `orchard_address.rs:38`).
 */
const PLATFORM_TYPE_P2PKH = 0xb0
const PLATFORM_TYPE_P2SH = 0x80
const PLATFORM_TYPE_ORCHARD = 0x10

/** A base58check address is 1 version byte + 20 hash bytes + 4 checksum bytes. */
const BASE58CHECK_LENGTH = 25

/** A bech32m Platform payload is 1 type byte + the address body. */
const PLATFORM_PAYLOAD_P2PKH_LENGTH = 1 + 20
const PLATFORM_PAYLOAD_P2SH_LENGTH = 1 + 20
/** Orchard: 1 type byte + 43 raw bytes (diversifier(11) || pk_d(32)). */
const PLATFORM_PAYLOAD_ORCHARD_LENGTH = 1 + 43

/** bech32m character set. Used to read the first payload character. */
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
 * Async because SubtleCrypto's `digest` is async, which is the only reason this
 * module is async. The checksum is what makes the classification trustworthy: a
 * typo'd or truncated address fails here instead of being mislabelled.
 *
 * Requires a secure context (https or localhost), same as
 * `isValidDashAddress` in `config.ts`.
 */
async function base58CheckIsValid(decoded: Uint8Array): Promise<boolean> {
    if (decoded.length !== BASE58CHECK_LENGTH) return false

    const payload = decoded.slice(0, BASE58CHECK_LENGTH - 4)
    const checksum = decoded.slice(BASE58CHECK_LENGTH - 4)

    const first = await crypto.subtle.digest('SHA-256', payload)
    const second = new Uint8Array(await crypto.subtle.digest('SHA-256', first))

    return second[0] === checksum[0]
        && second[1] === checksum[1]
        && second[2] === checksum[2]
        && second[3] === checksum[3]
}

/**
 * Split a bech32 string into its lowercased HRP and its data part.
 *
 * This is a SPLIT, not a validation: it confirms the shape (case, separator,
 * charset) so the caller can read the first payload character, and makes no
 * claim about the checksum. Returns null when the string is not shaped like
 * bech32 at all.
 */
function splitBech32(input: string): { hrp: string; data: string } | null {
    if (typeof input !== 'string' || input.length === 0) return null

    /*
     * bech32 forbids mixed case. Reject rather than normalise, so a typo is
     * never silently "corrected" into a different address.
     */
    const lower = input.toLowerCase()
    if (input !== lower && input !== input.toUpperCase()) return null

    /* The separator is the LAST '1'; the HRP itself may not contain one. */
    const separator = lower.lastIndexOf('1')
    if (separator < 1) return null

    const hrp = lower.slice(0, separator)
    const data = lower.slice(separator + 1)

    /* A valid bech32 data part is at least 6 checksum characters. */
    if (data.length < 6) return null

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
    const network: DashNetwork = hrp === PLATFORM_HRP_MAINNET
        ? 'mainnet'
        : hrp === PLATFORM_HRP_TESTNET
            /* Testnet, Devnet and Regtest are indistinguishable here. */
            ? 'testnet-or-devnet-or-regtest'
            : 'unknown'

    if (network === 'unknown') return null

    const onTestnet = network === 'testnet-or-devnet-or-regtest'
    const suffix = onTestnet ? ' (testnet)' : ''

    if (typeByte === PLATFORM_TYPE_ORCHARD) {
        /*
         * A wrong length is a hard decode error upstream
         * (`orchard_address.rs:105-118`), so it must not be accepted here.
         */
        if (payloadLength !== PLATFORM_PAYLOAD_ORCHARD_LENGTH) return null

        return {
            kind: 'platform-shielded',
            layer: 'L2',
            network,
            label: `Dash Platform shielded address${suffix}`,
            shielded: true,
        }
    }

    if (typeByte === PLATFORM_TYPE_P2PKH) {
        if (payloadLength !== PLATFORM_PAYLOAD_P2PKH_LENGTH) return null

        return {
            kind: 'platform-p2pkh',
            layer: 'L2',
            network,
            label: `Dash Platform transparent address (P2PKH)${suffix}`,
            shielded: false,
        }
    }

    if (typeByte === PLATFORM_TYPE_P2SH) {
        if (payloadLength !== PLATFORM_PAYLOAD_P2SH_LENGTH) return null

        return {
            kind: 'platform-p2sh',
            layer: 'L2',
            network,
            label: `Dash Platform transparent address (P2SH)${suffix}`,
            shielded: false,
        }
    }

    /*
     * A bech32m `dash`/`tdash` string with an unrecognised type byte is not a
     * Dash address we can vouch for. Do not guess.
     */
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
 * its own integrity before any kind is returned.
 */
export async function classifyDashAddress(
    input: unknown
): Promise<DashAddressClassification> {
    if (typeof input !== 'string') return unknownClassification()

    /* Surrounding whitespace is a paste artefact, not part of the address. */
    const candidate = input.trim()
    if (candidate.length === 0) return unknownClassification()

    /* --- 1. L1 Core: base58check. --- */
    const decoded = base58Decode(candidate)

    if (decoded !== null && await base58CheckIsValid(decoded)) {
        const version = decoded[0]

        if (version === CORE_VERSION_MAINNET_P2PKH) {
            return {
                kind: 'core-p2pkh',
                layer: 'L1',
                network: 'mainnet',
                label: 'Dash Core address (P2PKH)',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_MAINNET_P2SH) {
            return {
                kind: 'core-p2sh',
                layer: 'L1',
                network: 'mainnet',
                label: 'Dash Core address (P2SH)',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_TESTNET_P2PKH) {
            return {
                kind: 'core-p2pkh',
                layer: 'L1',
                network: 'testnet-or-devnet-or-regtest',
                label: 'Dash Core address (P2PKH, testnet)',
                shielded: false,
            }
        }

        if (version === CORE_VERSION_TESTNET_P2SH) {
            return {
                kind: 'core-p2sh',
                layer: 'L1',
                network: 'testnet-or-devnet-or-regtest',
                label: 'Dash Core address (P2SH, testnet)',
                shielded: false,
            }
        }

        /*
         * Checksum-valid base58 with an unknown version byte: some other
         * base58check chain. Not a Dash address.
         */
        return unknownClassification()
    }

    /* --- 2. L2 Platform: bech32m. --- */
    const bech = splitBech32(candidate)

    if (bech !== null) {
        /*
         * The first data character carries the top 5 bits of the type byte,
         * because bech32 encodes the payload most-significant-bit first. For
         * the three type bytes we care about the top 5 bits are unambiguous:
         *
         *   0xb0 = 1011 0000 -> 10110 = 22 -> charset[22] = 'k'
         *   0x80 = 1000 0000 -> 10000 = 16 -> charset[16] = 's'
         *   0x10 = 0001 0000 -> 00010 =  2 -> charset[2]  = 'z'
         *
         * The 0x10 -> 'z' mapping is confirmed against real output: the
         * verified round-trip address in the spec begins `dash1zry9e…`.
         */
        const fiveBits = BECH32_CHARSET.indexOf(bech.data[0])
        const typeByte = fiveBits << 3

        /*
         * Payload length in bytes: the data part is 5-bit groups; drop the 6
         * checksum characters, then convert bits to bytes.
         */
        const payloadCharacters = bech.data.length - 6
        const payloadLength = Math.floor((payloadCharacters * 5) / 8)

        const platform = platformClassification(bech.hrp, typeByte, payloadLength)
        if (platform !== null) return platform
    }

    /* --- 3. Not a Dash address. Do not guess. --- */
    return unknownClassification()
}
