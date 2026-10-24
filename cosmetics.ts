import type { UserData } from './store'

export type CosmeticKind = 'accent' | 'title'

export type Cosmetic = {
  id: string
  kind: CosmeticKind
  name: string
  description: string
  price: number
  color?: number
  emoji?: string
}

export const COSMETICS: readonly Cosmetic[] = [
  {
    id: 'accent_blood',
    kind: 'accent',
    name: 'Красный',
    description: 'Красный цвет профиля',
    price: 100,
    color: 0xb3001b,
  },
  {
    id: 'accent_ice',
    kind: 'accent',
    name: 'Синий',
    description: 'Синий цвет профиля',
    price: 100,
    color: 0x4aa3df,
  },
  {
    id: 'accent_gold',
    kind: 'accent',
    name: 'Жёлтый',
    description: 'Жёлтый цвет профиля',
    price: 100,
    color: 0xf1c40f,
  },
  {
    id: 'accent_custom',
    kind: 'accent',
    name: 'Свой цвет',
    description: 'Любой цвет по HEX-коду',
    price: 1000,
  },
  {
    id: 'title_survivor',
    kind: 'title',
    name: 'Выживший',
    description: 'Титул для тех, кто дожил до конца',
    price: 500,
  },
  {
    id: 'title_killer',
    kind: 'title',
    name: 'Киллер',
    description: 'Титул для охотников',
    price: 500,
  },
  {
    id: 'title_vip',
    kind: 'title',
    name: 'V.I.P.',
    description: 'Особый титул V.I.P.',
    price: 1000,
    emoji: 'vip',
  },
  {
    id: 'title_mlg',
    kind: 'title',
    name: 'MLG',
    description: 'Титул в стиле MLG',
    price: 1000,
    emoji: 'mlg',
  },
  {
    id: 'title_forsaken',
    kind: 'title',
    name: 'Spectre',
    description: 'Высший титул арены',
    price: 2000,
    emoji: 'spectre',
  },
]

export function cosmeticById(id: string): Cosmetic | undefined {
  return COSMETICS.find(item => item.id === id)
}

export function buyCosmetic(user: UserData, id: string): UserData {
  const item = cosmeticById(id)
  if (!item) throw new Error('Такой косметики нет.')
  if (user.cosmetics.owned.includes(id)) throw new Error('Эта косметика уже куплена.')
  if (user.coins < item.price) {
    throw new Error(`Не хватает монет: нужно ${item.price}, у тебя ${user.coins}.`)
  }

  return {
    ...user,
    coins: user.coins - item.price,
    cosmetics: {
      ...user.cosmetics,
      owned: [...user.cosmetics.owned, id],
      accent: item.kind === 'accent' ? id : user.cosmetics.accent,
      title: item.kind === 'title' ? id : user.cosmetics.title,
    },
  }
}

export function equipCosmetic(user: UserData, id: string): UserData {
  const item = cosmeticById(id)
  if (!item) throw new Error('Такой косметики нет.')
  if (!user.cosmetics.owned.includes(id)) throw new Error('Сначала купи эту косметику.')

  return {
    ...user,
    cosmetics: {
      ...user.cosmetics,
      accent: item.kind === 'accent' ? id : user.cosmetics.accent,
      title: item.kind === 'title' ? id : user.cosmetics.title,
    },
  }
}

export function clearCosmetics(user: UserData): UserData {
  return { ...user, cosmetics: { ...user.cosmetics, accent: null, title: null } }
}

export function normalizeHexColor(value: string): string | null {
  const raw = value.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return `#${raw.toLowerCase()}`
}

export function hexToColor(hex: string): number | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  return Number.parseInt(normalized.slice(1), 16)
}

export function setCustomColor(user: UserData, hex: string): UserData {
  const normalized = normalizeHexColor(hex)
  if (!normalized) throw new Error('Нужен HEX-код вида #ff00aa.')
  return {
    ...user,
    cosmetics: {
      ...user.cosmetics,
      accent: 'accent_custom',
      customColor: normalized,
    },
  }
}

export function profileAccent(user: UserData): number | null {
  const item = user.cosmetics.accent ? cosmeticById(user.cosmetics.accent) : undefined
  if (!item || item.kind !== 'accent' || !user.cosmetics.owned.includes(item.id)) return null
  if (item.id === 'accent_custom') {
    return user.cosmetics.customColor ? hexToColor(user.cosmetics.customColor) : null
  }
  return item.color ?? null
}

export function equippedTitleItem(user: UserData): Cosmetic | null {
  const item = user.cosmetics.title ? cosmeticById(user.cosmetics.title) : undefined
  if (!item || item.kind !== 'title' || !user.cosmetics.owned.includes(item.id)) return null
  return item
}

export function equippedTitle(user: UserData): string | null {
  return equippedTitleItem(user)?.name ?? null
}
