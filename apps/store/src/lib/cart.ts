// src/lib/cart.ts
//
// Pure cart logic. Extracted from Storefront.astro so it can be unit-tested
// without a DOM. All money is handled in integer cents; never accumulate
// floating-point dollars.

export interface CartItem {
    id: number
    title: string
    // Unit price in integer cents.
    price: number
    amount: number
}

export function addItem(cart: CartItem[], product: { id: number; title: string; priceCents: number }): CartItem[] {
    const existing = cart.find(item => item.id === product.id)
    if (existing) {
        existing.amount += 1
        return cart
    }
    cart.push({ id: product.id, title: product.title, price: product.priceCents, amount: 1 })
    return cart
}

export function removeItem(cart: CartItem[], id: number): CartItem[] {
    const index = cart.findIndex(item => item.id === id)
    if (index === -1) return cart
    const item = cart[index]
    if (item.amount > 1) {
        item.amount -= 1
        return cart
    }
    cart.splice(index, 1)
    return cart
}

export function totalCents(cart: CartItem[]): number {
    return cart.reduce((sum, item) => sum + item.price * item.amount, 0)
}

export function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`
}