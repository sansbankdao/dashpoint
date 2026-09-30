// apps/store/src/lib/create-store.ts
//
// The client half of "Create a Store".
//
// WHAT THIS FILE IS FOR
// ---------------------
// A merchant with a registered DPNS name and an identity but no store document
// needs a way to publish one. That is a Platform WRITE, and every write must be
// signed. This module holds the form's rules and the shape of the request; it
// deliberately does NOT hold a private key, and it deliberately does not sign.
//
// WHY THERE IS NO KEY HERE
// ------------------------
// The signing step is being replaced by DashConnect (a QR-code handshake). Until
// that ships, the only safe path is a SCOPED key -- purpose AUTHENTICATION,
// securityLevel HIGH -- which can create a document and cannot update the
// identity, move funds, or manage keys. Even that key is never entered into
// this page; it is read by a local CLI. The `StoreDraft` below is the payload a
// signer needs, and it is the same payload DashConnect will eventually sign.
//
// This file is therefore FINAL in shape and PENDING in wiring. When DashConnect
// lands, `requestSignature` gets a real implementation and nothing else changes.
//
// FIELD RULES ARE READ FROM THE CONTRACT, NOT INVENTED
// ---------------------------------------------------
// The live contract (id 2AUBj86MGTsXP7A3ekD62YoTeDwtJe5b9MxwkWwdg6Ba, the Yappr
// storefront contract) declares these limits. Each constant below cites the
// schema it came from. The required set is `$createdAt`, `name`, `status`.

/*
 * The document type and contract the storefront reader already queries.
 * Duplicated here rather than imported because the reader lives in a different
 * repo (`dashpoint-api`), and a build-time cross-repo import would couple the
 * two deploys. If the contract id ever changes, BOTH sites change together --
 * that is the point of it being a constant with a name.
 */
export const STORE_CONTRACT_ID = '2AUBj86MGTsXP7A3ekD62YoTeDwtJe5b9MxwkWwdg6Ba'
export const STORE_DOCUMENT_TYPE = 'store'

/** Field limits, from the contract schema. */
export const STORE_NAME_MAX = 100
export const STORE_DESCRIPTION_MAX = 500
export const STORE_URL_MAX = 512
export const STORE_PAYMENT_URIS_MAX = 2000
export const STORE_DEFAULT_CURRENCY_MAX = 10
export const STORE_POLICIES_MAX = 2000
export const STORE_LOCATION_MAX = 100
export const STORE_CONTACT_METHODS_MAX = 1000

/** The contract's `status` enum, verbatim: `active|paused|closed`. */
export const STORE_STATUSES = ['active', 'paused', 'closed'] as const
export type StoreStatus = (typeof STORE_STATUSES)[number]

/*
 * A URL the contract will accept.
 *
 * The contract pattern is `^https?://.+$` -- it demands a scheme and at least
 * one character after it, and it does NOT require a dot. A bare hostname like
 * `example` would pass the contract and fail a user's expectation, so the check
 * here is the contract's, and the message says which one it is.
 */
export const STORE_URL_PATTERN = /^https?:\/\/.+$/

/** What the merchant fills in. Matches the contract's writable properties. */
export interface StoreDraft {
    name: string
    description: string
    logoUrl: string
    bannerUrl: string
    status: StoreStatus
    defaultCurrency: string
    paymentUris: string
    policies: string
    location: string
    contactMethods: string
}

/** The result of checking a draft: the errors, and the cleaned payload. */
export interface StoreDraftCheck {
    errors: Partial<Record<keyof StoreDraft, string>>
    /** Present only when `errors` is empty. */
    payload: Record<string, unknown> | null
}

/** A blank draft. `status` defaults to the contract's own default, `active`. */
export function emptyDraft(): StoreDraft {
    return {
        name: '',
        description: '',
        logoUrl: '',
        bannerUrl: '',
        status: 'active',
        defaultCurrency: '',
        paymentUris: '',
        policies: '',
        location: '',
        contactMethods: '',
    }
}

/*
 * Check a draft and build the document properties.
 *
 * Only `name` and `status` are REQUIRED by the contract; `$createdAt` is added
 * by the platform, not by the client, so it is not in the payload. Every other
 * field is omitted when blank rather than sent as an empty string, because an
 * empty string is a value and the contract would store it as one.
 *
 * `contactMethods` and `paymentUris` are declared `string` in the contract and
 * their descriptions say the CONTENT is a JSON array/object. They are validated
 * as JSON here so a merchant learns about a typo before signing, not after.
 */
export function checkDraft(draft: StoreDraft): StoreDraftCheck {
    const errors: Partial<Record<keyof StoreDraft, string>> = {}

    const name = draft.name.trim()

    if (name.length === 0) {
        errors.name = 'A store name is required.'
    } else if (name.length > STORE_NAME_MAX) {
        errors.name = `A store name is at most ${STORE_NAME_MAX} characters.`
    }

    if (!STORE_STATUSES.includes(draft.status)) {
        errors.status = `Status must be one of: ${STORE_STATUSES.join(', ')}.`
    }

    const description = draft.description.trim()

    if (description.length > STORE_DESCRIPTION_MAX) {
        errors.description = `The description is at most ${STORE_DESCRIPTION_MAX} characters.`
    }

    for (const key of ['logoUrl', 'bannerUrl'] as const) {
        const value = draft[key].trim()

        if (value.length === 0) continue

        if (value.length > STORE_URL_MAX) {
            errors[key] = `At most ${STORE_URL_MAX} characters.`
        } else if (!STORE_URL_PATTERN.test(value)) {
            errors[key] = 'Must start with http:// or https:// (the contract requires a scheme).'
        }
    }

    const defaultCurrency = draft.defaultCurrency.trim()

    if (defaultCurrency.length > STORE_DEFAULT_CURRENCY_MAX) {
        errors.defaultCurrency = `At most ${STORE_DEFAULT_CURRENCY_MAX} characters, e.g. USD or DASH.`
    }

    const policies = draft.policies.trim()

    if (policies.length > STORE_POLICIES_MAX) {
        errors.policies = `At most ${STORE_POLICIES_MAX} characters.`
    }

    const location = draft.location.trim()

    if (location.length > STORE_LOCATION_MAX) {
        errors.location = `At most ${STORE_LOCATION_MAX} characters.`
    }

    /*
     * `paymentUris` and `contactMethods` are JSON-in-a-string. The contract
     * caps their LENGTH; it cannot check their syntax, so this does.
     */
    const paymentUris = draft.paymentUris.trim()

    if (paymentUris.length > STORE_PAYMENT_URIS_MAX) {
        errors.paymentUris = `At most ${STORE_PAYMENT_URIS_MAX} characters.`
    } else if (paymentUris.length > 0) {
        const parsed = tryParse(paymentUris)

        if (parsed === undefined) {
            errors.paymentUris = 'Must be valid JSON (the contract stores this as a JSON array).'
        } else if (!Array.isArray(parsed)) {
            errors.paymentUris = 'Must be a JSON array, e.g. ["dash:..."].'
        }
    }

    const contactMethods = draft.contactMethods.trim()

    if (contactMethods.length > STORE_CONTACT_METHODS_MAX) {
        errors.contactMethods = `At most ${STORE_CONTACT_METHODS_MAX} characters.`
    } else if (contactMethods.length > 0) {
        const parsed = tryParse(contactMethods)

        if (parsed === undefined) {
            errors.contactMethods = 'Must be valid JSON (the contract stores this as a JSON object).'
        } else if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            errors.contactMethods = 'Must be a JSON object, e.g. {"email":"..."}.'
        }
    }

    if (Object.keys(errors).length > 0) {
        return { errors, payload: null }
    }

    /*
     * Build the payload. Required fields always; optional fields only when they
     * carry a value. The order below follows the contract's declared property
     * order so a diff against the schema reads the same way.
     */
    const payload: Record<string, unknown> = {
        name,
        status: draft.status,
    }

    if (description.length > 0) payload.description = description
    if (draft.logoUrl.trim().length > 0) payload.logoUrl = draft.logoUrl.trim()
    if (draft.bannerUrl.trim().length > 0) payload.bannerUrl = draft.bannerUrl.trim()
    if (defaultCurrency.length > 0) payload.defaultCurrency = defaultCurrency
    if (paymentUris.length > 0) payload.paymentUris = paymentUris
    if (policies.length > 0) payload.policies = policies
    if (location.length > 0) payload.location = location
    if (contactMethods.length > 0) payload.contactMethods = contactMethods

    return { errors: {}, payload }
}

/*
 * Parse JSON, returning `undefined` for "not JSON" so that `null` stays a
 * meaningful, distinct result (`null` IS valid JSON and a valid array element).
 */
function tryParse(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

/*
 * Adapt a submitted form to a `StoreDraft`.
 *
 * Kept here rather than in the page so the field names the form uses and the
 * field names the contract uses are reconciled in ONE place. A page that reads
 * its own form and builds its own object is how a rename in the form silently
 * stops populating a contract field.
 */
export function draftFromFormData(data: FormData): StoreDraft {
    const text = (key: string): string => {
        const value = data.get(key)
        return typeof value === 'string' ? value : ''
    }

    const status = text('status')

    return {
        name: text('name'),
        description: text('description'),
        logoUrl: text('logoUrl'),
        bannerUrl: text('bannerUrl'),
        status: (STORE_STATUSES as readonly string[]).includes(status)
            ? (status as StoreStatus)
            : 'active',
        defaultCurrency: text('defaultCurrency'),
        paymentUris: text('paymentUris'),
        policies: text('policies'),
        location: text('location'),
        contactMethods: text('contactMethods'),
    }
}

/*
 * The signing seam.
 *
 * Today this always reports that no signer is configured, because none is. When
 * DashConnect ships, the QR handshake resolves here and returns a signed
 * transition; the caller does not change. Keeping the seam in one function is
 * what makes "wait for DashConnect" a wiring change rather than a rewrite.
 */
export interface SignerUnavailable {
    ok: false
    reason: string
}

export type SignatureResult =
    | { ok: true; stateTransitionHex: string }
    | SignerUnavailable

export async function requestSignature(
    _payload: Record<string, unknown>,
    _identityId: string,
): Promise<SignatureResult> {
    return {
        ok: false,
        reason:
            'No signer is configured yet. Signing will be a DashConnect QR handshake once it ships; until then a scoped key is used from the local CLI.',
    }
}
