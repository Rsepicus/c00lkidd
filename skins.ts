import { characterSlug } from './emoji'
import { CHARACTERS } from './forsaken'
import type { Language } from './names'
import type { UserData } from './store'

export type SkinText = { ru: string; en: string }

export type SkinTier = 'bronze' | 'silver' | 'gold'

export type Skin = {
  id: string
  character: string
  tier: SkinTier
  name: SkinText
  description: SkinText
  level: number
  emoji: string
}

type SkinTierSpec = {
  tier: SkinTier
  level: number
  name: SkinText
  description: SkinText
}

const TIERS: readonly SkinTierSpec[] = [
  {
    tier: 'bronze',
    level: 3,
    name: { ru: 'Бронзовый', en: 'Bronze' },
    description: {
      ru: 'Бронзовый скин за 3-й уровень мастерства.',
      en: 'Bronze skin for mastery level 3.',
    },
  },
  {
    tier: 'silver',
    level: 6,
    name: { ru: 'Серебряный', en: 'Silver' },
    description: {
      ru: 'Серебряный скин за 6-й уровень мастерства.',
      en: 'Silver skin for mastery level 6.',
    },
  },
  {
    tier: 'gold',
    level: 10,
    name: { ru: 'Золотой', en: 'Golden' },
    description: {
      ru: 'Золотой скин за 10-й уровень мастерства.',
      en: 'Golden skin for mastery level 10.',
    },
  },
]

export const SKINS: readonly Skin[] = CHARACTERS.flatMap(character => {
  const slug = characterSlug(character.name) ?? character.name.toLowerCase().replace(/\s+/g, '')
  return TIERS.map(tier => ({
    id: `${slug}-${tier.tier}`,
    character: character.name,
    tier: tier.tier,
    name: {
      ru: `${tier.name.ru} ${character.name}`,
      en: `${tier.name.en} ${character.name}`,
    },
    description: tier.description,
    level: tier.level,
    emoji: `${slug}_${tier.tier}`,
  }))
})

export function skinsFor(character: string): Skin[] {
  return SKINS.filter(skin => skin.character === character)
}

export function skinById(id: string): Skin | undefined {
  return SKINS.find(skin => skin.id === id)
}

// Mirrors masteryLevel in progress.ts to avoid a store <-> progress import cycle.
export function skinLevel(xp: number): number {
  return Math.min(10, 1 + Math.floor(Math.max(0, xp) / 100))
}

export function unlockedSkins(character: string, xp: number): Skin[] {
  const level = skinLevel(xp)
  return skinsFor(character).filter(skin => skin.level <= level)
}

export function skinUnlocked(character: string, xp: number, id: string): boolean {
  return unlockedSkins(character, xp).some(skin => skin.id === id)
}

export function equippedSkin(user: UserData, character: string): Skin | undefined {
  if (!user.owned.includes(character)) return undefined
  const id = user.equippedSkins?.[character]
  if (!id) return undefined
  const skin = skinById(id)
  if (!skin || skin.character !== character) return undefined
  const xp = user.characterStats[character]?.xp ?? 0
  return skinUnlocked(character, xp, id) ? skin : undefined
}

export function nextSkin(character: string, xp: number): Skin | undefined {
  return skinsFor(character).find(skin => skin.level > skinLevel(xp))
}

export function skinName(skin: Skin, language: Language): string {
  return skin.name[language]
}

export function skinDescription(skin: Skin, language: Language): string {
  return skin.description[language]
}
