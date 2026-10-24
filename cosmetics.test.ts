import { describe, expect, test } from 'bun:test'
import {
  COSMETICS,
  buyCosmetic,
  clearCosmetics,
  cosmeticById,
  equippedTitle,
  equipCosmetic,
  hexToColor,
  normalizeHexColor,
  profileAccent,
  setCustomColor,
} from './cosmetics'
import { defaultUser, type UserData } from './store'

function user(overrides: Partial<UserData> = {}): UserData {
  return { ...defaultUser(), ...overrides }
}

const accent = COSMETICS.find(item => item.kind === 'accent')!
const title = COSMETICS.find(item => item.id === 'title_survivor')!

describe('cosmetics', () => {
  test('profile colors use plain color names', () => {
    const accents = COSMETICS.filter(item => item.kind === 'accent').map(item => item.name)
    expect(accents).toEqual(['Красный', 'Синий', 'Жёлтый', 'Свой цвет'])
  })

  test('plain profile colors cost 100 coins, custom stays 1000', () => {
    for (const id of ['accent_blood', 'accent_ice', 'accent_gold']) {
      expect(cosmeticById(id)?.price).toBe(100)
    }
    expect(cosmeticById('accent_custom')?.price).toBe(1000)
  })

  test('VIP, MLG and Spectre titles carry their own emoji', () => {
    expect(cosmeticById('title_vip')?.emoji).toBe('vip')
    expect(cosmeticById('title_vip')?.name).toBe('V.I.P.')
    expect(cosmeticById('title_mlg')?.emoji).toBe('mlg')
    expect(cosmeticById('title_mlg')?.name).toBe('MLG')
    expect(cosmeticById('title_forsaken')?.emoji).toBe('spectre')
    expect(cosmeticById('title_forsaken')?.name).toBe('Spectre')
  })

  test('custom color costs 1000 and can be set by hex', () => {
    const custom = cosmeticById('accent_custom')!
    const buyer = buyCosmetic(user({ coins: 2000 }), custom.id)
    expect(buyer.coins).toBe(1000)
    expect(buyer.cosmetics.accent).toBe('accent_custom')
    expect(profileAccent(buyer)).toBeNull()

    const colored = setCustomColor(buyer, '#FF00aa')
    expect(colored.cosmetics.customColor).toBe('#ff00aa')
    expect(profileAccent(colored)).toBe(0xff00aa)
  })

  test('buying another cosmetic keeps the custom hex color', () => {
    const custom = buyCosmetic(user({ coins: 3000 }), 'accent_custom')
    const colored = setCustomColor(custom, '#123abc')
    const withTitle = buyCosmetic(colored, 'title_survivor')

    expect(withTitle.cosmetics.customColor).toBe('#123abc')
    expect(withTitle.cosmetics.accent).toBe('accent_custom')
    expect(profileAccent(withTitle)).toBe(0x123abc)
  })

  test('validates and normalizes hex colors', () => {
    expect(normalizeHexColor('#FF00aa')).toBe('#ff00aa')
    expect(normalizeHexColor('00ff00')).toBe('#00ff00')
    expect(normalizeHexColor('#12345')).toBeNull()
    expect(normalizeHexColor('red')).toBeNull()
    expect(hexToColor('#ff00aa')).toBe(0xff00aa)
    expect(() => setCustomColor(user(), 'red')).toThrow('HEX')
  })

  test('buying a VIP title equips it', () => {
    const vip = cosmeticById('title_vip')!
    const result = buyCosmetic(user({ coins: 3000 }), vip.id)
    expect(equippedTitle(result)).toBe('V.I.P.')
    expect(result.coins).toBe(3000 - vip.price)
  })
  test('buying an accent deducts coins and equips it', () => {
    const buyer = user({ coins: 1000 })
    const result = buyCosmetic(buyer, accent.id)

    expect(result.coins).toBe(1000 - accent.price)
    expect(result.cosmetics.owned).toContain(accent.id)
    expect(result.cosmetics.accent).toBe(accent.id)
    expect(profileAccent(result)).toBe(accent.color)
  })

  test('buying a title equips it in the profile', () => {
    const result = buyCosmetic(user({ coins: 1000 }), title.id)
    expect(result.cosmetics.title).toBe(title.id)
    expect(equippedTitle(result)).toBe(title.name)
  })

  test('rejects a cosmetic that is already owned', () => {
    const bought = buyCosmetic(user({ coins: 1000 }), accent.id)
    expect(() => buyCosmetic(bought, accent.id)).toThrow('уже куплена')
  })

  test('rejects a purchase without enough coins', () => {
    expect(() => buyCosmetic(user({ coins: 0 }), accent.id)).toThrow('Не хватает монет')
  })

  test('equips only owned cosmetics', () => {
    expect(() => equipCosmetic(user(), title.id)).toThrow('Сначала купи')
  })

  test('switches between owned accents', () => {
    const bought = buyCosmetic(user({ coins: 2000 }), accent.id)
    const other = COSMETICS.filter(item => item.kind === 'accent' && item.id !== accent.id)[0]
    const withBoth = buyCosmetic(bought, other.id)
    const switched = equipCosmetic(withBoth, accent.id)
    expect(switched.cosmetics.accent).toBe(accent.id)
  })

  test('clears the equipped accent and title', () => {
    let current = buyCosmetic(user({ coins: 2000 }), accent.id)
    current = buyCosmetic(current, title.id)
    const cleared = clearCosmetics(current)
    expect(cleared.cosmetics.accent).toBeNull()
    expect(cleared.cosmetics.title).toBeNull()
    expect(profileAccent(cleared)).toBeNull()
    expect(equippedTitle(cleared)).toBeNull()
  })

  test('finds a cosmetic by id', () => {
    expect(cosmeticById(accent.id)?.name).toBe(accent.name)
    expect(cosmeticById('nope')).toBeUndefined()
  })
})
