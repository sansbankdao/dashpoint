// src/data/products.ts
import type { Product } from '../types'

/*
 * The demo fixture.
 *
 * Each `imageUrl` is an Unsplash CDN URL whose photo id has been verified to
 * return `200 image/jpeg`. The query string asks the CDN for a square crop at
 * the size the grid renders, so no image bytes are stored in this repository
 * and the demo carries no binary payload. The demo's own `public/_headers` CSP
 * already allows any HTTPS origin (`img-src 'self' https: data:`), because a
 * real merchant supplies their own image URLs in their store document.
 */
const unsplash = (id: string) =>
    `https://images.unsplash.com/${id}?w=300&h=300&fit=crop&q=80`

export const products: Product[] = [
    { id: 1, title: 'Original', price: 5.00, imageUrl: unsplash('photo-1546069901-ba9599a7e63c') },
    { id: 2, title: 'Ginger', price: 6.00, imageUrl: unsplash('photo-1571934811356-5cc061b6821f') },
    { id: 3, title: 'Raspberry', price: 6.00, imageUrl: unsplash('photo-1497534446932-c925b458314e') },
    { id: 4, title: 'Lemon', price: 5.50, imageUrl: unsplash('photo-1622597467836-f3285f2131b8') },
    { id: 5, title: 'Hibiscus', price: 6.50, imageUrl: unsplash('photo-1556881286-fc6915169721') },
    { id: 6, title: 'Special', price: 7.00, imageUrl: unsplash('photo-1571091718767-18b5b1457add') },
]
