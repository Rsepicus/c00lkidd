import { isoWeekKey } from './boss'
import { characterByName, CHARACTERS } from './forsaken'
import { skinsFor, type Skin } from './skins'
import {
  ownedCharacters,
  type BattleRecord,
  type DailyQuest,
  type QuestBattleResult as BaseQuestBattleResult,
  type QuestKind as BaseQuestKind,
  type UserData,
  type WeeklyQuest,
  type WeeklyQuestKind,
} from './store'

export type QuestGameMode = 'classic' | 'random' | 'draft'

export type QuestKind =
  | BaseQuestKind
  | 'win_random'
  | 'win_draft'
  | 'play_random_draft'

export type QuestBattleResult = BaseQuestBattleResult & {
  gameMode: QuestGameMode
}

export type Achievement = {
  id: string
  name: string
  description: string
  reward: number
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first_win', name: 'Первая победа', description: 'Выиграй первый бой', reward: 100 },
  { id: 'wins_10', name: 'Десятка', description: 'Выиграй 10 боёв', reward: 300 },
  { id: 'wins_50', name: 'Ветеран', description: 'Выиграй 50 боёв', reward: 1000 },
  { id: 'streak_5', name: 'Серия', description: 'Выиграй 5 боёв подряд', reward: 500 },
  { id: 'collector', name: 'Коллекционер', description: 'Собери всех персонажей', reward: 1500 },
  { id: 'rich', name: 'Богач', description: 'Накопи 5000 монет', reward: 250 },
]

export type UnlockResult = { user: UserData; unlocked: Achievement[] }

export function evaluateAchievements(user: UserData): UnlockResult {
  const unlocked: Achievement[] = []
  let next = user

  for (const achievement of ACHIEVEMENTS) {
    if (next.achievements.includes(achievement.id)) continue

    const reached =
      achievement.id === 'first_win'
        ? next.wins >= 1
        : achievement.id === 'wins_10'
          ? next.wins >= 10
          : achievement.id === 'wins_50'
            ? next.wins >= 50
            : achievement.id === 'streak_5'
              ? next.bestStreak >= 5
              : achievement.id === 'collector'
                ? next.owned.length >= CHARACTERS.length
                : achievement.id === 'rich'
                  ? next.coins >= 5000
                  : false

    if (reached) {
      unlocked.push(achievement)
      next = {
        ...next,
        coins: next.coins + achievement.reward,
        achievements: [...next.achievements, achievement.id],
      }
    }
  }

  return { user: next, unlocked }
}

export const MASTERY_XP_PER_LEVEL = 100
export const MASTERY_MAX_LEVEL = 10
export const MASTERY_MAX_XP = (MASTERY_MAX_LEVEL - 1) * MASTERY_XP_PER_LEVEL
export const MASTERY_WIN_XP = 20
export const MASTERY_LOSS_XP = 10
export const MASTERY_LEVEL_REWARD = 50
export const ABILITY_XP_CAP = 10

export function abilityXp(uses: number, cooldown: number): number {
  const safeUses = Number.isFinite(uses) ? Math.max(0, Math.floor(uses)) : 0
  const safeCooldown = Number.isFinite(cooldown) ? Math.max(0, Math.floor(cooldown)) : 0
  return Math.min(ABILITY_XP_CAP, safeUses * Math.max(3, safeCooldown + 1))
}

export type MasteryMilestone = { level: number; reward: number; badge: string }

export const MASTERY_MILESTONES: readonly MasteryMilestone[] = [
  { level: 3, reward: 150, badge: 'Бронза' },
  { level: 6, reward: 300, badge: 'Серебро' },
  { level: 10, reward: 600, badge: 'Золото' },
]

export function masteryBadge(level: number): string | null {
  let badge: string | null = null
  for (const milestone of MASTERY_MILESTONES) {
    if (level >= milestone.level) badge = milestone.badge
  }
  return badge
}

export function masteryLevel(xp: number): number {
  return Math.min(MASTERY_MAX_LEVEL, 1 + Math.floor(Math.max(0, xp) / MASTERY_XP_PER_LEVEL))
}

export function masteryTitle(level: number): string {
  if (level >= 10) return 'Spectre'
  if (level >= 9) return 'Элита'
  if (level >= 7) return 'Мастер'
  if (level >= 5) return 'Ветеран'
  if (level >= 3) return 'Боец'
  return 'Новичок'
}

export type CharacterPerformance = {
  name: string
  wins: number
  losses: number
  battles: number
  winrate: number
  xp: number
  level: number
  title: string
}

function performanceOf(name: string, stat: { wins: number; losses: number; xp: number }): CharacterPerformance {
  const battles = stat.wins + stat.losses
  const level = masteryLevel(stat.xp)
  return {
    name,
    wins: stat.wins,
    losses: stat.losses,
    battles,
    winrate: battles > 0 ? Math.round((stat.wins / battles) * 100) : 0,
    xp: stat.xp,
    level,
    title: masteryTitle(level),
  }
}

function knownStats(user: UserData): Array<[string, { wins: number; losses: number; xp: number }]> {
  return Object.entries(user.characterStats).filter(([name]) => characterByName(name) !== undefined)
}

export function favoriteCharacter(user: UserData): CharacterPerformance | null {
  const entries = knownStats(user)
  if (entries.length === 0) return null
  entries.sort(
    ([leftName, left], [rightName, right]) =>
      right.wins + right.losses - (left.wins + left.losses) ||
      right.wins - left.wins ||
      leftName.localeCompare(rightName),
  )
  return performanceOf(entries[0][0], entries[0][1])
}

export function topMasteryCharacter(user: UserData): CharacterPerformance | null {
  const entries = knownStats(user)
  if (entries.length === 0) return null
  entries.sort(
    ([leftName, left], [rightName, right]) =>
      right.xp - left.xp ||
      right.wins + right.losses - (left.wins + left.losses) ||
      leftName.localeCompare(rightName),
  )
  return performanceOf(entries[0][0], entries[0][1])
}

export function recordCharacterResult(
  user: UserData,
  characterName: string,
  won: boolean,
  countBattle = true,
  bonusXp = 0,
): {
  user: UserData
  xpGained: number
  level: number
  leveledUp: boolean
  reward: number
  milestoneReward: number
  milestones: MasteryMilestone[]
  skinsUnlocked: Skin[]
} {
  const stat = user.characterStats[characterName] ?? { wins: 0, losses: 0, xp: 0 }
  const oldLevel = masteryLevel(stat.xp)
  const baseXp = Math.min(MASTERY_MAX_XP, stat.xp)
  const gain = (won ? MASTERY_WIN_XP : MASTERY_LOSS_XP) + Math.max(0, Math.floor(bonusXp))
  const xp = Math.min(MASTERY_MAX_XP, baseXp + gain)
  const level = masteryLevel(xp)
  const reward = Math.max(0, level - oldLevel) * MASTERY_LEVEL_REWARD
  const claimed = new Set(user.masteryRewards ?? [])
  const milestones = MASTERY_MILESTONES.filter(
    milestone => level >= milestone.level && !claimed.has(`${characterName}:${milestone.level}`),
  )
  const milestoneReward = milestones.reduce((sum, milestone) => sum + milestone.reward, 0)
  const skinsUnlocked = skinsFor(characterName).filter(
    skin => skin.level > oldLevel && skin.level <= level,
  )

  return {
    user: {
      ...user,
      coins: user.coins + reward + milestoneReward,
      masteryRewards: [
        ...(user.masteryRewards ?? []),
        ...milestones.map(milestone => `${characterName}:${milestone.level}`),
      ],
      characterStats: {
        ...user.characterStats,
        [characterName]: {
          wins: stat.wins + (countBattle && won ? 1 : 0),
          losses: stat.losses + (countBattle && !won ? 1 : 0),
          xp,
        },
      },
    },
    xpGained: xp - baseXp,
    level,
    leveledUp: level > oldLevel,
    reward,
    milestoneReward,
    milestones,
    skinsUnlocked,
  }
}

export type TrialTier = { wins: number; reward: number; title: string }

export const TRIAL_TIERS: readonly TrialTier[] = [
  { wins: 3, reward: 100, title: 'Ученик' },
  { wins: 10, reward: 250, title: 'Адепт' },
  { wins: 25, reward: 500, title: 'Мастер' },
]

export function trialTierCount(wins: number): number {
  return TRIAL_TIERS.filter(tier => wins >= tier.wins).length
}

export function trialTitleForWins(wins: number): string | null {
  const count = trialTierCount(wins)
  return count > 0 ? TRIAL_TIERS[count - 1].title : null
}

export type TrialCompletion = { name: string; title: string; reward: number }

export function applyCharacterTrial(
  user: UserData,
  characterName: string,
): { user: UserData; completed: TrialCompletion[] } {
  const wins = user.characterStats[characterName]?.wins ?? 0
  const reached = trialTierCount(wins)
  const claimed = user.trialClaimed[characterName] ?? 0
  if (reached <= claimed) return { user, completed: [] }

  const completed: TrialCompletion[] = []
  let coins = user.coins
  for (let index = claimed; index < reached; index++) {
    const tier = TRIAL_TIERS[index]
    coins += tier.reward
    completed.push({
      name: characterName,
      title: tier.title,
      reward: tier.reward,
    })
  }

  return {
    user: {
      ...user,
      coins,
      trialClaimed: { ...user.trialClaimed, [characterName]: reached },
    },
    completed,
  }
}

export const QUEST_TARGET = 3
export const QUEST_REWARD = 300
export const ABILITY_QUEST_TARGET = 4
export const ABILITY_QUEST_REWARD = 200

export type QuestCompletion = { name: string; reward: number }

type QuestSpec = { kind: QuestKind; target: number; reward: number }

export const QUEST_POOL: readonly QuestSpec[] = [
  { kind: 'ability', target: ABILITY_QUEST_TARGET, reward: ABILITY_QUEST_REWARD },
  { kind: 'damage', target: 200, reward: 250 },
  { kind: 'play', target: 3, reward: 150 },
  { kind: 'win_2v2', target: 2, reward: 300 },
  { kind: 'win_random', target: 2, reward: 300 },
  { kind: 'win_draft', target: 2, reward: 300 },
  { kind: 'play_random_draft', target: 3, reward: 200 },
]

export function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function questName(quest: DailyQuest): string {
  switch (quest.kind as QuestKind) {
    case 'win_character':
      return `Победи ${quest.target} раза за ${quest.character ?? 'персонажа'}`
    case 'ability':
      return `Используй способность ${quest.target} раза`
    case 'damage':
      return `Нанеси ${quest.target} урона`
    case 'play':
      return `Сыграй ${quest.target} боя`
    case 'win_2v2':
      return `Победи ${quest.target} раза в 2 на 2`
    case 'win_random':
      return `Победи ${quest.target} раза в случайном режиме`
    case 'win_draft':
      return `Победи ${quest.target} раза в драфте`
    case 'play_random_draft':
      return `Сыграй ${quest.target} боя в случайном режиме или драфте`
  }
}

function makeQuest(spec: QuestSpec, character?: string): DailyQuest {
  return {
    id: spec.kind,
    kind: spec.kind as DailyQuest['kind'],
    ...(character ? { character } : {}),
    target: spec.target,
    progress: 0,
    reward: spec.reward,
    claimed: false,
  }
}

function takeRandom<T>(items: T[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined
  const index = Math.floor(rng() * items.length) % items.length
  return items.splice(index, 1)[0]
}

export function ensureQuests(user: UserData, now = Date.now(), rng = Math.random): UserData {
  if (user.quests && user.quests.date === todayKey(now)) return user

  const pool = ownedCharacters(user)
  const chosen = pool[Math.floor(rng() * pool.length)] ?? CHARACTERS[0]
  const extras = [...QUEST_POOL]
  const quests: DailyQuest[] = [
    makeQuest(
      { kind: 'win_character', target: QUEST_TARGET, reward: QUEST_REWARD },
      chosen.name,
    ),
  ]
  for (let index = 0; index < 2; index++) {
    const spec = takeRandom(extras, rng)
    if (spec) quests.push(makeQuest(spec))
  }

  return {
    ...user,
    quests: {
      date: todayKey(now),
      quests,
      rerollUsed: false,
    },
  }
}

function questDelta(quest: DailyQuest, result: QuestBattleResult): number {
  switch (quest.kind as QuestKind) {
    case 'win_character':
      return result.won && result.characterNames.includes(quest.character ?? '') ? 1 : 0
    case 'ability':
      return Math.max(0, Math.floor(result.abilityUses))
    case 'damage':
      return Math.max(0, Math.floor(result.damage))
    case 'play':
      return 1
    case 'win_2v2':
      return result.won && result.mode === '2x2' ? 1 : 0
    case 'win_random':
      return result.won && result.gameMode === 'random' ? 1 : 0
    case 'win_draft':
      return result.won && result.gameMode === 'draft' ? 1 : 0
    case 'play_random_draft':
      return result.gameMode === 'random' || result.gameMode === 'draft' ? 1 : 0
  }
}

export type WeeklyQuestSpec = { kind: WeeklyQuestKind; target: number; reward: number }

export const WEEKLY_QUEST_POOL: readonly WeeklyQuestSpec[] = [
  { kind: 'wins', target: 15, reward: 700 },
  { kind: 'play', target: 20, reward: 600 },
  { kind: 'damage', target: 2000, reward: 700 },
  { kind: 'ability', target: 20, reward: 600 },
  { kind: 'win_2v2', target: 8, reward: 700 },
  { kind: 'win_random_draft', target: 8, reward: 700 },
]

export function weeklyQuestName(quest: WeeklyQuest): string {
  const target = quest.target
  switch (quest.kind) {
    case 'wins':
      return `Выиграй ${target} PvP-боёв за неделю`
    case 'play':
      return `Сыграй ${target} PvP-боёв за неделю`
    case 'damage':
      return `Нанеси ${target} урона за неделю`
    case 'ability':
      return `Используй ${target} способностей за неделю`
    case 'win_2v2':
      return `Выиграй ${target} боёв 2 на 2 за неделю`
    case 'win_random_draft':
      return `Выиграй ${target} боёв в Рандоме или Драфте за неделю`
  }
}

export function ensureWeeklyQuest(
  user: UserData,
  now = Date.now(),
  _rng = Math.random,
): UserData {
  const week = isoWeekKey(now)
  if (user.weeklyQuest?.week === week) return user
  const hash = [...week].reduce((value, char) => value * 31 + char.charCodeAt(0), 0)
  const spec = WEEKLY_QUEST_POOL[Math.abs(hash) % WEEKLY_QUEST_POOL.length] ?? WEEKLY_QUEST_POOL[0]
  return {
    ...user,
    weeklyQuest: {
      week,
      kind: spec.kind,
      target: spec.target,
      progress: 0,
      reward: spec.reward,
      claimed: false,
    },
  }
}

function weeklyQuestDelta(quest: WeeklyQuest, result: QuestBattleResult): number {
  switch (quest.kind) {
    case 'wins':
      return result.won ? 1 : 0
    case 'play':
      return 1
    case 'damage':
      return result.damage
    case 'ability':
      return result.abilityUses
    case 'win_2v2':
      return result.won && result.mode === '2x2' ? 1 : 0
    case 'win_random_draft':
      return result.won && (result.gameMode === 'random' || result.gameMode === 'draft') ? 1 : 0
  }
}

export function applyQuestBattle(
  user: UserData,
  result: QuestBattleResult,
  now = Date.now(),
  rng = Math.random,
): { user: UserData; completed: QuestCompletion[] } {
  let next = ensureQuests(user, now, rng)
  next = ensureWeeklyQuest(next, now, rng)
  const quests = next.quests!
  const completed: QuestCompletion[] = []
  let coins = next.coins

  const updated = quests.quests.map(quest => {
    if (quest.claimed) return quest
    const progress = Math.min(quest.target, quest.progress + questDelta(quest, result))
    if (progress < quest.target) return { ...quest, progress }
    coins += quest.reward
    completed.push({ name: questName(quest), reward: quest.reward })
    return { ...quest, progress, claimed: true }
  })

  let weeklyQuest = next.weeklyQuest
  if (weeklyQuest && !weeklyQuest.claimed) {
    const progress = Math.min(
      weeklyQuest.target,
      weeklyQuest.progress + weeklyQuestDelta(weeklyQuest, result),
    )
    if (progress >= weeklyQuest.target) {
      coins += weeklyQuest.reward
      completed.push({ name: weeklyQuestName(weeklyQuest), reward: weeklyQuest.reward })
      weeklyQuest = { ...weeklyQuest, progress, claimed: true }
    } else {
      weeklyQuest = { ...weeklyQuest, progress }
    }
  }

  return {
    user: {
      ...next,
      coins,
      quests: { ...quests, quests: updated },
      weeklyQuest,
    },
    completed,
  }
}

export function rerollQuest(
  user: UserData,
  questId: string,
  now = Date.now(),
  rng = Math.random,
): UserData {
  const next = ensureQuests(user, now, rng)
  const quests = next.quests!
  if (quests.rerollUsed) throw new Error('Замена квеста уже использована сегодня.')
  const target = quests.quests.find(quest => quest.id === questId)
  if (!target) throw new Error('Такого квеста нет.')
  if (target.claimed) throw new Error('Этот квест уже выполнен.')

  const active = new Set<QuestKind>(quests.quests.map(quest => quest.kind))
  const options = QUEST_POOL.filter(spec => !active.has(spec.kind))
  const spec = takeRandom(options, rng)
  if (!spec) throw new Error('Не осталось квестов для замены.')

  return {
    ...next,
    quests: {
      ...quests,
      rerollUsed: true,
      quests: quests.quests.map(quest =>
        quest.id === questId ? makeQuest(spec) : quest,
      ),
    },
  }
}

export function addHistory(user: UserData, record: BattleRecord): UserData {
  return { ...user, history: [record, ...user.history].slice(0, 5) }
}
