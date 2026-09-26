// src/lib/store-host.test.ts
//
// Tests for mapping a request hostname to a candidate DPNS username. Run with:
//   node --test src/lib/store-host.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    storeNameFromHostname,
    isValidStoreName,
    normalizeStoreName,
    STORE_DOMAIN,
    RESERVED_SUBDOMAINS,
    STORE_NAME_MIN_LENGTH,
    STORE_NAME_MAX_LENGTH,
} from './store-host.ts'

test('STORE_DOMAIN is dashpoint.store', () => {
    assert.equal(STORE_DOMAIN, 'dashpoint.store')
})

test('reserves www and demo', () => {
    assert.deepEqual([...RESERVED_SUBDOMAINS], ['www', 'demo'])
})

test('length bounds come from the DPNS contract schema', () => {
    assert.equal(STORE_NAME_MIN_LENGTH, 3)
    assert.equal(STORE_NAME_MAX_LENGTH, 63)
})

test('extracts the username label from a store subdomain', () => {
    assert.equal(storeNameFromHostname('homemadecrypto.dashpoint.store'), 'homemadecrypto')
})

test('lower-cases the label, because hostnames are case-insensitive', () => {
    assert.equal(storeNameFromHostname('HomemadeCrypto.DashPoint.Store'), 'homemadecrypto')
    assert.equal(storeNameFromHostname('HOMEMADECRYPTO.dashpoint.store'), 'homemadecrypto')
})

test('ignores a trailing dot and a port', () => {
    assert.equal(storeNameFromHostname('homemadecrypto.dashpoint.store.'), 'homemadecrypto')
    assert.equal(storeNameFromHostname('homemadecrypto.dashpoint.store:443'), 'homemadecrypto')
})

test('returns null for the apex', () => {
    assert.equal(storeNameFromHostname('dashpoint.store'), null)
})

test('returns null for reserved subdomains', () => {
    assert.equal(storeNameFromHostname('www.dashpoint.store'), null)
    assert.equal(storeNameFromHostname('demo.dashpoint.store'), null)
    assert.equal(storeNameFromHostname('WWW.dashpoint.store'), null)
    assert.equal(storeNameFromHostname('Demo.dashpoint.store'), null)
})

test('returns null for nested labels', () => {
    assert.equal(storeNameFromHostname('a.b.dashpoint.store'), null)
})

test('returns null for a different domain', () => {
    assert.equal(storeNameFromHostname('dashpoint.sale'), null)
    assert.equal(storeNameFromHostname('example.com'), null)
})

/*
 * The label rules below mirror the contract pattern and its two length bounds.
 * The edge cases that matter are the hyphen positions, because the pattern
 * forbids a leading or trailing hyphen but allows interior ones, and the
 * length bounds, because a 2-character label is syntactically fine as a DNS
 * label but is not a DPNS name.
 */

test('accepts a well-formed label', () => {
    assert.equal(isValidStoreName('homemadecrypto'), true)
    assert.equal(isValidStoreName('Homemade-Crypto'), true)
    assert.equal(isValidStoreName('abc'), true)
    assert.equal(isValidStoreName('a1b'), true)
})

test('rejects labels shorter than 3 or longer than 63', () => {
    assert.equal(isValidStoreName('ab'), false)
    assert.equal(isValidStoreName('a'), false)
    assert.equal(isValidStoreName(''), false)
    assert.equal(isValidStoreName('a'.repeat(63)), true)
    assert.equal(isValidStoreName('a'.repeat(64)), false)
})

test('rejects a leading or trailing hyphen', () => {
    assert.equal(isValidStoreName('-abc'), false)
    assert.equal(isValidStoreName('abc-'), false)
    assert.equal(isValidStoreName('-a-'), false)
})

test('rejects characters outside the alphabet', () => {
    assert.equal(isValidStoreName('abc_def'), false)
    assert.equal(isValidStoreName('abc.def'), false)
    assert.equal(isValidStoreName('abc def'), false)
    assert.equal(isValidStoreName('abc!'), false)
})

test('rejects non-strings', () => {
    assert.equal(isValidStoreName(undefined), false)
    assert.equal(isValidStoreName(null), false)
    assert.equal(isValidStoreName(42), false)
})

/*
 * Normalization is what makes the resolver correct: the homograph-safe form
 * is the value the contract stores and the value a lookup must compare against.
 */

test('normalizes o to 0 and i and l to 1', () => {
    assert.equal(normalizeStoreName('Bob'), 'b0b')
    assert.equal(normalizeStoreName('oil'), '011')
    assert.equal(normalizeStoreName('ILL'), '111')
})

test('homograph spellings resolve to one normalized name', () => {
    assert.equal(normalizeStoreName('Bob'), normalizeStoreName('B0b'))
    assert.equal(normalizeStoreName('oil'), normalizeStoreName('011'))
    assert.equal(normalizeStoreName('homemadecrypto'), normalizeStoreName('h0memadecrypt0'))
})
