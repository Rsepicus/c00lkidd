import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { availableSpecials, CHARACTERS, type Character } from './forsaken'
import type { Language } from './names'
import { skinById, skinLevel, skinUnlocked } from './skins'

export type QuestKind =
  | 'win_character'
  | 'ability'
  | 'damage'
  | 'play'
  | 'win_2v2'
  | 'win_random'
  | 'win_draft'
  | 'play_random_draft'

export type QuestBattleResult = {
  won: boolean
  characterNames: string[]
  abilityUses: number
  damage: number
  mode: '1x1' | '2x2'
  gameMode: 'classic' | 'random' | 'draft'
}

export type DailyQuest = {
  id: string
  kind: QuestKind
  character?: string
  target: number
  progress: number
  reward: number
  claimed: boolean
}

export type QuestProgress = {
  date: string
  quests: DailyQuest[]
  rerollUsed: boolean
}

export type WeeklyQuestKind =
  | 'wins'
  | 'play'
  | 'damage'
  | 'ability'
  | 'win_2v2'
  | 'win_random_draft'

export type WeeklyQuest = {
  week: string
  kind: WeeklyQuestKind
  target: number
  progress: number
  reward: number
  claimed: boolean
}

export type BattleRecord = {
  opponent: string
  result: 'win' | 'loss'
  coins: number
  at: number
}

export type CharacterStat = {
  wins: number
  losses: number
  xp: number
}

export type Cosmetics = {
  owned: string[]
  accent: string | null
  title: string | null
  customColor: string | null
}

export type BossRecord = {
  week: string
  bestDamage: number
  cleared: boolean
  wins: number
}

export type SurvivalBest = {
  wave: number
  character: string
  at: number
}

export type PvpFormat = '1x1' | '2x2'

export type PvpGameMode = 'classic' | 'random' | 'draft'

export type PvpSetup = {
  format: PvpFormat
  gameMode: PvpGameMode
  wager: number
}

export type UserData = {
  coins: number
  onboarded: boolean
  compactMode: boolean
  owned: string[]
  active: string | null
  partner: string | null
  wins: number
  losses: number
  lastBonus: number
  achievements: string[]
  streak: number
  bestStreak: number
  quests: QuestProgress | null
  weeklyQuest: WeeklyQuest | null
  boss: BossRecord | null
  survivalBest: SurvivalBest | null
  history: BattleRecord[]
  characterStats: Record<string, CharacterStat>
  masteryRewards: string[]
  equippedSkins: Record<string, string>
  trialClaimed: Record<string, number>
  cosmetics: Cosmetics
  loadouts: Record<string, string>
  language: Language
  lastPvp?: PvpSetup
}

export type Store = {
  users: Record<string, UserData>
}

export const STARTING_COINS = 500
export const DAILY_BONUS = 250
export const BONUS_COOLDOWN_MS = 24 * 60 * 60 * 1000
export const MAX_PVP_WAGER = 100_000

const DISCORD_USER_ID = /^\d{17,20}$/

export function isRealUserId(userId: string): boolean {
  return DISCORD_USER_ID.test(userId)
}

export function pruneSyntheticUsers(store: Store): boolean {
  let changed = false
  for (const userId of Object.keys(store.users)) {
    if (!isRealUserId(userId)) {
      delete store.users[userId]
      changed = true
    }
  }
  return changed
}

const FREE_CHARACTERS = ['Noob', 'Jason', 'Shedletsky', 'Elliot']

export function defaultUser(now = Date.now()): UserData {
  return {
    coins: STARTING_COINS,
    onboarded: false,
    compactMode: false,
    owned: [...FREE_CHARACTERS],
    active: 'Noob',
    partner: null,
    wins: 0,
    losses: 0,
    lastBonus: 0,
    achievements: [],
    streak: 0,
    bestStreak: 0,
    quests: null,
    weeklyQuest: null,
    boss: null,
    survivalBest: null,
    history: [],
    characterStats: {},
    masteryRewards: [],
    equippedSkins: {},
    trialClaimed: {},
    cosmetics: { owned: [], accent: null, title: null, customColor: null },
    loadouts: {},
    language: 'ru',
  }
}

const QUEST_KINDS: ReadonlySet<QuestKind> = new Set([
  'win_character',
  'ability',
  'damage',
  'play',
  'win_2v2',
  'win_random',
  'win_draft',
  'play_random_draft',
])

const WEEKLY_QUEST_KINDS: ReadonlySet<WeeklyQuestKind> = new Set([
  'wins',
  'play',
  'damage',
  'ability',
  'win_2v2',
  'win_random_draft',
])

const PVP_FORMATS: ReadonlySet<PvpFormat> = new Set(['1x1', '2x2'])

const PVP_GAME_MODES: ReadonlySet<PvpGameMode> = new Set(['classic', 'random', 'draft'])

function clampWager(wager: number): number {
  return Math.max(0, Math.min(MAX_PVP_WAGER, Math.floor(wager)))
}

function normalizeQuests(quests: unknown): QuestProgress | null {
  if (!quests || typeof quests !== 'object') return null
  const value = quests as Partial<QuestProgress>
  if (typeof value.date !== 'string' || !Array.isArray(value.quests)) return null

  const questsList = value.quests.filter((quest): quest is DailyQuest => {
    if (!quest || typeof quest !== 'object') return false
    const entry = quest as Partial<DailyQuest>
    return (
      typeof entry.id === 'string' &&
      typeof entry.kind === 'string' &&
      QUEST_KINDS.has(entry.kind as QuestKind) &&
      typeof entry.target === 'number' &&
      entry.target > 0 &&
      typeof entry.progress === 'number' &&
      typeof entry.reward === 'number' &&
      typeof entry.claimed === 'boolean'
    )
  })
  if (questsList.length === 0) return null

  return {
    date: value.date,
    quests: questsList.map(quest => ({
      ...quest,
      progress: Math.max(0, Math.min(quest.progress, quest.target)),
    })),
    rerollUsed: value.rerollUsed === true,
  }
}

function normalizeWeeklyQuest(value: unknown): WeeklyQuest | null {
  if (!value || typeof value !== 'object') return null
  const quest = value as Partial<WeeklyQuest>
  if (
    typeof quest.week !== 'string' ||
    typeof quest.kind !== 'string' ||
    !WEEKLY_QUEST_KINDS.has(quest.kind as WeeklyQuestKind) ||
    typeof quest.target !== 'number' ||
    quest.target <= 0 ||
    typeof quest.progress !== 'number' ||
    typeof quest.reward !== 'number' ||
    typeof quest.claimed !== 'boolean'
  ) {
    return null
  }
  return {
    week: quest.week,
    kind: quest.kind as WeeklyQuestKind,
    target: quest.target,
    progress: Math.max(0, Math.min(quest.progress, quest.target)),
    reward: quest.reward,
    claimed: quest.claimed,
  }
}

function normalizeLastPvp(value: unknown): PvpSetup | undefined {
  if (!value || typeof value !== 'object') return undefined
  const setup = value as Partial<PvpSetup>
  if (
    typeof setup.format !== 'string' ||
    !PVP_FORMATS.has(setup.format as PvpFormat) ||
    typeof setup.gameMode !== 'string' ||
    !PVP_GAME_MODES.has(setup.gameMode as PvpGameMode)
  ) {
    return undefined
  }
  return {
    format: setup.format as PvpFormat,
    gameMode: setup.gameMode as PvpGameMode,
    wager:
      typeof setup.wager === 'number' && Number.isFinite(setup.wager)
        ? clampWager(setup.wager)
        : 0,
  }
}

function normalizeHistory(history: unknown): BattleRecord[] {
  if (!Array.isArray(history)) return []
  return history
    .filter((record): record is BattleRecord => {
      if (!record || typeof record !== 'object') return false
      const value = record as Partial<BattleRecord>
      return (
        typeof value.opponent === 'string' &&
        (value.result === 'win' || value.result === 'loss') &&
        typeof value.coins === 'number' &&
        typeof value.at === 'number'
      )
    })
    .slice(0, 5)
}

function normalizeCharacterStats(stats: unknown): Record<string, CharacterStat> {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return {}
  const result: Record<string, CharacterStat> = {}
  for (const [name, value] of Object.entries(stats)) {
    if (!value || typeof value !== 'object') continue
    const stat = value as Partial<CharacterStat>
    if (
      typeof stat.wins !== 'number' ||
      typeof stat.losses !== 'number' ||
      typeof stat.xp !== 'number'
    ) {
      continue
    }
    result[name] = { wins: stat.wins, losses: stat.losses, xp: stat.xp }
  }
  return result
}

function normalizeTrialClaimed(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, tier]) => typeof tier === 'number' && Number.isFinite(tier))
      .map(([name, tier]) => [name, Math.max(0, Math.min(3, Math.floor(tier as number)))]),
  )
}

function normalizeLoadouts(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, special]) => typeof special === 'string'),
  ) as Record<string, string>
}

function normalizeBoss(value: unknown): BossRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<BossRecord>
  if (
    typeof record.week !== 'string' ||
    typeof record.bestDamage !== 'number' ||
    typeof record.cleared !== 'boolean' ||
    typeof record.wins !== 'number'
  ) {
    return null
  }
  return {
    week: record.week,
    bestDamage: record.bestDamage,
    cleared: record.cleared,
    wins: record.wins,
  }
}

function normalizeSurvivalBest(value: unknown): SurvivalBest | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<SurvivalBest>
  if (
    typeof record.wave !== 'number' ||
    !Number.isFinite(record.wave) ||
    record.wave < 1 ||
    typeof record.character !== 'string' ||
    record.character.trim() === '' ||
    typeof record.at !== 'number' ||
    !Number.isFinite(record.at) ||
    record.at < 0
  ) {
    return null
  }
  const wave = Math.floor(record.wave)
  if (wave < 1) return null
  return {
    wave,
    character: record.character,
    at: record.at,
  }
}

function normalizeCosmetics(value: unknown): Cosmetics {
  const cosmetics: Partial<Cosmetics> =
    value && typeof value === 'object' ? (value as Partial<Cosmetics>) : {}
  return {
    owned: Array.isArray(cosmetics.owned)
      ? cosmetics.owned.filter((id): id is string => typeof id === 'string')
      : [],
    accent: typeof cosmetics.accent === 'string' ? cosmetics.accent : null,
    title: typeof cosmetics.title === 'string' ? cosmetics.title : null,
    customColor: typeof cosmetics.customColor === 'string' ? cosmetics.customColor : null,
  }
}

function normalizeEquippedSkins(
  value: unknown,
  owned: string[],
  characterStats: Record<string, CharacterStat>,
): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const skins: Record<string, string> = {}
  for (const [character, id] of Object.entries(value as Record<string, unknown>)) {
    if (!owned.includes(character) || typeof id !== 'string') continue
    const skin = skinById(id)
    if (!skin || skin.character !== character) continue
    const xp = characterStats[character]?.xp ?? 0
    if (skinLevel(xp) < skin.level) continue
    skins[character] = id
  }
  return skins
}

export function normalizeUser(user: Partial<UserData>): UserData {
  const base = defaultUser()
  const owned = [...new Set([...(user.owned ?? base.owned), ...FREE_CHARACTERS])]
  const active = user.active === undefined ? base.active : user.active
  const partner =
    typeof user.partner === 'string' &&
    owned.includes(user.partner) &&
    user.partner !== active
      ? user.partner
      : null
  const characterStats = normalizeCharacterStats(user.characterStats)
  return {
    coins: user.coins ?? base.coins,
    onboarded: user.onboarded === true,
    compactMode: user.compactMode === true,
    owned,
    active,
    partner,
    wins: user.wins ?? base.wins,
    losses: user.losses ?? base.losses,
    lastBonus: user.lastBonus ?? base.lastBonus,
    achievements: user.achievements ?? base.achievements,
    streak: user.streak ?? base.streak,
    bestStreak: user.bestStreak ?? base.bestStreak,
    quests: normalizeQuests(user.quests),
    weeklyQuest: normalizeWeeklyQuest(user.weeklyQuest),
    boss: normalizeBoss(user.boss),
    survivalBest: normalizeSurvivalBest(user.survivalBest),
    history: normalizeHistory(user.history),
    characterStats,
    masteryRewards: Array.isArray(user.masteryRewards)
      ? user.masteryRewards.filter((entry): entry is string => typeof entry === 'string')
      : [],
    equippedSkins: normalizeEquippedSkins(user.equippedSkins, owned, characterStats),
    trialClaimed: normalizeTrialClaimed(user.trialClaimed),
    cosmetics: normalizeCosmetics(user.cosmetics),
    loadouts: normalizeLoadouts(user.loadouts),
    language: user.language === 'en' ? 'en' : 'ru',
    lastPvp: normalizeLastPvp(user.lastPvp),
  }
}

export function wagerAllowed(user: UserData, amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0 && user.coins >= amount
}

export function getUser(store: Store, userId: string, now = Date.now()): UserData {
  return store.users[userId] ?? defaultUser(now)
}

export function buyCharacter(user: UserData, character: Character): UserData {
  if (user.owned.includes(character.name)) {
    throw new Error('Этот персонаж уже куплен.')
  }
  if (FREE_CHARACTERS.includes(character.name)) {
    throw new Error('Этот персонаж доступен изначально.')
  }
  if (user.coins < character.price) {
    throw new Error(`Не хватает монет: нужно ${character.price}, у тебя ${user.coins}.`)
  }
  return {
    ...user,
    coins: user.coins - character.price,
    owned: [...user.owned, character.name],
    active: user.active ?? character.name,
  }
}

export function ownedCharacters(user: UserData): Character[] {
  return CHARACTERS.filter(character => user.owned.includes(character.name))
}

export function purchasableCharacters(user: UserData): Character[] {
  return CHARACTERS.filter(character => !user.owned.includes(character.name))
}

export function grantCoins(user: UserData, amount: number): UserData {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Сумма должна быть положительной.')
  }
  return { ...user, coins: user.coins + amount }
}

export function setLanguage(user: UserData, language: Language): UserData {
  return { ...user, language }
}

export function setLastPvp(user: UserData, setup: PvpSetup): UserData {
  if (!PVP_FORMATS.has(setup.format)) throw new Error('Неверный формат PvP.')
  if (!PVP_GAME_MODES.has(setup.gameMode)) throw new Error('Неверный режим игры.')
  if (!Number.isFinite(setup.wager)) throw new Error('Ставка должна быть числом.')
  return {
    ...user,
    lastPvp: {
      format: setup.format,
      gameMode: setup.gameMode,
      wager: clampWager(setup.wager),
    },
  }
}

export function setLoadout(
  user: UserData,
  characterName: string,
  specialName: string,
): UserData {
  const character = CHARACTERS.find(entry => entry.name === characterName)
  if (!character) throw new Error('Такого персонажа нет.')
  if (!user.owned.includes(characterName)) throw new Error('Сначала купи этого персонажа.')
  if (!availableSpecials(character).some(special => special.name === specialName)) {
    throw new Error('У этого персонажа нет такой способности.')
  }
  return {
    ...user,
    loadouts: { ...user.loadouts, [characterName]: specialName },
  }
}

export function setEquippedSkin(
  user: UserData,
  characterName: string,
  skinId: string | null,
): UserData {
  const equippedSkins = { ...user.equippedSkins }
  if (skinId === null) {
    delete equippedSkins[characterName]
    return { ...user, equippedSkins }
  }
  if (!user.owned.includes(characterName)) {
    throw new Error('Сначала купи этого персонажа.')
  }
  const skin = skinById(skinId)
  if (!skin || skin.character !== characterName) {
    throw new Error('Такого скина нет.')
  }
  const xp = user.characterStats[characterName]?.xp ?? 0
  if (!skinUnlocked(characterName, xp, skinId)) {
    throw new Error('Скин ещё не открыт.')
  }
  equippedSkins[characterName] = skinId
  return { ...user, equippedSkins }
}

export function setActive(user: UserData, characterName: string): UserData {
  if (!user.owned.includes(characterName)) {
    throw new Error('Сначала купи этого персонажа.')
  }
  return {
    ...user,
    active: characterName,
    partner: user.partner === characterName ? null : user.partner,
  }
}

export function setPartner(user: UserData, characterName: string | null): UserData {
  if (characterName === null) return { ...user, partner: null }
  if (!user.owned.includes(characterName)) {
    throw new Error('Сначала купи этого персонажа.')
  }
  if (characterName === user.active) {
    throw new Error('Напарник должен отличаться от активного персонажа.')
  }
  return { ...user, partner: characterName }
}

export function claimDailyBonus(user: UserData, now = Date.now()): UserData {
  const elapsed = now - user.lastBonus
  if (user.lastBonus !== 0 && elapsed < BONUS_COOLDOWN_MS) {
    throw new Error(`Бонус уже получен. Следующий через ${formatDuration(BONUS_COOLDOWN_MS - elapsed)}.`)
  }
  return { ...user, coins: user.coins + DAILY_BONUS, lastBonus: now }
}

export function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 0) return `${hours} ч ${minutes} мин`
  return `${Math.max(1, minutes)} мин`
}

export function loadStore(path: string): Store {
  if (!existsSync(path)) return { users: {} }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Store
    if (!parsed || typeof parsed !== 'object' || !parsed.users) return { users: {} }
    const users = Object.fromEntries(
      Object.entries(parsed.users).map(([id, user]) => [id, normalizeUser(user)]),
    )
    return { users }
  } catch {
    return { users: {} }
  }
}

export function saveStore(path: string, store: Store): void {
  const tempPath = `${path}.tmp`
  writeFileSync(tempPath, JSON.stringify(store, null, 2))
  renameSync(tempPath, path)
}
