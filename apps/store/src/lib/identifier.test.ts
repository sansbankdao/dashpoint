// src/lib/identifier.test.ts
//
// Tests for the Dash Platform Identifier shape check. Run with:
//   node --test src/lib/identifier.test.ts
// The known-good identifiers are the ones used as examples in the Dash
// Platform docs (retrieve-documents tutorial); each decodes to exactly 32
// bytes, which is the property the validator asserts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPlatformIdentifier, decodeBase58, IDENTIFIER_LENGTH } from './identifier.ts'

test('IDENTIFIER_LENGTH is 32 bytes', () => {
    assert.equal(IDENTIFIER_LENGTH, 32)
})

test('accepts known-good 32-byte platform identifiers', () => {
    assert.equal(isPlatformIdentifier('5CL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyzt'), true)
    assert.equal(isPlatformIdentifier('FW3DHrQiG24VqzPY4ARenMgjEPpBNuEQTZckV8hbVCG4'), true)
    assert.equal(isPlatformIdentifier('FKZZFDTfGdSWUmL2g7H9e46pMJMPQp9DHQcvjrsS6884'), true)
})

test('rejects a non-string', () => {
    assert.equal(isPlatformIdentifier(undefined), false)
    assert.equal(isPlatformIdentifier(null), false)
    assert.equal(isPlatformIdentifier(12345), false)
    assert.equal(isPlatformIdentifier({}), false)
})

test('rejects an empty string', () => {
    assert.equal(isPlatformIdentifier(''), false)
})

test('rejects characters outside the base58 alphabet (0, O, I, l)', () => {
    assert.equal(isPlatformIdentifier('0CL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyzt'), false)
    assert.equal(isPlatformIdentifier('OCL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyzt'), false)
    assert.equal(isPlatformIdentifier('ICL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyzt'), false)
    assert.equal(isPlatformIdentifier('lCL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyzt'), false)
})

test('rejects base58 that does not decode to exactly 32 bytes', () => {
    assert.equal(isPlatformIdentifier('1'), false)
    assert.equal(isPlatformIdentifier('z'), false)
    assert.equal(isPlatformIdentifier('5CL7qwbGPi4P6jqhat5pQxzSZ9PPxvNkDU8tU9yXYyztz'), false)
})

test('thirty-two 1s is a valid 32-byte identifier (leading zero bytes)', () => {
    assert.equal(decodeBase58('1'.repeat(32))?.length, 32)
    assert.equal(isPlatformIdentifier('1'.repeat(32)), true)
})

test('thirty-three 1s is not a valid identifier', () => {
    assert.equal(isPlatformIdentifier('1'.repeat(33)), false)
})

test('decodeBase58 returns null on a non-alphabet character', () => {
    assert.equal(decodeBase58('abc!'), null)
    assert.equal(decodeBase58(''), null)
})
