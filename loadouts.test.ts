import { describe, expect, test } from 'bun:test'
import { CHARACTERS, characterByName, type Character } from './forsaken'
import {
  applyLoadoutPreset,
  deleteLoadoutPreset,
  MAX_FAVORITES,
  MAX_PRESET_NAME,
  MAX_PRESETS,
  orderCharactersByFavorites,
  saveLoadoutPreset,
  toggleFavorite,
} from './loadouts'
import { defaultUser, type LoadoutPreset, type UserData } from './store'

function makeUser(overrides: Partial<UserData> = {}): UserData {
  return {
    ...defaultUser(),
    owned: ['Noob', 'Jason', 'Shedletsky', 'Elliot'],
    active: 'Noob',
    ...overrides,
  }
}

function snapshot(user: UserData): UserData {
  return structuredClone(user)
}

function sampleCharacters(): Character[] {
  return ['Noob', 'Jason', 'Shedletsky', 'Elliot'].map(
    name => characterByName(name)!,
  )
}

function userWithPresets(count: number): UserData {
  let user = makeUser()
  for (let index = 0; index < count; index += 1) {
    user = saveLoadoutPreset(user, `Preset ${index + 1}`, `id-${index + 1}`)
  }
  return user
}

function storedPreset(overrides: Partial<LoadoutPreset> = {}): LoadoutPreset {
  return {
    id: 'main',
    name: 'Main',
    character: 'Noob',
    special: 'Bloxy Cola',
    partner: null,
    partnerSpecial: null,
    ...overrides,
  }
}

describe('saveLoadoutPreset', () => {
  test('captures the active character, partner and chosen specials', () => {
    const user = makeUser({
      partner: 'Jason',
      loadouts: { Noob: 'Slateskin Potion', Jason: 'Raging Pace' },
    })
    const before = snapshot(user)

    const next = saveLoadoutPreset(user, 'Main', 'preset-1')

    expect(next.presets).toEqual([
      {
        id: 'preset-1',
        name: 'Main',
        character: 'Noob',
        special: 'Slateskin Potion',
        partner: 'Jason',
        partnerSpecial: 'Raging Pace',
      },
    ])
    expect(next).not.toBe(user)
    expect(next.presets).not.toBe(user.presets)
    expect(user).toEqual(before)
  })

  test('stores null partner fields and trims the name', () => {
    const user = makeUser()
    const before = snapshot(user)

    const next = saveLoadoutPreset(user, '   Solo   ', 'solo')

    expect(next.presets[0]).toMatchObject({
      name: 'Solo',
      partner: null,
      partnerSpecial: null,
    })
    expect(user).toEqual(before)
  })

  test('falls back to default specials when the stored choices are invalid', () => {
    const user = makeUser({
      partner: 'Jason',
      loadouts: { Noob: 'No Such Special', Jason: 'Nope' },
    })

    const [preset] = saveLoadoutPreset(user, 'Fallback', 'fallback').presets

    expect(preset.special).toBe('Bloxy Cola')
    expect(preset.partnerSpecial).toBe('Gashing Wound')
  })

  test('replaces a same-name preset in place and preserves its id', () => {
    let user = makeUser()
    user = saveLoadoutPreset(user, 'Main', 'keep-me')
    user = saveLoadoutPreset(user, 'Second', 'second')
    const changed: UserData = {
      ...user,
      active: 'Jason',
      partner: 'Elliot',
      loadouts: { Jason: 'Raging Pace', Elliot: 'Rush Hour' },
    }

    const next = saveLoadoutPreset(changed, '  Main  ', 'ignored-id')

    expect(next.presets.map(preset => preset.id)).toEqual(['keep-me', 'second'])
    expect(next.presets[0]).toMatchObject({
      name: 'Main',
      character: 'Jason',
      special: 'Raging Pace',
      partner: 'Elliot',
      partnerSpecial: 'Rush Hour',
    })
  })

  test('matches names case-sensitively after trimming', () => {
    let user = saveLoadoutPreset(makeUser(), 'Main', 'one')
    user = saveLoadoutPreset(user, 'main', 'two')

    expect(user.presets.map(preset => preset.id)).toEqual(['one', 'two'])
    expect(user.presets.map(preset => preset.name)).toEqual(['Main', 'main'])
  })

  test('rejects an empty or whitespace-only name', () => {
    expect(() => saveLoadoutPreset(makeUser(), '', 'x')).toThrow(
      'Название пресета не может быть пустым.',
    )
    expect(() => saveLoadoutPreset(makeUser(), '   ', 'x')).toThrow(
      'Название пресета не может быть пустым.',
    )
  })

  test('accepts exactly MAX_PRESET_NAME characters and rejects longer names', () => {
    const name = 'x'.repeat(MAX_PRESET_NAME)
    const user = saveLoadoutPreset(makeUser(), name, 'long')

    expect(user.presets[0].name).toBe(name)
    expect(() =>
      saveLoadoutPreset(user, 'x'.repeat(MAX_PRESET_NAME + 1), 'too-long'),
    ).toThrow(`не должно превышать ${MAX_PRESET_NAME}`)
  })

  test('rejects saving without a valid active character', () => {
    expect(() => saveLoadoutPreset(makeUser({ active: null }), 'Main')).toThrow(
      'Сначала выбери активного персонажа.',
    )
    expect(() =>
      saveLoadoutPreset(makeUser({ active: 'Ghost' }), 'Main'),
    ).toThrow('Неизвестный персонаж: Ghost.')
  })

  test('rejects a sixth preset but still allows replacing one at the cap', () => {
    const user = userWithPresets(MAX_PRESETS)

    expect(() => saveLoadoutPreset(user, 'Sixth', 'sixth')).toThrow(
      `Достигнут лимит пресетов (${MAX_PRESETS})`,
    )

    const replaced = saveLoadoutPreset(user, 'Preset 1', 'ignored')
    expect(replaced.presets).toHaveLength(MAX_PRESETS)
    expect(replaced.presets[0].id).toBe('id-1')
  })

  test('generates unique ids for presets saved back-to-back', () => {
    const first = saveLoadoutPreset(makeUser(), 'First')
    const second = saveLoadoutPreset(first, 'Second')

    expect(second.presets).toHaveLength(2)
    expect(second.presets[0].id).not.toBe(second.presets[1].id)
  })
})

describe('applyLoadoutPreset', () => {
  test('restores active, partner and the loadouts of both characters', () => {
    const user = makeUser({
      active: 'Elliot',
      partner: null,
      loadouts: { Elliot: 'Rush Hour' },
      presets: [
        storedPreset({
          special: 'Slateskin Potion',
          partner: 'Jason',
          partnerSpecial: 'Raging Pace',
        }),
      ],
    })
    const before = snapshot(user)

    const next = applyLoadoutPreset(user, 'main')

    expect(next.active).toBe('Noob')
    expect(next.partner).toBe('Jason')
    expect(next.loadouts).toEqual({
      Elliot: 'Rush Hour',
      Noob: 'Slateskin Potion',
      Jason: 'Raging Pace',
    })
    expect(next).not.toBe(user)
    expect(next.loadouts).not.toBe(user.loadouts)
    expect(user).toEqual(before)
  })

  test('clears the previous partner for a solo preset', () => {
    const user = makeUser({
      active: 'Jason',
      partner: 'Elliot',
      presets: [storedPreset()],
    })

    const next = applyLoadoutPreset(user, 'main')

    expect(next.active).toBe('Noob')
    expect(next.partner).toBeNull()
  })

  test('falls back to default specials that are no longer valid', () => {
    const user = makeUser({
      presets: [
        storedPreset({
          special: 'Removed Ability',
          partner: 'Jason',
          partnerSpecial: 'Removed Ability',
        }),
      ],
    })

    const next = applyLoadoutPreset(user, 'main')

    expect(next.loadouts.Noob).toBe('Bloxy Cola')
    expect(next.loadouts.Jason).toBe('Gashing Wound')
  })

  test('throws when the preset is missing', () => {
    expect(() => applyLoadoutPreset(makeUser(), 'missing')).toThrow(
      'Пресет не найден.',
    )
  })

  test('throws when the preset characters are no longer owned', () => {
    const unownedActive = makeUser({
      owned: ['Jason'],
      active: 'Jason',
      presets: [storedPreset({ character: 'Noob' })],
    })
    expect(() => applyLoadoutPreset(unownedActive, 'main')).toThrow(
      'Персонаж Noob больше не доступен.',
    )

    const unownedPartner = makeUser({
      owned: ['Noob'],
      presets: [storedPreset({ partner: 'Jason', partnerSpecial: 'Raging Pace' })],
    })
    expect(() => applyLoadoutPreset(unownedPartner, 'main')).toThrow(
      'Персонаж Jason больше не доступен.',
    )
  })

  test('throws for a preset with an unknown character', () => {
    const user = makeUser({
      presets: [storedPreset({ character: 'Ghost' })],
    })

    expect(() => applyLoadoutPreset(user, 'main')).toThrow(
      'Персонаж Ghost больше не доступен.',
    )
  })
})

describe('deleteLoadoutPreset', () => {
  test('removes only the matching preset without mutating the input', () => {
    let user = saveLoadoutPreset(makeUser(), 'One', 'one')
    user = saveLoadoutPreset(user, 'Two', 'two')
    const before = snapshot(user)

    const next = deleteLoadoutPreset(user, 'one')

    expect(next.presets.map(preset => preset.id)).toEqual(['two'])
    expect(next).not.toBe(user)
    expect(next.presets).not.toBe(user.presets)
    expect(user).toEqual(before)
  })

  test('ignores an unknown id', () => {
    const user = saveLoadoutPreset(makeUser(), 'One', 'one')
    const before = snapshot(user)

    const next = deleteLoadoutPreset(user, 'missing')

    expect(next.presets).toEqual(user.presets)
    expect(next).not.toBe(user)
    expect(user).toEqual(before)
  })
})

describe('toggleFavorite', () => {
  test('adds and removes an owned character without mutating the input', () => {
    const user = makeUser()
    const before = snapshot(user)

    const added = toggleFavorite(user, 'Jason')
    expect(added.favorites).toEqual(['Jason'])
    expect(added.favorites).not.toBe(user.favorites)
    expect(user).toEqual(before)

    const removed = toggleFavorite(added, 'Jason')
    expect(removed.favorites).toEqual([])
    expect(added.favorites).toEqual(['Jason'])
  })

  test('rejects unowned and unknown characters', () => {
    expect(() => toggleFavorite(makeUser(), 'c00lkidd')).toThrow(
      'Сначала купи этого персонажа.',
    )
    expect(() => toggleFavorite(makeUser(), 'Ghost')).toThrow(
      'Такого персонажа нет.',
    )
  })

  test('throws beyond the favorites cap while removal still works at the cap', () => {
    const names = CHARACTERS.slice(0, MAX_FAVORITES + 1).map(
      character => character.name,
    )
    const user = makeUser({
      owned: [...names],
      active: names[0],
      favorites: names.slice(0, MAX_FAVORITES),
    })
    const before = snapshot(user)

    expect(user.favorites).toHaveLength(MAX_FAVORITES)
    expect(() => toggleFavorite(user, names[MAX_FAVORITES])).toThrow(
      `В избранном не может быть больше ${MAX_FAVORITES} персонажей.`,
    )

    const removed = toggleFavorite(user, names[0])
    expect(removed.favorites).toHaveLength(MAX_FAVORITES - 1)

    const readded = toggleFavorite(removed, names[MAX_FAVORITES])
    expect(readded.favorites).toHaveLength(MAX_FAVORITES)
    expect(readded.favorites).toContain(names[MAX_FAVORITES])
    expect(user).toEqual(before)
  })
})

describe('orderCharactersByFavorites', () => {
  test('puts favorites first in their order, then the rest of the original order', () => {
    const characters = sampleCharacters()

    const ordered = orderCharactersByFavorites(characters, [
      'Elliot',
      'Noob',
      'Elliot',
      'Ghost',
      'Jason',
    ])

    expect(ordered.map(character => character.name)).toEqual([
      'Elliot',
      'Noob',
      'Jason',
      'Shedletsky',
    ])
    expect(new Set(ordered.map(character => character.name)).size).toBe(
      ordered.length,
    )
  })

  test('keeps the original order with no favorites or only unknown favorites', () => {
    const characters = sampleCharacters()

    expect(
      orderCharactersByFavorites(characters, []).map(character => character.name),
    ).toEqual(['Noob', 'Jason', 'Shedletsky', 'Elliot'])
    expect(
      orderCharactersByFavorites(characters, ['Ghost', 'Missing']).map(
        character => character.name,
      ),
    ).toEqual(['Noob', 'Jason', 'Shedletsky', 'Elliot'])
  })

  test('returns a new array and does not mutate its arguments', () => {
    const characters = sampleCharacters()
    const favorites = ['Elliot']

    const ordered = orderCharactersByFavorites(characters, favorites)

    expect(ordered).not.toBe(characters)
    expect(characters.map(character => character.name)).toEqual([
      'Noob',
      'Jason',
      'Shedletsky',
      'Elliot',
    ])
    expect(favorites).toEqual(['Elliot'])
  })
})
