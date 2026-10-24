import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { characterByName } from './forsaken'
import {
  BONUS_COOLDOWN_MS,
  buyCharacter,
  claimDailyBonus,
  DAILY_BONUS,
  defaultUser,
  getUser,
  grantCoins,
  ownedCharacters,
  purchasableCharacters,
  loadStore,
  MAX_PVP_WAGER,
  normalizeUser,
  saveStore,
  setActive,
  setEquippedSkin,
  setLanguage,
  setLastPvp,
  setLoadout,
  setPartner,
  STARTING_COINS,
  type UserData,
} from './store'

describe('defaultUser', () => {
  test('starts with coins, the free characters and Noob active', () => {
    const user = defaultUser()
    expect(user.coins).toBe(STARTING_COINS)
    expect(user.owned).toContain('Noob')
    expect(user.owned).toContain('Jason')
    expect(user.owned).toContain('Shedletsky')
    expect(user.owned).toContain('Elliot')
    expect(user.active).toBe('Noob')
    expect(user.partner).toBeNull()
    expect(user.wins).toBe(0)
    expect(user.losses).toBe(0)
    expect(user.characterStats).toEqual({})
    expect(user.cosmetics).toEqual({ owned: [], accent: null, title: null, customColor: null })
    expect(user.loadouts).toEqual({})
    expect(user.language).toBe('ru')
    expect(user.lastPvp).toBeUndefined()
    expect(user.weeklyQuest).toBeNull()
    expect(user.onboarded).toBe(false)
    expect(user.compactMode).toBe(false)
  })
})

describe('normalizeUser', () => {
  test('defaults battle history for older saves', () => {
    expect(normalizeUser(defaultUser()).history).toEqual([])
  })

  test('grants the free characters to older saves', () => {
    const normalized = normalizeUser({ ...defaultUser(), owned: ['Noob', 'Jason'] })
    expect(normalized.owned).toContain('Shedletsky')
    expect(normalized.owned).toContain('Elliot')
  })

  test('keeps saved battle history', () => {
    const history = [{ opponent: 'x', result: 'win' as const, coins: 150, at: 1 }]
    expect(normalizeUser({ ...defaultUser(), history }).history).toEqual(history)
  })

  test('keeps mastery milestone claims and drops invalid entries', () => {
    const normalized = normalizeUser({
      ...defaultUser(),
      masteryRewards: ['Jason:3', 'Noob:6', 42] as never,
    })
    expect(normalized.masteryRewards).toEqual(['Jason:3', 'Noob:6'])
  })

  test('keeps the onboarding flag', () => {
    expect(normalizeUser({ ...defaultUser(), onboarded: true }).onboarded).toBe(true)
    expect(normalizeUser({ ...defaultUser(), onboarded: 'yes' as never }).onboarded).toBe(false)
  })

  test('keeps the compact panel flag', () => {
    expect(normalizeUser({ ...defaultUser(), compactMode: true }).compactMode).toBe(true)
    expect(normalizeUser({ ...defaultUser(), compactMode: 'yes' as never }).compactMode).toBe(false)
  })

  test('keeps a valid weekly quest and drops a broken one', () => {
    const weeklyQuest = {
      week: '2026-W43',
      kind: 'wins' as const,
      target: 15,
      progress: 3,
      reward: 700,
      claimed: false,
    }
    expect(normalizeUser({ ...defaultUser(), weeklyQuest }).weeklyQuest).toEqual(weeklyQuest)
    expect(
      normalizeUser({ ...defaultUser(), weeklyQuest: { ...weeklyQuest, target: 0 } }).weeklyQuest,
    ).toBeNull()
  })

  test('keeps only valid equipped skins', () => {
    const normalized = normalizeUser({
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
      equippedSkins: { Jason: 'jason-gold', Noob: 'noob-gold', Ghost: 'jason-gold' },
    })
    expect(normalized.equippedSkins).toEqual({ Jason: 'jason-gold' })
  })

  test('discards an outdated quest shape', () => {
    const legacy = {
      ...defaultUser(),
      quests: { date: '2026-10-23', battles: 1, wins: 0, claimed: [] },
    } as unknown as Partial<UserData>

    expect(normalizeUser(legacy).quests).toBeNull()
  })

  test('keeps a valid daily quest assignment', () => {
    const quests = {
      date: '2026-10-23',
      rerollUsed: false,
      quests: [
        {
          id: 'win_character',
          kind: 'win_character' as const,
          character: 'Jason',
          target: 3,
          progress: 2,
          reward: 300,
          claimed: false,
        },
        {
          id: 'damage',
          kind: 'damage' as const,
          target: 200,
          progress: 250,
          reward: 250,
          claimed: true,
        },
      ],
    }
    expect(normalizeUser({ ...defaultUser(), quests }).quests?.quests).toHaveLength(2)
    expect(normalizeUser({ ...defaultUser(), quests }).quests?.quests[1].progress).toBe(200)
  })

  test('keeps and clamps character trial progress', () => {
    const trialClaimed = { Jason: 2, 'Jane Doe': 9, Broken: 'many' }
    const normalized = normalizeUser({
      ...defaultUser(),
      trialClaimed: trialClaimed as never,
    })
    expect(normalized.trialClaimed).toEqual({ Jason: 2, 'Jane Doe': 3 })
  })

  test('keeps a valid weekly boss record', () => {
    const boss = { week: '2026-W01', bestDamage: 120, cleared: true, wins: 2 }
    expect(normalizeUser({ ...defaultUser(), boss }).boss).toEqual(boss)
  })

  test('drops a broken boss record', () => {
    const boss = { week: '2026-W01', bestDamage: 'lots', cleared: true, wins: 2 }
    expect(normalizeUser({ ...defaultUser(), boss: boss as never }).boss).toBeNull()
  })

  test('keeps per-character stats and drops broken entries', () => {
    const stats = {
      Jason: { wins: 3, losses: 1, xp: 70 },
      Noob: { wins: 'many', losses: 0, xp: 0 },
    }
    const normalized = normalizeUser({
      ...defaultUser(),
      characterStats: stats as never,
    })
    expect(normalized.characterStats).toEqual({ Jason: { wins: 3, losses: 1, xp: 70 } })
  })

  test('keeps owned cosmetics and equipped slots', () => {
    const cosmetics = {
      owned: ['accent_blood', 'title_forsaken', 42],
      accent: 'accent_blood',
      title: 'title_forsaken',
    }
    const normalized = normalizeUser({ ...defaultUser(), cosmetics: cosmetics as never })
    expect(normalized.cosmetics).toEqual({
      owned: ['accent_blood', 'title_forsaken'],
      accent: 'accent_blood',
      title: 'title_forsaken',
      customColor: null,
    })
  })

  test('keeps character ability loadouts and drops broken values', () => {
    const loadouts = { 'Guest 1337': 'Charge', Noob: 42 }
    const normalized = normalizeUser({ ...defaultUser(), loadouts: loadouts as never })
    expect(normalized.loadouts).toEqual({ 'Guest 1337': 'Charge' })
  })

  test('keeps a valid 2v2 partner and drops invalid choices', () => {
    const base = {
      ...defaultUser(),
      owned: ['Noob', 'Jason', 'Guest 1337'],
      active: 'Noob',
    }
    expect(normalizeUser({ ...base, partner: 'Guest 1337' }).partner).toBe('Guest 1337')
    expect(normalizeUser({ ...base, partner: 'Noob' }).partner).toBeNull()
    expect(normalizeUser({ ...base, partner: 'c00lkidd' }).partner).toBeNull()
    expect(normalizeUser({ ...base, partner: 42 as never }).partner).toBeNull()
  })
})

describe('language', () => {
  test('defaults to Russian and keeps English', () => {
    expect(defaultUser().language).toBe('ru')
    expect(normalizeUser({ ...defaultUser(), language: 'en' }).language).toBe('en')
    expect(normalizeUser({ ...defaultUser(), language: 'xx' as never }).language).toBe('ru')
  })

  test('sets the chosen language', () => {
    expect(setLanguage(defaultUser(), 'en').language).toBe('en')
  })
})

describe('lastPvp', () => {
  test('is absent for older users', () => {
    expect(defaultUser().lastPvp).toBeUndefined()
    expect(normalizeUser({ ...defaultUser(), lastPvp: undefined }).lastPvp).toBeUndefined()
  })

  test('stores a valid setup with setLastPvp', () => {
    const setup = { format: '2x2' as const, gameMode: 'draft' as const, wager: 750 }
    expect(setLastPvp(defaultUser(), setup).lastPvp).toEqual(setup)
  })

  test('clamps the wager to 0..100000 and floors fractions', () => {
    const base = { format: '1x1' as const, gameMode: 'classic' as const }
    expect(setLastPvp(defaultUser(), { ...base, wager: -100 }).lastPvp?.wager).toBe(0)
    expect(setLastPvp(defaultUser(), { ...base, wager: 42.9 }).lastPvp?.wager).toBe(42)
    expect(setLastPvp(defaultUser(), { ...base, wager: MAX_PVP_WAGER }).lastPvp?.wager).toBe(
      MAX_PVP_WAGER,
    )
    expect(setLastPvp(defaultUser(), { ...base, wager: MAX_PVP_WAGER + 1 }).lastPvp?.wager).toBe(
      MAX_PVP_WAGER,
    )
  })

  test('rejects unknown formats and game modes', () => {
    expect(() =>
      setLastPvp(defaultUser(), { format: '3x3' as never, gameMode: 'classic', wager: 10 }),
    ).toThrow('формат')
    expect(() =>
      setLastPvp(defaultUser(), { format: '1x1', gameMode: 'chaos' as never, wager: 10 }),
    ).toThrow('режим')
    expect(() =>
      setLastPvp(defaultUser(), {
        format: '1x1',
        gameMode: 'classic',
        wager: Number.POSITIVE_INFINITY,
      }),
    ).toThrow('числом')
  })

  test('keeps and clamps a saved setup', () => {
    const normalized = normalizeUser({
      ...defaultUser(),
      lastPvp: { format: '2x2', gameMode: 'random', wager: -50 },
    })
    expect(normalized.lastPvp).toEqual({ format: '2x2', gameMode: 'random', wager: 0 })
  })

  test('drops legacy or invalid setups', () => {
    const base = defaultUser()
    expect(
      normalizeUser({
        ...base,
        lastPvp: { format: '3x3', gameMode: 'classic', wager: 10 } as never,
      }).lastPvp,
    ).toBeUndefined()
    expect(
      normalizeUser({
        ...base,
        lastPvp: { format: '1x1', gameMode: 'chaos', wager: 10 } as never,
      }).lastPvp,
    ).toBeUndefined()
    expect(normalizeUser({ ...base, lastPvp: 'classic' as never }).lastPvp).toBeUndefined()
    expect(normalizeUser({ ...base, lastPvp: { wager: 10 } as never }).lastPvp).toBeUndefined()
  })

  test('repairs a broken wager in otherwise valid data', () => {
    const normalized = normalizeUser({
      ...defaultUser(),
      lastPvp: { format: '1x1', gameMode: 'draft', wager: 'lots' } as never,
    })
    expect(normalized.lastPvp).toEqual({ format: '1x1', gameMode: 'draft', wager: 0 })
  })
})

describe('setLoadout', () => {
  const guestOwner = { ...defaultUser(), owned: ['Noob', 'Jason', 'Guest 1337'] }

  test('saves the chosen ability for an owned character', () => {
    const updated = setLoadout(guestOwner, 'Guest 1337', 'Charge')
    expect(updated.loadouts['Guest 1337']).toBe('Charge')
  })

  test('rejects an unowned character', () => {
    expect(() => setLoadout(defaultUser(), 'Guest 1337', 'Charge')).toThrow('Сначала купи')
  })

  test('rejects an ability the character does not have', () => {
    expect(() => setLoadout(guestOwner, 'Guest 1337', 'Plasma Beam')).toThrow('нет такой способности')
  })
})

describe('setEquippedSkin', () => {
  test('equips an unlocked skin and clears it with null', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
    }
    const equipped = setEquippedSkin(user, 'Jason', 'jason-gold')
    expect(equipped.equippedSkins.Jason).toBe('jason-gold')
    expect(setEquippedSkin(equipped, 'Jason', null).equippedSkins.Jason).toBeUndefined()
  })

  test('rejects locked, foreign and unknown skins', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
    }
    expect(() => setEquippedSkin(user, 'Noob', 'noob-gold')).toThrow()
    expect(() => setEquippedSkin(user, 'Jason', 'noob-gold')).toThrow()
    expect(() => setEquippedSkin(user, 'Jason', 'missing')).toThrow()
  })
})

describe('buyCharacter', () => {
  test('deducts coins and unlocks the character', () => {
    const character = characterByName('007n7')!
    const user = buyCharacter({ ...defaultUser(), coins: 500 }, character)
    expect(user.coins).toBe(0)
    expect(user.owned).toContain('007n7')
  })

  test('rejects a character that is already owned', () => {
    const character = characterByName('Noob')!
    expect(() => buyCharacter(defaultUser(), character)).toThrow('уже куплен')
  })

  test('rejects a purchase without enough coins', () => {
    const character = characterByName('Nosferatu')!
    expect(() => buyCharacter({ ...defaultUser(), coins: 100 }, character)).toThrow('Не хватает монет')
  })
})

describe('character lists', () => {
  test('ownedCharacters lists only the characters the user has', () => {
    const names = ownedCharacters(defaultUser()).map(character => character.name)
    expect(names).toContain('Noob')
    expect(names).toContain('Jason')
    expect(names).not.toContain('c00lkidd')
  })

  test('purchasableCharacters excludes owned characters', () => {
    const names = purchasableCharacters(defaultUser()).map(character => character.name)
    expect(names).not.toContain('Noob')
    expect(names).not.toContain('Jason')
    expect(names).not.toContain('Shedletsky')
    expect(names).not.toContain('Elliot')
    expect(names).toContain('c00lkidd')
  })
})

describe('grantCoins', () => {
  test('adds coins to the balance', () => {
    expect(grantCoins(defaultUser(), 2000).coins).toBe(STARTING_COINS + 2000)
  })

  test('rejects non-positive amounts', () => {
    expect(() => grantCoins(defaultUser(), 0)).toThrow('положительной')
    expect(() => grantCoins(defaultUser(), -5)).toThrow('положительной')
  })
})

describe('setActive', () => {
  test('switches to an owned character', () => {
    expect(setActive(defaultUser(), 'Jason').active).toBe('Jason')
  })

  test('rejects a character that is not owned', () => {
    expect(() => setActive(defaultUser(), 'Guest 666')).toThrow('Сначала купи')
  })

  test('clears the partner when it becomes the active character', () => {
    const withPartner = setPartner(defaultUser(), 'Jason')
    expect(setActive(withPartner, 'Jason').partner).toBeNull()
  })
})

describe('setPartner', () => {
  const owner = {
    ...defaultUser(),
    owned: ['Noob', 'Jason', 'Guest 1337'],
  }

  test('saves another owned character as the partner', () => {
    expect(setPartner(owner, 'Guest 1337').partner).toBe('Guest 1337')
  })

  test('auto picks a partner when the slot is cleared', () => {
    expect(setPartner(owner, null).partner).toBeNull()
  })

  test('rejects an unowned character or the active one', () => {
    expect(() => setPartner(owner, 'Guest 666')).toThrow('Сначала купи')
    expect(() => setPartner(owner, 'Noob')).toThrow('отличаться')
  })
})

describe('claimDailyBonus', () => {
  test('adds the daily bonus the first time', () => {
    const now = 1_000_000
    expect(claimDailyBonus(defaultUser(), now).coins).toBe(STARTING_COINS + DAILY_BONUS)
  })

  test('rejects a second claim within the cooldown', () => {
    const now = 1_000_000
    const user = claimDailyBonus(defaultUser(), now)
    expect(() => claimDailyBonus(user, now + 1000)).toThrow('Бонус уже получен')
  })

  test('allows the claim again after the cooldown', () => {
    const now = 1_000_000
    const user = claimDailyBonus(defaultUser(), now)
    expect(claimDailyBonus(user, now + BONUS_COOLDOWN_MS).coins).toBe(STARTING_COINS + DAILY_BONUS * 2)
  })
})

describe('getUser', () => {
  test('returns defaults for an unknown user without storing them', () => {
    const store = { users: {} }
    expect(getUser(store, '42').coins).toBe(STARTING_COINS)
    expect(store.users['42']).toBeUndefined()
  })
})

describe('persistence', () => {
  test('round-trips the last PvP setup through disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forsaken-store-'))
    const path = join(dir, 'data.json')
    try {
      const user = setLastPvp(defaultUser(), {
        format: '2x2',
        gameMode: 'draft',
        wager: 500,
      })
      saveStore(path, { users: { '42': user } })
      expect(loadStore(path).users['42'].lastPvp).toEqual({
        format: '2x2',
        gameMode: 'draft',
        wager: 500,
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('round-trips a store through disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'forsaken-store-'))
    const path = join(dir, 'data.json')
    try {
      expect(loadStore(path)).toEqual({ users: {} })
      const store = { users: { '42': { ...defaultUser(), coins: 1234 } } }
      saveStore(path, store)
      expect(loadStore(path)).toEqual(store)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
