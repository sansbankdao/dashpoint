// src/lib/identifier.ts
//
// Dash Platform Identifier validation.
//
// A Dash Platform `$id` / Document ID / Identity ID is the base58 (Bitcoin
// alphabet) encoding of exactly 32 raw bytes. VERIFIED in the platform
// reference implementation:
//
//   packages/rs-platform-value/src/types/identifier.rs:120
//     if bytes.len() != 32 { return Err(E::invalid_length(bytes.len(), &self)); }
//   packages/rs-platform-value/src/string_encoding.rs:29
//     Encoding::Base58 => Ok(bs58::decode(encoded_value) ...)
//
// The alphabet is the BITCOIN one — it omits `0`, `O`, `I` and `l`. The
// leading-`1`-per-leading-zero-byte rule is part of the encoding, not an
// artefact. This decoder mirrors the implementation in the sibling Worker
// `evobin/packages/api/src/lib/base58.ts`, which was verified against the live
// DAPI proxy (2026-09-21): a malformed id is a CLIENT error (400), not an
// upstream failure, so it is rejected locally rather than sent to Drive.
//
// NOTE: a syntactically valid identifier only proves the string *could* be an
// id. It does not prove a document with that id exists. Existence is the Drive
// query's job; this module answers "is this shaped like an id?" only.

/** Bitcoin base58 alphabet (58 characters, no 0/O/I/l). */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Reverse lookup table, built once at module scope. */
const INDEX = new Map<string, number>()
for (let i = 0; i < ALPHABET.length; i++) {
    INDEX.set(ALPHABET[i], i)
}

/** Length, in bytes, of a Dash Platform Identifier. */
export const IDENTIFIER_LENGTH = 32

/**
 * Decode a base58 string to bytes.
 *
 * @returns the decoded bytes, or `null` when the input contains a character
 *          outside the base58 alphabet (including whitespace).
 */
export function decodeBase58(input: string): Uint8Array | null {
    if (typeof input !== 'string' || input.length === 0) return null

    /* Leading '1's encode leading zero bytes and carry no numeric value, so
     * they are counted and stripped BEFORE decoding. Folding them into the
     * numeric accumulator double-counts one byte (the accumulator is seeded
     * with 0), which made the 32-'1' input decode to 33 bytes. */
    let leadingZeros = 0
    while (leadingZeros < input.length && input[leadingZeros] === '1') {
        leadingZeros++
    }

    const body = input.slice(leadingZeros)

    /* Little-endian accumulator, reversed before return. Starts EMPTY so an
     * all-'1' input yields exactly `leadingZeros` zero bytes and nothing
     * else. */
    const bytes: number[] = []

    for (const character of body) {
        const value = INDEX.get(character)

        /* Character outside the alphabet — reject outright. */
        if (value === undefined) return null

        let carry = value

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

    /* Rebuild with the leading zero bytes restored. */
    const decoded = new Uint8Array(leadingZeros + bytes.length)

    for (let i = 0; i < bytes.length; i++) {
        decoded[leadingZeros + i] = bytes[bytes.length - 1 - i]
    }

    return decoded
}

/**
 * Is this value a base58-encoded, exactly-32-byte Dash Platform Identifier?
 *
 * This is the shape check a `$id` must pass before any Drive lookup is
 * attempted. It returns `false` for a non-string, an empty string, a string
 * with non-base58 characters, or a base58 string that does not decode to
 * exactly 32 bytes.
 */
export function isPlatformIdentifier(input: unknown): input is string {
    if (typeof input !== 'string') return false

    const decoded = decodeBase58(input)

    return decoded !== null && decoded.length === IDENTIFIER_LENGTH
}
