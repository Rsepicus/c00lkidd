import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { availableSpecials, CHARACTERS } from './forsaken'
import {
  abilityEmojiData,
  abilitySlug,
  attackEmojiData,
  attackSlug,
  characterEmojiData,
  characterSlug,
  emojiData,
  emojiText,
  formatEmoji,
} from './emoji'


describe('formatEmoji', () => {
  test('builds a custom emoji tag', () => {
    expect(formatEmoji('c00lkidd', '123')).toBe('<:c00lkidd:123>')
  })

  test('returns an empty string when the id is missing', () => {
    expect(formatEmoji('c00lkidd')).toBe('')
  })
})

describe('abilitySlug', () => {
  test('maps character abilities to their icon slugs', () => {
    expect(abilitySlug('Guest 666', 'Infernal Cry')).toBe('infernalcry')
    expect(abilitySlug('Guest 666', 'Blood Hunt')).toBe('bloodhunt')
    expect(abilitySlug('c00lkidd', 'Pizza Delivery')).toBe('pizzadelivery')
    expect(abilitySlug('Shedletsky', 'Fried Chicken')).toBe('friedchicken')
    expect(abilitySlug('Taph', 'Subspace Tripmine')).toBe('mine')
    expect(abilitySlug('Noli', 'Observant')).toBe('observant')
  })
})

describe('attackSlug', () => {
  test('uses the character M1 icon', () => {
    expect(attackSlug('Jason')).toBe('slashslasher')
    expect(attackSlug('Guest 666')).toBe('carvingslash')
    expect(attackSlug('Two Time')).toBe('stabtwotime')
    expect(attackSlug('Guest 1337')).toBe('punch')
    expect(attackSlug('Noli')).toBe('stabnoli')
  })

  test('falls back to the guest punch for survivors without a strike', () => {
    expect(attackSlug('Elliot')).toBe('punch')
    expect(attackSlug('Noob')).toBe('punch')
    expect(attackSlug('Builderman')).toBe('punch')
  })
})

describe('emojiText', () => {
  test('falls back to the default emoji when the icon is missing', () => {
    expect(emojiText('does_not_exist', 'X')).toBe('X')
  })

  test('resolves the new boss, timer, MVP, duo, retry and gift icons', () => {
    for (const slug of ['boss', 'timer', 'mvp', 'duo', 'retry', 'gift', 'swordwhite']) {
      expect(emojiText(slug, 'X')).toContain(`:${slug}:`)
    }
  })
})

describe('characterSlug', () => {
  test('maps every roster character to a slug', () => {
    for (const character of CHARACTERS) {
      expect(characterSlug(character.name)).toBeTruthy()
    }
  })

  test('uses the known slugs', () => {
    expect(characterSlug('John Doe')).toBe('johndoe')
    expect(characterSlug('Guest 1337')).toBe('guest1337')
    expect(characterSlug('Two Time')).toBe('twotime')
    expect(characterSlug('Veeronica')).toBe('veeronica')
    expect(characterSlug('Jane Doe')).toBe('janedoe')
  })
})

describe('new character icons', () => {
  test('maps the new abilities and Hatchet attack', () => {
    expect(abilitySlug('Veeronica', 'Sk8')).toBe('sk8')
    expect(abilitySlug('Veeronica', 'Activate Battery')).toBe('activatebattery')
    expect(abilitySlug('Jane Doe', 'Crystal Pitch')).toBe('crystalpitch')
    expect(abilitySlug('Jane Doe', 'Purified')).toBe('purified')
    expect(attackSlug('Jane Doe')).toBe('hatchet')
  })

  test('resolves the battery, passive, Sk8 and question icons', () => {
    for (const slug of ['battery', 'passive', 'sk8', 'question']) {
      expect(emojiText(slug, 'X')).toContain(`:${slug}:`)
    }
  })

  test('every character, attack and ability has a custom icon', () => {
    const missing: string[] = []
    for (const character of CHARACTERS) {
      if (!characterEmojiData(character.name)) missing.push(`character:${character.name}`)
      if (!attackEmojiData(character.name)) missing.push(`attack:${character.name}`)
      for (const special of availableSpecials(character)) {
        if (!abilityEmojiData(character.name, special.name)) {
          missing.push(`ability:${character.name}|${special.name}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  test('every emoji slug used by the bot has an uploaded icon', () => {
    const source = readFileSync(new URL('./bot.ts', import.meta.url), 'utf8')
    const slugs = new Set<string>()
    for (const match of source.matchAll(/emoji(?:Text|Data)\(\x27([^\x27]+)\x27/g)) {
      slugs.add(match[1])
    }
    expect(slugs.size).toBeGreaterThan(20)
    expect([...slugs].filter(slug => !emojiData(slug))).toEqual([])
  })

  test('resolves every white UI icon that replaced a standard emoji', () => {
    for (const slug of [
      'check',
      'cross',
      'dot',
      'masks',
      'settings',
      'surrender',
      'stun',
      'strength',
      'weakness',
      'vulnerable',
      'creatures',
      'regeneration',
      'hemorrhage',
      'glitch',
      'haste',
      'atropa',
      'quest',
    ]) {
      expect(emojiText(slug, 'X')).toContain(`:${slug}:`)
    }
  })
})
