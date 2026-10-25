import { describe, expect, test } from 'bun:test'
import { CHARACTERS } from './forsaken'
import {
  SKINS,
  equippedSkin,
  skinById,
  skinDescription,
  skinName,
  skinUnlocked,
  skinsFor,
  unlockedSkins,
} from './skins'
import { defaultUser } from './store'

describe('skins catalog', () => {
  test('has bronze, silver and gold skins for every character', () => {
    expect(SKINS).toHaveLength(CHARACTERS.length * 3)
    for (const character of CHARACTERS) {
      const skins = skinsFor(character.name)
      expect(skins.map(skin => skin.level)).toEqual([3, 6, 10])
      expect(skins.map(skin => skin.emoji.split('_').pop())).toEqual([
        'bronze',
        'silver',
        'gold',
      ])
    }
  })

  test('unlocks bronze, silver and gold at levels 3, 6 and 10', () => {
    expect(unlockedSkins('Jason', 0)).toHaveLength(0)
    expect(unlockedSkins('Jason', 199)).toHaveLength(0)
    expect(unlockedSkins('Jason', 200).map(skin => skin.id)).toEqual(['jason-bronze'])
    expect(unlockedSkins('Jason', 500).map(skin => skin.id)).toEqual([
      'jason-bronze',
      'jason-silver',
    ])
    expect(unlockedSkins('Jason', 900).map(skin => skin.id)).toEqual([
      'jason-bronze',
      'jason-silver',
      'jason-gold',
    ])
    expect(skinUnlocked('Jason', 900, 'jason-gold')).toBe(true)
    expect(skinUnlocked('Jason', 499, 'jason-silver')).toBe(false)
  })

  test('equippedSkin rejects locked, unowned and foreign skins', () => {
    const jason = skinById('jason-gold')!
    const base = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      equippedSkins: { Jason: jason.id },
    }
    expect(equippedSkin(base, 'Jason')).toBeUndefined()
    expect(
      equippedSkin(
        {
          ...base,
          characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
        },
        'Jason',
      )?.id,
    ).toBe('jason-gold')
    expect(
      equippedSkin(
        {
          ...base,
          owned: ['Noob'],
          characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
        },
        'Jason',
      ),
    ).toBeUndefined()
    expect(
      equippedSkin(
        {
          ...base,
          equippedSkins: { Jason: 'noob-gold' },
          characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
        },
        'Jason',
      ),
    ).toBeUndefined()
  })

  test('names and descriptions are localized', () => {
    const skin = skinById('jason-gold')!
    expect(skinName(skin, 'ru')).toBe('Золотой Jason')
    expect(skinName(skin, 'en')).toBe('Golden Jason')
    expect(skinDescription(skin, 'en')).toContain('mastery level 10')
  })
})

describe('prestige skins', () => {
  test('keeps an equipped skin after prestige resets xp', () => {
    const user = {
      ...defaultUser(),
      owned: ['Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 0, prestige: 1 } },
      equippedSkins: { Jason: 'jason-gold' },
    }
    expect(equippedSkin(user, 'Jason')?.id).toBe('jason-gold')
  })
})
