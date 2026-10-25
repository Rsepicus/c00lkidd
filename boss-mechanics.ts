/**
 * Blood Moon is Nosferatu's boss-only mechanic. This module is pure: it takes
 * plain charge counts and returns plain effect descriptors so it can be wired
 * into pvp.ts without coupling battle state or UI text to the boss roster.
 *
 * Future pvp.ts wiring (not done here):
 * - Add `bloodMoonCharges: 0` to the Side shape/makeSide for the Nosferatu boss.
 * - In takeTurn's `case 'special'`, right after `side.abilityUses += 1`, call
 *   gainBloodMoonCharge when `side.boss` and the character is Nosferatu.
 * - At the start of that boss's turn, after start-of-turn DoT/regeneration
 *   resolution and before selecting the action, call applyBloodMoon; store
 *   `remainingCharges`, heal the boss, and apply the returned bleed to the
 *   chosen enemy via the existing dotDamage/dotTurns/dotKind fields.
 * Keep event wording in i18n.ts.
 */
export const BLOOD_MOON_MAX_CHARGES = 3

export type BloodMoonState = {
  charges: number
}

export type BloodMoonBleed = {
  damage: number
  turns: number
}

export type BloodMoonTuning = {
  charges: number
  spend: number
  heal: number
  bleed: BloodMoonBleed | null
}

export type BloodMoonEffect = BloodMoonTuning & {
  remainingCharges: number
}

const MINOR_SPEND = 1
const MINOR_HEAL = 12
const MINOR_BLEED: BloodMoonBleed = { damage: 3, turns: 2 }

const FULL_SPEND = BLOOD_MOON_MAX_CHARGES
const FULL_HEAL = 16
const FULL_BLEED: BloodMoonBleed = { damage: 2, turns: 2 }

function normalizeCharges(charges: number): number {
  if (!Number.isFinite(charges)) return 0
  return Math.max(0, Math.min(BLOOD_MOON_MAX_CHARGES, Math.floor(charges)))
}

/** Creates the persisted charge slice for a battle side. */
export function bloodMoonState(charges = 0): BloodMoonState {
  return { charges: normalizeCharges(charges) }
}

/**
 * Returns the spend/heal/bleed package for the current charge count.
 * At three charges the boss cashes out all three for a larger heal; at one or
 * two charges it spends one for a stronger bleed. Zero charges do nothing.
 */
export function bloodMoonTuning(charges: number): BloodMoonTuning {
  const current = normalizeCharges(charges)
  if (current >= BLOOD_MOON_MAX_CHARGES) {
    return {
      charges: current,
      spend: FULL_SPEND,
      heal: FULL_HEAL,
      bleed: { ...FULL_BLEED },
    }
  }
  if (current >= 1) {
    return {
      charges: current,
      spend: MINOR_SPEND,
      heal: MINOR_HEAL,
      bleed: { ...MINOR_BLEED },
    }
  }
  return { charges: 0, spend: 0, heal: 0, bleed: null }
}

/** Adds one charge from a boss ability use, capped at three. */
export function gainBloodMoonCharge(charges: number): number {
  return Math.min(BLOOD_MOON_MAX_CHARGES, normalizeCharges(charges) + 1)
}

/** Returns the charges left after the current charge tier is spent. */
export function consumeBloodMoon(charges: number): number {
  const tuning = bloodMoonTuning(charges)
  return Math.max(0, tuning.charges - tuning.spend)
}

/**
 * Resolves the start-of-turn effect without touching battle state. The caller
 * applies `heal` to the boss and `bleed` to its target, then stores
 * `remainingCharges`.
 */
export function applyBloodMoon(charges: number): BloodMoonEffect {
  const tuning = bloodMoonTuning(charges)
  return {
    ...tuning,
    bleed: tuning.bleed ? { ...tuning.bleed } : null,
    remainingCharges: Math.max(0, tuning.charges - tuning.spend),
  }
}
