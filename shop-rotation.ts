import { CHARACTERS, type Character } from './forsaken'

export const SHOP_ROTATION_SIZE = 3
export const SHOP_DISCOUNT = 0.2

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** Paid characters in their canonical CHARACTERS order, deduplicated by name. */
const PAID_CHARACTERS: readonly Character[] = CHARACTERS.filter(
  (character, index, all) =>
    character.price > 0 &&
    all.findIndex(candidate => candidate.name === character.name) === index,
)

/** Small local FNV-1a hash so the rotation never depends on outside state. */
function hashDay(day: string): number {
  let hash = FNV_OFFSET
  for (let index = 0; index < day.length; index += 1) {
    hash ^= day.charCodeAt(index)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

/** Deterministic PRNG (mulberry32) seeded by the day hash. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Returns the paid characters featured in the shop for `day` (YYYY-MM-DD).
 * Deterministic, unique, and stable: a larger `size` only extends the rotation.
 */
export function shopRotation(day: string, size = SHOP_ROTATION_SIZE): Character[] {
  const pool = [...PAID_CHARACTERS]
  const random = seededRandom(hashDay(day))
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = pool[index]
    pool[index] = pool[swap]
    pool[swap] = current
  }
  const count = Math.max(0, Math.min(pool.length, Math.floor(size)))
  return pool.slice(0, count)
}

export function isDailyFeatured(character: Character, day: string): boolean {
  return shopRotation(day).some(featured => featured.name === character.name)
}

export function dailyShopPrice(character: Character, day: string): number {
  if (!isDailyFeatured(character, day)) return character.price
  return Math.max(1, Math.round(character.price * (1 - SHOP_DISCOUNT)))
}
