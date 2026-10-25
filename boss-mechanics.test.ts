import { describe, expect, test } from 'bun:test'
import {
  BLOOD_MOON_MAX_CHARGES,
  applyBloodMoon,
  bloodMoonState,
  bloodMoonTuning,
  consumeBloodMoon,
  gainBloodMoonCharge,
} from './boss-mechanics'

// Integration notes for a later pvp.ts change (pvp.ts is intentionally untouched):
// 1. Give the Nosferatu boss a pure charge counter on Side, e.g. `bloodMoonCharges: 0`.
// 2. In takeTurn's `case 'special'`, after `side.abilityUses += 1`, call
//    `side.bloodMoonCharges = gainBloodMoonCharge(side.bloodMoonCharges)` when
//    `side.boss && side.character.name === 'Nosferatu'`.
// 3. At the start of that boss's turn, after start-of-turn DoT/regeneration
//    resolution and before choosing an action, call `applyBloodMoon(...)`, spend
//    the returned charges, heal `side` by `effect.heal`, and apply
//    `effect.bleed` to the chosen enemy as Bleeding. Use effect data, not strings.
// 4. Keep event wording in i18n.ts; this module must stay UI-free.

describe('blood moon charges', () => {
  test('caps charges at three', () => {
    expect(BLOOD_MOON_MAX_CHARGES).toBe(3)
    expect(gainBloodMoonCharge(0)).toBe(1)
    expect(gainBloodMoonCharge(1)).toBe(2)
    expect(gainBloodMoonCharge(2)).toBe(3)
    expect(gainBloodMoonCharge(3)).toBe(3)
    expect(gainBloodMoonCharge(99)).toBe(3)
  })

  test('never produces negative charges', () => {
    expect(gainBloodMoonCharge(-5)).toBe(1)
    expect(consumeBloodMoon(-5)).toBe(0)
    expect(bloodMoonState(-4).charges).toBe(0)
  })

  test('spends the tuned amount and leaves the remainder', () => {
    expect(consumeBloodMoon(0)).toBe(0)
    expect(consumeBloodMoon(1)).toBe(0)
    expect(consumeBloodMoon(2)).toBe(1)
    expect(consumeBloodMoon(3)).toBe(0)
  })

  test('can be built from a plain state shape', () => {
    expect(bloodMoonState()).toEqual({ charges: 0 })
    expect(bloodMoonState(2)).toEqual({ charges: 2 })
    expect(bloodMoonState(9)).toEqual({ charges: 3 })
  })
})

describe('blood moon tuning', () => {
  test('does nothing at zero charges', () => {
    expect(bloodMoonTuning(0)).toEqual({
      charges: 0,
      spend: 0,
      heal: 0,
      bleed: null,
    })
  })

  test('spends one charge for a stronger bleed at one or two charges', () => {
    const expected = {
      spend: 1,
      heal: 12,
      bleed: { damage: 3, turns: 2 },
    }
    expect(bloodMoonTuning(1)).toEqual({ charges: 1, ...expected })
    expect(bloodMoonTuning(2)).toEqual({ charges: 2, ...expected })
  })

  test('spends all three charges for a bigger heal and smaller bleed at full charge', () => {
    expect(bloodMoonTuning(3)).toEqual({
      charges: 3,
      spend: 3,
      heal: 16,
      bleed: { damage: 2, turns: 2 },
    })
  })

  test('clamps out-of-range input', () => {
    expect(bloodMoonTuning(-1)).toEqual(bloodMoonTuning(0))
    expect(bloodMoonTuning(10)).toEqual(bloodMoonTuning(3))
  })
})

describe('applyBloodMoon', () => {
  test('returns the effects and the remaining charges', () => {
    expect(applyBloodMoon(0)).toEqual({
      charges: 0,
      spend: 0,
      heal: 0,
      bleed: null,
      remainingCharges: 0,
    })
    expect(applyBloodMoon(1)).toEqual({
      charges: 1,
      spend: 1,
      heal: 12,
      bleed: { damage: 3, turns: 2 },
      remainingCharges: 0,
    })
    expect(applyBloodMoon(2)).toEqual({
      charges: 2,
      spend: 1,
      heal: 12,
      bleed: { damage: 3, turns: 2 },
      remainingCharges: 1,
    })
    expect(applyBloodMoon(3)).toEqual({
      charges: 3,
      spend: 3,
      heal: 16,
      bleed: { damage: 2, turns: 2 },
      remainingCharges: 0,
    })
  })

  test('is deterministic and does not mutate its input or shared results', () => {
    const charges = 2
    const first = applyBloodMoon(charges)
    const second = applyBloodMoon(charges)
    expect(first).toEqual(second)
    expect(charges).toBe(2)

    first.bleed!.damage = 99
    expect(applyBloodMoon(charges).bleed?.damage).toBe(3)
  })
})
