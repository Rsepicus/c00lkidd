import { describe, expect, test } from 'bun:test'
import { CHARACTERS, type Character } from './forsaken'
import {
  dailyShopPrice,
  isDailyFeatured,
  SHOP_DISCOUNT,
  SHOP_ROTATION_SIZE,
  shopRotation,
} from './shop-rotation'

const DAY = '2026-10-25'
const PAID = CHARACTERS.filter(character => character.price > 0)
const DAYS = Array.from(
  { length: 10 },
  (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`,
)

function names(rotation: readonly Character[]): string[] {
  return rotation.map(character => character.name)
}

describe('shop rotation', () => {
  test('exports the expected shop constants', () => {
    expect(SHOP_ROTATION_SIZE).toBe(3)
    expect(SHOP_DISCOUNT).toBe(0.2)
  })

  test('is deterministic for the same day', () => {
    expect(names(shopRotation(DAY))).toEqual(names(shopRotation(DAY)))
    expect(shopRotation(DAY, 5)).toEqual(shopRotation(DAY, 5))
  })

  test('features three unique paid characters', () => {
    const rotation = shopRotation(DAY)
    expect(rotation).toHaveLength(SHOP_ROTATION_SIZE)
    expect(new Set(names(rotation)).size).toBe(SHOP_ROTATION_SIZE)
    for (const character of rotation) {
      expect(character.price).toBeGreaterThan(0)
      expect(PAID).toContain(character)
      expect(CHARACTERS).toContain(character)
    }
  })

  test('keeps the default rotation as the prefix for larger sizes', () => {
    expect(shopRotation(DAY, 5).slice(0, SHOP_ROTATION_SIZE)).toEqual(shopRotation(DAY))
    expect(shopRotation(DAY, 1)).toHaveLength(1)
    expect(shopRotation(DAY, 0)).toEqual([])
    expect(shopRotation(DAY, 999)).toHaveLength(PAID.length)
    expect(new Set(names(shopRotation(DAY, 999))).size).toBe(PAID.length)
  })

  test('changes the selection when the day changes', () => {
    const signatures = new Set(DAYS.map(day => names(shopRotation(day)).join('|')))
    expect(signatures.size).toBeGreaterThan(1)
    const featuredNames = new Set(DAYS.flatMap(day => names(shopRotation(day))))
    expect(featuredNames.size).toBeGreaterThan(SHOP_ROTATION_SIZE)
  })

  test('never features free characters', () => {
    const free = CHARACTERS.filter(character => character.price <= 0)
    expect(free.length).toBeGreaterThan(0)
    for (const day of DAYS) {
      expect(shopRotation(day).every(character => character.price > 0)).toBe(true)
      for (const character of free) {
        expect(isDailyFeatured(character, day)).toBe(false)
        expect(dailyShopPrice(character, day)).toBe(character.price)
      }
    }
  })

  test('applies the discount only to featured characters', () => {
    const featuredNames = new Set(names(shopRotation(DAY)))
    for (const character of CHARACTERS) {
      const price = dailyShopPrice(character, DAY)
      if (featuredNames.has(character.name)) {
        expect(isDailyFeatured(character, DAY)).toBe(true)
        expect(price).toBe(Math.max(1, Math.round(character.price * (1 - SHOP_DISCOUNT))))
        expect(price).toBeLessThan(character.price)
      } else {
        expect(isDailyFeatured(character, DAY)).toBe(false)
        expect(price).toBe(character.price)
      }
    }
  })

  test('matches featured characters by name', () => {
    const featured = shopRotation(DAY)[0]
    const copy = { ...featured }
    expect(isDailyFeatured(copy, DAY)).toBe(true)
    expect(dailyShopPrice(copy, DAY)).toBe(dailyShopPrice(featured, DAY))
  })

  test('rounds discounted prices sanely and never below one', () => {
    for (const day of DAYS) {
      for (const character of shopRotation(day)) {
        const price = dailyShopPrice(character, day)
        expect(Number.isInteger(price)).toBe(true)
        expect(price).toBeGreaterThanOrEqual(1)
        expect(price).toBeLessThanOrEqual(character.price)
        expect(price).toBe(Math.max(1, Math.round(character.price * (1 - SHOP_DISCOUNT))))
      }
    }
    const featured = shopRotation(DAY)[0]
    expect(dailyShopPrice({ ...featured, price: 1 }, DAY)).toBe(1)
  })
})
