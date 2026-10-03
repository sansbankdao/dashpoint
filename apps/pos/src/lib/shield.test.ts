// apps/pos/src/lib/shield.test.ts
//
// Tests for the auto-shield planning maths, run with `node --test`.
//
// These numbers gate a real money movement: the plan decides how many duffs
// of a live deposit are committed to an asset lock. Every rule below is
// asserted directly rather than through the checkout flow, because a wrong
// plan is either rejected by consensus (under-funded) or leaves dust the
// change output cannot legally carry (overdrawn).

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MIN_CHANGE_DUFFS, duffsToDashString, planShieldAmount } from './shield.ts'

test('planShieldAmount subtracts pool fee, miner fee and safety from the balance', () => {
    // 0.005 DASH deposit, 0.002 DASH pool fee, 3000 duff miner fee,
    // 2000 duff safety.
    const plan = planShieldAmount(500_000n, 200_000n, 3_000n, 2_000n)
    assert.equal(plan, 295_000n)
})

test('planShieldAmount returns zero when the deposit exactly covers the fees', () => {
    assert.equal(planShieldAmount(205_000n, 200_000n, 3_000n, 2_000n), 0n)
})

test('planShieldAmount goes negative when the deposit cannot cover the fees', () => {
    // A negative plan is the caller's signal to leave the deposit alone.
    assert.equal(planShieldAmount(204_999n, 200_000n, 3_000n, 2_000n), -1n)
})

test('planShieldAmount accepts a zero safety margin for a full drain', () => {
    // The deposit pays only the pool fee and the miner fee; the change is
    // exactly zero.
    const plan = planShieldAmount(213_000n, 210_000n, 3_000n, 0n)
    assert.equal(plan, 0n)
})

test('MIN_CHANGE_DUFFS is above zero so change is never dust', () => {
    assert.ok(MIN_CHANGE_DUFFS > 0n)
})

test('duffsToDashString formats whole DASH', () => {
    assert.equal(duffsToDashString(100_000_000n), '1.00000000')
})

test('duffsToDashString pads the fraction to eight digits', () => {
    assert.equal(duffsToDashString(295_000n), '0.00295000')
})

test('duffsToDashString formats zero', () => {
    assert.equal(duffsToDashString(0n), '0.00000000')
})

test('duffsToDashString round-trips through the API amount parser shape', () => {
    // The quote endpoint parses /^([0-9]+)(?:\.([0-9]+))?$/ with at most
    // eight decimals; this string must always match that shape.
    const values = [1n, 9_999n, 1_000_000_00n, 123_456_789n]
    for (const value of values) {
        assert.match(duffsToDashString(value), /^[0-9]+\.[0-9]{8}$/)
    }
})

test('duffsToDashString carries no float error on large values', () => {
    // 21 million DASH in duffs would lose precision as a float.
    assert.equal(duffsToDashString(2_100_000_000_000_000n), '21000000.00000000')
})
