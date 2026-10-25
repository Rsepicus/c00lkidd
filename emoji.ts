import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SLUGS: Record<string, string> = {
  Jason: 'jason',
  c00lkidd: 'c00lkidd',
  'John Doe': 'johndoe',
  Noli: 'noli',
  '1x1x1x1': '1x1x1x1',
  'Guest 666': 'guest666',
  Nosferatu: 'nosferatu',
  Noob: 'noob',
  Shedletsky: 'shedletsky',
  Elliot: 'elliot',
  '007n7': '007n7',
  'Guest 1337': 'guest1337',
  'Two Time': 'twotime',
  Builderman: 'builderman',
  Dusekkar: 'dusekkar',
  Taph: 'taph',
  Chance: 'chance',
  Azure: 'azure',
  Helperbot: 'helperbot',
  Veeronica: 'veeronica',
  'Jane Doe': 'janedoe',
  'Rotten Minion': 'rottenminion',
}

const ABILITY_SLUGS: Record<string, string> = {
  'Jason|Gashing Wound': 'gashingwound',
  'c00lkidd|Pizza Delivery': 'pizzadelivery',
  'John Doe|Corrupt Energy': 'corruptenergy',
  'Noli|Void Rush': 'voidrush',
  'Noli|Observant': 'observant',
  '1x1x1x1|Entanglement': 'entanglement',
  '1x1x1x1|Rejuvenate the Rotten': 'rejuvenatetherotten',
  'Guest 666|Infernal Cry': 'infernalcry',
  'Guest 666|Blood Hunt': 'bloodhunt',
  'Nosferatu|Ascension': 'ascension',
  'Noob|Bloxy Cola': 'bloxycola',
  'Shedletsky|Fried Chicken': 'friedchicken',
  'Elliot|Pizza Throw': 'pizzathrow',
  '007n7|Clone': 'clone',
  'Guest 1337|Block': 'block',
  'Two Time|Oblation': 'ritual',
  'Builderman|Sentry': 'sentry',
  'Dusekkar|Spawn Protection': 'shield',
  'Taph|Subspace Tripmine': 'mine',
  'Chance|Coin Flip': 'coinflip',
  'Shedletsky|Sword Switch': 'sfoth',
  'Jason|Raging Pace': 'ragingpace',
  'Noli|Nova': 'nova',
  '1x1x1x1|Mass Infection': 'massinfection',
  'Guest 666|Eviscerate': 'eviscerate',
  'Nosferatu|Lacerate': 'lacerate',
  'Noob|Slateskin Potion': 'slateskin',
  'Elliot|Rush Hour': 'rushhour',
  'Guest 1337|Charge': 'charge',
  'Two Time|Pray': 'pray',
  'Builderman|Dispenser': 'dispenser',
  'Dusekkar|Plasma Beam': 'plasma',
  'Taph|Tripwire': 'tripwire',
  'Chance|One Shot': 'oneshot',
  'John Doe|Digital Footprint': 'digitalfootprint',
  '007n7|c00lgui': 'teleport',
  'c00lkidd|Corrupt Nature': 'corruptnature',
  'Azure|Seeker Bulb': 'seekerbulb',
  'Azure|Stigmatize': 'stigmatize',
  'Helperbot|Pulse': 'pulse',
  'Helperbot|Inspiration': 'inspire',
  'Veeronica|Sk8': 'sk8',
  'Veeronica|Activate Battery': 'activatebattery',
  'Jane Doe|Crystal Pitch': 'crystalpitch',
  'Jane Doe|Purified': 'purified',
  'Nosferatu|Hunter\'s Feast': 'huntersfeast',
}

export function characterSlug(name: string): string | undefined {
  return SLUGS[name]
}

const ATTACK_SLUGS: Record<string, string> = {
  Jason: 'slashslasher',
  c00lkidd: 'punchc00lkidd',
  'John Doe': 'slashjohndoe',
  Noli: 'stabnoli',
  '1x1x1x1': 'slash1x',
  'Guest 666': 'carvingslash',
  Nosferatu: 'lacerate',
  'Guest 1337': 'punch',
  'Two Time': 'stabtwotime',
  Shedletsky: 'sfoth',
  Chance: 'oneshot',
  'Jane Doe': 'hatchet',
}

export function abilitySlug(characterName: string, specialName: string): string | undefined {
  return ABILITY_SLUGS[`${characterName}|${specialName}`]
}

export function attackSlug(characterName: string): string {
  return ATTACK_SLUGS[characterName] ?? 'punch'
}

export function formatEmoji(name: string, id?: string): string {
  return id ? `<:${name}:${id}>` : ''
}

export function emojiData(slug: string): { id: string; name: string } | undefined {
  const id = EMOJI_IDS[slug]
  return id ? { id, name: slug } : undefined
}

export function emojiText(slug: string, fallback: string): string {
  return formatEmoji(slug, EMOJI_IDS[slug]) || fallback
}

function loadEmojiIds(): Record<string, string> {
  const base = dirname(fileURLToPath(import.meta.url))
  const merged: Record<string, string> = {}
  for (const file of ['emojis.json', 'emojis-ability.json', 'emojis-skins.json']) {
    const path = join(base, file)
    if (!existsSync(path)) continue
    try {
      Object.assign(merged, JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>)
    } catch {
      // ignore a broken cache file
    }
  }
  return merged
}

const EMOJI_IDS = loadEmojiIds()

export function emojiTag(slug: string): string {
  return formatEmoji(slug, EMOJI_IDS[slug])
}

export function characterEmoji(name: string): string {
  const slug = characterSlug(name)
  return slug ? emojiTag(slug) : ''
}

export function skinnedCharacterLabel(name: string, skinEmoji?: string): string {
  const tag = skinEmoji ? emojiTag(skinEmoji) : ''
  if (tag) return `${tag} ${name}`
  const fallback = characterEmoji(name)
  return fallback ? `${fallback} ${name}` : name
}

export function characterEmojiData(name: string): { id: string; name: string } | undefined {
  const slug = characterSlug(name)
  const id = slug ? EMOJI_IDS[slug] : undefined
  return id && slug ? { id, name: slug } : undefined
}

export function abilityEmojiData(
  characterName: string,
  specialName: string,
): { id: string; name: string } | undefined {
  const slug = abilitySlug(characterName, specialName)
  const id = slug ? EMOJI_IDS[slug] : undefined
  return id && slug ? { id, name: slug } : undefined
}

export function abilityEmojiText(characterName: string, specialName: string): string {
  const data = abilityEmojiData(characterName, specialName)
  return data ? formatEmoji(data.name, data.id) : ''
}

export function attackEmojiData(characterName: string): { id: string; name: string } | undefined {
  const slug = attackSlug(characterName)
  const id = EMOJI_IDS[slug]
  return id ? { id, name: slug } : undefined
}

export function characterLabel(name: string): string {
  const tag = characterEmoji(name)
  return tag ? `${tag} ${name}` : name
}
