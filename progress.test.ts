import { describe, expect, test } from 'bun:test'
import { isoWeekKey } from './boss'
import { CHARACTERS } from './forsaken'
import {
  abilityXp,
  addHistory,
  applyCharacterTrial,
  applyQuestBattle,
  ensureQuests,
  ensureWeeklyQuest,
  weeklyQuestName,
  evaluateAchievements,
  favoriteCharacter,
  masteryBadge,
  masteryLevel,
  masteryTitle,
  prestigeCharacter,
  prestigeLevel,
  prestigeStars,
  questName,
  recordCharacterResult,
  rerollQuest,
  topMasteryCharacter,
  ABILITY_QUEST_REWARD,
  MASTERY_LEVEL_REWARD,
  MASTERY_MAX_XP,
  MASTERY_WIN_XP,
  PRESTIGE_REWARD_BASE,
  QUEST_POOL,
  QUEST_REWARD,
  todayKey,
  trialTierCount,
  trialTitleForWins,
  type QuestKind,
} from './progress'
import { defaultUser, type UserData } from './store'

function user(overrides: Partial<UserData>): UserData {
  return { ...defaultUser(), ...overrides }
}

const DAY = 24 * 60 * 60 * 1000

describe('achievements', () => {
  test('unlocks and rewards the first win once', () => {
    const first = evaluateAchievements(user({ wins: 1 }))
    expect(first.unlocked.map(achievement => achievement.id)).toContain('first_win')
    expect(first.user.coins).toBe(defaultUser().coins + 100)

    const second = evaluateAchievements(first.user)
    expect(second.unlocked).toHaveLength(0)
    expect(second.user.coins).toBe(defaultUser().coins + 100)
  })

  test('unlocks the streak achievement at five wins', () => {
    expect(evaluateAchievements(user({ bestStreak: 5 })).unlocked.map(a => a.id)).toContain('streak_5')
  })

  test('unlocks the collector achievement for the full roster', () => {
    const collector = user({ owned: CHARACTERS.map(character => character.name) })
    expect(evaluateAchievements(collector).unlocked.map(a => a.id)).toContain('collector')
  })

  test('unlocks the rich achievement at 5000 coins', () => {
    expect(evaluateAchievements(user({ coins: 5000 })).unlocked.map(a => a.id)).toContain('rich')
  })
})

const battle = (
  overrides: Partial<Parameters<typeof applyQuestBattle>[1]> = {},
) => ({
  won: true,
  characterNames: ['Jason'],
  abilityUses: 0,
  damage: 0,
  mode: '1x1' as const,
  gameMode: 'classic' as const,
  ...overrides,
})

function questUser(...kinds: QuestKind[]): UserData {
  const base = user({})
  base.quests = {
    date: todayKey(0),
    rerollUsed: false,
    quests: kinds.map(kind => {
      const spec = QUEST_POOL.find(entry => entry.kind === kind)
      if (!spec) throw new Error(`Нет квеста ${kind}`)
      return {
        id: spec.kind,
        kind: spec.kind,
        target: spec.target,
        progress: 0,
        reward: spec.reward,
        claimed: false,
      }
    }),
  } as unknown as UserData['quests']
  return base
}

describe('daily quests', () => {
  test('assigns a random owned character and two extra quests for the day', () => {
    const first = ensureQuests(user({}), 0, () => 0).quests!
    expect(first.quests.map(quest => quest.kind)).toEqual([
      'win_character',
      'ability',
      'damage',
    ])
    expect(first.quests[0].character).toBe('Jason')

    const second = ensureQuests(user({}), 0, () => 0.99).quests!
    expect(second.quests[0].character).toBe('Elliot')
    expect(second.quests).toHaveLength(3)
  })

  test('keeps quests for the rest of the day', () => {
    const assigned = ensureQuests(user({}), 1000, () => 0)
    const again = ensureQuests(assigned, 2000, () => 0.99)
    expect(again.quests).toBe(assigned.quests)
    expect(again).toBe(assigned)
  })

  test('resets progress on a new day', () => {
    const dayOne = applyQuestBattle(user({}), battle(), 1000, () => 0)
    expect(dayOne.user.quests?.quests[0].progress).toBe(1)

    const nextDay = ensureQuests(dayOne.user, 1000 + DAY, () => 0)
    expect(nextDay.quests?.quests[0].progress).toBe(0)
    expect(nextDay.quests?.date).toBe(todayKey(1000 + DAY))
  })

  test('counts only wins with the assigned character', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    current = applyQuestBattle(
      current,
      battle({ characterNames: ['Noob'] }),
      0,
      () => 0,
    ).user
    current = applyQuestBattle(
      current,
      battle({ won: false, characterNames: ['Jason'] }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(0)

    current = applyQuestBattle(current, battle(), 0, () => 0).user
    expect(current.quests?.quests[0].progress).toBe(1)
  })

  test('rewards 300 coins after three wins with the assigned character', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    const completed: string[] = []
    for (let index = 0; index < 3; index++) {
      const result = applyQuestBattle(current, battle(), 0, () => 0)
      current = result.user
      completed.push(...result.completed.map(quest => quest.name))
    }

    expect(completed).toHaveLength(1)
    expect(current.quests?.quests[0].progress).toBe(3)
    expect(current.coins).toBe(defaultUser().coins + QUEST_REWARD)
  })

  test('rewards the same quest only once per day', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    for (let index = 0; index < 3; index++) {
      current = applyQuestBattle(current, battle(), 0, () => 0).user
    }

    const extra = applyQuestBattle(current, battle(), 0, () => 0)
    expect(extra.completed).toHaveLength(0)
    expect(extra.user.coins).toBe(defaultUser().coins + QUEST_REWARD)
  })

  test('tracks ability uses and rewards the ability quest after four', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    current = applyQuestBattle(
      current,
      battle({ characterNames: [], abilityUses: 2 }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[1].progress).toBe(2)
    expect(current.coins).toBe(defaultUser().coins)

    const result = applyQuestBattle(
      current,
      battle({ characterNames: [], abilityUses: 2 }),
      0,
      () => 0,
    )
    expect(result.completed.map(quest => quest.name)).toContain(
      'Используй способность 4 раза',
    )
    expect(result.user.coins).toBe(defaultUser().coins + ABILITY_QUEST_REWARD)
  })

  test('rewards the ability quest once and clamps its progress', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    current = applyQuestBattle(
      current,
      battle({ characterNames: [], abilityUses: 4 }),
      0,
      () => 0,
    ).user
    const extra = applyQuestBattle(
      current,
      battle({ characterNames: [], abilityUses: 2 }),
      0,
      () => 0,
    )

    expect(extra.completed).toHaveLength(0)
    expect(extra.user.coins).toBe(defaultUser().coins + ABILITY_QUEST_REWARD)
    expect(extra.user.quests?.quests[1].progress).toBe(4)
  })

  test('tracks damage and 2v2 wins', () => {
    let current = questUser('damage', 'win_2v2')
    const damage = applyQuestBattle(
      current,
      battle({ characterNames: [], damage: 200 }),
      0,
      () => 0,
    )
    expect(damage.completed.map(quest => quest.name)).toContain('Нанеси 200 урона')
    current = damage.user

    current = applyQuestBattle(
      current,
      battle({ characterNames: [], mode: '2x2' }),
      0,
      () => 0,
    ).user
    const second = applyQuestBattle(
      current,
      battle({ characterNames: [], mode: '2x2' }),
      0,
      () => 0,
    )
    expect(second.completed.map(quest => quest.name)).toContain(
      'Победи 2 раза в 2 на 2',
    )
  })

  test('includes PvP mode quests in the daily pool', () => {
    const pool = new Map(QUEST_POOL.map(spec => [spec.kind, spec]))
    expect(pool.get('win_random')).toEqual({ kind: 'win_random', target: 2, reward: 300 })
    expect(pool.get('win_draft')).toEqual({ kind: 'win_draft', target: 2, reward: 300 })
    expect(pool.get('play_random_draft')).toEqual({
      kind: 'play_random_draft',
      target: 3,
      reward: 200,
    })
  })

  test('progresses and rewards random-mode wins only', () => {
    let current = questUser('win_random')
    current = applyQuestBattle(
      current,
      battle({ gameMode: 'draft' }),
      0,
      () => 0,
    ).user
    current = applyQuestBattle(
      current,
      battle({ gameMode: 'random', won: false }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(0)

    current = applyQuestBattle(
      current,
      battle({ gameMode: 'random' }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(1)

    const result = applyQuestBattle(
      current,
      battle({ gameMode: 'random' }),
      0,
      () => 0,
    )
    expect(result.completed).toEqual([
      { name: 'Победи 2 раза в случайном режиме', reward: 300 },
    ])
    expect(result.user.quests?.quests[0].claimed).toBe(true)
    expect(result.user.coins).toBe(defaultUser().coins + 300)
  })

  test('progresses and rewards draft wins only', () => {
    let current = questUser('win_draft')
    current = applyQuestBattle(
      current,
      battle({ gameMode: 'random' }),
      0,
      () => 0,
    ).user
    current = applyQuestBattle(
      current,
      battle({ gameMode: 'draft', won: false }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(0)

    current = applyQuestBattle(
      current,
      battle({ gameMode: 'draft' }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(1)

    const result = applyQuestBattle(
      current,
      battle({ gameMode: 'draft' }),
      0,
      () => 0,
    )
    expect(result.completed).toEqual([
      { name: 'Победи 2 раза в драфте', reward: 300 },
    ])
    expect(result.user.quests?.quests[0].claimed).toBe(true)
    expect(result.user.coins).toBe(defaultUser().coins + 300)
  })

  test('counts random and draft battles for the mixed-mode quest', () => {
    let current = questUser('play_random_draft')
    current = applyQuestBattle(
      current,
      battle({ gameMode: 'classic' }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(0)

    current = applyQuestBattle(
      current,
      battle({ gameMode: 'random', won: false }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(1)

    current = applyQuestBattle(
      current,
      battle({ gameMode: 'draft' }),
      0,
      () => 0,
    ).user
    expect(current.quests?.quests[0].progress).toBe(2)

    const result = applyQuestBattle(
      current,
      battle({ gameMode: 'random', won: false }),
      0,
      () => 0,
    )
    expect(result.completed).toEqual([
      { name: 'Сыграй 3 боя в случайном режиме или драфте', reward: 200 },
    ])
    expect(result.user.quests?.quests[0].claimed).toBe(true)
    expect(result.user.coins).toBe(defaultUser().coins + 200)
  })

  test('allows one quest reroll per day', () => {
    const current = ensureQuests(user({}), 0, () => 0)
    const rerolled = rerollQuest(current, 'win_character', 0, () => 0)
    expect(rerolled.quests?.rerollUsed).toBe(true)
    expect(rerolled.quests?.quests[0].kind).toBe('play')
    expect(rerolled.quests?.quests[0].progress).toBe(0)

    expect(() => rerollQuest(rerolled, 'ability', 0, () => 0)).toThrow('уже использована')
  })

  test('does not reroll a claimed quest', () => {
    let current = ensureQuests(user({}), 0, () => 0)
    current = applyQuestBattle(current, battle(), 0, () => 0).user
    current = applyQuestBattle(current, battle(), 0, () => 0).user
    current = applyQuestBattle(current, battle(), 0, () => 0).user
    expect(() => rerollQuest(current, 'win_character', 0, () => 0)).toThrow('уже выполнен')
  })

  test('describes each quest type', () => {
    const current = ensureQuests(user({}), 0, () => 0)
    expect(questName(current.quests!.quests[0])).toContain('Jason')
    expect(questName(current.quests!.quests[1])).toContain('способность')
    expect(questName(current.quests!.quests[2])).toContain('урона')
  })
})

describe('weekly quests', () => {
  test('creates one quest per ISO week and resets the next week', () => {
    const now = Date.UTC(2026, 9, 21)
    const first = ensureWeeklyQuest(user({}), now, () => 0)
    expect(first.weeklyQuest?.week).toBe(isoWeekKey(now))
    expect(first.weeklyQuest?.progress).toBe(0)

    const sameWeek = ensureWeeklyQuest(first, now + DAY, () => 0.9)
    expect(sameWeek.weeklyQuest).toEqual(first.weeklyQuest)

    const nextWeek = ensureWeeklyQuest(first, now + 7 * DAY, () => 0.9)
    expect(nextWeek.weeklyQuest?.week).toBe(isoWeekKey(now + 7 * DAY))
    expect(nextWeek.weeklyQuest?.progress).toBe(0)
  })

  test('progresses a weekly quest and pays its reward once', () => {
    const now = Date.UTC(2026, 9, 21)
    const quest = {
      week: isoWeekKey(now),
      kind: 'wins' as const,
      target: 15,
      progress: 14,
      reward: 700,
      claimed: false,
    }
    const current = user({ weeklyQuest: quest })
    const first = applyQuestBattle(current, battle({ won: true }), now, () => 0)
    expect(first.user.weeklyQuest?.progress).toBe(15)
    expect(first.user.weeklyQuest?.claimed).toBe(true)
    expect(first.completed.map(entry => entry.name)).toContain(weeklyQuestName(quest))
    expect(first.user.coins).toBe(current.coins + 700)

    const again = applyQuestBattle(first.user, battle({ won: true }), now, () => 0)
    expect(again.completed.filter(entry => entry.name === weeklyQuestName(quest))).toHaveLength(0)
  })

  test('a weekly damage quest tracks damage and respects the higher target', () => {
    const now = Date.UTC(2026, 9, 21)
    const current = user({
      weeklyQuest: {
        week: isoWeekKey(now),
        kind: 'damage',
        target: 2000,
        progress: 1900,
        reward: 700,
        claimed: false,
      },
    })
    const result = applyQuestBattle(current, battle({ damage: 200 }), now, () => 0)
    expect(result.user.weeklyQuest?.progress).toBe(2000)
    expect(result.completed.map(entry => entry.name)).toContain(
      weeklyQuestName(current.weeklyQuest!),
    )
  })
})

describe('character trials', () => {
  test('unlocks tiers at 3, 10 and 25 wins', () => {
    expect(trialTierCount(2)).toBe(0)
    expect(trialTierCount(3)).toBe(1)
    expect(trialTierCount(10)).toBe(2)
    expect(trialTierCount(25)).toBe(3)
    expect(trialTitleForWins(3)).toBe('Ученик')
    expect(trialTitleForWins(10)).toBe('Адепт')
    expect(trialTitleForWins(25)).toBe('Мастер')
  })

  test('pays each tier once', () => {
    const current = user({ characterStats: { Jason: { wins: 3, losses: 0, xp: 0 } } })
    const first = applyCharacterTrial(current, 'Jason')
    expect(first.completed.map(entry => entry.title)).toEqual(['Ученик'])
    expect(first.user.coins).toBe(defaultUser().coins + 100)
    expect(first.user.trialClaimed.Jason).toBe(1)

    const again = applyCharacterTrial(first.user, 'Jason')
    expect(again.completed).toHaveLength(0)
    expect(again.user.coins).toBe(first.user.coins)

    const ten = applyCharacterTrial(
      { ...first.user, characterStats: { Jason: { wins: 10, losses: 0, xp: 0 } } },
      'Jason',
    )
    expect(ten.completed.map(entry => entry.title)).toEqual(['Адепт'])
    expect(ten.user.coins).toBe(first.user.coins + 250)
  })
})

describe('mastery', () => {
  test('scales ability XP with cooldown and caps it per battle', () => {
    expect(abilityXp(1, 2)).toBe(3)
    expect(abilityXp(1, 3)).toBe(4)
    expect(abilityXp(1, 4)).toBe(5)
    expect(abilityXp(3, 2)).toBe(9)
    expect(abilityXp(4, 2)).toBe(10)
    expect(abilityXp(2, 4)).toBe(10)
    expect(abilityXp(0, 2)).toBe(0)
  })

  test('adds ability XP on top of the win/loss XP', () => {
    const win = recordCharacterResult(user({}), 'Jason', true, false, 7)
    expect(win.xpGained).toBe(27)
    const loss = recordCharacterResult(user({}), 'Jason', false, false, 7)
    expect(loss.xpGained).toBe(17)
  })

  test('levels up every 100 experience and rewards coins', () => {
    const current = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: 90 } },
    })
    const result = recordCharacterResult(current, 'Jason', true)

    expect(result.user.characterStats.Jason).toEqual({ wins: 1, losses: 0, xp: 110 })
    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
    expect(result.reward).toBe(MASTERY_LEVEL_REWARD)
    expect(result.user.coins).toBe(defaultUser().coins + MASTERY_LEVEL_REWARD)
  })

  test('can grant mastery XP without changing battle stats', () => {
    const current = user({
      characterStats: { Jason: { wins: 2, losses: 1, xp: 90 } },
    })
    const result = recordCharacterResult(current, 'Jason', true, false)
    expect(result.user.characterStats.Jason).toEqual({ wins: 2, losses: 1, xp: 110 })
    expect(result.xpGained).toBe(20)
  })

  test('gives less experience for a loss', () => {
    const result = recordCharacterResult(user({}), 'Noob', false)
    expect(result.user.characterStats.Noob).toEqual({ wins: 0, losses: 1, xp: 10 })
  })

  test('caps experience and rewards at max level', () => {
    let current = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: 880 } },
    })
    const first = recordCharacterResult(current, 'Jason', true)
    expect(first.level).toBe(10)
    expect(first.user.characterStats.Jason.xp).toBe(900)

    const second = recordCharacterResult(first.user, 'Jason', true)
    expect(second.leveledUp).toBe(false)
    expect(second.reward).toBe(0)
    expect(second.user.characterStats.Jason.xp).toBe(900)
    expect(second.user.characterStats.Jason.wins).toBe(2)
  })

  test('maps levels to titles', () => {
    expect(masteryLevel(0)).toBe(1)
    expect(masteryLevel(99)).toBe(1)
    expect(masteryLevel(100)).toBe(2)
    expect(masteryLevel(900)).toBe(10)
    expect(masteryLevel(5000)).toBe(10)
    expect(masteryTitle(1)).toBe('Новичок')
    expect(masteryTitle(5)).toBe('Ветеран')
    expect(masteryTitle(10)).toBe('Spectre')
  })

  test('maps mastery levels to milestone badges', () => {
    expect(masteryBadge(2)).toBeNull()
    expect(masteryBadge(3)).toBe('Бронза')
    expect(masteryBadge(5)).toBe('Бронза')
    expect(masteryBadge(6)).toBe('Серебро')
    expect(masteryBadge(9)).toBe('Серебро')
    expect(masteryBadge(10)).toBe('Золото')
  })

  test('reports the gold skin unlocked at level 10 once', () => {
    const current = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: 890 } },
    })
    const first = recordCharacterResult(current, 'Jason', true)
    expect(first.level).toBe(10)
    expect(first.skinsUnlocked.map(skin => skin.id)).toEqual(['jason-gold'])

    const second = recordCharacterResult(first.user, 'Jason', true)
    expect(second.skinsUnlocked).toHaveLength(0)
  })

  test('pays milestone rewards once at levels 3, 6 and 10', () => {
    const bronze = recordCharacterResult(
      user({ characterStats: { Jason: { wins: 0, losses: 0, xp: 190 } } }),
      'Jason',
      true,
    )
    expect(bronze.level).toBe(3)
    expect(bronze.milestones.map(entry => entry.badge)).toEqual(['Бронза'])
    expect(bronze.milestoneReward).toBe(150)
    expect(bronze.user.coins).toBe(
      defaultUser().coins + MASTERY_LEVEL_REWARD + bronze.milestoneReward,
    )
    expect(bronze.user.masteryRewards).toContain('Jason:3')

    const again = recordCharacterResult(bronze.user, 'Jason', true)
    expect(again.milestones).toHaveLength(0)
    expect(again.milestoneReward).toBe(0)

    const silver = recordCharacterResult(
      {
        ...again.user,
        characterStats: { Jason: { wins: 2, losses: 0, xp: 490 } },
      },
      'Jason',
      true,
    )
    expect(silver.level).toBe(6)
    expect(silver.milestones.map(entry => entry.badge)).toEqual(['Серебро'])
    expect(silver.milestoneReward).toBe(300)

    const gold = recordCharacterResult(
      {
        ...silver.user,
        characterStats: { Jason: { wins: 3, losses: 0, xp: 890 } },
      },
      'Jason',
      true,
    )
    expect(gold.level).toBe(10)
    expect(gold.milestones.map(entry => entry.badge)).toEqual(['Золото'])
    expect(gold.milestoneReward).toBe(600)
  })

  test('finds the most played and the most experienced character', () => {
    const current = user({
      characterStats: {
        Jason: { wins: 3, losses: 2, xp: 100 },
        Noob: { wins: 1, losses: 0, xp: 150 },
      },
    })
    const favorite = favoriteCharacter(current)
    expect(favorite?.name).toBe('Jason')
    expect(favorite?.battles).toBe(5)
    expect(favorite?.winrate).toBe(60)
    expect(topMasteryCharacter(current)?.name).toBe('Noob')
  })

  test('has no favorite without battles', () => {
    expect(favoriteCharacter(user({}))).toBeNull()
    expect(topMasteryCharacter(user({}))).toBeNull()
  })
})

describe('mastery prestige', () => {
  test('refuses unknown characters and characters below max mastery', () => {
    expect(() => prestigeCharacter(user({}), 'Неизвестный')).toThrow('не найден')

    const almost = user({
      characterStats: { Jason: { wins: 4, losses: 1, xp: MASTERY_MAX_XP - 1 } },
    })
    expect(() => prestigeCharacter(almost, 'Jason')).toThrow('максимального уровня')

    expect(() => prestigeCharacter(user({}), 'Jason')).toThrow('максимального уровня')
  })

  test('prestiges a maxed character, resets XP and keeps battle stats and items', () => {
    const current = user({
      characterStats: { Jason: { wins: 7, losses: 3, xp: MASTERY_MAX_XP } },
      masteryRewards: ['Jason:3', 'Jason:6', 'Jason:10'],
      equippedSkins: { Jason: 'jason-gold' },
      loadouts: { main: 'Jason' },
    })
    const result = prestigeCharacter(current, 'Jason')

    expect(result.prestige).toBe(1)
    expect(result.reward).toBe(PRESTIGE_REWARD_BASE)
    expect(Number.isInteger(result.reward)).toBe(true)
    expect(result.user.coins).toBe(current.coins + PRESTIGE_REWARD_BASE)
    expect(result.user.characterStats.Jason).toEqual({
      wins: 7,
      losses: 3,
      xp: 0,
      prestige: 1,
    })
    expect(result.user.masteryRewards).toEqual(current.masteryRewards)
    expect(result.user.equippedSkins).toEqual({ Jason: 'jason-gold' })
    expect(result.user.loadouts).toEqual({ main: 'Jason' })
  })

  test('needs a fresh climb before the next prestige and pays more', () => {
    const start = user({
      characterStats: { Jason: { wins: 7, losses: 3, xp: MASTERY_MAX_XP } },
      masteryRewards: ['Jason:3', 'Jason:6', 'Jason:10'],
    })
    const first = prestigeCharacter(start, 'Jason')
    expect(first.prestige).toBe(1)
    expect(() => prestigeCharacter(first.user, 'Jason')).toThrow('максимального уровня')

    let current = first.user
    for (let index = 0; index < MASTERY_MAX_XP / MASTERY_WIN_XP; index++) {
      current = recordCharacterResult(current, 'Jason', true, false).user
    }
    expect(current.characterStats.Jason.xp).toBe(MASTERY_MAX_XP)
    expect(current.characterStats.Jason.prestige).toBe(1)
    expect(current.coins).toBe(first.user.coins)

    const second = prestigeCharacter(current, 'Jason')
    expect(second.prestige).toBe(2)
    expect(second.reward).toBe(PRESTIGE_REWARD_BASE + 100)
    expect(second.user.coins).toBe(first.user.coins + PRESTIGE_REWARD_BASE + 100)
    expect(second.user.characterStats.Jason).toEqual({
      wins: 7,
      losses: 3,
      xp: 0,
      prestige: 2,
    })
  })

  test('does not pay milestone rewards again after prestige', () => {
    const start = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: MASTERY_MAX_XP } },
      masteryRewards: ['Jason:3', 'Jason:6', 'Jason:10'],
    })
    const prestiged = prestigeCharacter(start, 'Jason').user

    let result = recordCharacterResult(prestiged, 'Jason', true, false)
    for (let index = 1; index < 10; index++) {
      result = recordCharacterResult(result.user, 'Jason', true, false)
    }

    expect(result.level).toBe(3)
    expect(result.milestones).toHaveLength(0)
    expect(result.milestoneReward).toBe(0)
    expect(result.user.masteryRewards).toEqual(start.masteryRewards)
    expect(result.user.coins).toBe(prestiged.coins)
  })

  test('does not re-report skins after prestige', () => {
    const start = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: MASTERY_MAX_XP } },
    })
    let result = recordCharacterResult(
      prestigeCharacter(start, 'Jason').user,
      'Jason',
      true,
      false,
      300,
    )
    for (let index = 1; index < 10; index++) {
      result = recordCharacterResult(result.user, 'Jason', true, false)
    }
    expect(result.skinsUnlocked).toEqual([])
  })

  test('does not repeat level-up coin rewards after prestige', () => {
    const start = user({
      characterStats: { Jason: { wins: 0, losses: 0, xp: MASTERY_MAX_XP } },
      masteryRewards: ['Jason:3', 'Jason:6', 'Jason:10'],
    })
    const prestiged = prestigeCharacter(start, 'Jason').user

    let result = recordCharacterResult(prestiged, 'Jason', true, false)
    for (let index = 1; index < 5; index++) {
      result = recordCharacterResult(result.user, 'Jason', true, false)
    }

    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
    expect(result.reward).toBe(0)
    expect(result.user.coins).toBe(prestiged.coins)
  })

  test('reads prestige levels and caps prestige stars at five', () => {
    expect(prestigeLevel(undefined)).toBe(0)
    expect(prestigeLevel({})).toBe(0)
    expect(prestigeLevel({ prestige: 2.9 })).toBe(2)
    expect(prestigeLevel({ prestige: -1 })).toBe(0)

    expect(prestigeStars(0)).toBe('')
    expect(prestigeStars(1)).toBe('★')
    expect(prestigeStars(3)).toBe('★★★')
    expect(prestigeStars(9)).toBe('★★★★★')
    expect(prestigeStars(-2)).toBe('')
  })
})

describe('history', () => {
  test('keeps the five latest battles, newest first', () => {
    let current = user({})
    for (let index = 0; index < 7; index++) {
      current = addHistory(current, {
        opponent: `p${index}`,
        result: 'win',
        coins: index,
        at: index,
      })
    }
    expect(current.history).toHaveLength(5)
    expect(current.history[0].opponent).toBe('p6')
    expect(current.history[4].opponent).toBe('p2')
  })
})
