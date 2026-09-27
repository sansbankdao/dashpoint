// src/types.ts
export interface Product {
    id: number
    title: string
    /** Display price in dollars. */
    price: number
    /**
     * The price in integer cents, when the source already knows it.
     *
     * A resolved Dash Platform item stores cents (`basePrice`), so the exact
     * value is carried through rather than recovered from the dollar display.
     * Optional: the demo fixture only has dollars and omits it.
     */
    priceCents?: number
    imageUrl: string
}
