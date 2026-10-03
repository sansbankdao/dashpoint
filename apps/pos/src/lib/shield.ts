// apps/pos/src/lib/shield.ts
//
// Auto-shield arithmetic for the terminal, run with `node --test` via
// shield.test.ts.
//
// The numbers come from the payment API's shield endpoints:
//   - `/v1/shield/quote?amount=` prices a shield against the LIVE protocol
//     version and returns `poolFeeDuffs` and `requiredLockDuff` as strings.
//   - the confirmed balance of the sale's deposit address comes from the
//     same public Insight endpoint the API itself reads.
//
// The pool fee is charged per action, not per duff, so at a fixed action
// count it is a constant: the fee quoted for a probe amount is the fee the
// real shield will pay. The plan is still re-quoted at the actual amount and
// checked against the deposit balance before anything is signed, so if that
// constant ever stops being constant, the mismatch is caught before money
// moves rather than after.
//
// All arithmetic is bigint. A float would lose low duffs and change the
// fee's rounding, which is exactly what these formulas must not do: an
// under-funded lock is rejected by consensus, and an over-funded one beyond
// the implicit fee cap is rejected too.

/** One unspent output, as the deposit flow needs it from Insight. */
export interface ShieldUtxo {
    txid: string
    vout: number
    satoshis: number
}

/**
 * The smallest change amount the asset-lock transaction may leave behind.
 * A change output below this is dust and would be rejected by the network's
 * relay policy, so the plan keeps the change at zero or above this floor.
 */
export const MIN_CHANGE_DUFFS = 1000n

/**
 * The largest amount that can be shielded from a deposit.
 *
 * The asset lock spends the deposit's confirmed outputs and pays the L1
 * miner fee from them, so the lock must not exceed the balance minus that
 * fee. The pool fee and the safety margin are subtracted on top: the pool
 * fee because the lock must cover it, the safety margin so a fee estimate
 * that moves between the quote and the signature cannot make the lock
 * overdraw the deposit. A negative result means the deposit is too small to
 * shield at all — the funds simply stay put.
 */
export function planShieldAmount(
    balanceDuffs: bigint,
    poolFeeDuffs: bigint,
    minerFeeDuffs: bigint,
    safetyDuffs: bigint
): bigint {
    return balanceDuffs - poolFeeDuffs - minerFeeDuffs - safetyDuffs
}

/**
 * Format duffs as a decimal DASH string the API's shield quote accepts.
 *
 * The API parses amounts with at most eight decimal places and no exponent,
 * so the fraction is always padded to exactly eight digits.
 */
export function duffsToDashString(duffs: bigint): string {
    const whole = duffs / 100_000_000n
    const fraction = duffs % 100_000_000n
    return `${whole}.${fraction.toString().padStart(8, '0')}`
}
