import { availableSpecials, characterByName, type Character } from './forsaken'
import type { LoadoutPreset, UserData } from './store'

export const MAX_PRESETS = 5
export const MAX_FAVORITES = 12
export const MAX_PRESET_NAME = 32

const PRESET_NOT_FOUND = 'Пресет не найден.'

function resolveSpecial(character: Character, chosen: string | null): string {
  const specials = availableSpecials(character)
  return chosen !== null && specials.some(special => special.name === chosen)
    ? chosen
    : character.special.name
}

function nextTimestampId(presets: readonly LoadoutPreset[]): string {
  let timestamp = Date.now()
  while (presets.some(preset => preset.id === String(timestamp))) timestamp += 1
  return String(timestamp)
}

/**
 * Saves the current active character, partner and their chosen specials as a
 * preset. A preset with the same trimmed name is replaced in place and keeps
 * its old id; the `id` argument is only used for a brand-new preset.
 */
export function saveLoadoutPreset(
  user: UserData,
  name: string,
  id?: string,
): UserData {
  if (typeof name !== 'string' || name.trim() === '') {
    throw new Error('Название пресета не может быть пустым.')
  }
  const trimmedName = name.trim()
  if (trimmedName.length > MAX_PRESET_NAME) {
    throw new Error(`Название пресета не должно превышать ${MAX_PRESET_NAME} символов.`)
  }
  if (!user.active) {
    throw new Error('Сначала выбери активного персонажа.')
  }
  const character = characterByName(user.active)
  if (!character) {
    throw new Error(`Неизвестный персонаж: ${user.active}.`)
  }
  const partner =
    user.partner && user.partner !== character.name
      ? characterByName(user.partner) ?? null
      : null
  const special = resolveSpecial(character, user.loadouts[character.name] ?? null)
  const partnerSpecial = partner
    ? resolveSpecial(partner, user.loadouts[partner.name] ?? null)
    : null

  const existingIndex = user.presets.findIndex(
    preset => preset.name.trim() === trimmedName,
  )
  if (existingIndex !== -1) {
    const presets = user.presets.map((preset, index) =>
      index === existingIndex
        ? {
            id: preset.id,
            name: trimmedName,
            character: character.name,
            special,
            partner: partner?.name ?? null,
            partnerSpecial,
          }
        : preset,
    )
    return { ...user, presets }
  }

  if (user.presets.length >= MAX_PRESETS) {
    throw new Error(
      `Достигнут лимит пресетов (${MAX_PRESETS}). Удали один из них.`,
    )
  }

  const preset: LoadoutPreset = {
    id: id ?? nextTimestampId(user.presets),
    name: trimmedName,
    character: character.name,
    special,
    partner: partner?.name ?? null,
    partnerSpecial,
  }
  return { ...user, presets: [...user.presets, preset] }
}

/**
 * Applies a saved preset. Invalid stored specials fall back to the character's
 * default, but a character/partner that is no longer owned aborts the switch.
 */
export function applyLoadoutPreset(user: UserData, id: string): UserData {
  const preset = user.presets.find(entry => entry.id === id)
  if (!preset) throw new Error(PRESET_NOT_FOUND)

  const character = characterByName(preset.character)
  if (!character || !user.owned.includes(character.name)) {
    throw new Error(`Персонаж ${preset.character} больше не доступен.`)
  }

  let partner: Character | null = null
  if (preset.partner !== null && preset.partner !== character.name) {
    const candidate = characterByName(preset.partner)
    if (!candidate || !user.owned.includes(candidate.name)) {
      throw new Error(`Персонаж ${preset.partner} больше не доступен.`)
    }
    partner = candidate
  }

  const loadouts: Record<string, string> = {
    ...user.loadouts,
    [character.name]: resolveSpecial(character, preset.special),
  }
  if (partner) {
    loadouts[partner.name] = resolveSpecial(partner, preset.partnerSpecial)
  }

  return {
    ...user,
    active: character.name,
    partner: partner?.name ?? null,
    loadouts,
  }
}

/** Removes a preset; deleting an unknown id is a no-op on a fresh user object. */
export function deleteLoadoutPreset(user: UserData, id: string): UserData {
  return {
    ...user,
    presets: user.presets.filter(preset => preset.id !== id),
  }
}

/**
 * Toggles a character in the favorites list. Only owned characters can be
 * favorited; adding beyond the cap throws instead of silently dropping entries.
 */
export function toggleFavorite(user: UserData, characterName: string): UserData {
  const character = characterByName(characterName)
  if (!character) throw new Error('Такого персонажа нет.')
  if (!user.owned.includes(character.name)) {
    throw new Error('Сначала купи этого персонажа.')
  }
  if (user.favorites.includes(character.name)) {
    return {
      ...user,
      favorites: user.favorites.filter(name => name !== character.name),
    }
  }
  if (user.favorites.length >= MAX_FAVORITES) {
    throw new Error(
      `В избранном не может быть больше ${MAX_FAVORITES} персонажей.`,
    )
  }
  return { ...user, favorites: [...user.favorites, character.name] }
}

/**
 * Favorites first in their saved order, then the remaining characters in their
 * original order. Duplicate and unknown favorite names are ignored.
 */
export function orderCharactersByFavorites(
  characters: readonly Character[],
  favorites: readonly string[],
): Character[] {
  const byName = new Map<string, Character>()
  for (const character of characters) {
    if (!byName.has(character.name)) byName.set(character.name, character)
  }

  const ordered: Character[] = []
  const taken = new Set<string>()
  for (const name of favorites) {
    const character = byName.get(name)
    if (!character || taken.has(character.name)) continue
    ordered.push(character)
    taken.add(character.name)
  }
  for (const character of characters) {
    if (taken.has(character.name)) continue
    ordered.push(character)
    taken.add(character.name)
  }
  return ordered
}
