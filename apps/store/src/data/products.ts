// src/data/products.ts

import type { Product } from '../types'

/**
 * Demo catalogue for the Homemade Crypto storefront.
 *
 * Product titles, photographs and prices were read from live Amazon listings
 * (hardware wallet, security key and faraday bag searches). Prices were quoted
 * in CAD because the request originated from a Canadian network, so each one was
 * converted to USD at 1 CAD = 0.706149 USD
 * (open.er-api.com/v6/latest/CAD, 2026-09-29) and rounded to integer cents.
 *
 * This is placeholder merchandising. A resolved Dash Platform store replaces every
 * field here with the item's own document, so nothing in this file is load-bearing.
 */
const CAD_TO_USD = 0.706149

export const products: Product[] = [
    // Hardware wallets
    {
        id: 1,
        title: 'Trezor Safe 7 Crypto Hardware Wallet with Bluetooth for Android/iOS/Desktop',
        price: 352.73 * CAD_TO_USD,
        priceCents: 24908,
        imageUrl: 'https://m.media-amazon.com/images/I/71gs-lcR16L._AC_UL320_.jpg',
        category: 'Hardware wallets',
        tagline: 'Air-gapped cold storage',
        description: 'Bluetooth hardware wallet with a secure element. Keys stay offline.',
    },
    {
        id: 2,
        title: 'Trezor Safe 3 - Passphrase & Secure Element Protected Crypto Hardware Wallet - Buy, Store, Manage Digital Assets Simply and Safely (Cosmic Black)',
        price: 83.58 * CAD_TO_USD,
        priceCents: 5902,
        imageUrl: 'https://m.media-amazon.com/images/I/51hilzKj+kL._AC_UL320_.jpg',
        category: 'Hardware wallets',
        tagline: 'Passphrase protected',
        description: 'Secure-element wallet for holding digital assets without a custodian.',
    },
    {
        id: 3,
        title: 'ELLIPAL X Card Crypto Wallet – Cold Wallet for Bitcoin, Ethereum, XRP, NFTs & 10,000+ Tokens – NFC Hardware Wallet for Cold Storage',
        price: 71.54 * CAD_TO_USD,
        priceCents: 5052,
        imageUrl: 'https://m.media-amazon.com/images/I/51vyMss2g2L._AC_UL320_.jpg',
        category: 'Hardware wallets',
        tagline: 'Card-shaped, NFC',
        description: 'Cold wallet for Bitcoin, Ethereum, XRP, NFTs and thousands of tokens.',
    },
    {
        id: 4,
        title: 'Keystone - Cryptocurrency Hardware Wallet Air-gapped, 4-inch Touch Screen, Store Your Crypto Securely (Keystone 3 Pro)',
        price: 211.07 * CAD_TO_USD,
        priceCents: 14905,
        imageUrl: 'https://m.media-amazon.com/images/I/41e9KZc+2eL._AC_UL320_.jpg',
        category: 'Hardware wallets',
        tagline: 'Air-gapped touchscreen',
        description: 'Air-gapped signer with a 4-inch touchscreen and no USB link.',
    },
    {
        id: 5,
        title: 'DCENT Hardware Wallet | Biometric Cold Storage, Bluetooth, Multi-Crypto',
        price: 154.41 * CAD_TO_USD,
        priceCents: 10904,
        imageUrl: 'https://m.media-amazon.com/images/I/51Nu9Y9St0L._AC_UL320_.jpg',
        category: 'Hardware wallets',
        tagline: 'Biometric unlock',
        description: 'Fingerprint-protected cold storage with Bluetooth and multi-coin support.',
    },

    // Security keys
    {
        id: 6,
        title: 'Security Key C NFC - Basic Compatibility - Multi-Factor authentication (MFA) Security Key and passkey, Connect via USB-C or NFC, FIDO Certified',
        price: 41.08 * CAD_TO_USD,
        priceCents: 2901,
        imageUrl: 'https://m.media-amazon.com/images/I/41DkFsG8yEL._AC_UY218_.jpg',
        category: 'Security keys',
        tagline: 'USB-C and NFC',
        description: 'FIDO-certified key for passkeys and multi-factor authentication.',
    },
    {
        id: 7,
        title: 'YubiKey 5 NFC - Multi-Factor authentication (MFA) Security Key and passkey, Connect via USB-A or NFC, FIDO Certified - Protect Your Online Accounts',
        price: 82.16 * CAD_TO_USD,
        priceCents: 5802,
        imageUrl: 'https://m.media-amazon.com/images/I/41T0zUwiOcL._AC_UY218_.jpg',
        category: 'Security keys',
        tagline: 'USB-A and NFC',
        description: 'Hardware MFA key that also works over NFC with a phone.',
    },
    {
        id: 8,
        title: 'Nano-C for Business - USB C FIDO2 Security Key L1 MFA & Passkey Access for School ERP, Employee Online Account, Compatible with Coinbase Google Workspace Apple ID Window Salesfore - 2 Pack',
        price: 57.07 * CAD_TO_USD,
        priceCents: 4030,
        imageUrl: 'https://m.media-amazon.com/images/I/61j-AaD4-HL._AC_UY218_.jpg',
        category: 'Security keys',
        tagline: 'Two-pack for teams',
        description: 'FIDO2 keys supplied in pairs for account recovery.',
    },
    {
        id: 9,
        title: 'YubiKey 5C Nano FIPS (140-3) - Multi-Factor authentication (MFA) Security Key and passkey, Connect via USB, FIDO Certified - Protect Your Online Accounts',
        price: 138.82 * CAD_TO_USD,
        priceCents: 9803,
        imageUrl: 'https://m.media-amazon.com/images/I/41CyruA9cEL._AC_UY218_.jpg',
        category: 'Security keys',
        tagline: 'Low-profile FIPS',
        description: 'Nano FIPS 140-3 key that stays in the USB port.',
    },

    // Faraday bags
    {
        id: 10,
        title: 'Simket 2 Pack Military Grade Faraday Bags, Fireproof Waterproof Signal Blocking Pouch for Cell Phone & Car Keys, RFID GPS WIFI NFC Blocker, Anti-Tracking Privacy Shielding Pouch for Daily Travel',
        price: 21.23 * CAD_TO_USD,
        priceCents: 1499,
        imageUrl: 'https://m.media-amazon.com/images/I/81suLufpouL._AC_UL320_.jpg',
        category: 'Faraday bags',
        tagline: 'Two-pack, waterproof',
        description: 'Signal-blocking pouch for phones and car keys. RFID, GPS, WiFi and NFC.',
    },
    {
        id: 11,
        title: 'yaokvide Large Faraday Bags - 5 Pack Faraday Cages for Laptops & Tablets & Phones & Car Keys, Faraday Key Fob Protector, Fireproof & Waterproof Anti-Theft Signal Blocking Pouch',
        price: 34.98 * CAD_TO_USD,
        priceCents: 2470,
        imageUrl: 'https://m.media-amazon.com/images/I/81jkjxGDGLL._AC_UL320_.jpg',
        category: 'Faraday bags',
        tagline: 'Five-pack, large',
        description: 'Faraday cages sized for laptops, tablets and phones.',
    },
    {
        id: 12,
        title: 'lanpard Faraday Pouch for Car Keys, Faraday Bag, Car RFID Signal Blocking Holder, Key Fob Protector, Key fob cage Block Signal Anti-Theft Fob Case (2 Pack)',
        price: 12.73 * CAD_TO_USD,
        priceCents: 899,
        imageUrl: 'https://m.media-amazon.com/images/I/81seNyVoskL._AC_UL320_.jpg',
        category: 'Faraday bags',
        tagline: 'Key-fob pouch',
        description: 'RFID-blocking holder that stops key-fob relay attacks.',
    },
    {
        id: 13,
        title: 'Faraday Defense Faraday Bag Jacket Pro for Phones | Magnetic Closure, Shielding - Law Enforcement & Military, Travel & Data Security, Privacy, Anti-Tracking Anti-Hacking Black (Phone Vertical)',
        price: 63.87 * CAD_TO_USD,
        priceCents: 4510,
        imageUrl: 'https://m.media-amazon.com/images/I/71xnJzYCNhL._AC_UL320_.jpg',
        category: 'Faraday bags',
        tagline: 'Magnetic closure',
        description: 'Jacket-style faraday bag with a magnetic seal.',
    },
]
