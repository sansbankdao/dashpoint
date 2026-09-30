// apps/store/src/lib/create-store.test.ts
//
// Tests for the "Create a Store" form rules.
//
// WHAT IS BEING PINNED HERE
// -------------------------
// The rules below are the LIVE CONTRACT's rules, read from
// `getDataContract` for `2AUBj86MGTsXP7A3ekD62YoTeDwtJe5b9MxwkWwdg6Ba`. A test
// that only checked "the form rejects bad input" would pass while the form
// drifted away from the contract. These tests assert the CONTRACT's numbers and
// the CONTRACT's required set, so a drift is a failing test.
//
// The required set is `$createdAt`, `name`, `status`. `$createdAt` is set by the
// platform and is deliberately NOT in the payload; `name` and `status` are.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
    checkDraft,
    draftFromFormData,
    emptyDraft,
    requestSignature,
    STORE_CONTRACT_ID,
    STORE_DESCRIPTION_MAX,
    STORE_NAME_MAX,
    STORE_STATUSES,
    STORE_URL_PATTERN,
    type StoreDraft,
} from './create-store.ts'

/** A minimal valid draft: only the contract's required fields. */
function minimal(overrides: Partial<StoreDraft> = {}): StoreDraft {
    return { ...emptyDraft(), name: 'Little Gem Shop', ...overrides }
}

describe('contract constants', () => {
    it('names the Yappr storefront contract the resolver reads', () => {
        assert.equal(STORE_CONTRACT_ID, '2AUBj86MGTsXP7A3ekD62YoTeDwtJe5b9MxwkWwdg6Ba')
    })

    it('uses the contract status enum verbatim', () => {
        assert.deepEqual([...STORE_STATUSES], ['active', 'paused', 'closed'])
    })

    it('uses the contract name limit of 100', () => {
        assert.equal(STORE_NAME_MAX, 100)
    })

    it('uses the contract description limit of 500', () => {
        assert.equal(STORE_DESCRIPTION_MAX, 500)
    })

    it('uses the contract URL pattern ^https?://.+$', () => {
        assert.ok(STORE_URL_PATTERN.test('https://example.com/a.png'))
        assert.ok(STORE_URL_PATTERN.test('http://example.com'))
        /* The contract demands a scheme and at least one char; no dot needed. */
        assert.ok(STORE_URL_PATTERN.test('https://x'))
        assert.ok(!STORE_URL_PATTERN.test('example.com'))
        assert.ok(!STORE_URL_PATTERN.test('ftp://example.com'))
    })
})

describe('emptyDraft', () => {
    it('defaults status to the contract default, active', () => {
        assert.equal(emptyDraft().status, 'active')
    })

    it('starts every text field empty', () => {
        const draft = emptyDraft()
        for (const key of ['name', 'description', 'logoUrl', 'bannerUrl', 'defaultCurrency', 'paymentUris', 'policies', 'location', 'contactMethods'] as const) {
            assert.equal(draft[key], '', `${key} should start empty`)
        }
    })
})

describe('checkDraft — required fields', () => {
    it('rejects a blank name', () => {
        const { errors, payload } = checkDraft(minimal({ name: '   ' }))
        assert.ok(errors.name)
        assert.equal(payload, null)
    })

    it('accepts a name at exactly the contract maximum', () => {
        const { errors, payload } = checkDraft(minimal({ name: 'a'.repeat(STORE_NAME_MAX) }))
        assert.deepEqual(errors, {})
        assert.equal(payload?.name, 'a'.repeat(STORE_NAME_MAX))
    })

    it('rejects a name one over the contract maximum', () => {
        const { errors } = checkDraft(minimal({ name: 'a'.repeat(STORE_NAME_MAX + 1) }))
        assert.ok(errors.name)
    })

    it('rejects a status outside the contract enum', () => {
        const { errors } = checkDraft(minimal({ status: 'open' as never }))
        assert.ok(errors.status)
    })

    it('accepts every status in the contract enum', () => {
        for (const status of STORE_STATUSES) {
            const { errors } = checkDraft(minimal({ status }))
            assert.deepEqual(errors, {}, `status ${status} should be accepted`)
        }
    })

    it('trims the name', () => {
        const { payload } = checkDraft(minimal({ name: '  Little Gem Shop  ' }))
        assert.equal(payload?.name, 'Little Gem Shop')
    })
})

describe('checkDraft — optional fields are omitted when blank', () => {
    it('omits every blank optional field from the payload', () => {
        const { payload } = checkDraft(minimal())
        assert.deepEqual(Object.keys(payload ?? {}).sort(), ['name', 'status'])
    })

    it('does not send an empty string as a value', () => {
        const { payload } = checkDraft(minimal({ description: '   ', logoUrl: '' }))
        assert.ok(!('description' in (payload ?? {})))
        assert.ok(!('logoUrl' in (payload ?? {})))
    })

    it('never includes $createdAt, which the platform sets', () => {
        const { payload } = checkDraft(minimal())
        assert.ok(!('$createdAt' in (payload ?? {})))
    })

    it('never includes $ownerId, which the platform sets from the signer', () => {
        const { payload } = checkDraft(minimal())
        assert.ok(!('$ownerId' in (payload ?? {})))
    })
})

describe('checkDraft — URLs', () => {
    it('rejects a URL without a scheme', () => {
        const { errors } = checkDraft(minimal({ logoUrl: 'example.com/logo.png' }))
        assert.ok(errors.logoUrl)
    })

    it('rejects a non-http scheme', () => {
        const { errors } = checkDraft(minimal({ bannerUrl: 'ftp://example.com/b.png' }))
        assert.ok(errors.bannerUrl)
    })

    it('accepts http and https', () => {
        assert.deepEqual(checkDraft(minimal({ logoUrl: 'http://example.com/l.png' })).errors, {})
        assert.deepEqual(checkDraft(minimal({ bannerUrl: 'https://example.com/b.png' })).errors, {})
    })

    it('rejects an over-long URL', () => {
        const { errors } = checkDraft(minimal({ logoUrl: 'https://example.com/' + 'a'.repeat(600) }))
        assert.ok(errors.logoUrl)
    })
})

describe('checkDraft — JSON-in-a-string fields', () => {
    it('requires paymentUris to be a JSON array', () => {
        assert.ok(checkDraft(minimal({ paymentUris: 'dash:Xxxx' })).errors.paymentUris)
        assert.ok(checkDraft(minimal({ paymentUris: '{"a":1}' })).errors.paymentUris)
    })

    it('accepts a JSON array of payment URIs', () => {
        const { errors, payload } = checkDraft(minimal({ paymentUris: '["dash:Xxxx"]' }))
        assert.deepEqual(errors, {})
        assert.equal(payload?.paymentUris, '["dash:Xxxx"]')
    })

    it('accepts an empty JSON array', () => {
        assert.deepEqual(checkDraft(minimal({ paymentUris: '[]' })).errors, {})
    })

    it('requires contactMethods to be a JSON object, not an array', () => {
        assert.ok(checkDraft(minimal({ contactMethods: '["a"]' })).errors.contactMethods)
        assert.ok(checkDraft(minimal({ contactMethods: 'null' })).errors.contactMethods)
        assert.ok(checkDraft(minimal({ contactMethods: 'not json' })).errors.contactMethods)
    })

    it('accepts a JSON object of contact methods', () => {
        const { errors, payload } = checkDraft(minimal({ contactMethods: '{"email":"a@b.c"}' }))
        assert.deepEqual(errors, {})
        assert.equal(payload?.contactMethods, '{"email":"a@b.c"}')
    })
})

describe('checkDraft — payload shape', () => {
    it('keeps the contract property order for a full draft', () => {
        const { payload } = checkDraft({
            name: 'Little Gem Shop',
            description: 'Hand-poured goods.',
            logoUrl: 'https://example.com/l.png',
            bannerUrl: 'https://example.com/b.png',
            status: 'active',
            defaultCurrency: 'USD',
            paymentUris: '["dash:Xxxx"]',
            policies: 'Ships in 3 days.',
            location: 'Atlanta, GA',
            contactMethods: '{"email":"a@b.c"}',
        })

        assert.deepEqual(Object.keys(payload ?? {}), [
            'name',
            'status',
            'description',
            'logoUrl',
            'bannerUrl',
            'defaultCurrency',
            'paymentUris',
            'policies',
            'location',
            'contactMethods',
        ])
    })

    it('reports every problem at once, not just the first', () => {
        const { errors } = checkDraft({
            ...emptyDraft(),
            name: '',
            logoUrl: 'nope',
            paymentUris: 'not json',
        })

        assert.ok(errors.name)
        assert.ok(errors.logoUrl)
        assert.ok(errors.paymentUris)
    })
})

describe('draftFromFormData', () => {
    it('reads the form field names into the contract field names', () => {
        const data = new FormData()
        data.set('name', 'Little Gem Shop')
        data.set('status', 'paused')
        data.set('defaultCurrency', 'DASH')

        const draft = draftFromFormData(data)

        assert.equal(draft.name, 'Little Gem Shop')
        assert.equal(draft.status, 'paused')
        assert.equal(draft.defaultCurrency, 'DASH')
    })

    it('falls back to active when the status field is missing or unknown', () => {
        const empty = new FormData()
        assert.equal(draftFromFormData(empty).status, 'active')

        const bogus = new FormData()
        bogus.set('status', 'open')
        assert.equal(draftFromFormData(bogus).status, 'active')
    })

    it('yields empty strings for absent fields rather than undefined', () => {
        const draft = draftFromFormData(new FormData())
        for (const value of Object.values(draft)) {
            assert.equal(typeof value, 'string')
        }
    })
})

describe('requestSignature — the DashConnect seam', () => {
    it('reports that no signer is configured, and says why', async () => {
        const result = await requestSignature({ name: 'x' }, 'H5MZfwLELurkviAJ8aZgtpz6skqEaLcy3mBMDhBYWBRJ')
        assert.equal(result.ok, false)
        if (result.ok) return
        assert.match(result.reason, /DashConnect/)
    })
})
