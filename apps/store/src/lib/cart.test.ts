// src/lib/cart.test.ts
//
// Minimal assertion-based tests for the pure cart logic. Run with:
//   node --test src/lib/cart.test.ts
// Node's built-in test runner supports TypeScript type-stripping on Node 22+.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addItem, removeItem, totalCents, formatCents, type CartItem } from './cart.ts'

test('addItem appends a new item with amount 1', () => {
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    assert.equal(cart.length, 1)
    assert.equal(cart[0].amount, 1)
    assert.equal(cart[0].price, 500)
})

test('addItem increments amount for a duplicate id', () => {
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    assert.equal(cart.length, 1)
    assert.equal(cart[0].amount, 2)
})

test('removeItem decrements then drops at zero', () => {
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    removeItem(cart, 1)
    assert.equal(cart[0].amount, 1)
    removeItem(cart, 1)
    assert.equal(cart.length, 0)
})

test('removeItem on an unknown id is a no-op', () => {
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    removeItem(cart, 99)
    assert.equal(cart.length, 1)
})

test('totalCents sums price * amount as integers', () => {
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'Original', priceCents: 500 })
    addItem(cart, { id: 4, title: 'Lemon', priceCents: 550 })
    addItem(cart, { id: 5, title: 'Hibiscus', priceCents: 650 })
    assert.equal(totalCents(cart), 1700)
    assert.equal(formatCents(1700), '$17.00')
})

test('integer cents avoid the float rounding error', () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; cents must not drift.
    const cart: CartItem[] = []
    addItem(cart, { id: 1, title: 'A', priceCents: 10 })
    addItem(cart, { id: 2, title: 'B', priceCents: 20 })
    assert.equal(totalCents(cart), 30)
    assert.equal(formatCents(30), '$0.30')
})