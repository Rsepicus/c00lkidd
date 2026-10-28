import {
  ActionRowBuilder,
  ActivityType,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type APISelectMenuOption,
  type AutocompleteInteraction,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type PresenceData,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from 'discord.js'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseBossAction, chooseBotTurn, type BotDecision } from './ai'
import { ARENA_BATTLES, runLlmArena, type ArenaResult } from './arena'
import { localLlmStatus, startLocalLlm } from './local-llm'
import {
  choosePolicyTurn,
  policyAiEnabled,
  policyAvailable,
  policyWeightsPath,
} from './policy'
import {
  chooseLlmTurn,
  importLlmEnv,
  llmAiEnabled,
  llmDebugEnabled,
  llmHybridEnabled,
  llmLikelyAvailable,
  llmStats,
  noteLlmTurn,
  warmLlmModel,
} from './llm-ai'
import { simulateBalance, type BalanceSimulation } from './balance'
import {
  loadBattleState,
  saveBattleState,
  type BattleSnapshot,
} from './battle-state'
import { backupDataFiles } from './backups'
import {
  recordSurvivalBest,
  survivalClearedWaves,
  survivalEnemyStats,
  survivalHeal,
  survivalReward,
  topSurvivalRecords,
} from './survival'
import { appendErrorLog } from './errors'
import {
  BOSS_FIRST_CLEAR_BONUS,
  BOSS_WIN_REWARD,
  bossCharacterForDay,
  bossForDay,
  bossForWeek,
  isoDayKey,
  isoWeekKey,
  recordBossResult,
  type BossMode,
} from './boss'
import {
  BOSS_RUSH_STAGES,
  advanceBossRush,
  bossRushBoss,
  bossRushReward,
  bossRushSummary,
  createBossRush,
  type BossRushRun,
} from './boss-rush'
import {
  TOWER_FLOORS,
  TOWER_UPGRADES,
  advanceTowerRun,
  applyTowerUpgrades,
  createTowerBattle,
  createTowerRun,
  towerFloor,
  towerReward,
  towerRewardMultiplier,
  towerRunSummary,
  towerUpgradeChoices,
  type TowerRun,
  type TowerUpgradeId,
} from './tower'
import {
  TRIALS,
  checkTrialResult,
  claimTrialResult,
  createTrialBattle,
  trialClaimKey,
  trialProgress,
  trialResultFromBattle,
  type Trial,
} from './trials'
import {
  buyCosmetic,
  clearCosmetics,
  COSMETICS,
  cosmeticById,
  equippedTitleItem,
  equipCosmetic,
  normalizeHexColor,
  profileAccent,
  setCustomColor,
  type Cosmetic,
} from './cosmetics'
import {
  abilityEmojiData,
  abilityEmojiText,
  attackEmojiData,
  characterEmoji,
  characterEmojiData,
  characterLabel,
  emojiData,
  emojiTag,
  emojiText,
  skinnedCharacterLabel,
} from './emoji'
import {
  equippedSkin,
  nextSkin,
  skinById,
  skinDescription,
  skinName,
  skinsFor,
  unlockedSkins,
  type Skin,
} from './skins'
import {
  availableSpecials,
  CHARACTERS,
  KILLERS,
  SURVIVORS,
  characterByName,
  characterClass,
  characterPassive,
  characterWithSpecial,
  randomBattleCharacters,
  randomCharacter,
  selectedSpecial,
  type Character,
  type Passive,
  type Special,
} from './forsaken'
import {
  ACHIEVEMENTS,
  abilityXp,
  addHistory,
  applyCharacterTrial,
  applyQuestBattle,
  ensureQuests,
  ensureWeeklyQuest,
  evaluateAchievements,
  favoriteCharacter,
  MASTERY_MAX_XP,
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
  TRIAL_TIERS,
  trialTitleForWins,
  weeklyQuestName,
} from './progress'
import {
  activeLanguage,
  localizeComponentJSON,
  localizeEmbedJSON,
  localizeOptions,
  setActiveLanguage,
  translateText,
  withLanguage,
} from './i18n'
import { atropaDescription, passiveDescription, specialDescription } from './names'
import { createDmBattle, dmMatchTurnUserId, takeDmPair } from './matchmaking'
import {
  applyLoadoutPreset,
  deleteLoadoutPreset,
  MAX_PRESETS,
  orderCharactersByFavorites,
  saveLoadoutPreset,
  toggleFavorite,
} from './loadouts'
import {
  addRottenMinion,
  batteryDodgeBonusOf,
  canUseSpecialNow,
  cooldownAfterTick,
  createBattle,
  createTeamBattle,
  JUKE_STANCE_BONUS,
  jukeBonusOf,
  jukeChanceOf,
  purifiedReduction,
  specialCooldown,
  specialLabel,
  specialNeedsAllyTarget,
  specialNeedsEnemyTarget,
  specialOf,
  surrender,
  takeTurn,
  type Action,
  type Battle,
  type BattleMode,
  type FighterEntry,
  type RottenCorpse,
  type Side,
  type StatusName,
} from './pvp'
import {
  BONUS_COOLDOWN_MS,
  buyCharacter,
  claimDailyBonus,
  DAILY_BONUS,
  defaultUser,
  formatDuration,
  getUser,
  grantCoins,
  isRealUserId,
  loadStore,
  ownedCharacters,
  pruneSyntheticUsers,
  purchasableCharacters,
  saveStore,
  setActive,
  setEquippedSkin,
  setLanguage,
  setLastPvp,
  setLoadout,
  setPartner,
  wagerAllowed,
  type LoadoutPreset,
  type Store,
  type UserData,
} from './store'

const originalEmbedToJSON = EmbedBuilder.prototype.toJSON
EmbedBuilder.prototype.toJSON = function (this: EmbedBuilder) {
  return localizeEmbedJSON(originalEmbedToJSON.call(this), activeLanguage())
}

const originalButtonToJSON = ButtonBuilder.prototype.toJSON
ButtonBuilder.prototype.toJSON = function (this: ButtonBuilder) {
  return localizeComponentJSON(originalButtonToJSON.call(this), activeLanguage())
}

const originalSelectToJSON = StringSelectMenuBuilder.prototype.toJSON
StringSelectMenuBuilder.prototype.toJSON = function (this: StringSelectMenuBuilder) {
  return localizeComponentJSON(originalSelectToJSON.call(this), activeLanguage())
}

const originalTextInputToJSON = TextInputBuilder.prototype.toJSON
TextInputBuilder.prototype.toJSON = function (this: TextInputBuilder) {
  return localizeComponentJSON(originalTextInputToJSON.call(this), activeLanguage())
}

const originalModalToJSON = ModalBuilder.prototype.toJSON
ModalBuilder.prototype.toJSON = function (this: ModalBuilder) {
  return localizeComponentJSON(originalModalToJSON.call(this), activeLanguage())
}

const originalRowToJSON = ActionRowBuilder.prototype.toJSON
ActionRowBuilder.prototype.toJSON = function (this: ActionRowBuilder) {
  return localizeComponentJSON(originalRowToJSON.call(this), activeLanguage())
}

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), 'data.json')
const ERROR_LOG_PATH = join(dirname(fileURLToPath(import.meta.url)), 'errors.log')
const BATTLE_STATE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'battles.json')
const OWNER_ID = '598861089916321802'

const EMBED_COLORS = {
  profile: 0x8b1e1e,
  shop: 0xd4a017,
  choose: 0xb3001b,
  battle: 0xb3001b,
  victory: 0x2e7d32,
}

export type PvpMode = 'classic' | 'random' | 'draft'

type Challenge = {
  challengerId: string
  challengerName: string
  opponentId: string
  wager: number
  mode: BattleMode
  gameMode: PvpMode
  bestOf: 1 | 3 | 5
}

type OpenChallenge = {
  creatorId: string
  creatorName: string
  wager: number
  mode: BattleMode
  createdAt: number
  gameMode: PvpMode
  bestOf: 1 | 3 | 5
}

type PvpSetup = {
  ownerId: string
  ownerName: string
  opponentId?: string
  format: BattleMode
  gameMode: PvpMode
  wager: number
  bestOf: 1 | 3 | 5
  createdAt: number
}

type DuelSeries = {
  messageId: string
  channelId: string
  challengerId: string
  challengerName: string
  opponentId: string
  opponentName: string
  bestOf: 3 | 5
  wins: [number, number]
  round: number
  challengerTeam: 0 | 1
  wager: number
  finished: boolean
}

type TrainingSetup = {
  ownerId: string
  mode: BattleMode
  botCharacter?: string
  botAbility?: string
  botPartner?: string
  botPartnerAbility?: string
  playerCharacter?: string
  playerAbility?: string
  partner?: string
  partnerAbility?: string
  page?: 'player' | 'enemies'
}

type DebugTestSetup = {
  ownerId: string
  mode: BattleMode
  character?: string
  special?: string
  battlesPerPair?: number
}

const DEBUG_BATTLES_OPTIONS = [5, 10, 30, 50, 100, 200] as const
const DEBUG_BATTLES_DEFAULT = 30

type SurvivalRun = {
  messageId: string
  channelId: string
  userId: string
  name: string
  character: Character
  wave: number
  hp: number
  maxHp: number
  reward: number
  rottenCorpses?: RottenCorpse[]
  minions?: Array<{ name: string; hp: number; maxHp: number; attack: number }>
}

type DraftPlayer = {
  userId: string
  name: string
  bans: string[]
  picks: string[]
  chosen: string[]
  abilities: Record<string, string>
}

export type DraftState = {
  messageId: string
  channelId: string
  format: BattleMode
  wager: number
  pool: Character[]
  players: [DraftPlayer, DraftPlayer]
  phase: 'ban' | 'pick' | 'choose' | 'ability'
  turn: 0 | 1
  banIndex: number
  pickIndex: number
  pickOrder: number[]
  chooseIndex: number
  abilityIndex: number
  createdAt: number
}

type CoopBossInvite = {
  creatorId: string
  creatorName: string
  week: string
  createdAt: number
  targetId?: string
}

type DmMatchPlayer = {
  userId: string
  name: string
  channelId: string
  messageId: string
}

type DmMatch = {
  id: string
  battle: Battle
  players: [DmMatchPlayer, DmMatchPlayer]
  ping: { userId: string; channelId: string; messageId: string } | null
}

const dmQueue: string[] = []
const dmMatches = new Map<string, DmMatch>()
const dmMatchByUser = new Map<string, string>()
let dmMatchCounter = 0

const challenges = new Map<string, Challenge>()
const openChallenges = new Map<string, OpenChallenge>()
const pvpSetups = new Map<string, PvpSetup>()
const duels = new Map<string, DuelSeries>()
const pveOwners = new Map<string, string>()
const trainingSetups = new Map<string, TrainingSetup>()
const bossRushRuns = new Map<string, { ownerId: string; run: BossRushRun }>()
const towerRuns = new Map<string, { ownerId: string; run: TowerRun }>()
const trialRuns = new Map<string, { ownerId: string; trialId: string }>()
const debugTests = new Map<string, DebugTestSetup>()
const survivalRuns = new Map<string, SurvivalRun>()
const drafts = new Map<string, DraftState>()
const draftTimers = new Map<string, ReturnType<typeof setTimeout>>()
const coopBossInvites = new Map<string, CoopBossInvite>()
const coopBossFinishes = new Map<
  string,
  { players: Array<{ id: string; name: string }>; week: string }
>()
const battles = new Map<string, Battle>()
const battleLogs = new Map<string, string[]>()
const wagers = new Map<string, number>()
const trainingBattles = new Set<string>()
const battleGameModes = new Map<string, PvpMode>()
const bossBattles = new Map<
  string,
  { mode: BossMode; week: string; day?: string; coop?: boolean }
>()
const battleChannels = new Map<string, string>()
const battleDeadlines = new Map<string, number>()
const battleTimers = new Map<string, ReturnType<typeof setTimeout>>()
const timeoutStrikes = new Map<string, Map<string, number>>()

export const BATTLE_TURN_MS = 90_000
export const TIMEOUT_STRIKES_TO_LOSE = 2
export const OPEN_CHALLENGE_TTL = 30 * 60 * 1000

type PersistedBattleState = {
  version: 1
  battles: Array<[string, Battle]>
  logs: Array<[string, string[]]>
  wagers: Array<[string, number]>
  training: string[]
  gameModes: Array<[string, PvpMode]>
  boss: Array<[string, { mode: BossMode; week: string; day?: string; coop?: boolean }]>
  bossRush?: Array<[string, { ownerId: string; run: BossRushRun }]>
  tower?: Array<[string, { ownerId: string; run: TowerRun }]>
  trials?: Array<[string, { ownerId: string; trialId: string }]>
  channels: Array<[string, string]>
  deadlines: Array<[string, number]>
  strikes: Array<[string, Array<[string, number]>]>
  pending: Array<[string, PendingTarget]>
  survival: Array<[string, SurvivalRun]>
  duels: Array<[string, DuelSeries]>
}

function snapshotEntries<T>(value: unknown): Array<[string, T]> {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is [string, T] =>
          Array.isArray(entry) && typeof entry[0] === 'string',
      )
    : []
}

function serializeBattleState(): PersistedBattleState {
  return {
    version: 1,
    battles: [...battles.entries()],
    logs: [...battleLogs.entries()],
    wagers: [...wagers.entries()],
    training: [...trainingBattles],
    gameModes: [...battleGameModes.entries()],
    boss: [...bossBattles.entries()],
    bossRush: [...bossRushRuns.entries()],
    tower: [...towerRuns.entries()],
    trials: [...trialRuns.entries()],
    channels: [...battleChannels.entries()],
    deadlines: [...battleDeadlines.entries()],
    strikes: [...timeoutStrikes.entries()].map(([id, strikes]) => [id, [...strikes.entries()]]),
    pending: [...pendingTargets.entries()],
    survival: [...survivalRuns.entries()],
    duels: [...duels.entries()],
  }
}

function persistBattleState(): void {
  try {
    saveBattleState(BATTLE_STATE_PATH, serializeBattleState())
  } catch (error) {
    appendErrorLog(ERROR_LOG_PATH, error, 'battle-state')
  }
}

function restoreBattleState(snapshot: BattleSnapshot, client: Client): void {
  if (snapshot.version !== 1) return
  const state = snapshot as unknown as PersistedBattleState
  battles.clear()
  battleLogs.clear()
  wagers.clear()
  trainingBattles.clear()
  battleGameModes.clear()
  bossBattles.clear()
  bossRushRuns.clear()
  towerRuns.clear()
  trialRuns.clear()
  lastTurnPingUser.clear()
  battleChannels.clear()
  battleDeadlines.clear()
  timeoutStrikes.clear()
  pendingTargets.clear()
  survivalRuns.clear()
  duels.clear()

  for (const [id, battle] of snapshotEntries<Battle>(state.battles)) {
    if (!battle || typeof battle !== 'object' || !Array.isArray(battle.sides)) continue
    battles.set(id, battle)
  }
  for (const [id, log] of snapshotEntries<string[]>(state.logs)) battleLogs.set(id, log)
  for (const [id, wager] of snapshotEntries<number>(state.wagers)) wagers.set(id, wager)
  for (const id of Array.isArray(state.training) ? state.training : []) trainingBattles.add(id)
  for (const [id, mode] of snapshotEntries<PvpMode>(state.gameModes)) battleGameModes.set(id, mode)
  for (const [id, boss] of snapshotEntries<{
    mode: BossMode
    week: string
    day?: string
    coop?: boolean
  }>(state.boss)) {
    bossBattles.set(id, boss)
  }
  for (const [id, stateRun] of snapshotEntries<{ ownerId: string; run: BossRushRun }>(
    state.bossRush,
  )) {
    if (
      stateRun &&
      typeof stateRun === 'object' &&
      typeof stateRun.ownerId === 'string' &&
      stateRun.run &&
      typeof stateRun.run === 'object'
    ) {
      bossRushRuns.set(id, stateRun)
    }
  }
  for (const [id, stateRun] of snapshotEntries<{ ownerId: string; run: TowerRun }>(
    state.tower,
  )) {
    if (
      stateRun &&
      typeof stateRun === 'object' &&
      typeof stateRun.ownerId === 'string' &&
      stateRun.run &&
      typeof stateRun.run === 'object'
    ) {
      towerRuns.set(id, stateRun)
    }
  }
  for (const [id, stateRun] of snapshotEntries<{ ownerId: string; trialId: string }>(
    state.trials,
  )) {
    if (
      stateRun &&
      typeof stateRun === 'object' &&
      typeof stateRun.ownerId === 'string' &&
      typeof stateRun.trialId === 'string'
    ) {
      trialRuns.set(id, stateRun)
    }
  }
  for (const [id, channel] of snapshotEntries<string>(state.channels)) battleChannels.set(id, channel)
  for (const [id, deadline] of snapshotEntries<number>(state.deadlines)) {
    battleDeadlines.set(id, deadline)
  }
  for (const [id, strikes] of snapshotEntries<Array<[string, number]>>(state.strikes)) {
    timeoutStrikes.set(
      id,
      new Map(Array.isArray(strikes) ? strikes : []),
    )
  }
  for (const [id, target] of snapshotEntries<PendingTarget>(state.pending)) {
    if (target && typeof target === 'object') pendingTargets.set(id, target)
  }
  for (const [id, run] of snapshotEntries<SurvivalRun>(state.survival)) {
    if (run && typeof run === 'object') survivalRuns.set(id, run)
  }
  for (const [id, duel] of snapshotEntries<DuelSeries>(state.duels)) {
    if (duel && typeof duel === 'object') duels.set(id, duel)
  }

  for (const [id, battle] of battles) {
    if (battle.finished) continue
    if (isPveBattle(id)) {
      battleDeadlines.delete(id)
      continue
    }
    const deadline = battleDeadlines.get(id)
    const remaining = deadline ? Math.max(1000, deadline - Date.now()) : BATTLE_TURN_MS
    if (!deadline) battleDeadlines.set(id, Date.now() + remaining)
    const timer = setTimeout(() => {
      void handleBattleTimeout(client, id)
    }, remaining)
    timer.unref?.()
    battleTimers.set(id, timer)
  }
  persistBattleState()
}

export function timeoutForfeits(strikes: number): boolean {
  return strikes >= TIMEOUT_STRIKES_TO_LOSE
}
type PendingTarget = {
  userId: string
  action: Action
  turn: number
  targets: number[]
}
const pendingTargets = new Map<string, PendingTarget>()
// One action per battle at a time: an LLM turn can hold the resolve open for
// seconds, and a second click during that window would replay the same turn.
const battleActionLocks = new Set<string>()
const hubOwners = new Map<string, string>()
type CharacterFilter = 'all' | 'owned'
const characterFilters = new Map<string, CharacterFilter>()
const finishedBattles = new Map<
  string,
  {
    players: Array<{ userId: string; name: string }>
    wager: number
    mode: BattleMode
    gameMode: PvpMode
  }
>()
const userInteractionTokens = new Map<
  string,
  Map<string, { applicationId: string; token: string; at: number }>
>()
const INTERACTION_TOKEN_TTL = 14 * 60 * 1000
const turnPings = new Map<
  string,
  { applicationId: string; token: string; messageId: string; channelId: string; at: number }
>()
const lastTurnPingUser = new Map<string, string>()
export let store: Store = { users: {} }

export function parseToken(contents: string): string {
  for (const line of contents.split('\n')) {
    const match = line.match(/^DISCORD_BOT_TOKEN=(.*)$/)
    if (!match) continue
    const token = match[1].trim()
    if (token) return token
    break
  }
  throw new Error('DISCORD_BOT_TOKEN is missing in the .env file')
}

export function resolveToken(
  envToken: string | undefined,
  fileContents: string | null,
): string {
  const fromEnv = envToken?.trim()
  if (fromEnv) return fromEnv
  if (fileContents === null) {
    throw new Error('DISCORD_BOT_TOKEN is missing in the environment and .env file')
  }
  return parseToken(fileContents)
}

export function botPresence(): PresenceData {
  return {
    status: 'online',
    activities: [{ name: 'Forsaken Simulator · /пве', type: ActivityType.Playing }],
  }
}

export function challengeText(
  challengerName: string,
  opponentId: string,
  gameMode: PvpMode = 'classic',
): string {
  const kind = gameMode === 'random' ? 'случайный бой' : gameMode === 'draft' ? 'драфт' : 'бой'
  return `**${challengerName}** вызывает <@${opponentId}> на ${kind} Forsaken Simulator!`
}

export function challengeEmbed(
  challengerName: string,
  opponentId: string,
  wager = 0,
  mode: BattleMode = '1x1',
  gameMode: PvpMode = 'classic',
  bestOf: 1 | 3 | 5 = 1,
): EmbedBuilder {
  const stake =
    wager > 0 ? `\n\nСтавка: **${wager}** ${emojiText('points', '🪙')}` : ''
  const format =
    mode === '2x2' ? 'Формат: **2 на 2** — по два персонажа.' : 'Формат: **1 на 1**.'
  const modeNote =
    gameMode === 'random'
      ? '\n\nПерсонажи и способности выпадут при принятии.'
      : gameMode === 'draft'
        ? '\n\nОбщий пул: баны и пики.'
        : ''
  const title =
    gameMode === 'random'
      ? 'Случайный вызов'
      : gameMode === 'draft'
        ? 'Драфт-вызов'
        : 'Вызов на бой'
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('swordwhite', '⚔️')} ${title}`)
    .setDescription(
      `${challengeText(challengerName, opponentId, gameMode)}${stake}${modeNote}\n\n${format}`,
    )
}

export function challengeReplyOptions(
  challengerName: string,
  opponentId: string,
  wager = 0,
  mode: BattleMode = '1x1',
  gameMode: PvpMode = 'classic',
  bestOf: 1 | 3 | 5 = 1,
) {
  return {
    content: `<@${opponentId}>`,
    embeds: [challengeEmbed(challengerName, opponentId, wager, mode, gameMode, bestOf)],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('pvp:accept').setLabel('Принять').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pvp:decline').setLabel('Отклонить').setStyle(ButtonStyle.Secondary),
      ),
    ],
    allowedMentions: { users: [opponentId] },
  }
}

export function openChallengeEmbed(
  creatorName: string,
  wager = 0,
  mode: BattleMode = '1x1',
  gameMode: PvpMode = 'classic',
  bestOf: 1 | 3 | 5 = 1,
): EmbedBuilder {
  const stake =
    wager > 0 ? `\n\nСтавка: **${wager}** ${emojiText('points', '🪙')}` : ''
  const format =
    mode === '2x2' ? 'Формат: **2 на 2** — по два персонажа.' : 'Формат: **1 на 1**.'
  const modeNote =
    gameMode === 'random'
      ? '\n\nПерсонажи и способности выпадут при принятии.'
      : gameMode === 'draft'
        ? '\n\nОбщий пул: баны и пики.'
        : ''
  const title = gameMode === 'random' ? 'Случайный вызов' : gameMode === 'draft' ? 'Драфт-вызов' : 'Открытый вызов'
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('swordwhite', '⚔️')} ${title}`)
    .setDescription(
      `**${creatorName}** ищет соперника. Принять может любой.${stake}${modeNote}\n\n${format}`,
    )
}

export function openChallengeComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('pvp:open:accept')
        .setLabel('Согласиться')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pvp:open:cancel')
        .setLabel('Отменить')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export const PVP_MODE_LABELS: Record<PvpMode, string> = {
  classic: 'Классика',
  random: 'Рандом',
  draft: 'Драфт',
}

export function pvpSetupEmbed(setup: PvpSetup): EmbedBuilder {
  const opponent = setup.opponentId
    ? `<@${setup.opponentId}>`
    : 'открытый вызов — принять может любой'
  const stake =
    setup.wager > 0
      ? `**${setup.wager}** ${emojiText('points', '🪙')}`
      : 'без ставки'
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('swordwhite', '⚔️')} Настройка PvP`)
    .setDescription(
      `**Создаёт:** ${setup.ownerName}\n` +
        `**Формат:** ${setup.format === '2x2' ? '2 на 2' : '1 на 1'}\n` +
        `**Режим:** ${PVP_MODE_LABELS[setup.gameMode]}\n` +
        `**Ставка:** ${stake}\n` +
        `**Соперник:** ${opponent}`,
    )
}

export function pvpSetupComponents(
  setup: PvpSetup,
): Array<
  ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>
> {
  const sword = emojiData('swordwhite')
  const duo = emojiData('duo')
  const question = emojiData('question')
  const abilities = emojiData('abilities')
  const points = emojiData('points')
  const check = emojiData('check')
  const cross = emojiData('cross')
  const format = new StringSelectMenuBuilder()
    .setCustomId('pvp:setup:format')
    .setPlaceholder('Формат боя')
    .addOptions(
      {
        label: '1 на 1',
        value: '1x1',
        default: setup.format === '1x1',
        ...(sword ? { emoji: sword } : {}),
      },
      {
        label: '2 на 2',
        value: '2x2',
        default: setup.format === '2x2',
        ...(duo ? { emoji: duo } : {}),
      },
    )
  const mode = new StringSelectMenuBuilder()
    .setCustomId('pvp:setup:mode')
    .setPlaceholder('Режим боя')
    .addOptions(
      {
        label: 'Классика',
        value: 'classic',
        default: setup.gameMode === 'classic',
        ...(sword ? { emoji: sword } : {}),
      },
      {
        label: 'Рандом',
        value: 'random',
        default: setup.gameMode === 'random',
        ...(question ? { emoji: question } : {}),
      },
      {
        label: 'Драфт',
        value: 'draft',
        default: setup.gameMode === 'draft',
        ...(abilities ? { emoji: abilities } : {}),
      },
    )
  const series = new StringSelectMenuBuilder()
    .setCustomId('pvp:setup:series')
    .setPlaceholder('Серия')
    .addOptions([
      {
        label: 'Обычный бой',
        value: 'single',
        default: setup.bestOf === 1,
        ...(sword ? { emoji: sword } : {}),
      },
      {
        label: 'До 2 побед (Bo3)',
        value: 'bo3',
        default: setup.bestOf === 3,
        ...(sword ? { emoji: sword } : {}),
      },
      {
        label: 'До 3 побед (Bo5)',
        value: 'bo5',
        default: setup.bestOf === 5,
        ...(sword ? { emoji: sword } : {}),
      },
    ])
  const wager = new ButtonBuilder()
    .setCustomId('pvp:setup:wager')
    .setLabel(`Ставка: ${setup.wager}`)
    .setStyle(ButtonStyle.Secondary)
  if (points) wager.setEmoji(points)
  const create = new ButtonBuilder()
    .setCustomId('pvp:setup:create')
    .setLabel('Создать вызов')
    .setStyle(ButtonStyle.Success)
  if (check) create.setEmoji(check)
  const cancel = new ButtonBuilder()
    .setCustomId('pvp:setup:cancel')
    .setLabel('Отмена')
    .setStyle(ButtonStyle.Secondary)
  if (cross) cancel.setEmoji(cross)
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(wager, create, cancel)
  const global = new ButtonBuilder()
    .setCustomId('pvp:global')
    .setLabel('Глобальный поиск')
    .setStyle(ButtonStyle.Primary)
  if (sword) global.setEmoji(sword)
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(format),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(mode),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(series),
    row,
    new ActionRowBuilder<ButtonBuilder>().addComponents(global),
  ]
}

function userOf(userId: string): UserData {
  const user = store.users[userId] ?? defaultUser()
  store.users[userId] = user
  return user
}

function persist(): void {
  saveStore(DATA_PATH, store)
}

function rememberPveOwner(messageId: string, userId: string): void {
  if (pveOwners.size >= 500) {
    const oldest = pveOwners.keys().next().value
    if (oldest) pveOwners.delete(oldest)
  }
  pveOwners.set(messageId, userId)
}

function activeCharacter(user: UserData): Character {
  const character = characterByName(user.active ?? '') ?? characterByName('Noob')!
  return characterWithSpecial(character, user.loadouts[character.name])
}

export function parseBattleMode(value: string | null | undefined): BattleMode {
  return value === '2x2' ? '2x2' : '1x1'
}

export function battleReward(wager: number): number {
  return wager * 2
}

export function partnerCharacter(user: UserData): Character {
  const primary = activeCharacter(user)
  const chosen =
    user.partner && user.partner !== primary.name && user.owned.includes(user.partner)
      ? characterByName(user.partner)
      : undefined
  const partner = chosen ?? ownedCharacters(user).find(character => character.name !== primary.name) ?? primary
  return characterWithSpecial(partner, user.loadouts[partner.name])
}

function teamEntries(user: UserData, userId: string, displayName: string): FighterEntry[] {
  return [
    { userId, name: displayName, character: activeCharacter(user) },
    {
      userId,
      name: displayName,
      character: partnerCharacter(user),
    },
  ]
}

export function randomBattleFor(
  mode: BattleMode,
  first: { userId: string; name: string },
  second: { userId: string; name: string },
  rng: () => number = Math.random,
): Battle {
  const characters = randomBattleCharacters(mode, rng)
  const perTeam = mode === '2x2' ? 2 : 1
  const entries = (
    player: { userId: string; name: string },
    teamCharacters: Character[],
  ): FighterEntry[] =>
    teamCharacters.map(character => ({
      userId: player.userId,
      name: player.name,
      character,
    }))
  const firstEntries = entries(first, characters.slice(0, perTeam))
  const secondEntries = entries(second, characters.slice(perTeam))
  return mode === '2x2'
    ? createTeamBattle(firstEntries, secondEntries)
    : createBattle(firstEntries[0], secondEntries[0])
}

export function coopBossBattle(
  first: FighterEntry,
  second: FighterEntry,
  week = isoWeekKey(),
  day = isoDayKey(),
): Battle {
  const boss = bossCharacterForDay('2x2', day)
  return createTeamBattle([first, second], [
    {
      userId: `boss:${week}:coop`,
      name: `БОСС · ${boss.name}`,
      character: boss,
      boss: true,
    },
  ])
}

const COMMAND_NAME_EN: Record<string, string> = {
  профиль: 'profile',
  пвп: 'pvp',
  пве: 'pve',
  дебаг: 'debug',
  гайд: 'guide',
  команды: 'commands',
}

const COMMAND_NAME_BASE: Record<string, string> = Object.fromEntries(
  Object.entries(COMMAND_NAME_EN).map(([russian, english]) => [english, russian]),
)

function baseCommand(name: string, description: string): SlashCommandBuilder {
  const builder = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    )
  const english = COMMAND_NAME_EN[name]
  if (english) builder.setNameLocalizations({ 'en-US': english })
  return builder
}

const BATTLE_MODE_CHOICES = [
  { name: '2 на 2', value: '2x2', name_localizations: { 'en-US': '2v2' } },
  { name: '1 на 1', value: '1x1', name_localizations: { 'en-US': '1v1' } },
] as const

export function commandDefinitions(): SlashCommandBuilder[] {
  return [
    baseCommand('профиль', 'Профиль и управление персонажем')
      .setDescriptionLocalizations({ 'en-US': 'Profile and character management' })
      .addUserOption(option =>
        option
          .setName('пользователь')
          .setNameLocalizations({ 'en-US': 'user' })
          .setDescription('Чей профиль показать')
          .setDescriptionLocalizations({ 'en-US': 'Whose profile to show' }),
      ),
    baseCommand('пвп', 'Настроить PvP: классика, рандом или драфт')
      .setDescriptionLocalizations({
        'en-US': 'Set up PvP: classic, random or draft',
      })
      .addUserOption(option =>
        option
          .setName('соперник')
          .setNameLocalizations({ 'en-US': 'opponent' })
          .setDescription('Кого вызываем (необязательно — можно открыть вызов для всех)')
          .setDescriptionLocalizations({
            'en-US': 'Opponent (optional — leave empty for an open challenge)',
          })
          .setRequired(false),
      ),
    baseCommand('пве', 'Босс, тренировка и выживание в одном меню').setDescriptionLocalizations({
      ru: 'Босс, тренировка и выживание в одном меню',
      'en-US': 'Boss, training and survival in one menu',
    }),
    baseCommand('дебаг', 'Панель создателя: монеты, тест баланса и проверка').setDescriptionLocalizations({
      ru: 'Панель создателя: монеты, тест баланса и проверка',
      'en-US': 'Creator panel: coins, balance test and health check',
    }),
    baseCommand('гайд', 'Краткий гайд по режимам, статусам и прогрессу').setDescriptionLocalizations({
      ru: 'Краткий гайд по режимам, статусам и прогрессу',
      'en-US': 'Quick guide to modes, statuses and progression',
    }),
    baseCommand('команды', 'Список команд и возможностей').setDescriptionLocalizations({
      ru: 'Список команд и возможностей',
      'en-US': 'List of commands and features',
    }),
    baseCommand('settings', 'Язык интерфейса и описаний способностей').setDescriptionLocalizations({
      ru: 'Язык интерфейса и описаний способностей',
      'en-US': 'Interface and ability description language',
    }),
  ]
}

function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

function cooldownLabel(special: Special): string {
  const cooldown = specialCooldown(special)
  return cooldown > 0
    ? `КД: ${cooldown} ${plural(cooldown, 'ход', 'хода', 'ходов')}`
    : 'без КД'
}

function hasCooldownInDescription(text: string): boolean {
  return /(?:КД|CD)/i.test(text)
}

function abilityOptionDescription(
  special: Special,
  language: UserData['language'],
): string {
  const description = specialDescription(special, language)
  if (hasCooldownInDescription(description)) return description.slice(0, 100)
  const cooldown = specialCooldown(special)
  const suffix = cooldown > 0 ? ` · КД ${cooldown}` : ' · без КД'
  return `${description.slice(0, 100 - suffix.length)}${suffix}`
}

function backRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('hub:back').setLabel('← Назад').setStyle(ButtonStyle.Secondary),
  )
}

export function hubComponents(user: UserData): ActionRowBuilder<ButtonBuilder>[] {
  const shopEmoji = emojiData('inventory')
  const chooseEmoji = userCharacterEmojiData(user, user.active ?? '') ?? emojiData('masks')
  const topEmoji = emojiData('achievement')
  const bonusEmoji = emojiData('robux')

  const shopButton = new ButtonBuilder()
    .setCustomId('hub:shop')
    .setLabel(shopEmoji ? 'Магазин' : '🛒 Магазин')
    .setStyle(ButtonStyle.Primary)
  if (shopEmoji) shopButton.setEmoji(shopEmoji)

  const chooseButton = new ButtonBuilder()
    .setCustomId('hub:choose')
    .setLabel(chooseEmoji ? 'Сменить' : '🎭 Сменить')
    .setStyle(ButtonStyle.Secondary)
  if (chooseEmoji) chooseButton.setEmoji(chooseEmoji)

  const bonusButton = new ButtonBuilder()
    .setCustomId('hub:bonus')
    .setLabel(bonusEmoji ? 'Бонус' : '🎁 Бонус')
    .setStyle(ButtonStyle.Success)
  if (bonusEmoji) bonusButton.setEmoji(bonusEmoji)

  const topButton = new ButtonBuilder()
    .setCustomId('hub:top')
    .setLabel(topEmoji ? 'Лидеры' : '🏆 Лидеры')
    .setStyle(ButtonStyle.Secondary)
  if (topEmoji) topButton.setEmoji(topEmoji)

  const charsEmoji = emojiData('abilities')
  const charsButton = new ButtonBuilder()
    .setCustomId('hub:chars')
    .setLabel(charsEmoji ? 'Способности' : '📖 Способности')
    .setStyle(ButtonStyle.Secondary)
  if (charsEmoji) charsButton.setEmoji(charsEmoji)

  const achEmoji = emojiData('achievement')
  const achievementsButton = new ButtonBuilder()
    .setCustomId('hub:achievements')
    .setLabel(achEmoji ? 'Достижения' : '🏆 Достижения')
    .setStyle(ButtonStyle.Secondary)
  if (achEmoji) achievementsButton.setEmoji(achEmoji)

  const questEmoji = emojiData('quest')
  const questsButton = new ButtonBuilder()
    .setCustomId('hub:quests')
    .setLabel(questEmoji ? 'Квесты' : '📜 Квесты')
    .setStyle(ButtonStyle.Secondary)
  if (questEmoji) questsButton.setEmoji(questEmoji)

  const historyEmoji = emojiData('sfoth')
  const historyButton = new ButtonBuilder()
    .setCustomId('hub:history')
    .setLabel(historyEmoji ? 'История' : '⚔️ История')
    .setStyle(ButtonStyle.Secondary)
  if (historyEmoji) historyButton.setEmoji(historyEmoji)

  const cosmeticsEmoji = emojiData('skins')
  const cosmeticsButton = new ButtonBuilder()
    .setCustomId('hub:cosmetics')
    .setLabel(cosmeticsEmoji ? 'Косметика' : '🎨 Косметика')
    .setStyle(ButtonStyle.Secondary)
  if (cosmeticsEmoji) cosmeticsButton.setEmoji(cosmeticsEmoji)

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(shopButton, chooseButton, charsButton),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      bonusButton,
      questsButton,
      achievementsButton,
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      historyButton,
      topButton,
      cosmeticsButton,
    ),
  ]
}

function characterOptionDescription(character: Character, base: string): string {
  const passive = characterPassive(character)
  return passive ? `${base} · ${passive.name}` : base
}

export function shopComponents(
  user: UserData,
): Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> {
  const rows: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> = []
  const purchasable = purchasableCharacters(user)

  if (purchasable.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('hub:buy')
          .setPlaceholder('Купить персонажа')
          .addOptions(
            purchasable.map(character => {
              const emoji = characterEmojiData(character.name)
              return {
                label: character.name,
                description: characterOptionDescription(character, `${character.price} монет`),
                value: character.name,
                ...(emoji ? { emoji } : {}),
              }
            }),
          ),
      ),
    )
  }

  rows.push(backRow())
  return rows
}

function presetDescription(preset: LoadoutPreset): string {
  const partner = preset.partner
    ? ` + ${preset.partner} (${preset.partnerSpecial ?? '—'})`
    : ''
  return `${preset.character} (${preset.special})${partner}`
}

export function presetsEmbed(user: UserData, note?: string): EmbedBuilder {
  const lines =
    user.presets.length === 0
      ? [
          'Пока нет пресетов.',
          'Настрой героя, напарника и способности, затем нажми «Сохранить текущий».',
        ]
      : user.presets.map(
          (preset, index) => `${index + 1}. **${preset.name}** — ${presetDescription(preset)}`,
        )
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('abilities', '📦')} Пресеты`)
    .setDescription([note, ...lines].filter(Boolean).join('\n\n'))
    .setFooter({ text: `Пресетов: ${user.presets.length}/${MAX_PRESETS} · Forsaken Simulator` })
}

export function presetsComponents(
  user: UserData,
): Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> {
  const rows: Array<
    ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>
  > = []
  if (user.presets.length > 0) {
    const options = user.presets.map(preset => {
      const emoji = characterEmojiData(preset.character)
      return {
        label: preset.name,
        description: presetDescription(preset).slice(0, 100),
        value: preset.id,
        ...(emoji ? { emoji } : {}),
      }
    })
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('presets:apply')
          .setPlaceholder('Применить пресет')
          .addOptions(options),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('presets:delete')
          .setPlaceholder('Удалить пресет')
          .addOptions(options),
      ),
    )
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('presets:save')
        .setLabel('Сохранить текущий')
        .setStyle(ButtonStyle.Success)
        .setDisabled(user.presets.length >= MAX_PRESETS),
      new ButtonBuilder()
        .setCustomId('hub:choose')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  )
  return rows
}

export function chooseComponents(
  user: UserData,
): Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> {
  const rows: Array<
    ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>
  > = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('hub:select')
        .setPlaceholder('Активный персонаж')
        .addOptions(
          ownedCharacters(user).map(character => {
            const emoji = userCharacterEmojiData(user, character.name)
            return {
              label: character.name,
              description: characterOptionDescription(character, characterClass(character)),
              value: character.name,
              default: character.name === user.active,
              ...(emoji ? { emoji } : {}),
            }
          }),
        ),
    ),
  ]

  const partnerOptions: APISelectMenuOption[] = ownedCharacters(user)
    .filter(character => character.name !== user.active)
    .map(character => {
      const emoji = userCharacterEmojiData(user, character.name)
      return {
        label: character.name,
        description: characterOptionDescription(character, characterClass(character)),
        value: character.name,
        default: character.name === user.partner,
        ...(emoji ? { emoji } : {}),
      }
    })
  if (partnerOptions.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('hub:partner')
          .setPlaceholder('Второй персонаж (2 на 2)')
          .addOptions([
            {
              label: 'Авто',
              description: 'Первый другой купленный персонаж',
              value: 'auto',
              default: user.partner === null,
            },
            ...partnerOptions,
          ]),
      ),
    )
  }

  const active = characterByName(user.active ?? '')
  if (active) {
    const specials = availableSpecials(active)
    const selected = selectedSpecial(active, user.loadouts[active.name])
    if (specials.length > 1) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('hub:ability')
            .setPlaceholder(`Способность: ${active.name}`)
            .addOptions(
              specials.map(special => {
                const icon = abilityEmojiData(active.name, special.name)
                return {
                  label: special.name,
                  description: abilityOptionDescription(special, user.language),
                  value: special.name,
                  default: special.name === selected.name,
                  ...(icon ? { emoji: icon } : {}),
                }
              }),
            ),
        ),
      )
    }
  }

  if (partnerOptions.length > 0) {
    const partner = characterByName(partnerCharacter(user).name)
    if (partner) {
      const specials = availableSpecials(partner)
      const selected = selectedSpecial(partner, user.loadouts[partner.name])
      if (specials.length > 1) {
        rows.push(
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('hub:partnerAbility')
              .setPlaceholder(`Способность напарника: ${partner.name}`)
              .addOptions(
                specials.map(special => {
                  const icon = abilityEmojiData(partner.name, special.name)
                  return {
                    label: special.name,
                    description: abilityOptionDescription(special, user.language),
                    value: special.name,
                    default: special.name === selected.name,
                    ...(icon ? { emoji: icon } : {}),
                  }
                }),
              ),
          ),
        )
      }
    }
  }

  const presetsEmoji = emojiData('abilities')
  const presetsButton = new ButtonBuilder()
    .setCustomId('hub:presets')
    .setLabel(presetsEmoji ? 'Пресеты' : '📦 Пресеты')
    .setStyle(ButtonStyle.Primary)
  if (presetsEmoji) presetsButton.setEmoji(presetsEmoji)
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      presetsButton,
      new ButtonBuilder()
        .setCustomId('hub:back')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  )
  return rows
}

export function shopEmbed(user: UserData, note?: string): EmbedBuilder {
  const coin = emojiText('points', '🪙')
  const list = (characters: readonly Character[]) =>
    characters
      .map(character => {
        const price = character.price === 0 ? 'бесплатно' : `${character.price} ${coin}`
        return `**${userCharacterLabel(user, character.name)}** — ${price}`
      })
      .join('\n')
  const characters = list(CHARACTERS)

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.shop)
    .setTitle(`${emojiText('inventory', '🛒')} Магазин Forsaken`)
    .setDescription(note ? `${note}\n\n${characters}` : characters)
    .setFooter({ text: `Баланс: ${user.coins}` })
}

export function profileEmbed(
  userId: string,
  user: UserData,
  name = userId,
  note?: string,
  now = Date.now(),
): EmbedBuilder {
  const active = characterByName(user.active ?? '')
  const partnerOptions = active
    ? ownedCharacters(user).filter(character => character.name !== active.name)
    : []
  const partner =
    partnerOptions.find(character => character.name === user.partner) ?? partnerOptions[0]
  const bonus =
    user.lastBonus === 0
      ? 'доступен'
      : formatDuration(Math.max(0, BONUS_COOLDOWN_MS - (now - user.lastBonus)))
  const title = equippedTitleItem(user)
  const favorite = favoriteCharacter(user)
  const topMastery = topMasteryCharacter(user)
  const showcase = user.achievements
    .slice(-3)
    .map(id => ACHIEVEMENTS.find(achievement => achievement.id === id)?.name)
    .filter((entry): entry is string => Boolean(entry))

  const favoriteTrial = favorite
    ? trialTitleForWins(user.characterStats[favorite.name]?.wins ?? 0)
    : null
  const favoriteValue = favorite
    ? `${userCharacterLabel(user, favorite.name)} — ${favorite.battles} ${plural(favorite.battles, 'бой', 'боя', 'боёв')} · ${favorite.winrate}% побед` +
      (favoriteTrial ? ` · ${favoriteTrial}` : '')
    : '—'
  const topBadge = topMastery ? masteryBadge(topMastery.level) : null
  const masteryValue = topMastery
    ? `${userCharacterLabel(user, topMastery.name)} — ур. ${topMastery.level} «${topMastery.title}»` +
      (topBadge ? ` · ${topBadge}` : '')
    : '—'

  return new EmbedBuilder()
    .setColor(profileAccent(user) ?? EMBED_COLORS.profile)
    .setTitle(`${emojiText('welcomehell', '👤')} Профиль`)
    .setDescription(
      `**${name}**${
        title
          ? ` · ${title.emoji ? emojiText(title.emoji, '🎖️') : emojiText('mvp', '🎖️')} «${title.name}»`
          : ''
      }` + (note ? `\n\n${note}` : ''),
    )
    .addFields(
      { name: `${emojiText('points', '🪙')} Монеты`, value: `${user.coins}`, inline: true },
      { name: `${emojiText('achievement', '🏆')} Победы`, value: `${user.wins}`, inline: true },
      { name: `${emojiText('skull', '💀')} Поражения`, value: `${user.losses}`, inline: true },
      {
        name: 'Активный',
        value: active ? userCharacterLabel(user, active.name) : '—',
        inline: true,
      },
      {
        name: 'Напарник',
        value: partner ? userCharacterLabel(user, partner.name) : '—',
        inline: true,
      },
      {
        name: `${emojiText('inventory', '📦')} Коллекция`,
        value: `${user.owned.length}/${CHARACTERS.length}`,
        inline: true,
      },
      { name: `${emojiText('robux', '🎁')} Бонус`, value: bonus, inline: true },
      { name: `${emojiText('masks', '🎭')} Любимый персонаж`, value: favoriteValue, inline: true },
      { name: `${emojiText('xp', '⭐')} Мастерство`, value: masteryValue, inline: true },
      ...(user.compactMode
        ? []
        : [
            {
              name: `${emojiText('achievement', '🏆')} Витрина`,
              value: showcase.length > 0 ? showcase.join(' · ') : 'Пока пусто',
              inline: false,
            },
          ]),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function balanceEmbed(simulation: BalanceSimulation): EmbedBuilder {
  const lines = simulation.rows.map(
    (row, index) =>
      `${index + 1}. **${row.name}** — ${row.winrate}% ` +
      `(${row.wins}W/${row.losses}L/${row.draws}D)`,
  )
  const scope = simulation.character
    ? ` · ${simulation.character}${simulation.special ? ` · ${simulation.special}` : ''}`
    : ''
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('achievement', '🏆')} Тест: AI-прогон`)
    .setDescription(lines.join('\n'))
    .setFooter({
      text:
        `${simulation.mode === '2x2' ? '2 на 2' : '1 на 1'} · ${simulation.battles} боёв · ` +
        `${simulation.battlesPerPair} на пару · сид ${simulation.seed}${scope}`,
    })
}

export const TOP_PAGE_SIZE = 10

function leaderboardUsers(): Array<[string, UserData]> {
  return Object.entries(store.users)
    .filter(([userId]) => isRealUserId(userId))
    .sort((left, right) => right[1].wins - left[1].wins || right[1].coins - left[1].coins)
}

export function topPageCount(): number {
  return Math.max(1, Math.ceil(leaderboardUsers().length / TOP_PAGE_SIZE))
}

function leaderboardCharacterEmojis(user: UserData): string {
  const names = [user.active, user.partner].filter(
    (name, index, list): name is string =>
      Boolean(name) && list.indexOf(name) === index && Boolean(characterByName(name)),
  )
  return names
    .map(name => {
      const skin = equippedSkin(user, name)
      const skinTag = skin ? emojiTag(skin.emoji) : ''
      return skinTag || characterEmoji(name)
    })
    .filter(Boolean)
    .join(' ')
}

export function topEmbed(page = 0): EmbedBuilder {
  const allEntries = leaderboardUsers()
  const totalPages = Math.max(1, Math.ceil(allEntries.length / TOP_PAGE_SIZE))
  const current = Number.isFinite(page)
    ? Math.max(0, Math.min(totalPages - 1, Math.floor(page)))
    : 0
  const entries = allEntries.slice(
    current * TOP_PAGE_SIZE,
    (current + 1) * TOP_PAGE_SIZE,
  )
  const description =
    entries.length === 0
      ? 'Пока никто не играл.'
      : entries
          .map(([userId, user], index) => {
            const characters = leaderboardCharacterEmojis(user)
            return (
              `${current * TOP_PAGE_SIZE + index + 1}. <@${userId}> — ${user.wins} побед, ` +
              `${user.coins} ${emojiText('points', '🪙')}` +
              (characters ? ` · ${characters}` : '')
            )
          })
          .join('\n')

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.shop)
    .setTitle(`${emojiText('achievement', '🏆')} Лидеры`)
    .setDescription(description)
    .setFooter({
      text: `Страница ${current + 1}/${totalPages} · всего ${allEntries.length}`,
    })
}

export function topComponents(page = 0): ActionRowBuilder<ButtonBuilder>[] {
  const totalPages = topPageCount()
  const current = Number.isFinite(page)
    ? Math.max(0, Math.min(totalPages - 1, Math.floor(page)))
    : 0
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`top:page:${current - 1}`)
      .setLabel('←')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current <= 0),
    new ButtonBuilder()
      .setCustomId('top:pageinfo')
      .setLabel(`${current + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`top:page:${current + 1}`)
      .setLabel('→')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('hub:back')
      .setLabel('← Назад')
      .setStyle(ButtonStyle.Secondary),
  )
  return [row]
}

export function historyEmbed(user: UserData): EmbedBuilder {
  const lines =
    user.history.length === 0
      ? ['Пока нет боёв.']
      : user.history.map(
          record =>
            `${record.result === 'win' ? emojiText('check', '✅') : emojiText('cross', '❌')} против **${record.opponent}** — ` +
            `${record.coins >= 0 ? '+' : ''}${record.coins} ${emojiText('points', '🪙')} · ` +
            `<t:${Math.floor(record.at / 1000)}:R>`,
        )

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.profile)
    .setTitle(`${emojiText('sfoth', '⚔️')} История боёв`)
    .setDescription(lines.join('\n'))
}

export function cosmeticsEmbed(user: UserData): EmbedBuilder {
  const coin = emojiText('points', '🪙')
  const check = emojiText('check', '✅')
  const dot = emojiText('dot', '▫️')
  const line = (item: Cosmetic) => {
    const owned = user.cosmetics.owned.includes(item.id)
    const equipped =
      item.kind === 'accent'
        ? user.cosmetics.accent === item.id
        : user.cosmetics.title === item.id
    const status = equipped ? 'надето' : owned ? 'куплено' : `${item.price} ${coin}`
    const icon = item.emoji ? `${emojiText(item.emoji, '')} ` : ''
    const custom =
      item.id === 'accent_custom' && user.cosmetics.customColor
        ? ` · ${user.cosmetics.customColor}`
        : ''
    return `${icon}${owned ? check : dot} **${item.name}** — ${item.description} · ${status}${custom}`
  }

  const colors = COSMETICS.filter(item => item.kind === 'accent').map(line).join('\n')
  const titles = COSMETICS.filter(item => item.kind === 'title').map(line).join('\n')

  return new EmbedBuilder()
    .setColor(profileAccent(user) ?? EMBED_COLORS.choose)
    .setTitle(`${emojiText('skins', '🎨')} Косметика`)
    .setDescription(
      `**Цвета профиля**\n${colors}\n\n**Титулы**\n${titles}\n\n` +
        'Выбери предмет ниже: некупленный — купится и наденется, купленный — просто наденется.',
    )
    .setFooter({ text: `Баланс: ${user.coins}` })
}

export function cosmeticsComponents(
  user: UserData,
): Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> {
  const options: APISelectMenuOption[] = COSMETICS.map(item => {
    const owned = user.cosmetics.owned.includes(item.id)
    const equipped =
      item.kind === 'accent'
        ? user.cosmetics.accent === item.id
        : user.cosmetics.title === item.id
    const icon = item.emoji ? emojiData(item.emoji) : undefined
    return {
      label: `${equipped ? '✓ ' : owned ? '' : 'Купить: '}${item.name}${owned ? '' : ` — ${item.price}`}`,
      description:
        item.id === 'accent_custom' && (equipped || owned)
          ? 'Нажми, чтобы изменить HEX-цвет'
          : equipped
            ? 'Надето'
            : owned
              ? 'Куплено — нажми, чтобы надеть'
              : item.description,
      value: item.id,
      ...(icon ? { emoji: icon } : {}),
    }
  })

  if (user.cosmetics.accent !== null || user.cosmetics.title !== null) {
    options.push({
      label: 'Снять косметику',
      description: 'Убрать цвет и титул',
      value: 'none',
    })
  }

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('cosmetics:item')
        .setPlaceholder('Купить или надеть косметику')
        .addOptions(options),
    ),
    backRow(),
  ]
}

export function achievementsEmbed(user: UserData): EmbedBuilder {
  const check = emojiText('check', '✅')
  const lines = ACHIEVEMENTS.map(achievement => {
    const unlocked = user.achievements.includes(achievement.id)
    const reward = `${achievement.reward} ${emojiText('points', '🪙')}`
    return `${unlocked ? check : emojiText('locked', '🔒')} **${achievement.name}** — ${achievement.description} (+${reward})`
  })

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.shop)
    .setTitle(`${emojiText('achievement', '🏆')} Достижения`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${user.achievements.length}/${ACHIEVEMENTS.length}` })
}

const DAMAGE_QUEST_STEP = 50

function progressBar(value: number, target: number, step = 1): string {
  const unit = Math.max(1, step)
  const segments = Math.max(1, Math.ceil(target / unit))
  const filled = Math.min(segments, Math.max(0, Math.floor(value / unit)))
  return '▰'.repeat(filled) + '▱'.repeat(segments - filled)
}

export function questsEmbed(user: UserData, now = Date.now()): EmbedBuilder {
  const updated = ensureWeeklyQuest(ensureQuests(user, now), now)
  const quests = updated.quests!
  const weekly = updated.weeklyQuest
  const allDone = quests.quests.every(quest => quest.claimed) && (!weekly || weekly.claimed)
  const check = emojiText('check', '✅')
  const dot = emojiText('dot', '▫️')
  const lines = quests.quests.map(quest => {
    const mark = quest.claimed ? check : dot
    return (
      `${mark} ${questName(quest)}\n` +
      `${progressBar(
        quest.progress,
        quest.target,
        quest.kind === 'damage' ? DAMAGE_QUEST_STEP : 1,
      )} ${quest.progress}/${quest.target} · ` +
      `+${quest.reward} ${emojiText('points', '🪙')}`
    )
  })
  const weeklyStep =
    weekly?.kind === 'wins'
      ? 3
      : weekly?.kind === 'damage'
        ? 200
        : weekly && weekly.target > 10
          ? Math.ceil(weekly.target / 10)
          : 1
  const weeklyLines = weekly
    ? [
        `**Недельный квест:** ${weekly.claimed ? check : dot} ${weeklyQuestName(weekly)}`,
        `${progressBar(weekly.progress, weekly.target, weeklyStep)} ` +
          `${weekly.progress}/${weekly.target} · +${weekly.reward} ${emojiText('points', '🪙')}`,
      ]
    : []

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('quest', '📜')} Ежедневные квесты`)
    .setDescription(
      [
        `${allDone ? `${check} Все задания выполнены!` : `${dot} Задания на сегодня:`}\n\n${lines.join('\n\n')}`,
        weeklyLines.join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n'),
    )
    .setFooter({
      text: quests.rerollUsed
        ? 'Замена квеста использована · Сброс раз в сутки · Недельный квест сбрасывается в понедельник'
        : 'Награды начисляются автоматически · Замена: 1 раз в день · Недельный квест сбрасывается в понедельник',
    })
}

export function questsComponents(
  user: UserData,
  now = Date.now(),
): Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> {
  const updated = ensureQuests(user, now)
  const quests = updated.quests!
  const incomplete = quests.quests.filter(quest => !quest.claimed)
  if (quests.rerollUsed || incomplete.length === 0) return [backRow()]

  const menu = new StringSelectMenuBuilder()
    .setCustomId('quest:reroll')
    .setPlaceholder('Заменить квест (1 раз в день)')
    .addOptions(
      incomplete.map(quest => ({
        label: `Заменить: ${questName(quest)}`.slice(0, 100),
        description: `Награда: ${quest.reward} монет`,
        value: quest.id,
      })),
    )
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), backRow()]
}

export function bossPanelEmbed(user: UserData, now = Date.now()): EmbedBuilder {
  const week = isoWeekKey(now)
  const day = isoDayKey(now)
  const boss = bossForDay(day)
  const duo = bossCharacterForDay('2x2', day)
  const specials = [boss.special, ...(boss.alternates ?? [])]
  const specialIcons = specials.map(special => abilityEmojiText(boss.name, special.name))
  const leaders = Object.entries(store.users)
    .filter(([, entry]) => entry.boss?.week === week && (entry.boss?.bestDamage ?? 0) > 0)
    .sort(([, left], [, right]) => (right.boss?.bestDamage ?? 0) - (left.boss?.bestDamage ?? 0))
    .slice(0, 5)
  const leaderboard =
    leaders.length > 0
      ? leaders
          .map(
            ([userId, entry], index) =>
              `${index + 1}. <@${userId}> — ${entry.boss!.bestDamage} урона` +
              (entry.boss!.cleared ? ` ${emojiText('achievement', '✅')}` : ''),
          )
          .join('\n')
      : 'Пока никто не нанёс урон.'

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('boss', '👑')} Босс дня: ${characterLabel(boss.name)}`)
    .setDescription(
      `День **${day}** · неделя **${week}**. Босс использует **обе** свои способности, у каждой свой кулдаун.\n` +
        `${emojiText('hp', '❤️')} 2 на 1: **${duo.hp} HP** · атака **${duo.attack}**`,
    )
    .addFields(
      {
        name: `${specialIcons[0] ?? ''} Способность 1 · ${specials[0].name}`,
        value: specialDescription(specials[0], user.language),
      },
      {
        name: `${specialIcons[1] ?? ''} Способность 2 · ${specials[1]?.name ?? '—'}`,
        value: specials[1] ? specialDescription(specials[1], user.language) : '—',
      },
      {
        name: 'Награда за победу',
        value:
          `${BOSS_WIN_REWARD} ${emojiText('points', '🪙')}` +
          ` · первая победа за неделю: +${BOSS_FIRST_CLEAR_BONUS}`,
        inline: true,
      },
      ...(user.compactMode ? [] : [{ name: 'Лучший урон за неделю', value: leaderboard }]),
    )
    .setFooter({ text: 'Бои с боссом не идут в PvP-статистику и квесты' })
}

export function bossPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const duo = emojiData('duo')
  const partner = new ButtonBuilder()
    .setCustomId('boss:start:2x2')
    .setLabel(duo ? '2 на 1 · с напарником' : '👥 2 на 1 · с напарником')
    .setStyle(ButtonStyle.Primary)
  if (duo) partner.setEmoji(duo)
  const coop = new ButtonBuilder()
    .setCustomId('boss:coop')
    .setLabel(duo ? '2 на 1 · с игроком' : '👥 2 на 1 · с игроком')
    .setStyle(ButtonStyle.Secondary)
  if (duo) coop.setEmoji(duo)

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(partner, coop)]
}

export function pvePanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('swordwhite', '⚔️')} PvE`)
    .setDescription(
      [
        '**Босс/Boss Rush** — босс дня (2 на 1: с напарником или в кооперативе) или пять боссов подряд.',
        '**Тренировка** — бой с ботами без наград и статистики; можно выбрать героев и способности обеих сторон.',
        '**Выживание/Башня** — волны с растущими врагами или 10 этажей башни. В башне после каждого этажа выбирается одно из трёх усилений, в выживании награда копится за волны.',
        '**Испытания** — особые цели для каждого персонажа за опыт мастерства.',
      ].join('\n\n'),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function pvePanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const boss = emojiData('boss')
  const sword = emojiData('swordwhite')
  const bossModesButton = new ButtonBuilder()
    .setCustomId('pve:bossmodes')
    .setLabel(boss ? 'Босс/Boss Rush' : '👑 Босс/Boss Rush')
    .setStyle(ButtonStyle.Danger)
  if (boss) bossModesButton.setEmoji(boss)
  const trainingButton = new ButtonBuilder()
    .setCustomId('pve:training')
    .setLabel(sword ? 'Тренировка' : '⚔️ Тренировка')
    .setStyle(ButtonStyle.Primary)
  if (sword) trainingButton.setEmoji(sword)
  const towerEmoji = emojiData('tower')
  const modesButton = new ButtonBuilder()
    .setCustomId('pve:modes')
    .setLabel(towerEmoji ? 'Выживание/Башня' : '🗼 Выживание/Башня')
    .setStyle(ButtonStyle.Secondary)
  if (towerEmoji) modesButton.setEmoji(towerEmoji)
  const trialsEmoji = emojiData('trials')
  const trialsButton = new ButtonBuilder()
    .setCustomId('pve:trials')
    .setLabel(trialsEmoji ? 'Испытания' : '🏅 Испытания')
    .setStyle(ButtonStyle.Success)
  if (trialsEmoji) trialsButton.setEmoji(trialsEmoji)
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      modesButton,
      bossModesButton,
      trainingButton,
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(trialsButton),
  ]
}

export function pveBossModesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('boss', '👑')} Босс и Boss Rush`)
    .setDescription(
      [
        '**Босс дня** — один босс с обеими способностями. Бой всегда 2 на 1: активный герой с напарником из профиля или в кооперативе с другим игроком.',
        '**Boss Rush** — пять боссов подряд. После победы восстанавливается 25% HP, награда растёт с каждым этапом.',
      ].join('\n\n'),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function pveBossModesComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const boss = emojiData('boss')
  const bossButton = new ButtonBuilder()
    .setCustomId('pve:boss')
    .setLabel(boss ? 'Босс дня' : '👑 Босс дня')
    .setStyle(ButtonStyle.Danger)
  if (boss) bossButton.setEmoji(boss)
  const rushButton = new ButtonBuilder()
    .setCustomId('pve:bossrush')
    .setLabel('Boss Rush')
    .setStyle(ButtonStyle.Danger)
  if (boss) rushButton.setEmoji(boss)
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      bossButton,
      rushButton,
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function pveModesEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('tower', '🗼')} Выживание и башня`)
    .setDescription(
      [
        '**Выживание** — забег по волнам. Каждая волна сильнее, между волнами восстанавливается 25% HP, награда копится за пройденные волны.',
        '**Башня** — 10 этажей по два усиленных противника. После каждого этажа выбирается одно из трёх усилений на следующий бой.',
      ].join('\n\n'),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function pveModesComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const skull = emojiData('skull')
  const survivalButton = new ButtonBuilder()
    .setCustomId('pve:survival')
    .setLabel('Выживание')
    .setStyle(ButtonStyle.Secondary)
  if (skull) survivalButton.setEmoji(skull)
  const towerEmoji = emojiData('tower')
  const towerButton = new ButtonBuilder()
    .setCustomId('pve:tower')
    .setLabel(towerEmoji ? 'Башня' : '🗼 Башня')
    .setStyle(ButtonStyle.Primary)
  if (towerEmoji) towerButton.setEmoji(towerEmoji)
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      survivalButton,
      towerButton,
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function towerPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('tower', '🗼')} Башня`)
    .setDescription(
      [
        `${TOWER_FLOORS} этажей, на каждом — двое противников с растущими HP и атакой.`,
        'После каждого этажа — выбор одного из трёх усилений на следующий бой.',
        `За победу на этаже: ${towerReward(1)} → ${towerReward(TOWER_FLOORS)} ${emojiText('points', '🪙')} по этажам.`,
        'Играешь своей парой: герой и напарник. Поражение заканчивает забег.',
        'Мастерство начисляется, PvP-статистика и квесты — нет.',
      ].join('\n\n'),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function towerPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tower:start')
        .setLabel('Начать забег')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function towerUpgradeComponents(
  choices: TowerUpgradeId[],
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>()
  for (const id of choices) {
    const upgrade = TOWER_UPGRADES[id]
    if (!upgrade) continue
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tower:upgrade:${id}`)
        .setLabel(upgrade.name)
        .setStyle(ButtonStyle.Success),
    )
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('pve:menu')
      .setLabel('В меню PvE')
      .setStyle(ButtonStyle.Secondary),
  )
  return [row]
}

function towerAgainComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tower:start')
        .setLabel('Ещё забег')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('В меню PvE')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

const TRIAL_OBJECTIVE_LABELS: Record<Trial['objective'], string> = {
  win: 'Победить',
  survive: 'Продержаться {n} ходов',
  special: 'Применить способность {n} раз',
  win_without_rest: 'Победить без отдыха',
  heal: 'Восстановить {n} HP',
  damage: 'Нанести {n} урона',
  summon: 'Призвать {n} юнитов',
  block: 'Заблокировать {n} атак',
  stun: 'Оглушить {n} раз',
  revive: 'Активировать вторую жизнь',
}

const TRIAL_OBJECTIVE_LABELS_EN: Record<Trial['objective'], string> = {
  win: 'Win',
  survive: 'Survive {n} turns',
  special: 'Use the ability {n} times',
  win_without_rest: 'Win without resting',
  heal: 'Restore {n} HP',
  damage: 'Deal {n} damage',
  summon: 'Summon {n} units',
  block: 'Block {n} attacks',
  stun: 'Stun {n} times',
  revive: 'Trigger a second life',
}

function trialObjectiveText(trial: Trial): string {
  const labels =
    activeLanguage() === 'en' ? TRIAL_OBJECTIVE_LABELS_EN : TRIAL_OBJECTIVE_LABELS
  return labels[trial.objective].replace('{n}', String(trial.target))
}

function trialGoalLine(trial: Trial): string {
  return activeLanguage() === 'en'
    ? `Goal: ${trialObjectiveText(trial)}.`
    : `Цель: ${trialObjectiveText(trial)}.`
}

function trialAbilityLine(trial: Trial): string {
  if (!trial.specialName) {
    return activeLanguage() === 'en'
      ? 'Ability: Sentry or Dispenser from your loadout.'
      : 'Способность: **Sentry** или **Dispenser** из твоего лоадаута.'
  }
  const icon = abilityEmojiText(trial.characterName, trial.specialName)
  const label = icon ? `${icon} **${trial.specialName}**` : `**${trial.specialName}**`
  return activeLanguage() === 'en'
    ? `Ability: ${label}. It is fixed for the trial.`
    : `Способность: ${label}. В испытании она фиксирована.`
}

export function availableTrials(user?: UserData): Trial[] {
  if (!user) return [...TRIALS]
  return TRIALS.filter(trial => (user.trialClaimed[trialClaimKey(trial)] ?? 0) === 0)
}

export function trialCharacterFor(trial: Trial, user: UserData): Character {
  const base = characterByName(trial.characterName)
  if (!base) throw new Error('Trial character is missing.')
  return characterWithSpecial(base, trial.specialName ?? user.loadouts[base.name])
}

export function trialsPanelEmbed(selected?: Trial, user?: UserData): EmbedBuilder {
  const available = availableTrials(user)
  const completed = TRIALS.length - available.length
  const lines = selected
    ? [
        `${characterLabel(selected.characterName)} · ${selected.mode}`,
        trialAbilityLine(selected),
        trialGoalLine(selected),
        `Награда: **+${selected.bonusXp} XP**.`,
        'В 2 на 2 напарник — бот. Мастерство начисляется один раз за испытание.',
      ]
    : available.length === 0
      ? [
          'Все испытания выполнены — награды получены.',
          `Пройдено: **${TRIALS.length}/${TRIALS.length}**.`,
          'Можно вернуться в меню PvE.',
        ]
      : [
          'Испытания персонажей: сыграй за героя и выполни его цель.',
          `Доступно: **${available.length}** из ${TRIALS.length}.` +
            (completed > 0 ? ` Выполнено: **${completed}**.` : ''),
          'Награда — опыт мастерства этого персонажа. Выполненные испытания исчезают из списка.',
        ]
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('trials', '🏅')} Испытания`)
    .setDescription(lines.join('\n\n'))
    .setFooter({ text: 'Forsaken Simulator' })
}

export function trialsPanelComponents(user?: UserData): Array<
  ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
> {
  const available = availableTrials(user)
  const rows: Array<
    ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
  > = []
  if (available.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('trials:select')
      .setPlaceholder('Выбрать испытание')
      .addOptions(
        available.map(trial => {
          const emoji = characterEmojiData(trial.characterName)
          return {
            label: trial.characterName,
            description: `${trial.mode} · ${trialObjectiveText(trial)}`.slice(0, 100),
            value: trial.id,
            ...(emoji ? { emoji } : {}),
          }
        }),
      )
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu))
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  )
  return rows
}

function trialStartComponents(trial: Trial): ActionRowBuilder<ButtonBuilder>[] {
  const start = new ButtonBuilder()
    .setCustomId(`trials:start:${trial.id}`)
    .setLabel('Начать испытание')
    .setStyle(ButtonStyle.Success)
  const emoji = characterEmojiData(trial.characterName)
  if (emoji) start.setEmoji(emoji)
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      start,
      new ButtonBuilder()
        .setCustomId('pve:trials')
        .setLabel('← К списку')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function bossRushPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('boss', '👑')} Boss Rush`)
    .setDescription(
      [
        `Пять боссов подряд, каждый бой — 2 на 1. Между этапами восстанавливается 25% HP.`,
        `Награды: ${bossRushReward(1)} → ${bossRushReward(BOSS_RUSH_STAGES)} ${emojiText('points', '🪙')}.`,
        'Мастерство начисляется, PvP-статистика и квесты — нет.',
      ].join('\n\n'),
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function bossRushPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('bossrush:start:2x2')
        .setLabel('2 на 1')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

function bossRushNextComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('bossrush:next')
        .setLabel('Следующий босс')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('В меню PvE')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

function bossRushAgainComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('bossrush:start:2x2')
        .setLabel('Ещё забег')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('В меню PvE')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function pveBossComponents(): Array<
  ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<UserSelectMenuBuilder>
> {
  return [
    ...bossPanelComponents(),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId('pve:boss:invite')
        .setPlaceholder('Пригласить игрока в кооп')
        .setMinValues(1)
        .setMaxValues(1),
    ),
  ]
}

function trainingActiveBase(user: UserData): Character {
  return characterByName(user.active ?? '') ?? characterByName('Noob')!
}

function trainingPlayerBase(user: UserData, setup: TrainingSetup): Character {
  return (
    (setup.playerCharacter ? characterByName(setup.playerCharacter) : undefined) ??
    trainingActiveBase(user)
  )
}

function trainingPartnerBase(user: UserData, setup: TrainingSetup): Character {
  return (setup.partner ? characterByName(setup.partner) : undefined) ?? partnerCharacter(user)
}

function trainingBotBase(setup: TrainingSetup): Character {
  return characterByName(setup.botCharacter ?? '') ?? characterByName('Jason')!
}

function trainingBotPartnerBase(setup: TrainingSetup): Character {
  const chosen = setup.botPartner ? characterByName(setup.botPartner) : undefined
  if (chosen) return chosen
  const first = trainingBotBase(setup)
  return CHARACTERS.find(character => character.name !== first.name) ?? first
}

export function trainingPlayerCharacter(user: UserData, setup: TrainingSetup): Character {
  return characterWithSpecial(trainingPlayerBase(user, setup), setup.playerAbility)
}

export function trainingPartnerCharacter(user: UserData, setup: TrainingSetup): Character {
  return characterWithSpecial(trainingPartnerBase(user, setup), setup.partnerAbility)
}

export function trainingBotCharacter(setup: TrainingSetup): Character {
  return characterWithSpecial(trainingBotBase(setup), setup.botAbility)
}

export function trainingBotPartnerCharacter(setup: TrainingSetup): Character {
  return characterWithSpecial(trainingBotPartnerBase(setup), setup.botPartnerAbility)
}

export function trainingEntries(
  user: UserData,
  setup: TrainingSetup,
  userId: string,
  displayName: string,
): FighterEntry[] {
  const player: FighterEntry = {
    userId,
    name: displayName,
    character: trainingPlayerCharacter(user, setup),
  }
  if (setup.mode !== '2x2') return [player]
  return [
    player,
    {
      userId,
      name: displayName,
      character: trainingPartnerCharacter(user, setup),
    },
  ]
}

export function trainingSetupEmbed(user: UserData, setup: TrainingSetup): EmbedBuilder {
  const player = trainingPlayerCharacter(user, setup)
  const partner = trainingPartnerCharacter(user, setup)
  const bot = trainingBotCharacter(setup)
  const botPartner = trainingBotPartnerCharacter(setup)
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('swordwhite', '⚔️')} Тренировка`)
    .setDescription(
      [
        `Твой герой: ${userCharacterLabel(user, player.name)} · **${player.special.name}**`,
        `Напарник: ${userCharacterLabel(user, partner.name)} · **${partner.special.name}**`,
        `Бот 1: ${characterLabel(bot.name)} · **${bot.special.name}**`,
        ...(setup.mode === '2x2'
          ? [`Бот 2: ${characterLabel(botPartner.name)} · **${botPartner.special.name}**`]
          : []),
        `Формат: **${setup.mode === '2x2' ? '2 на 2' : '1 на 1'}**`,
      ].join('\n'),
    )
    .setFooter({ text: 'Без наград и статистики · Forsaken Simulator' })
}

function trainingAbilityOptions(character: Character, selected: string, language: 'ru' | 'en') {
  return availableSpecials(character).map(special => ({
    label: special.name,
    value: special.name,
    description: specialDescription(special, language).slice(0, 100),
    default: special.name === selected,
    ...(abilityEmojiData(character.name, special.name)
      ? { emoji: abilityEmojiData(character.name, special.name) }
      : {}),
  }))
}

function trainingCharacterOptions(selected: string) {
  return [
    {
      label: 'Случайный',
      value: 'random',
      default: false,
      ...(emojiData('question') ? { emoji: emojiData('question') } : {}),
    },
    ...CHARACTERS.map(character => ({
      label: character.name,
      value: character.name,
      default: character.name === selected,
      ...(characterEmojiData(character.name) ? { emoji: characterEmojiData(character.name) } : {}),
    })),
  ]
}

export function trainingSetupComponents(
  user: UserData,
  setup: TrainingSetup,
): Array<
  ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
> {
  const page = setup.page ?? 'player'
  const rows: Array<
    ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
  > = []
  if (page === 'player') {
    const playerBase = trainingPlayerBase(user, setup)
    const player = trainingPlayerCharacter(user, setup)
    const partnerBase = trainingPartnerBase(user, setup)
    const partner = trainingPartnerCharacter(user, setup)
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:player-character')
          .setPlaceholder('Герой')
          .addOptions(trainingCharacterOptions(playerBase.name)),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:ability')
          .setPlaceholder('Способность героя')
          .addOptions(trainingAbilityOptions(playerBase, player.special.name, user.language)),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:partner')
          .setPlaceholder('Напарник')
          .addOptions(trainingCharacterOptions(partnerBase.name)),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:partner-ability')
          .setPlaceholder('Способность напарника')
          .addOptions(trainingAbilityOptions(partnerBase, partner.special.name, user.language)),
      ),
    )
  } else {
    const botBase = trainingBotBase(setup)
    const bot = trainingBotCharacter(setup)
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:character')
          .setPlaceholder('Бот 1')
          .addOptions(trainingCharacterOptions(botBase.name)),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('pve:training:bot-ability')
          .setPlaceholder('Способность бота 1')
          .addOptions(trainingAbilityOptions(botBase, bot.special.name, user.language)),
      ),
    )
    if (setup.mode === '2x2') {
      const botPartnerBase = trainingBotPartnerBase(setup)
      const botPartner = trainingBotPartnerCharacter(setup)
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('pve:training:bot-partner')
            .setPlaceholder('Бот 2')
            .addOptions(trainingCharacterOptions(botPartnerBase.name)),
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('pve:training:bot-partner-ability')
            .setPlaceholder('Способность бота 2')
            .addOptions(
              trainingAbilityOptions(botPartnerBase, botPartner.special.name, user.language),
            ),
        ),
      )
    }
  }

  const sword = emojiData('swordwhite')
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(
          page === 'player' ? 'pve:training:page:enemies' : 'pve:training:page:player',
        )
        .setLabel(page === 'player' ? 'Бот →' : '← Игрок')
        .setStyle(ButtonStyle.Secondary),
      (() => {
        const button = new ButtonBuilder()
          .setCustomId('pve:training:start')
          .setLabel('Начать бой')
          .setStyle(ButtonStyle.Success)
        if (sword) button.setEmoji(sword)
        return button
      })(),
      new ButtonBuilder()
        .setCustomId('pve:training:mode')
        .setLabel(`Формат: ${setup.mode === '2x2' ? '2 на 2' : '1 на 1'}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pve:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  )
  return rows
}

export function debugPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('settings', '⚙️')} Дебаг`)
    .setDescription(
      [
        '**Выдать монеты** — начислить монеты себе или игроку по ID.',
        '**Тест баланса** — AI-прогон 1×1 или 2×2, при необходимости с фиксированным героем и способностью.',
        '**Арена ИИ** — 6 зеркальных боёв: нейросеть против эвристики.',
        '**Проверка** — пинг, аптайм, команды и состояние базы.',
        '',
        'Панель видна только создателю.',
      ].join('\n'),
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

export function debugPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const points = emojiData('points')
  const settings = emojiData('settings')
  const coinsButton = new ButtonBuilder()
    .setCustomId('debug:coins')
    .setLabel(points ? 'Выдать монеты' : '🪙 Выдать монеты')
    .setStyle(ButtonStyle.Primary)
  if (points) coinsButton.setEmoji(points)
  const testButton = new ButtonBuilder()
    .setCustomId('debug:test')
    .setLabel(settings ? 'Тест баланса' : '⚙️ Тест баланса')
    .setStyle(ButtonStyle.Secondary)
  if (settings) testButton.setEmoji(settings)
  const neural = emojiData('neural')
  const arenaButton = new ButtonBuilder()
    .setCustomId('debug:arena')
    .setLabel(neural ? 'Арена ИИ' : '🧠 Арена ИИ')
    .setStyle(ButtonStyle.Secondary)
  if (neural) arenaButton.setEmoji(neural)
  const timer = emojiData('timer')
  const statusButton = new ButtonBuilder()
    .setCustomId('debug:status')
    .setLabel(timer ? 'Проверка' : '⏳ Проверка')
    .setStyle(ButtonStyle.Secondary)
  if (timer) statusButton.setEmoji(timer)
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      coinsButton,
      testButton,
      arenaButton,
      statusButton,
    ),
  ]
}

export function arenaIntroEmbed(): EmbedBuilder {
  const policyMode = policyAiEnabled() && policyAvailable()
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('neural', '🧠')} Арена: нейросеть против эвристики`)
    .setDescription(
      [
        `**${ARENA_BATTLES} зеркальных боёв 1 на 1.** Обе стороны играют одним и тем же персонажем; в половине боёв нейросеть ходит первой, в половине — второй.`,
        'Персонажи: Jason, Guest 1337, Two Time.',
        '',
        policyMode
          ? 'Сейчас включена **policy-сеть** (`POLICY_AI=1`): запросы к LLM не тратятся, бой считается мгновенно.'
          : 'Один бой — примерно 10–20 запросов к модели. Весь прогон — **60–100 запросов**, заметная часть дневного лимита.',
        policyMode
          ? ''
          : 'Если часть ходов уйдёт в эвристику из-за лимита или таймаута, результат будет смешанным.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

export function arenaIntroComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('debug:arena:start')
        .setLabel(`Запустить ${ARENA_BATTLES} боёв`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('debug:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function arenaProgressEmbed(done: number, total: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('neural', '🧠')} Арена ИИ`)
    .setDescription(
      `Идёт бой **${done}/${total}**…\nСообщение обновится после каждого боя.`,
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

function perAction(damage: number, actions: number): string {
  return actions > 0 ? (damage / actions).toFixed(1) : '0.0'
}

export function arenaEmbed(result: ArenaResult): EmbedBuilder {
  const total = result.battles.length
  const winRate = total > 0 ? Math.round((result.llmWins / total) * 100) : 0
  const lines = result.battles.flatMap((battle, index) => {
    const outcome =
      battle.winner === null
        ? 'ничья'
        : battle.winner === battle.llmTeam
          ? 'победа ИИ'
          : 'победа эвристики'
    return [
      `${index + 1}. **${battle.character}** · ${outcome} · ${battle.turns} ходов · ` +
        `урон ${battle.llmDamage}:${battle.heuristicDamage}`,
      `   за ход ${perAction(battle.llmDamage, battle.llmActions)}:${perAction(
        battle.heuristicDamage,
        battle.heuristicActions,
      )} · получено ${battle.llmDamageTaken}:${battle.heuristicDamageTaken} · ` +
        `лечение ${battle.llmHealing}:${battle.heuristicHealing} · ` +
        `пустых ${battle.llmWasted}:${battle.heuristicWasted} · ` +
        `недобитых ${battle.llmMissedFinishes}:${battle.heuristicMissedFinishes}`,
    ]
  })
  const modelText = result.models.length > 0 ? result.models.join(', ') : '—'
  const fallbackNote =
    result.fallbacks > 0
      ? `⚠️ ${result.fallbacks} ходов нейросети заменила эвристика — результат смешанный.`
      : ''
  return new EmbedBuilder()
    .setColor(
      result.llmWins > result.heuristicWins
        ? EMBED_COLORS.victory
        : EMBED_COLORS.battle,
    )
    .setTitle(`${emojiText('neural', '🧠')} Арена: итог`)
    .setDescription(
      [
        `**Нейросеть ${result.llmWins} : ${result.heuristicWins} эвристика** · ничьих ${result.draws}`,
        `Побед нейросети: **${winRate}%** · средняя длина боя: **${result.avgTurns.toFixed(1)}** ходов`,
        `Урон: **${result.llmDamage}** : **${result.heuristicDamage}** · ` +
          `за ход **${perAction(result.llmDamage, result.llmActions)}** : **${perAction(
            result.heuristicDamage,
            result.heuristicActions,
          )}**`,
        `Получено урона: **${result.llmDamageTaken}** : **${result.heuristicDamageTaken}** · ` +
          `лечение: **${result.llmHealing}** : **${result.heuristicHealing}**`,
        `Пустых ходов: **${result.llmWasted}** : **${result.heuristicWasted}** · ` +
          `недобитых: **${result.llmMissedFinishes}** : **${result.heuristicMissedFinishes}**`,
        `Ходов модели: **${result.llmDecisions}** · откатов: **${result.fallbacks}**`,
        `Модель: ${modelText}.`,
        ...(fallbackNote ? ['', fallbackNote] : []),
        'Порядок: нейросеть : эвристика.',
        '',
        ...lines,
      ].join('\n'),
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

function localLlmStatusLine(): string {
  const status = localLlmStatus()
  if (!status.enabled) return ''
  if (status.ready) return `Локальная модель: **готова** (${status.baseUrl})`
  if (status.phase === 'downloading') {
    const received = Math.round(status.received / 1024 / 1024)
    const total =
      status.total > 0 ? `/${Math.round(status.total / 1024 / 1024)}` : ''
    const percent =
      status.total > 0
        ? ` · ${Math.round((status.received / status.total) * 100)}%`
        : ''
    return (
      `Локальная модель: **скачивание ${received}${total} МБ${percent}**` +
      (status.detail ? ` — ${status.detail}` : '')
    )
  }
  if (status.phase === 'extracting') {
    return 'Локальная модель: **распаковка llama.cpp**'
  }
  if (status.phase === 'starting') {
    return 'Локальная модель: **запуск llama-server**'
  }
  if (status.phase === 'checking') {
    return 'Локальная модель: **проверка файлов**'
  }
  if (status.phase === 'error') {
    return `Локальная модель: **ошибка** — ${status.error || status.detail || 'неизвестно'}`
  }
  return `Локальная модель: **${status.phase}**`
}

function policyStatusLine(): string {
  if (!policyAiEnabled()) {
    return policyAvailable() ? 'Policy AI: **выключена** (модель есть)' : ''
  }
  return policyAvailable()
    ? `Policy AI: **включена** (${policyWeightsPath()})`
    : 'Policy AI: **включена**, но policy-weights.json не найден'
}

export function debugStatusEmbed(client?: Client): EmbedBuilder {
  const errorSize = existsSync(ERROR_LOG_PATH) ? statSync(ERROR_LOG_PATH).size : 0
  const memory = Math.round(process.memoryUsage().rss / 1024 / 1024)
  const ping = client?.ws.ping ?? -1
  const pingText =
    Number.isFinite(ping) && ping >= 0 ? `${Math.round(ping)} мс` : 'нет данных'
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.victory)
    .setTitle(`${emojiText('timer', '⏳')} Проверка`)
    .setDescription(
      [
        '**Бот работает.**',
        `Пинг: **${pingText}**`,
        `Команд: **${commandDefinitions().length}**`,
        `Аптайм: **${formatDuration(process.uptime() * 1000)}**`,
        `Пользователей в базе: **${Object.keys(store.users).length}**`,
        `Активных боёв: **${battles.size}**`,
        `Ошибок в errors.log: **${errorSize} байт**`,
        `Память: **${memory} MB**`,
        localLlmStatusLine(),
        policyStatusLine(),
        client?.user ? `Бот: **${client.user.tag}**` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

export function debugCoinsModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('debug:coins:modal')
    .setTitle('Выдать монеты')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel('Сумма')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(7),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('target')
          .setLabel('Кому: ID или упоминание (пусто — себе)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(64),
      ),
    )
}

export function debugTestEmbed(setup: DebugTestSetup): EmbedBuilder {
  const special = setup.special ? ` · способность **${setup.special}**` : ''
  const battlesPerPair = setup.battlesPerPair ?? DEBUG_BATTLES_DEFAULT
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('settings', '⚙️')} Тест баланса`)
    .setDescription(
      [
        `Формат: **${setup.mode === '2x2' ? '2 на 2' : '1 на 1'}**`,
        `Персонаж: **${setup.character ?? 'все'}**${special}`,
        '',
        `Будет сыграно ${battlesPerPair} боёв на пару.`,
      ].join('\n'),
    )
    .setFooter({ text: 'Только для владельца · Forsaken Simulator' })
}

export function debugTestComponents(
  setup: DebugTestSetup,
): Array<
  ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
> {
  const character = setup.character ? characterByName(setup.character) : undefined
  const specials = character ? availableSpecials(character) : []
  const sword = emojiData('swordwhite')
  const duo = emojiData('duo')
  const question = emojiData('question')
  const settings = emojiData('settings')
  const modeMenu = new StringSelectMenuBuilder()
    .setCustomId('debug:test:mode')
    .setPlaceholder('Формат')
    .addOptions([
      {
        label: '1 на 1',
        value: '1x1',
        default: setup.mode === '1x1',
        ...(sword ? { emoji: sword } : {}),
      },
      {
        label: '2 на 2',
        value: '2x2',
        default: setup.mode === '2x2',
        ...(duo ? { emoji: duo } : {}),
      },
    ])
  const characterMenu = new StringSelectMenuBuilder()
    .setCustomId('debug:test:character')
    .setPlaceholder('Персонаж')
    .addOptions([
      {
        label: 'Все персонажи',
        value: 'all',
        default: !setup.character,
        ...(question ? { emoji: question } : {}),
      },
      ...CHARACTERS.map(entry => ({
        label: entry.name,
        value: entry.name,
        default: setup.character === entry.name,
        ...(characterEmojiData(entry.name) ? { emoji: characterEmojiData(entry.name) } : {}),
      })),
    ])
  const specialMenu = new StringSelectMenuBuilder()
    .setCustomId('debug:test:special')
    .setPlaceholder('Способность')
    .addOptions([
      { label: 'Все способности', value: 'all', default: !setup.special },
      ...specials.map(special => {
        const icon = character ? abilityEmojiData(character.name, special.name) : undefined
        return {
          label: special.name,
          value: special.name,
          default: setup.special === special.name,
          ...(icon ? { emoji: icon } : {}),
        }
      }),
    ])
  const battlesPerPair = setup.battlesPerPair ?? DEBUG_BATTLES_DEFAULT
  const battlesMenu = new StringSelectMenuBuilder()
    .setCustomId('debug:test:battles')
    .setPlaceholder('Боёв на пару')
    .addOptions(
      DEBUG_BATTLES_OPTIONS.map(count => ({
        label: `${count} боёв`,
        value: String(count),
        default: battlesPerPair === count,
      })),
    )
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(modeMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(characterMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(specialMenu),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(battlesMenu),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      (() => {
        const button = new ButtonBuilder()
          .setCustomId('debug:test:start')
          .setLabel('Запустить')
          .setStyle(ButtonStyle.Success)
        if (settings) button.setEmoji(settings)
        return button
      })(),
      new ButtonBuilder()
        .setCustomId('debug:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function bossCoopEmbed(
  creatorName: string,
  week = isoWeekKey(),
  targetId?: string,
  day = isoDayKey(),
): EmbedBuilder {
  const boss = bossForDay(day)
  const invitation = targetId
    ? `**${creatorName}** приглашает <@${targetId}> на босса **${boss.name}**.`
    : `**${creatorName}** ищет второго игрока на босса **${boss.name}**.`
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle(`${emojiText('boss', '👑')} Совместный босс`)
    .setDescription(
      `${invitation}\n\n` +
        'Каждый берёт своего активного персонажа. Награды и урон — каждому.',
    )
    .setFooter({ text: 'Совместный бой: двое игроков против босса' })
}

export function bossCoopComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('boss:coop:accept')
        .setLabel('Присоединиться')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('boss:coop:cancel')
        .setLabel('Отменить')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function bossCoopRematchComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const retry = emojiData('retry')
  const button = new ButtonBuilder()
    .setCustomId('boss:coop:again')
    .setLabel(retry ? 'Ещё раз' : '🔄 Ещё раз')
    .setStyle(ButtonStyle.Primary)
  if (retry) button.setEmoji(retry)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
}

function bossRetryComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const retry = emojiData('retry')
  const button = new ButtonBuilder()
    .setCustomId('boss:start:2x2')
    .setLabel(retry ? 'Ещё раз' : '🔄 Ещё раз')
    .setStyle(ButtonStyle.Primary)
  if (retry) button.setEmoji(retry)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
}

export function helpEmbed(user: UserData): EmbedBuilder {
  const en = user.language === 'en'
  const description = en
    ? [
        '**Commands**',
        `${emojiText('welcomehell', '👤')} \`/profile [user]\` — profile, shop, characters, quests, achievements, history, leaderboard and cosmetics.`,
        `${emojiText('swordwhite', '⚔️')} \`/pvp [opponent]\` — setup panel: 1v1/2v2, classic/random/draft, wager via modal, then a direct or open challenge.`,
        `${emojiText('boss', '👑')} \`/pve\` — PvE menu with Boss, Training and Survival buttons.`,
        `${emojiText('abilities', '📖')} \`/guide\` — quick guide to modes, statuses and progression.`,
        `${emojiText('settings', '⚙️')} \`/settings\` — interface and ability description language.`,
        `${emojiText('abilities', '📖')} \`/commands\` — this command list.`,
        `${emojiText('settings', '⚙️')} \`/debug\` — creator panel: coins, balance test and health check (owner only).`,
      ].join('\n')
    : [
        '**Команды**',
        `${emojiText('welcomehell', '👤')} \`/профиль [пользователь]\` — профиль, магазин, персонажи, квесты, достижения, история, лидеры и косметика.`,
        `${emojiText('swordwhite', '⚔️')} \`/пвп [соперник]\` — панель настройки: 1×1/2×2, классика/рандом/драфт, ставка через модалку, затем личный или открытый вызов.`,
        `${emojiText('boss', '👑')} \`/пве\` — меню PvE с кнопками «Босс», «Тренировка» и «Выживание».`,
        `${emojiText('abilities', '📖')} \`/гайд\` — краткий гайд по режимам, статусам и прогрессу.`,
        `${emojiText('settings', '⚙️')} \`/settings\` — язык интерфейса и описаний способностей.`,
        `${emojiText('abilities', '📖')} \`/команды\` — этот список команд.`,
        `${emojiText('settings', '⚙️')} \`/дебаг\` — панель создателя: монеты, тест баланса и проверка (только владелец).`,
      ].join('\n')

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('abilities', '📖')} ${en ? 'Help' : 'Помощь'}`)
    .setDescription(description)
    .setFooter({
      text: en ? 'Forsaken Simulator · language: English' : 'Forsaken Simulator · язык: русский',
    })
}

const languagePromptSource = new Map<string, 'command' | 'button'>()

export function languagePickerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle('🌐 Choose language / Выбери язык')
    .setDescription(
      'Pick the interface language. You can change it later with `/settings`.\n' +
        'After choosing, repeat the action you started.\n' +
        'Выбери язык интерфейса. Потом его можно сменить в `/settings`.\n' +
        'Потом повтори действие, которое начал.',
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function shouldPromptLanguage(user: UserData, customId: string): boolean {
  return !customId.startsWith('onboarding:') && !user.onboarded
}

export function languagePickerComponents(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding:lang:ru')
        .setLabel('🇷🇺 Русский')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('onboarding:lang:en')
        .setLabel('🇬🇧 English')
        .setStyle(ButtonStyle.Secondary),
    ),
  ]
}

export function onboardingEmbed(user?: UserData, note?: string): EmbedBuilder {
  const en = user?.language === 'en'
  const lines = en
    ? [
        '**1. Profile** — `/profile`: characters, shop, quests and rewards.',
        '**2. Battle** — `/pvp`: pick 1×1 or 2×2 and a mode; the wager is optional.',
        '**3. PvE** — `/pve`: boss, training and survival.',
        '**4. Help** — `/guide` and `/commands` explain modes, statuses and progression.',
        'Start with `/profile` and claim the daily bonus.',
      ]
    : [
        '**1. Профиль** — `/профиль`: персонажи, магазин, квесты и награды.',
        '**2. Бой** — `/пвп`: выбери 1×1 или 2×2 и режим; ставка необязательна.',
        '**3. PvE** — `/пве`: босс, тренировка и выживание.',
        '**4. Помощь** — `/гайд` и `/команды` объясняют режимы, статусы и прогресс.',
        'Начни с `/профиль` и забери ежедневный бонус.',
      ]
  if (note) lines.push(note)
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(
      `${emojiText('welcomehell', '👤')} ${
        en ? 'Welcome to Forsaken Simulator' : 'Добро пожаловать в Forsaken Simulator'
      }`,
    )
    .setDescription(lines.join('\n'))
    .setFooter({
      text: en ? 'Shown once · Forsaken Simulator' : 'Показывается один раз · Forsaken Simulator',
    })
}

export function onboardingComponents(user?: UserData): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding:done')
        .setLabel(user?.language === 'en' ? 'Got it' : 'Понятно')
        .setStyle(ButtonStyle.Success),
    ),
  ]
}

export function guideEmbed(user?: UserData): EmbedBuilder {
  const en = user?.language === 'en'
  if (user?.compactMode) {
    return new EmbedBuilder()
      .setColor(EMBED_COLORS.choose)
      .setTitle(`${emojiText('abilities', '📖')} ${en ? 'Guide' : 'Гайд'}`)
      .setDescription(
        en
          ? [
              `${emojiText('swordwhite', '⚔️')} **Modes:** Classic / Random / Draft, 1×1 / 2×2.`,
              `${emojiText('swordwhite', '⚔️')} **Battle:** 90-second turns, dodge +60%, statuses and log in Forecast.`,
              `${emojiText('xp', '⭐')} **Progress:** mastery 1–10, bronze/silver/gold skins, quests and the weekly boss.`,
            ].join('\n')
          : [
              `${emojiText('swordwhite', '⚔️')} **Режимы:** Классика / Рандом / Драфт, 1×1 / 2×2.`,
              `${emojiText('swordwhite', '⚔️')} **Бой:** ходы по 90 секунд, уворот +60%, статусы и лог в «Прогнозе».`,
              `${emojiText('xp', '⭐')} **Прогресс:** мастерство 1–10, бронза/серебро/золото, квесты и босс недели.`,
            ].join('\n'),
      )
      .setFooter({ text: 'Forsaken Simulator' })
  }
  const description = en
    ? [
        `${emojiText('swordwhite', '⚔️')} **Modes**`,
        '• **Classic** — your active and second character.',
        '• **Random** — random heroes and abilities for both players.',
        '• **Draft** — a shared pool of 12 heroes, bans, picks and an ability-choice phase.',
        '• **1×1 / 2×2** — pick the format in `/pvp`; in 2×2 each player controls two heroes.',
        '',
        `${emojiText('swordwhite', '⚔️')} **Battle**`,
        '• 90 seconds per turn; the first miss is an automatic rest, the second is a defeat.',
        '• Base dodge is 0%; the Dodge +60% button lasts until the first attack against you.',
        '• Attack, ability, dodge, rest; Forecast shows effects and the battle log.',
        '',
        `${emojiText('weakness', '🔻')} **Statuses**`,
        '• STR +20% damage · WEAK −20% damage · VULN +20% taken · RES −20% taken.',
        '• CREATURES +25% taken · REGEN +8 HP at turn start · HEMORRHAGE blocks healing.',
        '• GLITCH blocks abilities · SLATESKIN +25 HP and DoT immunity · HASTE doubles cooldown ticks.',
        '',
        `${emojiText('passive', '🔹')} **2×2 synergies**`,
        '• Plead, Survival for the Fittest, You and I, Creation of Hatred, Dead Ringer and And the Seraphim Wept reward LMS pairs on one team.',
        '',
        `${emojiText('xp', '⭐')} **Progression**`,
        '• Mastery 1–10: +50 coins per level; at 3/6/10 — badges and +150/+300/+600.',
        '• Mastery level 10 unlocks a golden character skin.',
        '• Daily quests plus one weekly quest with a large reward.',
        '• Weekly boss: 150 coins per win and +250 for the first win of the week.',
      ]
    : [
        `${emojiText('swordwhite', '⚔️')} **Режимы**`,
        '• **Классика** — твои активный и второй персонаж.',
        '• **Рандом** — случайные герои и способности у обоих игроков.',
        '• **Драфт** — общий пул 12 героев, баны, пики и отдельный выбор способностей.',
        '• **1×1 / 2×2** — формат выбирается в `/пвп`; в 2×2 у каждого два героя.',
        '',
        `${emojiText('swordwhite', '⚔️')} **Бой**`,
        '• 90 секунд на ход; первый пропуск — передышка, второй — поражение.',
        '• Базовый уворот 0%; кнопка «Уворот +60%» действует до первой атаки по тебе.',
        '• Атака, способность, уворот, передышка; «Прогноз» показывает эффекты и лог.',
        '',
        `${emojiText('weakness', '🔻')} **Статусы**`,
        '• STR +20% урона · WEAK −20% урона · VULN +20% получаемого · RES −20% получаемого.',
        '• CREATURES +25% получаемого · REGEN +8 HP в начале хода · HEMORRHAGE запрещает лечение.',
        '• GLITCH блокирует способность · SLATESKIN +25 HP и иммунитет к DoT · HASTE ускоряет КД вдвое.',
        '',
        `${emojiText('passive', '🔹')} **Синергии 2×2**`,
        '• Plead, Survival for the Fittest, You and I, Creation of Hatred, Dead Ringer и And the Seraphim Wept — бонусы за LMS-пары в одной команде.',
        '',
        `${emojiText('xp', '⭐')} **Прогресс**`,
        '• Мастерство 1–10: +50 монет за уровень; на 3/6/10 — бейджи и +150/+300/+600.',
        '• На 10 уровне открывается золотой скин героя.',
        '• Ежедневные квесты и один недельный квест с крупной наградой.',
        '• Босс недели: 150 монет за победу и +250 за первую победу на неделе.',
      ]
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('abilities', '📖')} ${en ? 'Guide' : 'Гайд'}`)
    .setDescription(description.join('\n'))
    .setFooter({ text: 'Forsaken Simulator' })
}

export function settingsEmbed(user: UserData): EmbedBuilder {
  const en = user.language === 'en'
  const language = en ? 'English' : 'Русский'
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('settings', '⚙️')} ${en ? 'Settings' : 'Настройки'}`)
    .setDescription(
      en
        ? `Interface and ability description language: **${language}**\n` +
            'Ability names always stay English, as on the wiki.\n' +
            'Choose a language in the menu below.'
        : `Язык интерфейса и описаний способностей: **${language}**\n` +
            'Названия способностей всегда остаются английскими, как на вики.\n' +
            'Выбери язык в меню ниже.',
    )
}

export function settingsComponents(user: UserData): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const en = user.language === 'en'
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('settings:language')
        .setPlaceholder(en ? 'Interface language' : 'Язык интерфейса')
        .addOptions(
          {
            label: en ? 'Russian' : 'Русский',
            description: en
              ? 'Russian interface and descriptions'
              : 'Русский язык интерфейса и описаний',
            value: 'ru',
            default: user.language === 'ru',
            emoji: '🇷🇺',
          },
          {
            label: 'English',
            description: en
              ? 'English interface and descriptions'
              : 'Английский язык интерфейса и описаний',
            value: 'en',
            default: user.language === 'en',
            emoji: '🇬🇧',
          },
        ),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      (() => {
        const button = new ButtonBuilder()
          .setCustomId('settings:compact')
          .setLabel(
            en
              ? `Compact panels: ${user.compactMode ? 'on' : 'off'}`
              : `Компактные панели: ${user.compactMode ? 'вкл' : 'выкл'}`,
          )
          .setStyle(user.compactMode ? ButtonStyle.Success : ButtonStyle.Secondary)
        const icon = emojiData(user.compactMode ? 'check' : 'settings')
        if (icon) button.setEmoji(icon)
        return button
      })(),
    ),
  ]
}

export function chooseEmbed(user: UserData): EmbedBuilder {
  const active = characterByName(user.active ?? '')
  const selected = active ? selectedSpecial(active, user.loadouts[active.name]) : null
  const otherOwned = ownedCharacters(user).filter(character => character.name !== active?.name)
  const partner = otherOwned.length > 0 ? partnerCharacter(user) : null
  const partnerBase = partner ? characterByName(partner.name) : null
  const partnerSelected = partnerBase
    ? selectedSpecial(partnerBase, user.loadouts[partnerBase.name])
    : null
  const activePassive = active ? characterPassive(active) : undefined
  const partnerPassive = partnerBase ? characterPassive(partnerBase) : undefined
  const passiveText = (passive: Passive) =>
    `${emojiText('passive', '🔹')} **${passive.name}** — ${passiveDescription(passive.name, passive.description, user.language)}`
  const lines = [
    `Куплено: **${user.owned.length}/${CHARACTERS.length}**`,
    active
      ? `Активный: ${userCharacterLabel(user, active.name)} · ${characterClass(active)}`
      : 'Активный: —',
    activePassive ? `Пассивка: ${passiveText(activePassive)}` : '',
    partner
      ? `Второй персонаж (2 на 2): ${userCharacterLabel(user, partner.name)}${user.partner ? '' : ' · авто'}`
      : 'Второй персонаж: —',
    partnerPassive ? `Пассивка напарника: ${passiveText(partnerPassive)}` : '',
    selected
      ? `Способность: **${selected.name}** — ${specialDescription(selected, user.language)}`
      : '',
    partnerSelected
      ? `Способность напарника: **${partnerSelected.name}** — ${specialDescription(partnerSelected, user.language)}`
      : '',
    'Выбери активного персонажа, напарника и их способности в меню ниже.',
  ].filter(Boolean)

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle('Выбор персонажа')
    .setDescription(lines.join('\n'))
}

export function characterEmbed(character: Character, user: UserData): EmbedBuilder {
  const price =
    character.price === 0 ? 'бесплатно' : `${character.price} ${emojiText('points', '🪙')}`
  const specials = availableSpecials(character)
  const selected = selectedSpecial(character, user.loadouts[character.name])
  const passive = characterPassive(character)
  const abilityLines = [
    ...specials.map(special => {
      const icon = abilityEmojiText(character.name, special.name)
      const mark =
        special.name === selected.name ? emojiText('check', '✅') : emojiText('dot', '▫️')
      const description = specialDescription(special, user.language)
      const cd = hasCooldownInDescription(description) ? '' : ` · ${cooldownLabel(special)}`
      return `${mark} ${icon ? `${icon} ` : ''}**${special.name}** — ${description}${cd}`
    }),
    passive
      ? `${emojiText('passive', '🔹')} **${passive.name}** — ${passiveDescription(passive.name, passive.description, user.language)}`
      : '',
    character.name === 'Azure'
      ? `${emojiText('atropa', '🌸')} **Atropa** — ${atropaDescription(user.language)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
  const stat = user.characterStats[character.name]
  const battles = stat ? stat.wins + stat.losses : 0
  const statsValue =
    !stat || battles === 0
      ? 'Пока нет боёв'
      : `${battles} ${plural(battles, 'бой', 'боя', 'боёв')} · ` +
        `${stat.wins} ${plural(stat.wins, 'победа', 'победы', 'побед')} · ` +
        `${Math.round((stat.wins / battles) * 100)}%`
  const xp = stat?.xp ?? 0
  const level = masteryLevel(xp)
  const prestige = prestigeLevel(stat)
  const stars = prestigeStars(prestige)
  const badge = masteryBadge(level)
  const xpIcon = emojiText('xp', '')
  const masteryValue = `${stars ? `${stars} · ` : ''}Ур. ${level} «${masteryTitle(level)}»${
    badge ? ` · ${badge}` : ''
  }\n${xpIcon ? `${xpIcon} ` : ''}${level >= 10 ? 'MAX' : `${xp % 100}/100 XP`}`
  const wins = stat?.wins ?? 0
  const trialTitle = trialTitleForWins(wins)
  const nextTrial = TRIAL_TIERS.find(tier => wins < tier.wins)
  const trialValue = [
    trialTitle ? `${trialTitle} (${wins} побед)` : `0/${TRIAL_TIERS[0].wins} побед`,
    nextTrial ? `До «${nextTrial.title}»: ${wins}/${nextTrial.wins}` : 'Максимальное испытание',
  ].join('\n')
  const owned = user.owned.includes(character.name)
  const equipped = equippedSkin(user, character.name)
  const next = nextSkin(character.name, xp)
  const skinProgress = next
    ? `До «${skinName(next, user.language)}»: ${Math.max(
        0,
        (next.level - 1) * 100 - xp,
      )} XP`
    : 'Максимальный скин'
  const skinValue = !owned
    ? 'не куплен'
    : [
        equipped
          ? `${emojiText(equipped.emoji, '')} ${skinName(equipped, user.language)}`.trim()
          : 'не выбран',
        skinProgress,
      ].join('\n')

  return new EmbedBuilder()
    .setColor(character.role === 'killer' ? EMBED_COLORS.battle : EMBED_COLORS.victory)
    .setTitle(userCharacterLabel(user, character.name))
    .setDescription(characterClass(character))
    .addFields(
      {
        name: `${emojiText('abilities', '📖')} Способность`,
        value: abilityLines,
      },
      { name: `${emojiText('hp', '❤️')} HP`, value: `${character.hp}`, inline: true },
      { name: 'Урон', value: `${character.attack}`, inline: true },
      { name: 'Цена', value: price, inline: true },
      {
        name: 'В коллекции',
        value: user.owned.includes(character.name) ? 'да' : 'нет',
        inline: true,
      },
      { name: 'Твоя статистика', value: statsValue, inline: true },
      { name: `${emojiText('xp', '⭐')} Мастерство`, value: masteryValue, inline: true },
      { name: `${emojiText('mvp', '🏅')} Испытание`, value: trialValue, inline: true },
      { name: 'Скин', value: skinValue, inline: true },
    )
    .setFooter({ text: 'Forsaken Simulator' })
}

export function characterPromptEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('abilities', '📖')} Способности персонажей`)
    .setDescription(
      `${emojiText('question', '❓')} Выбери персонажа в меню ниже, чтобы прочитать его способности.`,
    )
}

function filterCharacters(
  characters: readonly Character[],
  user: UserData,
  filter: CharacterFilter,
): Character[] {
  if (filter === 'owned') return characters.filter(entry => user.owned.includes(entry.name))
  return [...characters]
}

export function characterBrowserComponents(
  showBack: boolean,
  character?: Character,
  user?: UserData,
  canEdit = false,
  filter: CharacterFilter = 'all',
): Array<ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>> {
  const rows: Array<
    ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<ButtonBuilder>
  > = [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('char:view')
        .setPlaceholder('Выбери персонажа')
        .addOptions(
          (user
            ? orderCharactersByFavorites(
                filterCharacters(CHARACTERS, user, filter),
                user.favorites,
              )
            : CHARACTERS
          ).map(entry => {
              const emoji = user
                ? userCharacterEmojiData(user, entry.name)
                : characterEmojiData(entry.name)
              const favorite = user?.favorites.includes(entry.name) ?? false
              return {
                label: favorite ? `⭐ ${entry.name}` : entry.name,
                description: characterOptionDescription(entry, characterClass(entry)),
                value: entry.name,
                ...(emoji ? { emoji } : {}),
              }
            },
          ),
        ),
    ),
  ]

  if (!character && user) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('char:filter')
          .setPlaceholder('Фильтр')
          .addOptions([
            { label: 'Все', value: 'all', default: filter === 'all' },
            { label: 'Купленные', value: 'owned', default: filter === 'owned' },
          ]),
      ),
    )
  }

  if (canEdit && character && user && user.owned.includes(character.name)) {
    const specials = availableSpecials(character)
    if (specials.length > 1) {
      const selected = selectedSpecial(character, user.loadouts[character.name])
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `char:special:${CHARACTERS.findIndex(entry => entry.name === character.name)}`,
            )
            .setPlaceholder('Выбери способность')
            .addOptions(
              specials.map(special => {
                const icon = abilityEmojiData(character.name, special.name)
                return {
                  label: special.name,
                  description: abilityOptionDescription(special, user.language),
                  value: special.name,
                  default: special.name === selected.name,
                  ...(icon ? { emoji: icon } : {}),
                }
              }),
            ),
        ),
      )
    }

    const xp = user.characterStats[character.name]?.xp ?? 0
    const unlocked = unlockedSkins(character.name, xp)
    if (unlocked.length > 0) {
      const equipped = equippedSkin(user, character.name)
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `char:skin:${CHARACTERS.findIndex(entry => entry.name === character.name)}`,
            )
            .setPlaceholder('Выбери скин')
            .addOptions([
              ...unlocked.map(skin => {
                const icon = emojiData(skin.emoji)
                return {
                  label: skinName(skin, user.language),
                  description: skinDescription(skin, user.language),
                  value: skin.id,
                  default: equipped?.id === skin.id,
                  ...(icon ? { emoji: icon } : {}),
                }
              }),
              {
                label: 'Обычный вид',
                description: 'Снять скин',
                value: 'none',
                default: !equipped,
              },
            ]),
        ),
      )
    }
  }

  if (canEdit && character && user && user.owned.includes(character.name)) {
    const favorite = user.favorites.includes(character.name)
    const stat = user.characterStats[character.name]
    const xp = stat?.xp ?? 0
    const prestige = prestigeLevel(stat)
    const index = CHARACTERS.findIndex(entry => entry.name === character.name)
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`char:favorite:${index}`)
        .setLabel(favorite ? 'Убрать из избранного' : 'В избранное')
        .setStyle(favorite ? ButtonStyle.Secondary : ButtonStyle.Primary),
    ]
    if (xp >= MASTERY_MAX_XP) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`char:prestige:${index}`)
          .setLabel(prestige > 0 ? `Престиж ★${prestige}` : 'Престиж')
          .setStyle(ButtonStyle.Success),
      )
    }
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons))
  }

  if (showBack) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('hub:back').setLabel('← Назад').setStyle(ButtonStyle.Secondary),
      ),
    )
  }

  return rows
}

function hpBar(side: Side): string {
  const filled = Math.max(0, Math.min(10, Math.ceil((side.hp / side.maxHp) * 10)))
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`
}

function sideStatus(side: Side): string {
  const remainingCooldown = side.boss ? 0 : cooldownAfterTick(side)
  const baseCooldown = side.boss ? 0 : specialCooldown(specialOf(side))
  const cooldownText = (index = 0): string => {
    const base = specialCooldown(specialOf(side, index))
    if (base <= 0) return 'готово'
    return `${cooldownAfterTick(side, index)}/${base}`
  }
  return [
    side.juking || side.blocking ? emojiText('dodge', '🌀') : '',
    side.shield > 0 ? emojiText('shield', '🛡️') : '',
    side.tempHp > 0 ? `${emojiText('timer', '⏳')} TEMP ${side.tempHp}` : '',
    side.character.name === 'Veeronica' ? `${emojiText('battery', '🔋')} ${side.charge}%` : '',
    side.shatterpoint > 0 ? `SP ${side.shatterpoint}` : '',
    side.resonance > 0 ? `RESONANCE ×${side.resonance}` : '',
    side.stunned ? `${emojiText('stun', '💫')} STUN` : '',
    side.counterReady ? `${emojiText('guestpunch', '⚔️')} контрудар` : '',
    side.empoweredAttack ? `${emojiText('sfoth', '⚔️')} меч усилен` : '',
    side.effects.strength ? `${emojiText('strength', '💪')} STR(${side.effects.strength})` : '',
    side.effects.weakness ? `${emojiText('weakness', '🔻')} WEAK(${side.effects.weakness})` : '',
    side.effects.vulnerable ? `${emojiText('vulnerable', '🎯')} VULN(${side.effects.vulnerable})` : '',
    side.effects.resistance ? `${emojiText('shield', '🛡️')} RES(${side.effects.resistance})` : '',
    side.effects.creatures ? `${emojiText('creatures', '🦇')} CREATURES(${side.effects.creatures})` : '',
    side.effects.regeneration ? `${emojiText('regeneration', '💚')} REGEN(${side.effects.regeneration})` : '',
    side.effects.hemorrhage ? `${emojiText('hemorrhage', '🩸')} HEMORRHAGE(${side.effects.hemorrhage})` : '',
    side.effects.glitch ? `${emojiText('glitch', '👾')} GLITCH(${side.effects.glitch})` : '',
    side.effects.slateskin ? `${emojiText('slateskin', '🪨')} SLATESKIN(${side.effects.slateskin})` : '',
    side.effects.haste ? `${emojiText('haste', '⚡')} HASTE(${side.effects.haste})` : '',
    side.atropa > 0
      ? `${emojiText('atropa', '🌸')} ATROPA ×${side.atropa} (+${side.atropa} DMG)`
      : '',
    side.purified
      ? `${emojiText('purified', '✨')} PURIFIED ${purifiedReduction(side)}%`
      : '',
    side.sword ? `${emojiText('sfoth', '⚔️')} ${side.sword}` : '',
    side.bloodHuntCharges > 0 ? `${emojiText('bloodhunt', '🩸')}×${side.bloodHuntCharges}` : '',
    remainingCooldown > 0 && baseCooldown > 0
      ? `КД ${remainingCooldown}/${baseCooldown}`
      : '',
    side.boss
      ? `${emojiText('boss', '👑')} ${specialOf(side, 0).name} [${cooldownText(0)}] / ` +
        `${specialOf(side, 1).name} [${cooldownText(1)}]`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function teamLabel(battle: Battle, team: 0 | 1): string {
  const members = battle.sides.filter(
    side => side.team === team && !side.fake && !side.minion,
  )
  if (members.length === 1 && members[0].boss) return members[0].name
  if (members.length === 0) {
    const minions = battle.sides.filter(
      side => side.team === team && side.minion && side.hp > 0,
    ).length
    return minions > 0 ? 'Миньоны' : '—'
  }
  const owners = [...new Set(members.map(side => side.name))]
  const characters = members.map(side => side.character.name).join(' + ')
  return `${owners.join(' и ')} (${characters})`
}

export function userCharacterLabel(user: UserData, characterName: string): string {
  const skin = equippedSkin(user, characterName)
  return skinnedCharacterLabel(characterName, skin?.emoji)
}

export function userCharacterEmojiData(
  user: UserData,
  characterName: string,
): { id: string; name: string } | undefined {
  const skin = equippedSkin(user, characterName)
  const skinEmoji = skin ? emojiData(skin.emoji) : undefined
  return skinEmoji ?? characterEmojiData(characterName)
}

function sideCharacterLabel(side: Side): string {
  if (isAutomatedSide(side)) return skinnedCharacterLabel(side.character.name)
  return userCharacterLabel(userOf(side.userId), side.character.name)
}

function minionSummaryLines(minions: Side[]): string[] {
  const rotten = minions.filter(side => !side.pizzaMinion && !side.structure)
  const pizza = minions.filter(side => side.pizzaMinion)
  const sentries = minions.filter(side => side.structure === 'sentry')
  const dispensers = minions.filter(side => side.structure === 'dispenser')
  const hp = (group: Side[]) =>
    `**${group.reduce((sum, side) => sum + side.hp, 0)}/${group.reduce(
      (sum, side) => sum + side.maxHp,
      0,
    )}**`
  const lines: string[] = []
  if (rotten.length > 0) {
    lines.push(
      `${emojiText('rottenminion', '🧟')} Миньоны: **${rotten.length}** · HP ${hp(rotten)} · ` +
        `атака **${rotten.reduce((sum, side) => sum + side.character.attack, 0)}**`,
    )
  }
  if (pizza.length > 0) {
    lines.push(
      `${emojiText('pizzadelivery', '🍕')} Пицца-миньоны: **${pizza.length}** · HP ${hp(pizza)}`,
    )
  }
  if (sentries.length > 0) {
    lines.push(
      `${emojiText('sentry', '🔫')} Турели: **${sentries.length}** · HP ${hp(sentries)} · ` +
        `урон **${sentries.reduce((sum, side) => sum + side.character.attack, 0)}**`,
    )
  }
  if (dispensers.length > 0) {
    lines.push(
      `${emojiText('dispenser', '💉')} Диспенсеры: **${dispensers.length}** · HP ${hp(dispensers)}`,
    )
  }
  return lines
}

function abilityBreakdown(side: Side, limit = 3): string {
  const entries = Object.entries(side.abilityStats ?? {})
    .filter(([, stat]) => stat.uses > 0)
    .sort((left, right) => right[1].uses - left[1].uses)
    .slice(0, limit)
    .map(([name, stat]) => {
      const parts = [`${stat.uses}×`]
      if (stat.damage > 0) parts.push(`${stat.damage} урона`)
      if (stat.healing > 0) parts.push(`${stat.healing} лечения`)
      return `${name} ${parts.join(', ')}`
    })
  return entries.join('; ')
}

export function battleStatsEmbed(battle: Battle): EmbedBuilder {
  const lines = battle.sides
    .filter(side => !side.fake && !side.minion)
    .map(side => {
      const breakdown = abilityBreakdown(side, 6)
      return (
        `**${side.character.name}** (${side.name})\n` +
        `Урон: **${side.damageDealt}** · Лечение: **${side.healingDone}** · ` +
        `Получено: **${side.damageTaken}** · Способностей: **${side.abilityUses}**` +
        (breakdown ? `\n${breakdown}` : '')
      )
    })
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('achievement', '📊')} Статистика боя`)
    .setDescription(lines.join('\n\n').slice(0, 4096))
}

export function battleStatsText(battle: Battle): string {
  const lines = battle.sides
    .filter(side => !side.fake && !side.minion)
    .map(side => {
      const who = side.boss
        ? `${emojiText('boss', '👑')} ${side.name} (${side.character.name})`
        : `${sideCharacterLabel(side)} **${side.name}**`
      const breakdown = abilityBreakdown(side)
      return (
        `${who} — ${side.damageDealt} урона · ${side.healingDone} лечения · ` +
        `${side.abilityUses} способностей${breakdown ? ` (${breakdown})` : ''}`
      )
    })

  const minions = battle.sides.filter(side => side.minion && side.hp > 0)
  lines.push(...minionSummaryLines(minions))

  const mvp = [...battle.sides]
    .filter(
      side =>
        !side.fake &&
        !side.minion &&
        (side.damageDealt > 0 || side.healingDone > 0),
    )
    .sort(
      (left, right) =>
        right.damageDealt + right.healingDone - (left.damageDealt + left.healingDone) ||
        right.damageDealt - left.damageDealt,
    )[0]
  if (mvp) {
    lines.push(
      `${emojiText('mvp', '🏅')} MVP: **${mvp.name}** (${mvp.character.name}) — ${mvp.damageDealt} урона, ${mvp.healingDone} лечения`,
    )
  }
  return lines.join('\n').slice(0, 1024)
}

export function forecastEmbed(
  battle: Battle,
  side: Side,
  log: string[] = [],
): EmbedBuilder {
  const language = activeLanguage()
  const ownDodge = Math.round(jukeChanceOf(side) * 100)
  let attackMin = side.character.attack
  let attackMax = attackMin + 4
  if (side.effects.strength) {
    attackMin = Math.ceil(attackMin * 1.2)
    attackMax = Math.ceil(attackMax * 1.2)
  }
  if (side.effects.weakness) {
    attackMin = Math.ceil(attackMin * 0.8)
    attackMax = Math.ceil(attackMax * 0.8)
  }

  const special = specialOf(side)
  const baseCooldown = specialCooldown(special)
  const cooldown =
    baseCooldown > 0 ? `${cooldownAfterTick(side)}/${baseCooldown}` : 'готово'
  const enemySides = battle.sides.filter(
    candidate => candidate.team !== side.team && candidate.hp > 0,
  )
  const minionEnemies = enemySides.filter(candidate => candidate.minion)
  const enemies = enemySides.filter(candidate => !candidate.minion)
  const lines = [
    `**${sideCharacterLabel(side)} ${side.name}**`,
    `HP ${side.hp}/${side.maxHp} · уворот ${ownDodge}%${dodgePenalty(side)} · атака ${attackMin}–${attackMax}`,
    `**Способность:** ${special.name} — ${specialDescription(special, language)} · КД ${cooldown}`,
    side.synergy
      ? `**Синергия:** **${side.synergy.name}** — ${side.synergy.description}`
      : '',
    '',
    '**Цели:**',
    ...enemies.map(
      enemy =>
        `${sideCharacterLabel(enemy)} ${enemy.name} — HP ${enemy.hp}/${enemy.maxHp} · уворот ${Math.round(jukeChanceOf(enemy) * 100)}%${dodgePenalty(enemy)}`,
    ),
    ...minionSummaryLines(minionEnemies),
    '',
    '**Статусы:**',
    ...statusLines(battle),
  ]
  const help = statusHelpLines(battle)
  if (help.length > 0) {
    lines.push('', '**Расшифровка эффектов:**', ...help)
  }
  if (log.length > 0) {
    lines.push('', '**Лог боя:**', ...log.slice(-8))
  }

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('question', '❓')} Прогноз хода`)
    .setDescription(lines.join('\n').slice(0, 4096))
}

function statusLines(battle: Battle): string[] {
  return battle.sides
    .filter(side => !side.fake && !side.minion)
    .map(side => {
      const mods = side.jukeMods.map(
        mod =>
          `${mod.source} ${mod.amount >= 0 ? '+' : ''}${Math.round(mod.amount * 100)}% (${mod.turns})`,
      )
      const stance = side.juking
        ? `стойка +${Math.round(JUKE_STANCE_BONUS * 100)}% (${side.jukingTurns})`
        : side.blocking
          ? `стойка +${Math.round(JUKE_STANCE_BONUS * 100)}% (1)`
          : ''
      const battery = batteryDodgeBonusOf(side)
      const batteryText =
        battery === 0
          ? ''
          : `батарея ${battery > 0 ? '+' : '−'}${Math.abs(Math.round(battery * 100))}%`
      const dodgeDetails = [...mods, batteryText, stance].filter(Boolean).join(' · ')
      return [
        `${sideCharacterLabel(side)} **${side.name}** — ${side.hp}/${side.maxHp} HP`,
        `Уворот: **${Math.round(jukeChanceOf(side) * 100)}%**${dodgeDetails ? ` · ${dodgeDetails}` : ''}`,
        `Эффекты: ${sideStatus(side) || '—'}`,
      ].join('\n')
    })
}

export function statusEmbed(battle: Battle): EmbedBuilder {
  const help = statusHelpLines(battle)
  const body = [...statusLines(battle)]
  const minions = battle.sides.filter(side => side.minion && side.hp > 0)
  body.push(...minionSummaryLines(minions))
  if (help.length > 0) body.push(['**Расшифровка эффектов:**', ...help].join('\n'))
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(`${emojiText('masks', '🎭')} Статусы`)
    .setDescription(body.join('\n\n').slice(0, 4096))
}

const STATUS_HELP: Array<[StatusName, string]> = [
  ['strength', 'STR — +20% к наносимому урону.'],
  ['weakness', 'WEAK — −20% к наносимому урону.'],
  ['vulnerable', 'VULN — +20% к получаемому урону.'],
  ['resistance', 'RES — −20% к получаемому урону.'],
  ['creatures', 'CREATURES — +25% к получаемому урону.'],
  ['regeneration', 'REGEN — +8 HP в начале хода.'],
  ['hemorrhage', 'HEMORRHAGE — нельзя лечиться.'],
  ['glitch', 'GLITCH — способность заблокирована.'],
  ['slateskin', 'SLATESKIN — +25 HP сверх максимума и иммунитет к DoT.'],
  ['haste', 'HASTE — перезарядка ускоряется вдвое.'],
]

function statusHelpLines(battle: Battle): string[] {
  const active = new Set<StatusName>()
  let dot = false
  let stun = false
  let shield = false
  let temp = false
  let purified = false
  let juking = false
  let counter = false
  let empowered = false
  let atropa = false
  for (const side of battle.sides) {
    if (side.fake) continue
    for (const status of Object.keys(side.effects) as StatusName[]) {
      if ((side.effects[status] ?? 0) > 0) active.add(status)
    }
    dot ||= side.dotTurns > 0
    stun ||= side.stunned
    shield ||= side.shield > 0
    temp ||= side.tempHp > 0
    purified ||= side.purified
    juking ||= side.juking
    counter ||= side.counterReady
    empowered ||= side.empoweredAttack
    atropa ||= side.atropa > 0
  }
  const lines = STATUS_HELP.filter(([status]) => active.has(status)).map(
    ([, description]) => `• ${description}`,
  )
  if (dot) lines.push('• DoT — урон в начале каждого хода.')
  if (stun) lines.push('• STUN — пропуск хода.')
  if (shield) lines.push('• SHIELD — снижает урон следующего попадания.')
  if (temp) lines.push('• TEMP — временные HP, исчезают через несколько ходов.')
  if (purified)
    lines.push('• PURIFIED — следующий удар слабее тем сильнее, чем меньше HP.')
  if (juking) lines.push('• Стойка уворота — +60% до первой атаки.')
  if (counter) lines.push('• Контрудар — следующая полученная атака вызывает ответную.')
  if (empowered) lines.push('• Меч усилен — следующая атака бьёт сильнее.')
  if (atropa) lines.push('• ATROPA — +1 урона за стак.')
  return lines
}

function dodgePenalty(side: Side): string {
  const stanced = side.juking || side.blocking
  const raw =
    jukeBonusOf(side) +
    batteryDodgeBonusOf(side) +
    (stanced ? JUKE_STANCE_BONUS : 0)
  return !stanced && raw < 0
    ? ` · штраф −${Math.abs(Math.round(raw * 100))}%`
    : ''
}

/**
 * Keeps the newest lines of a long turn log. Discord caps a field at 1024
 * characters; cutting from the start hid the killing blows of a long batch.
 */
function clampBattleLog(events: string[], limit = 1024): string {
  const text = events.join('\n')
  if (text.length <= limit) return text
  let start = events.length
  let size = 0
  while (start > 0) {
    const line = events[start - 1]
    const cost = line.length + (size > 0 ? 1 : 0)
    if (size + cost > limit - 2) break
    size += cost
    start--
  }
  if (start === events.length) {
    return `…${(events.at(-1) ?? '').slice(-(limit - 1))}`
  }
  return ['…', ...events.slice(start)].join('\n').slice(0, limit)
}

export function battleEmbed(
  battle: Battle,
  events: string[] = [],
  note?: string,
  deadline?: number,
): EmbedBuilder {
  const line = (side: Side) => {
    const status = sideStatus(side)
    return [
      `${sideCharacterLabel(side)} **${side.name}** · уворот ${Math.round(
        jukeChanceOf(side) * 100,
      )}%${dodgePenalty(side)}${side.juking ? ' (активен)' : ''}`,
      `${emojiText('hp', '❤️')} \`${hpBar(side)}\` ${side.hp}/${side.maxHp}${status ? ` · ${status}` : ''}`,
    ].join('\n')
  }
  const teamBlock = (team: 0 | 1) => {
    const synergy = battle.sides.find(
      side => side.team === team && !side.fake && !side.minion,
    )?.synergy
    const minions = battle.sides.filter(
      side => side.team === team && side.minion && side.hp > 0,
    )
    return [
      `**${teamLabel(battle, team)}**`,
      synergy
        ? `${emojiText('passive', '🔹')} Синергия: **${synergy.name}** — ${synergy.description}`
        : '',
      ...battle.sides
        .filter(
          side =>
            side.team === team &&
            !side.minion &&
            (!side.fake || (side.hp > 0 && !battle.finished)),
        )
        .map(line),
      ...minionSummaryLines(minions),
    ]
      .filter(Boolean)
      .join('\n')
  }

  const isBoss = battle.sides.some(side => side.boss)
  const baseDescription =
    battle.sides.length > 2
      ? [teamBlock(0), '', teamBlock(1), note ? `\n${note}` : ''].filter(Boolean).join('\n')
      : [line(battle.sides[0]), '', line(battle.sides[1]), note ? `\n${note}` : '']
          .filter(Boolean)
          .join('\n')

  const timer =
    !battle.finished && deadline
      ? ` · до <t:${Math.floor(deadline / 1000)}:R>`
      : ''
  const active = battle.sides[battle.turn]
  const turnLine = battle.finished
    ? ''
    : `${emojiText('timer', '⏳')} Ход ${battle.clock + 1}: ${
        isBoss || battle.sides.length > 2
          ? `${active.name} · ${sideCharacterLabel(active)}`
          : active.name
      }${timer}`
  const playerDamage = new Map<string, { name: string; damage: number }>()
  for (const side of battle.sides) {
    if (side.team !== 0 || side.fake || side.minion) continue
    const entry = playerDamage.get(side.userId) ?? { name: side.name, damage: 0 }
    entry.damage += side.damageDealt
    playerDamage.set(side.userId, entry)
  }
  const coopDamage =
    isBoss && !battle.finished && playerDamage.size > 1
      ? `${emojiText('swordwhite', '⚔️')} Урон: ${[...playerDamage.values()]
          .map(entry => `${entry.name}: **${entry.damage}**`)
          .join(' · ')}`
      : ''
  const description = [baseDescription, coopDamage, turnLine].filter(Boolean).join('\n\n')

  const embed = new EmbedBuilder()
    .setColor(battle.finished ? EMBED_COLORS.victory : EMBED_COLORS.battle)
    .setTitle(
      battle.finished
        ? `${emojiText('achievement', '🏆')} Бой окончен`
        : isBoss
          ? `${emojiText('boss', '👑')} Бой с боссом`
          : `${emojiText('swordwhite', '⚔️')} Бой`,
    )
    .setDescription(description)

  if (events.length > 0) {
    embed.addFields({ name: 'Ход', value: clampBattleLog(events) })
  }
  if (battle.finished) {
    embed.addFields({ name: 'Итоги', value: battleStatsText(battle) })
  }

  embed.setFooter({
    text: battle.finished
      ? battle.winner === null
        ? 'Бой окончен.'
        : isBoss
          ? battle.winner === 0
            ? 'Босс повержен.'
            : 'Босс победил.'
          : battle.sides.length > 2
            ? `Победила команда ${teamLabel(battle, battle.winner)}.`
            : `Победил ${battle.sides[battle.winner].name}.`
      : 'Forsaken Simulator',
  })
  return embed
}

export function battleComponents(
  battle: Battle,
  prefix = 'pvp',
): ActionRowBuilder<ButtonBuilder>[] {
  const side = battle.sides[battle.turn]
  const attackEmoji = attackEmojiData(side.character.name)
  const attackButton = new ButtonBuilder()
    .setCustomId(`${prefix}:attack`)
    .setLabel(attackEmoji ? 'Атака' : '⚔️ Атака')
    .setStyle(ButtonStyle.Danger)
  if (attackEmoji) attackButton.setEmoji(attackEmoji)

  const specialEmoji = abilityEmojiData(
    side.copiedFrom ?? side.character.name,
    specialOf(side).name,
  )
  const remainingCooldown = cooldownAfterTick(side)
  const baseCooldown = specialCooldown(specialOf(side))
  const cooldownSuffix =
    remainingCooldown > 0 && baseCooldown > 0
      ? ` · КД ${remainingCooldown}/${baseCooldown}`
      : ''
  const specialText = `${specialLabel(side)}${cooldownSuffix}`
  const specialButton = new ButtonBuilder()
    .setCustomId(`${prefix}:special`)
    .setLabel(specialEmoji ? specialText : `✨ ${specialText}`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(!canUseSpecialNow(side))
  if (specialEmoji) specialButton.setEmoji(specialEmoji)

  const staminaEmoji = emojiData('dodge')
  const jukeButton = new ButtonBuilder()
    .setCustomId(`${prefix}:juke`)
    .setLabel(
      `${staminaEmoji ? '' : '🌀 '}Уворот +${Math.round(JUKE_STANCE_BONUS * 100)}%`,
    )
    .setStyle(ButtonStyle.Primary)
  if (staminaEmoji) jukeButton.setEmoji(staminaEmoji)

  const medkitEmoji = emojiData('medkit')
  const restButton = new ButtonBuilder()
    .setCustomId(`${prefix}:rest`)
    .setLabel(medkitEmoji ? 'Передышка' : '🛡️ Передышка')
    .setStyle(ButtonStyle.Secondary)
  if (medkitEmoji) restButton.setEmoji(medkitEmoji)

  const surrenderEmoji = emojiData('surrender')
  const surrenderButton = new ButtonBuilder()
    .setCustomId(`${prefix}:surrender`)
    .setLabel('Сдаться')
    .setStyle(ButtonStyle.Secondary)
  if (surrenderEmoji) surrenderButton.setEmoji(surrenderEmoji)

  const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    attackButton,
    specialButton,
    jukeButton,
  )
  const forecastEmoji = emojiData('question')
  const forecastButton = new ButtonBuilder()
    .setCustomId(`${prefix}:forecast`)
    .setLabel('Прогноз')
    .setStyle(ButtonStyle.Secondary)
  if (forecastEmoji) forecastButton.setEmoji(forecastEmoji)
  const statsEmoji = emojiData('achievement')
  const statsButton = new ButtonBuilder()
    .setCustomId(`${prefix}:stats`)
    .setLabel('Статистика')
    .setStyle(ButtonStyle.Secondary)
  if (statsEmoji) statsButton.setEmoji(statsEmoji)
  const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    restButton,
    forecastButton,
    statsButton,
    surrenderButton,
  )
  const rows = [firstRow, secondRow]
  return rows
}

export function targetComponents(
  battle: Battle,
  targets: number[],
  tone: 'enemy' | 'ally' = 'enemy',
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = []
  const minionTargets = targets.filter(index => battle.sides[index]?.minion)
  const normalTargets = targets.filter(index => !battle.sides[index]?.minion)
  for (const index of normalTargets) {
    const side = battle.sides[index]
    const emoji = isAutomatedSide(side)
      ? characterEmojiData(side.character.name)
      : userCharacterEmojiData(userOf(side.userId), side.character.name)
    const button = new ButtonBuilder()
      .setCustomId(`pvp:target:${index}`)
      .setLabel(emoji ? `${side.character.name} — ${side.name}` : `🎯 ${side.character.name} — ${side.name}`)
      .setStyle(tone === 'ally' ? ButtonStyle.Primary : ButtonStyle.Danger)
    if (emoji) button.setEmoji(emoji)
    buttons.push(button)
  }
  const minionMeta = (side: Side): { label: string; slug: string; fallback: string } => {
    if (side.structure === 'sentry') {
      return { label: 'Турель', slug: 'sentry', fallback: '🔫' }
    }
    if (side.structure === 'dispenser') {
      return { label: 'Диспенсер', slug: 'dispenser', fallback: '💉' }
    }
    if (side.pizzaMinion) {
      return { label: 'Пицца-миньон', slug: 'pizzadelivery', fallback: '🍕' }
    }
    return { label: 'Миньон', slug: 'rottenminion', fallback: '🧟' }
  }
  const cancelButton = new ButtonBuilder()
    .setCustomId('pvp:target:cancel')
    .setLabel('Отмена')
    .setStyle(ButtonStyle.Secondary)
  const counts = new Map<string, number>()
  const minionButtons = minionTargets.map(index => {
    const side = battle.sides[index]
    const meta = minionMeta(side)
    const number = (counts.get(meta.label) ?? 0) + 1
    counts.set(meta.label, number)
    const minionEmoji = emojiData(meta.slug)
    const label = `${meta.label} ${number} (${side.hp}/${side.maxHp})`
    const button = new ButtonBuilder()
      .setCustomId(`pvp:target:${index}`)
      .setLabel(minionEmoji ? label : `${meta.fallback} ${label}`)
      .setStyle(tone === 'ally' ? ButtonStyle.Primary : ButtonStyle.Danger)
    if (minionEmoji) button.setEmoji(minionEmoji)
    return button
  })
  // Discord allows 25 buttons. If a long fight has more targets than that,
  // fall back to one button per minion type so the panel still fits.
  if (buttons.length + minionButtons.length + 1 <= 25) {
    buttons.push(...minionButtons)
  } else {
    const minionGroups = [
      {
        type: 'rotten',
        targets: minionTargets.filter(
          index => !battle.sides[index]?.pizzaMinion && !battle.sides[index]?.structure,
        ),
        label: 'Миньоны',
        slug: 'rottenminion',
        fallback: '🧟',
      },
      {
        type: 'pizza',
        targets: minionTargets.filter(index => battle.sides[index]?.pizzaMinion),
        label: 'Пицца-миньоны',
        slug: 'pizzadelivery',
        fallback: '🍕',
      },
      {
        type: 'sentry',
        targets: minionTargets.filter(index => battle.sides[index]?.structure === 'sentry'),
        label: 'Турели',
        slug: 'sentry',
        fallback: '🔫',
      },
      {
        type: 'dispenser',
        targets: minionTargets.filter(
          index => battle.sides[index]?.structure === 'dispenser',
        ),
        label: 'Диспенсеры',
        slug: 'dispenser',
        fallback: '💉',
      },
    ]
    for (const group of minionGroups) {
      if (group.targets.length === 0) continue
      const minionEmoji = emojiData(group.slug)
      const label = `${group.label} (${group.targets.length})`
      const button = new ButtonBuilder()
        .setCustomId(`pvp:target:minions:${group.type}`)
        .setLabel(minionEmoji ? label : `${group.fallback} ${label}`)
        .setStyle(tone === 'ally' ? ButtonStyle.Primary : ButtonStyle.Danger)
      if (minionEmoji) button.setEmoji(minionEmoji)
      buttons.push(button)
    }
  }
  buttons.push(cancelButton)
  // Discord allows at most 5 buttons per row. A 2v2 fight against minions and
  // structures can produce more targets than that, so split them into rows.
  const rows: ActionRowBuilder<ButtonBuilder>[] = []
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(index, index + 5)),
    )
  }
  return rows
}

export function rematchComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const retry = emojiData('retry')
  const button = new ButtonBuilder()
    .setCustomId('pvp:rematch')
    .setLabel(retry ? 'Реванш' : '🔄 Реванш')
    .setStyle(ButtonStyle.Primary)
  if (retry) button.setEmoji(retry)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
}

function replyError(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ModalSubmitInteraction,
  message: string,
) {
  return interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {})
}

export function localizeInteraction(interaction: Interaction): void {
  const target = interaction as unknown as Record<string, unknown>
  for (const method of ['reply', 'update', 'followUp', 'editReply', 'showModal']) {
    const original = target[method]
    if (typeof original !== 'function') continue
    target[method] = function (this: unknown, options: unknown, ...args: unknown[]) {
      return (original as (...params: unknown[]) => unknown).call(
        this,
        localizeOptions(options),
        ...args,
      )
    }
  }
}

function rememberInteraction(interaction: Interaction): void {
  if (interaction.user.bot) return
  if (!interaction.applicationId || !interaction.channelId) return

  let channels = userInteractionTokens.get(interaction.user.id)
  if (!channels) {
    channels = new Map()
    userInteractionTokens.set(interaction.user.id, channels)
    if (userInteractionTokens.size > 500) {
      const oldest = userInteractionTokens.keys().next().value
      if (oldest) userInteractionTokens.delete(oldest)
    }
  }

  channels.set(interaction.channelId, {
    applicationId: interaction.applicationId,
    token: interaction.token,
    at: Date.now(),
  })
}

function clearTurnPing(client: Client, messageId: string): void {
  const ping = turnPings.get(messageId)
  if (!ping) return
  turnPings.delete(messageId)
  void client.rest
    .delete(Routes.webhookMessage(ping.applicationId, ping.token, ping.messageId), {
      auth: false,
    })
    .catch(() => {
      void client.rest
        .delete(Routes.channelMessage(ping.channelId, ping.messageId))
        .catch(() => {})
    })
}

/**
 * Pings only make sense when another player has to act: solo PvE is excluded,
 * automated sides never get pinged, and one user is not pinged twice in a row.
 */
export function shouldPingNextTurn(battle: Battle, lastUserId?: string): boolean {
  if (battle.finished) return false
  const humans = new Set(
    battle.sides
      .filter(side => !side.fake && !side.minion && !isAutomatedSide(side) && side.hp > 0)
      .map(side => side.userId),
  )
  if (humans.size <= 1) return false
  const next = battle.sides[battle.turn]
  if (!next || isAutomatedSide(next)) return false
  return next.userId !== lastUserId
}

function notifyNextTurn(
  client: Client,
  battle: Battle,
  channelId: string | null,
  messageId: string,
): void {
  clearTurnPing(client, messageId)
  if (!channelId) return
  if (!shouldPingNextTurn(battle, lastTurnPingUser.get(messageId))) return
  const next = battle.sides[battle.turn]

  const channels = userInteractionTokens.get(next.userId)
  let saved = channels?.get(channelId)
  if (!saved || Date.now() - saved.at > INTERACTION_TOKEN_TTL) {
    for (const tokens of userInteractionTokens.values()) {
      const candidate = tokens.get(channelId)
      if (candidate && Date.now() - candidate.at <= INTERACTION_TOKEN_TTL) {
        saved = candidate
        break
      }
    }
  }
  if (!saved) return
  const webhook = saved
  lastTurnPingUser.set(messageId, next.userId)

  const user = userOf(next.userId)
  const content = translateText(
    `${emojiText('swordwhite', '⚔️')} Твой ход! ${next.character.name}.`,
    user.language,
  )
  void client.rest
    .post(`${Routes.webhook(webhook.applicationId, webhook.token)}?wait=true`, {
      auth: false,
      body: {
        content: `<@${next.userId}> ${content}`,
        allowed_mentions: { users: [next.userId] },
      },
    })
    .then((message: { id?: string } | undefined) => {
      if (!message?.id) return
      turnPings.set(messageId, {
        applicationId: webhook.applicationId,
        token: webhook.token,
        messageId: message.id,
        channelId,
        at: Date.now(),
      })
    })
    .catch(() => {})
}

function notifyBattleStart(
  client: Client,
  battle: Battle,
  channelId: string | null,
  messageId: string,
): void {
  notifyNextTurn(client, battle, channelId, messageId)
}

function isAutomatedSide(side: Side): boolean {
  return (
    side.minion === true ||
    side.fake ||
    side.boss ||
    side.userId.startsWith('minion:') ||
    side.userId.startsWith('bot:') ||
    side.userId.startsWith('boss:')
  )
}

/** Whether the LLM could be asked to control any living side in this battle. */
function battleCouldUseLlm(battle: Battle): boolean {
  // The policy answers instantly, so the slow "neural net is thinking" state
  // would only make battles feel laggy.
  if (policyAiEnabled() && policyAvailable()) return false
  return battle.sides.some(
    side => isAutomatedSide(side) && llmLikelyAvailable(side),
  )
}

function isPveBattle(messageId: string): boolean {
  return (
    trainingBattles.has(messageId) ||
    bossBattles.has(messageId) ||
    survivalRuns.has(messageId) ||
    bossRushRuns.has(messageId) ||
    towerRuns.has(messageId) ||
    trialRuns.has(messageId)
  )
}

export function battleTurnLanguage(
  battle: Battle,
  languageOf: (userId: string) => UserData['language'] = userId => userOf(userId).language,
): UserData['language'] | undefined {
  if (battle.finished) return undefined
  const side = battle.sides[battle.turn]
  if (!side || isAutomatedSide(side)) return undefined
  return languageOf(side.userId)
}

async function withBattleTurnLanguage<T>(
  battle: Battle,
  fn: () => Promise<T>,
): Promise<T> {
  const language = battleTurnLanguage(battle)
  return language ? withLanguage(language, fn) : fn()
}

function stopBattleTimer(messageId: string): void {
  const timer = battleTimers.get(messageId)
  if (timer) clearTimeout(timer)
  battleTimers.delete(messageId)
  battleDeadlines.delete(messageId)
}

function armBattleTimer(client: Client, messageId: string, battle: Battle): number | undefined {
  stopBattleTimer(messageId)
  if (battle.finished || isPveBattle(messageId)) {
    persistBattleState()
    return undefined
  }
  const side = battle.sides[battle.turn]
  if (!side || isAutomatedSide(side)) {
    persistBattleState()
    return undefined
  }

  const deadline = Date.now() + BATTLE_TURN_MS
  battleDeadlines.set(messageId, deadline)
  const timer = setTimeout(() => {
    void handleBattleTimeout(client, messageId)
  }, BATTLE_TURN_MS)
  timer.unref?.()
  battleTimers.set(messageId, timer)
  persistBattleState()
  return deadline
}

function resetTimeoutStrikes(messageId: string, userId: string): void {
  const strikes = timeoutStrikes.get(messageId)
  if (!strikes) return
  strikes.delete(userId)
  if (strikes.size === 0) timeoutStrikes.delete(messageId)
}

async function runAutomatedTurns(
  input: Battle,
  events: string[],
  history: string[] = [],
): Promise<Battle> {
  let current = input
  let guard = 0
  let llmCalls = 0
  while (
    !current.finished &&
    isAutomatedSide(current.sides[current.turn]) &&
    guard++ < Math.max(12, current.sides.length + 12)
  ) {
    const side = current.sides[current.turn]
    let decision: BotDecision
    if (side.fake) {
      decision = { action: 'attack', specialIndex: 0 }
    } else if (side.structure === 'dispenser') {
      decision = { action: 'special', specialIndex: 0 }
    } else if (side.minion) {
      decision = { action: 'attack', specialIndex: 0 }
    } else {
      const startedAt = Date.now()
      const policyTurn = policyAiEnabled() ? choosePolicyTurn(current) : null
      const llmTurn =
        !policyTurn && llmCalls < 3
          ? await chooseLlmTurn(current, [...history, ...events])
          : null
      const elapsedMs = Date.now() - startedAt
      const chosen = policyTurn?.decision ?? llmTurn?.decision ?? null
      noteLlmTurn(chosen !== null)
      if (llmTurn) llmCalls += 1
      if (llmDebugEnabled()) {
        const who = `${side.character.name} #${side.id}`
        const counters = llmStats()
        const suffix =
          ` · ${elapsedMs} мс · модель ${counters.model} / ` +
          `эвристика ${counters.heuristic} / невалид ${counters.invalid}` +
          (llmHybridEnabled() ? ` / гибрид ${counters.hybrid}` : '')
        if (policyTurn) {
          const slot =
            policyTurn.decision.action === 'special'
              ? ` (special ${policyTurn.decision.specialIndex})`
              : ''
          const target =
            policyTurn.decision.targetIndex !== undefined
              ? ` → #${policyTurn.decision.targetIndex}`
              : ''
          console.log(
            `[bot] Policy AI: ${who} — ${policyTurn.model}: ` +
              `${policyTurn.decision.action}${slot}${target}${suffix}`,
          )
        } else if (llmTurn) {
          const slot =
            llmTurn.decision.action === 'special'
              ? ` (special ${llmTurn.decision.specialIndex})`
              : ''
          const target =
            llmTurn.decision.targetIndex !== undefined
              ? ` → #${llmTurn.decision.targetIndex}`
              : ''
          const key =
            llmTurn.keyCount > 1
              ? ` ключ ${llmTurn.keyIndex + 1}/${llmTurn.keyCount}`
              : ''
          console.log(
            `[bot] LLM AI: ${who} — ${llmTurn.provider}${key} (${llmTurn.model}): ` +
              `${llmTurn.decision.action}${slot}${target}${suffix}`,
          )
        } else {
          console.log(`[bot] LLM AI: ${who} — эвристика${suffix}`)
        }
      }
      decision =
        chosen ??
        (side.boss
          ? chooseBossAction(current, Math.random)
          : chooseBotTurn(current, Math.random))
    }
    const result = takeTurn(
      current,
      decision.action,
      Math.random,
      decision.targetIndex,
      decision.specialIndex,
    )
    current = result.battle
    events.push(...result.events)
  }
  return current
}

async function patchBattleMessage(
  client: Client,
  messageId: string,
  channelId: string | null,
  battle: Battle,
  events: string[] = [],
  note?: string,
  deadline?: number,
  components?: ActionRowBuilder<ButtonBuilder>[],
): Promise<void> {
  if (!channelId) return
  await withBattleTurnLanguage(battle, async () => {
    await client.rest
      .patch(Routes.channelMessage(channelId, messageId), {
        body: {
          embeds: [battleEmbed(battle, events, note, deadline).toJSON()],
          components: (components ?? (battle.finished ? [] : battleComponents(battle))).map(row =>
            row.toJSON(),
          ),
        },
      })
      .catch(() => {})
  })
}

async function updateBattleInteraction(
  interaction: ButtonInteraction,
  messageId: string,
  battle: Battle,
  events: string[],
  note: string | undefined,
  components: ActionRowBuilder<ButtonBuilder>[],
  deadline?: number,
): Promise<void> {
  await withBattleTurnLanguage(battle, async () => {
    try {
      const payload = {
        embeds: [battleEmbed(battle, events, note, deadline)],
        components,
      }
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload)
      } else {
        await interaction.update(payload)
      }
    } catch {
      // The interaction can expire while a turn or simulation is being processed.
      // Keep the public battle message in sync even if the callback token is gone.
      await patchBattleMessage(
        interaction.client,
        messageId,
        interaction.channelId,
        battle,
        events,
        note,
        deadline,
        components,
      )
    }
  })
}

async function handleBattleTimeout(client: Client, messageId: string): Promise<void> {
  battleTimers.delete(messageId)
  battleDeadlines.delete(messageId)
  pendingTargets.delete(messageId)
  clearTurnPing(client, messageId)

  const battle = battles.get(messageId)
  if (!battle || battle.finished || isPveBattle(messageId)) return
  const side = battle.sides[battle.turn]
  if (!side || isAutomatedSide(side)) return
  setActiveLanguage(userOf(side.userId).language)

  const channelId = battleChannels.get(messageId) ?? null
  const strikes = timeoutStrikes.get(messageId) ?? new Map<string, number>()
  timeoutStrikes.set(messageId, strikes)
  const count = (strikes.get(side.userId) ?? 0) + 1
  strikes.set(side.userId, count)

  if (timeoutForfeits(count)) {
    const result = surrender(battle, side.userId)
    const prefix = `${emojiText('timer', '⌛')} ${side.name} дважды пропустил ход — поражение.`
    const finished = finishBattleState(messageId, result.battle, prefix)
    await patchBattleMessage(
      client,
      messageId,
      channelId,
      result.battle,
      [],
      finished.note,
      undefined,
      finished.components,
    )
    return
  }

  const events = [
    `${emojiText('timer', '⌛')} ${side.name} не успел за 90 секунд — автоматическая передышка.`,
  ]
  const result = takeTurn(battle, 'rest', Math.random)
  events.push(...result.events)
  const current = await runAutomatedTurns(
    result.battle,
    events,
    battleLogs.get(messageId) ?? [],
  )
  appendBattleLog(messageId, events)

  if (current.finished) {
    const finished = finishBattleState(messageId, current)
    await patchBattleMessage(
      client,
      messageId,
      channelId,
      current,
      events,
      finished.note,
      undefined,
      finished.components,
    )
    return
  }

  battles.set(messageId, current)
  const deadline = armBattleTimer(client, messageId, current)
  await patchBattleMessage(
    client,
    messageId,
    channelId,
    current,
    events,
    undefined,
    deadline,
    battleComponents(current),
  )
  notifyNextTurn(client, current, channelId, messageId)
}

type SkinUnlock = { userId: string; character: string; skin: Skin }

function masteryProgressNotes(
  progress: ReturnType<typeof recordCharacterResult>,
  characterName: string,
  language: UserData['language'],
): string[] {
  const notes: string[] = []
  const label = userCharacterLabel(progress.user, characterName)
  if (progress.leveledUp) {
    notes.push(
      `${emojiText('xp', '⭐')} Мастерство: ${label} — ур. ${progress.level} ` +
        `(+${progress.reward} ${emojiText('points', '🪙')})`,
    )
  }
  for (const milestone of progress.milestones) {
    notes.push(
      `${emojiText('xp', '⭐')} Мастерство: ${label} — ` +
        `${milestone.badge} (+${milestone.reward} ${emojiText('points', '🪙')})`,
    )
  }
  const skin = progress.skinsUnlocked.at(-1)
  if (skin) {
    notes.push(
      `${emojiText('mvp', '🏅')} Открыт скин: ${label} — ` +
        `${skinName(skin, language)}`,
    )
  }
  return notes
}

export function recordSurvivalWave(
  user: UserData,
  characterName: string,
  bonusXp = 0,
): ReturnType<typeof recordCharacterResult> {
  return recordCharacterResult(user, characterName, true, false, bonusXp)
}

function recordBattle(
  battle: Battle,
  winnerTeam: 0 | 1,
  wager: number,
  training: boolean,
  gameMode: PvpMode,
): { notes: string[]; skinUnlocks: SkinUnlock[] } {
  if (training) return { notes: [], skinUnlocks: [] }

  const reward = battleReward(wager)
  const completed = new Map<string, string>()
  const unlocked = new Map<string, string>()
  const notes: string[] = []
  const skinUnlocks: SkinUnlock[] = []

  const applyTeam = (team: 0 | 1, won: boolean): void => {
    const teamSides = battle.sides.filter(
      side => side.team === team && !side.fake && !side.minion,
    )
    const userIds = [...new Set(teamSides.map(side => side.userId))]

    for (const userId of userIds) {
      let user = userOf(userId)
      if (won) {
        user = {
          ...user,
          coins: user.coins + reward,
          wins: user.wins + 1,
          streak: user.streak + 1,
        }
        user = { ...user, bestStreak: Math.max(user.bestStreak, user.streak) }
      } else {
        user = { ...user, losses: user.losses + 1, streak: 0 }
      }

      const userSides = teamSides.filter(side => side.userId === userId)
      const characterNames = [...new Set(userSides.map(side => side.character.name))]
      for (const characterName of characterNames) {
        const characterSides = userSides.filter(side => side.character.name === characterName)
        const abilityUses = characterSides.reduce((sum, side) => sum + side.abilityUses, 0)
        const bonusXp = abilityXp(
          abilityUses,
          specialCooldown(characterSides[0]!.character.special),
        )
        const progress = recordCharacterResult(user, characterName, won, true, bonusXp)
        user = progress.user
        if (progress.leveledUp) {
          notes.push(
            `${emojiText('xp', '⭐')} Мастерство: ${userCharacterLabel(user, characterName)} — ур. ${progress.level} ` +
              `(+${progress.reward} ${emojiText('points', '🪙')})`,
          )
        }
        for (const milestone of progress.milestones) {
          notes.push(
            `${emojiText('xp', '⭐')} Мастерство: ${userCharacterLabel(user, characterName)} — ` +
              `${milestone.badge} (+${milestone.reward} ${emojiText('points', '🪙')})`,
          )
        }
        const skin = progress.skinsUnlocked.at(-1)
        if (skin) {
          notes.push(
            `${emojiText('mvp', '🏅')} Открыт скин: ${userCharacterLabel(user, characterName)} — ` +
              `${skinName(skin, user.language)}`,
          )
          skinUnlocks.push({ userId, character: characterName, skin })
        }
        const trial = applyCharacterTrial(user, characterName)
        user = trial.user
        for (const completion of trial.completed) {
          notes.push(
            `${emojiText('mvp', '🏅')} Испытание: ${userCharacterLabel(user, completion.name)} — ` +
              `${completion.title} (+${completion.reward} ${emojiText('points', '🪙')})`,
          )
        }
      }

      const abilityUses = userSides.reduce((sum, side) => sum + side.abilityUses, 0)
      const damage = userSides.reduce((sum, side) => sum + side.damageDealt, 0)
      const quest = applyQuestBattle(user, {
        won,
        characterNames,
        abilityUses,
        damage,
        mode: battle.sides.filter(side => !side.fake).length > 2 ? '2x2' : '1x1',
        gameMode,
      })
      user = quest.user
      for (const entry of quest.completed) {
        completed.set(entry.name, `«${entry.name}» +${entry.reward}`)
      }

      const achievements = evaluateAchievements(user)
      user = achievements.user
      for (const achievement of achievements.unlocked) {
        unlocked.set(achievement.id, `«${achievement.name}» +${achievement.reward}`)
      }

      user = addHistory(user, {
        opponent: teamLabel(battle, (1 - team) as 0 | 1),
        result: won ? 'win' : 'loss',
        coins: won ? reward : -wager,
        at: Date.now(),
      })
      store.users[userId] = user
    }
  }

  applyTeam(winnerTeam, true)
  applyTeam((1 - winnerTeam) as 0 | 1, false)
  persist()

  if (completed.size > 0) {
    notes.push(`${emojiText('quest', '📜')} Квест: ${[...completed.values()].join(', ')}`)
  }
  if (unlocked.size > 0)
    notes.push(`${emojiText('achievement', '🏆')} Достижение: ${[...unlocked.values()].join(', ')}`)
  return { notes, skinUnlocks }
}

function skinUnlockComponents(unlocks: SkinUnlock[]): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...unlocks.slice(0, 5).map(unlock =>
      new ButtonBuilder()
        .setCustomId(`skin:equip:${unlock.userId}:${unlock.character}:${unlock.skin.id}`)
        .setLabel(`Надеть: ${unlock.character}`)
        .setStyle(ButtonStyle.Success),
    ),
  )
}

function appendBattleLog(messageId: string, events: string[]): void {
  if (events.length === 0) return
  const log = battleLogs.get(messageId) ?? []
  log.push(...events)
  if (log.length > 20) log.splice(0, log.length - 20)
  battleLogs.set(messageId, log)
}

function rememberFinishedBattle(
  messageId: string,
  battle: Battle,
  wager: number,
  gameMode: PvpMode,
): void {
  if (finishedBattles.size >= 500) {
    const oldest = finishedBattles.keys().next().value
    if (oldest) finishedBattles.delete(oldest)
  }
  const players = new Map<string, string>()
  for (const side of battle.sides) {
    if (side.fake) continue
    if (!players.has(side.userId)) players.set(side.userId, side.name)
  }
  finishedBattles.set(messageId, {
    players: [...players].map(([userId, name]) => ({ userId, name })),
    wager,
    mode: battle.sides.filter(side => !side.fake).length > 2 ? '2x2' : '1x1',
    gameMode,
  })
}

function cleanupBattle(messageId: string): void {
  battles.delete(messageId)
  battleLogs.delete(messageId)
  turnPings.delete(messageId)
  lastTurnPingUser.delete(messageId)
  wagers.delete(messageId)
  trainingBattles.delete(messageId)
  battleGameModes.delete(messageId)
  bossBattles.delete(messageId)
  pendingTargets.delete(messageId)
  battleChannels.delete(messageId)
  timeoutStrikes.delete(messageId)
  stopBattleTimer(messageId)
  persistBattleState()
}

function finishBattleState(
  messageId: string,
  battle: Battle,
  notePrefix?: string,
): { note: string; components: ActionRowBuilder<ButtonBuilder>[] } {
  const wager = wagers.get(messageId) ?? 0
  const training = trainingBattles.has(messageId)
  const gameMode = battleGameModes.get(messageId) ?? 'classic'
  const boss = bossBattles.get(messageId)
  const bossRush = bossRushRuns.get(messageId)
  const tower = towerRuns.get(messageId)
  const trialState = trialRuns.get(messageId)
  let note = ''
  let components: ActionRowBuilder<ButtonBuilder>[] = []

  const survival = survivalRuns.get(messageId)
  if (survival) {
    const player = battle.sides.find(side => side.userId === survival.userId && !side.fake)
    if (battle.winner === 0 && player && player.hp > 0) {
      const cleared = survival.wave
      survival.reward += survivalReward(cleared)
      survival.wave += 1
      survival.hp = Math.min(
        survival.maxHp,
        player.hp + survivalHeal(survival.maxHp),
      )
      survival.rottenCorpses = [...(player.rottenCorpses ?? [])]
      survival.minions = battle.sides
        .filter(side => side.minion && side.team === player.team && side.hp > 0)
        .map(side => ({
          name: side.name,
          hp: side.hp,
          maxHp: side.maxHp,
          attack: side.character.attack,
        }))
      survivalRuns.set(messageId, survival)
      const progress = recordSurvivalWave(
        userOf(survival.userId),
        player.character.name,
        abilityXp(player.abilityUses, specialCooldown(player.character.special)),
      )
      const best = recordSurvivalBest(progress.user, cleared, player.character.name)
      store.users[survival.userId] = best.user
      persist()
      note = [
        notePrefix,
        `${emojiText('skull', '💀')} Волна **${cleared}** пройдена. HP: **${survival.hp}/${survival.maxHp}**.`,
        progress.xpGained > 0
          ? `${emojiText('xp', '⭐')} Опыт: **+${progress.xpGained} XP**.`
          : '',
        ...masteryProgressNotes(progress, player.character.name, progress.user.language),
        best.improved
          ? `${emojiText('achievement', '🏆')} Новый личный рекорд: **${cleared}** волн!`
          : `Личный рекорд: **${best.best?.wave ?? cleared}** волн.`,
        `Награда за забег: **${survival.reward}** ${emojiText('points', '🪙')}.`,
      ]
        .filter(Boolean)
        .join('\n')
      components = survivalNextComponents()
    } else {
      const payout = survival.reward
      const cleared = survivalClearedWaves(survival.wave)
      const best = recordSurvivalBest(
        userOf(survival.userId),
        cleared,
        survival.character.name,
      )
      store.users[survival.userId] =
        payout > 0 ? grantCoins(best.user, payout) : best.user
      persist()
      rememberPveOwner(messageId, survival.userId)
      survivalRuns.delete(messageId)
      note = [
        notePrefix,
        `${emojiText('skull', '💀')} Забег окончен: пройдено волн **${cleared}**.`,
        payout > 0
          ? `Награда: **+${payout}** ${emojiText('points', '🪙')}.`
          : 'Награды за этот забег нет.',
        best.improved ? `Новый личный рекорд: **${cleared}** волн!` : '',
      ]
        .filter(Boolean)
        .join('\n')
      components = survivalAgainComponents()
    }
  } else if (boss) {
    const playerSides = battle.sides.filter(
      side => side.team === 0 && !side.fake && !side.minion,
    )
    const damageByUser = new Map<string, number>()
    const nameByUser = new Map<string, string>()
    for (const side of playerSides) {
      damageByUser.set(side.userId, (damageByUser.get(side.userId) ?? 0) + side.damageDealt)
      nameByUser.set(side.userId, side.name)
    }
    const userIds = [...damageByUser.keys()]
    const damage = [...damageByUser.values()].reduce((sum, value) => sum + value, 0)
    const won = battle.winner === 0
    let reward = 0
    let firstClear = false
    let bestDamage = 0
    const bossMasteryNotes: string[] = []
    for (const userId of userIds) {
      const result = recordBossResult(
        userOf(userId),
        boss.week,
        damageByUser.get(userId) ?? 0,
        won,
      )
      let user = result.user
      const characterNames = [
        ...new Set(
          playerSides
            .filter(side => side.userId === userId)
            .map(side => side.character.name),
        ),
      ]
      for (const characterName of characterNames) {
        const characterSides = playerSides.filter(
          side => side.userId === userId && side.character.name === characterName,
        )
        const abilityUses = characterSides.reduce((sum, side) => sum + side.abilityUses, 0)
        const bonusXp = abilityXp(
          abilityUses,
          specialCooldown(characterSides[0]!.character.special),
        )
        const progress = recordCharacterResult(user, characterName, won, false, bonusXp)
        user = progress.user
        bossMasteryNotes.push(...masteryProgressNotes(progress, characterName, user.language))
      }
      store.users[userId] = user
      reward += result.reward
      firstClear = firstClear || result.firstClear
      bestDamage = Math.max(bestDamage, result.record.bestDamage)
    }
    persist()

    const bossName = boss.day
      ? bossForDay(boss.day).name
      : bossForWeek(boss.week).name
    const damageReport = [...damageByUser]
      .map(([userId, value]) => `${nameByUser.get(userId) ?? '—'}: **${value}**`)
      .join(' · ')
    if (won) {
      note = [
        notePrefix,
        `${emojiText('boss', '👑')} **${bossName} повержен!** +${reward} ${emojiText('points', '🪙')}`,
        firstClear
          ? `${emojiText('gift', '🎁')} Включая бонус за первую победу: +${BOSS_FIRST_CLEAR_BONUS}`
          : '',
        boss.coop ? `Урон: ${damageReport}.` : '',
        `Лучший урон: **${bestDamage}**.`,
      ]
        .filter(Boolean)
        .join('\n')
    } else {
      note = [
        notePrefix,
        boss.coop
          ? `${emojiText('boss', '👑')} Босс **${bossName}** побеждает. Урон: ${damageReport}.`
          : `${emojiText('boss', '👑')} Босс **${bossName}** побеждает. Твой урон: **${damage}**.`,
        `Лучший урон за попытку: **${bestDamage}**.`,
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (boss.coop) {
      const players = [
        ...new Map(
          playerSides.map(side => [side.userId, { id: side.userId, name: side.name }]),
        ).values(),
      ]
      if (players.length === 2) {
        if (coopBossFinishes.size >= 500) {
          const oldest = coopBossFinishes.keys().next().value
          if (oldest) coopBossFinishes.delete(oldest)
        }
        coopBossFinishes.set(messageId, { players, week: boss.week })
      }
      components = bossCoopRematchComponents()
    } else {
      components = bossRetryComponents()
    }
  } else if (bossRush) {
    const ownerId = bossRush.ownerId
    const run = bossRush.run
    const playerSides = battle.sides.filter(
      side => side.team === 0 && !side.fake && !side.minion,
    )
    const totalHp = playerSides.reduce((sum, side) => sum + side.maxHp, 0)
    const currentHp = playerSides.reduce((sum, side) => sum + Math.max(0, side.hp), 0)
    const hpRatio = totalHp > 0 ? currentHp / totalHp : 0
    const won = battle.winner === 0
    const nextRun = advanceBossRush(run, won, hpRatio)
    const summary = bossRushSummary(nextRun)
    let user = userOf(ownerId)
    let reward = 0
    if (won) {
      reward = bossRushReward(run.stage)
      user = grantCoins(user, reward)
    }
    const characterNames = [...new Set(playerSides.map(side => side.character.name))]
    const rushNotes: string[] = []
    for (const characterName of characterNames) {
      const characterSides = playerSides.filter(side => side.character.name === characterName)
      const abilityUses = characterSides.reduce((sum, side) => sum + side.abilityUses, 0)
      const bonusXp = abilityXp(
        abilityUses,
        specialCooldown(characterSides[0]!.character.special),
      )
      const progress = recordCharacterResult(user, characterName, won, false, bonusXp)
      user = progress.user
      rushNotes.push(...masteryProgressNotes(progress, characterName, user.language))
    }
    store.users[ownerId] = user
    persist()
    bossRushRuns.set(messageId, { ownerId, run: nextRun })
    rememberPveOwner(messageId, ownerId)
    const nextBoss =
      nextRun.status === 'active' ? bossRushBoss(nextRun).character.name : null
    note = [
      notePrefix,
      `Boss Rush · этап ${run.stage}/${BOSS_RUSH_STAGES}: ` +
        `${battle.winner === 0 ? 'победа' : battle.winner === null ? 'ничья' : 'поражение'}.`,
      reward > 0 ? `Награда: **+${reward}** ${emojiText('points', '🪙')}.` : '',
      `Пройдено боссов: **${summary.bossesDefeated}/${summary.totalStages}**.`,
      nextBoss ? `Следующий босс: **${nextBoss}**.` : '',
      nextRun.status === 'completed' ? 'Забег завершён!' : '',
      nextRun.status === 'failed' ? 'Забег окончен.' : '',
      `HP к следующему этапу: **${Math.round(nextRun.hpRatio * 100)}%**.`,
      ...rushNotes,
    ]
      .filter(Boolean)
      .join('\n')
    components =
      nextRun.status === 'active'
        ? bossRushNextComponents()
        : bossRushAgainComponents()
  } else if (tower) {
    const ownerId = tower.ownerId
    const run = tower.run
    const won = battle.winner === 0
    const nextRun = advanceTowerRun(run, won)
    const summary = towerRunSummary(nextRun)
    let user = userOf(ownerId)
    let reward = 0
    if (won) {
      reward = Math.round(towerReward(run.floor) * towerRewardMultiplier(run))
      user = grantCoins(user, reward)
    }
    const playerSides = battle.sides.filter(
      side => side.team === 0 && !side.fake && !side.minion,
    )
    const characterNames = [...new Set(playerSides.map(side => side.character.name))]
    const towerNotes: string[] = []
    for (const characterName of characterNames) {
      const characterSides = playerSides.filter(side => side.character.name === characterName)
      const abilityUses = characterSides.reduce((sum, side) => sum + side.abilityUses, 0)
      const bonusXp = abilityXp(
        abilityUses,
        specialCooldown(characterSides[0]!.character.special),
      )
      const progress = recordCharacterResult(user, characterName, won, false, bonusXp)
      user = progress.user
      towerNotes.push(...masteryProgressNotes(progress, characterName, user.language))
    }
    store.users[ownerId] = user
    persist()
    towerRuns.set(messageId, { ownerId, run: nextRun })
    rememberPveOwner(messageId, ownerId)
    const choices =
      nextRun.status === 'active' ? towerUpgradeChoices(nextRun.seed, run.floor) : []
    note = [
      notePrefix,
      `Башня · этаж ${run.floor}/${TOWER_FLOORS}: ` +
        `${won ? 'пройден' : battle.winner === null ? 'ничья' : 'поражение'}.`,
      reward > 0 ? `Награда: **+${reward}** ${emojiText('points', '🪙')}.` : '',
      `Пройдено этажей: **${summary.floorsCleared}/${summary.totalFloors}**.`,
      nextRun.status === 'active' ? `Следующий этаж: **${nextRun.floor}**.` : '',
      choices.length > 0
        ? `Выбери усиление: ${choices
            .map(id => `**${TOWER_UPGRADES[id].name}** (${TOWER_UPGRADES[id].description})`)
            .join(' · ')}.`
        : '',
      nextRun.status === 'completed' ? 'Башня пройдена!' : '',
      nextRun.status === 'failed' ? 'Забег окончен.' : '',
      ...towerNotes,
    ]
      .filter(Boolean)
      .join('\n')
    components =
      choices.length > 0 ? towerUpgradeComponents(choices) : towerAgainComponents()
  } else if (trialState) {
    const ownerId = trialState.ownerId
    const trialDef = TRIALS.find(candidate => candidate.id === trialState.trialId)
    const playerSide = battle.sides.find(
      side => side.userId === ownerId && side.team === 0 && !side.fake && !side.minion,
    )
    const trialResult = trialResultFromBattle(battle, ownerId)
    const cleared = trialDef ? checkTrialResult(trialDef, trialResult) : false
    let user = userOf(ownerId)
    const claim = trialDef ? claimTrialResult(user, trialDef, cleared) : undefined
    if (claim?.claimed) {
      user = claim.user
      store.users[ownerId] = user
      persist()
    }
    const label = trialDef?.characterName ?? playerSide?.character.name ?? '—'
    const lastSkin = claim?.skinsUnlocked.at(-1)
    note = [
      notePrefix,
      `Испытание · **${label}**: ${cleared ? 'цель выполнена' : 'цель не выполнена'}.`,
      trialDef
        ? `${trialGoalLine(trialDef).replace(/\.$/, '')} ` +
          `(${trialProgress(trialDef, trialResult)}/${trialDef.target}).`
        : '',
      claim?.claimed
        ? `Награда: **+${claim.xpGained} XP**` +
          (claim.milestoneReward > 0
            ? ` и **+${claim.milestoneReward}** ${emojiText('points', '🪙')}`
            : '') +
          '.'
        : cleared
          ? 'Награда за это испытание уже получена.'
          : '',
      claim?.leveledUp ? `Мастерство: ур. **${claim.level}**.` : '',
      ...(claim?.milestones.map(
        milestone =>
          `Мастерство: **${milestone.badge}** (+${milestone.reward} ${emojiText('points', '🪙')}).`,
      ) ?? []),
      lastSkin ? `Открыт скин: **${skinName(lastSkin, user.language)}**.` : '',
    ]
      .filter(Boolean)
      .join('\n')
    components = trialDef ? trialStartComponents(trialDef) : towerPanelComponents()
  } else if (battle.winner === null) {
    note = [notePrefix, 'Бой окончен вничью.'].filter(Boolean).join('\n')
  } else if (training) {
    note = [notePrefix, 'Тренировка окончена — без награды.'].filter(Boolean).join('\n')
  } else {
    const winnerTeam = battle.winner
    const reward = battleReward(wager)
    const result = recordBattle(battle, winnerTeam, wager, false, gameMode)
    const notes = result.notes
    if (result.skinUnlocks.length > 0) {
      components.push(skinUnlockComponents(result.skinUnlocks))
    }
    const rewardLine =
      wager > 0
        ? `**${teamLabel(battle, winnerTeam)}** получает ${reward} ${emojiText('points', '🪙')}`
        : duels.has(messageId)
          ? ''
          : 'Без ставки — без денежной награды.'
    note = [
      notePrefix,
      rewardLine,
      ...notes,
    ]
      .filter(Boolean)
      .join('\n')
    rememberFinishedBattle(messageId, battle, wager, gameMode)
    components = rematchComponents()
  }

  const duel = duels.get(messageId)
  if (duel && !duel.finished && battle.winner !== null) {
    const winnerIndex = battle.winner === duel.challengerTeam ? 0 : 1
    duel.wins[winnerIndex] += 1
    const target = Math.ceil(duel.bestOf / 2)
    const roundWinner = winnerIndex === 0 ? duel.challengerName : duel.opponentName
    const score = `${duel.wins[0]}:${duel.wins[1]}`
    if (duel.wins[winnerIndex] >= target) {
      duel.finished = true
      let payout = 0
      if (duel.wager > 0) {
        const winnerId = winnerIndex === 0 ? duel.challengerId : duel.opponentId
        const winner = userOf(winnerId)
        store.users[winnerId] = grantCoins(winner, duel.wager * 2)
        payout = duel.wager * 2
        persist()
      }
      note = [
        note,
        `${emojiText('swordwhite', '⚔️')} Серия окончена: **${roundWinner}** побеждает **${score}**.` +
          (payout > 0 ? ` +${payout} ${emojiText('points', '🪙')}` : ''),
      ]
        .filter(Boolean)
        .join('\n')
      components = duelRematchComponents()
    } else {
      duel.round += 1
      duel.challengerTeam = duel.challengerTeam === 0 ? 1 : 0
      note = [
        note,
        `${emojiText('swordwhite', '⚔️')} Раунд ${duel.round - 1}: **${roundWinner}** · счёт **${score}**.`,
      ]
        .filter(Boolean)
        .join('\n')
      components = duelNextComponents()
    }
  }

  cleanupBattle(messageId)
  return { note, components }
}

async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  if (interaction.commandName !== 'тест') {
    await interaction.respond([])
    return
  }
  const focused = interaction.options.getFocused(true)
  if (focused.name !== 'способность') {
    await interaction.respond([])
    return
  }
  const character = characterByName(interaction.options.getString('персонаж') ?? '')
  if (!character) {
    await interaction.respond([])
    return
  }
  const query = String(focused.value).toLowerCase()
  const choices = availableSpecials(character)
    .filter(special => special.name.toLowerCase().includes(query))
    .slice(0, 25)
    .map(special => ({ name: special.name, value: special.name }))
  await interaction.respond(choices)
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!userOf(interaction.user.id).onboarded) {
    languagePromptSource.set(interaction.user.id, 'command')
    await interaction.reply({
      embeds: [languagePickerEmbed()],
      components: languagePickerComponents(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  const commandName = COMMAND_NAME_BASE[interaction.commandName] ?? interaction.commandName
  switch (commandName) {
    case 'профиль': {
      const target = interaction.options.getUser('пользователь') ?? interaction.user
      if (target.id !== interaction.user.id) {
        await interaction.reply({
          embeds: [profileEmbed(target.id, getUser(store, target.id), target.displayName)],
          allowedMentions: { parse: [] },
        })
        return
      }
      const user = userOf(interaction.user.id)
      await interaction.reply({
        embeds: [profileEmbed(interaction.user.id, user, interaction.user.displayName)],
        components: hubComponents(user),
        allowedMentions: { parse: [] },
      })
      const message = await interaction.fetchReply()
      hubOwners.set(message.id, interaction.user.id)
      return
    }
    case 'пвп': {
      const opponent = interaction.options.getUser('соперник')
      if (opponent?.bot) {
        await replyError(interaction, 'С ботами не дерёмся.')
        return
      }
      if (opponent?.id === interaction.user.id) {
        await replyError(interaction, 'Себя вызывать не надо.')
        return
      }
      const now = Date.now()
      for (const [id, setup] of pvpSetups) {
        if (now - setup.createdAt > OPEN_CHALLENGE_TTL) pvpSetups.delete(id)
      }
      const last = userOf(interaction.user.id).lastPvp
      const setup: PvpSetup = {
        ownerId: interaction.user.id,
        ownerName: interaction.user.displayName,
        ...(opponent ? { opponentId: opponent.id } : {}),
        format: last?.format ?? '1x1',
        gameMode: last?.gameMode ?? 'classic',
        wager: last?.wager ?? 0,
        bestOf: 1,
        createdAt: now,
      }
      await interaction.reply({
        embeds: [pvpSetupEmbed(setup)],
        components: pvpSetupComponents(setup),
        allowedMentions: { parse: [] },
      })
      const message = await interaction.fetchReply()
      if (pvpSetups.size >= 500) {
        const oldest = pvpSetups.keys().next().value
        if (oldest) pvpSetups.delete(oldest)
      }
      pvpSetups.set(message.id, setup)
      return
    }
    case 'пве': {
      await interaction.reply({
        embeds: [pvePanelEmbed()],
        components: pvePanelComponents(),
        allowedMentions: { parse: [] },
      })
      const message = await interaction.fetchReply()
      if (pveOwners.size >= 500) {
        const oldest = pveOwners.keys().next().value
        if (oldest) pveOwners.delete(oldest)
      }
      pveOwners.set(message.id, interaction.user.id)
      return
    }
    case 'дебаг': {
      if (interaction.user.id !== OWNER_ID) {
        await replyError(interaction, 'Команда только для владельца бота.')
        return
      }
      await interaction.reply({
        embeds: [debugPanelEmbed()],
        components: debugPanelComponents(),
        flags: MessageFlags.Ephemeral,
      })
      return
    }
    case 'гайд': {
      await interaction.reply({
        embeds: [guideEmbed(userOf(interaction.user.id))],
        allowedMentions: { parse: [] },
      })
      return
    }
    case 'команды': {
      const user = userOf(interaction.user.id)
      await interaction.reply({
        embeds: [helpEmbed(user)],
        allowedMentions: { parse: [] },
      })
      return
    }
    case 'settings': {
      const user = userOf(interaction.user.id)
      await interaction.reply({
        embeds: [settingsEmbed(user)],
        components: settingsComponents(user),
        flags: MessageFlags.Ephemeral,
      })
      return
    }
  }
}

function setupFor(interaction: ButtonInteraction | StringSelectMenuInteraction): PvpSetup | undefined {
  const setup = pvpSetups.get(interaction.message.id)
  if (!setup) return undefined
  if (Date.now() - setup.createdAt > OPEN_CHALLENGE_TTL) {
    pvpSetups.delete(interaction.message.id)
    return undefined
  }
  return setup
}

async function handlePvpSetupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const setup = setupFor(interaction)
  if (!setup) {
    await replyError(interaction, 'Настройка устарела. Открой /пвп заново.')
    return
  }
  if (interaction.user.id !== setup.ownerId) {
    await replyError(interaction, 'Это чужая настройка.')
    return
  }
  if (interaction.customId === 'pvp:setup:format') {
    setup.format = parseBattleMode(interaction.values[0])
  } else if (interaction.customId === 'pvp:setup:mode') {
    const gameMode = interaction.values[0] as PvpMode
    if (!['classic', 'random', 'draft'].includes(gameMode)) {
      await replyError(interaction, 'Такого режима нет.')
      return
    }
    setup.gameMode = gameMode
  } else if (interaction.customId === 'pvp:setup:series') {
    const series = interaction.values[0]
    setup.bestOf = series === 'bo3' ? 3 : series === 'bo5' ? 5 : 1
  }
  await interaction.update({
    embeds: [pvpSetupEmbed(setup)],
    components: pvpSetupComponents(setup),
  })
}

async function createChallengeFromSetup(
  interaction: ButtonInteraction,
  setup: PvpSetup,
): Promise<void> {
  releasePveBattles(setup.ownerId)
  if (isUserInActiveBattle(setup.ownerId)) {
    await replyError(interaction, 'Сначала закончи текущий бой.')
    return
  }
  if (setup.wager > 0 && !wagerAllowed(userOf(setup.ownerId), setup.wager)) {
    await replyError(interaction, 'Недостаточно монет для такой ставки.')
    return
  }
  if (setup.opponentId && isUserInActiveBattle(setup.opponentId)) {
    await replyError(interaction, 'Соперник уже участвует в другом бою.')
    return
  }
  if (setup.bestOf > 1 && (setup.format !== '1x1' || setup.gameMode !== 'classic')) {
    await replyError(interaction, 'Дуэли доступны только в формате 1 на 1 и режиме «Классика».')
    return
  }

  store.users[setup.ownerId] = setLastPvp(userOf(setup.ownerId), {
    format: setup.format,
    gameMode: setup.gameMode,
    wager: setup.wager,
  })
  persist()
  pvpSetups.delete(interaction.message.id)
  if (setup.opponentId) {
    await interaction.update(
      challengeReplyOptions(
        setup.ownerName,
        setup.opponentId,
        setup.wager,
        setup.format,
        setup.gameMode,
        setup.bestOf,
      ),
    )
    challenges.set(interaction.message.id, {
      challengerId: setup.ownerId,
      challengerName: setup.ownerName,
      opponentId: setup.opponentId,
      wager: setup.wager,
      mode: setup.format,
      gameMode: setup.gameMode,
      bestOf: setup.bestOf,
    })
    return
  }

  const now = Date.now()
  for (const [id, offer] of openChallenges) {
    if (now - offer.createdAt > OPEN_CHALLENGE_TTL) openChallenges.delete(id)
  }
  await interaction.update({
    embeds: [openChallengeEmbed(setup.ownerName, setup.wager, setup.format, setup.gameMode, setup.bestOf)],
    components: openChallengeComponents(),
  })
  openChallenges.set(interaction.message.id, {
    creatorId: setup.ownerId,
    creatorName: setup.ownerName,
    wager: setup.wager,
    mode: setup.format,
    createdAt: now,
    gameMode: setup.gameMode,
    bestOf: setup.bestOf,
  })
}

async function handlePvpSetupButton(interaction: ButtonInteraction): Promise<void> {
  const setup = setupFor(interaction)
  if (!setup) {
    await replyError(interaction, 'Настройка устарела. Открой /пвп заново.')
    return
  }
  if (interaction.user.id !== setup.ownerId) {
    await replyError(interaction, 'Это чужая настройка.')
    return
  }
  if (interaction.customId === 'pvp:setup:cancel') {
    pvpSetups.delete(interaction.message.id)
    await interaction.update({
      content: 'Настройка PvP отменена.',
      embeds: [],
      components: [],
    })
    return
  }
  if (interaction.customId === 'pvp:setup:create') {
    await createChallengeFromSetup(interaction, setup)
    return
  }
  if (interaction.customId === 'pvp:setup:wager') {
    const modal = new ModalBuilder()
      .setCustomId('pvp:setup:wager:modal')
      .setTitle('Ставка')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('pvp:setup:wager:input')
            .setLabel('Сколько монет поставить?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(6)
            .setValue(String(setup.wager)),
        ),
      )
    await interaction.showModal(modal)
  }
}

async function handlePvpSetupModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.isFromMessage()) {
    await replyError(interaction, 'Настройка устарела. Открой /пвп заново.')
    return
  }
  const messageId = interaction.message.id
  const setup = pvpSetups.get(messageId)
  if (!setup) {
    await replyError(interaction, 'Настройка устарела. Открой /пвп заново.')
    return
  }
  if (interaction.user.id !== setup.ownerId) {
    await replyError(interaction, 'Это чужая настройка.')
    return
  }
  const value = Number(interaction.fields.getTextInputValue('pvp:setup:wager:input'))
  if (!Number.isInteger(value) || value < 0 || value > 100_000) {
    await replyError(interaction, 'Ставка должна быть целым числом от 0 до 100000.')
    return
  }
  if (value > 0 && !wagerAllowed(userOf(setup.ownerId), value)) {
    await replyError(interaction, 'Недостаточно монет для такой ставки.')
    return
  }
  setup.wager = value
  await interaction.update({
    embeds: [pvpSetupEmbed(setup)],
    components: pvpSetupComponents(setup),
  })
}

const DRAFT_POOL_SIZE = 12
const DRAFT_TURN_MS = 90_000

type DraftConfig = {
  messageId: string
  channelId: string
  format: BattleMode
  wager: number
  players: [{ userId: string; name: string }, { userId: string; name: string }]
}

export function draftPickOrder(format: BattleMode): number[] {
  return format === '2x2' ? [0, 1, 1, 0, 0, 1, 1, 0] : [0, 1, 1, 0, 0, 1]
}

export function draftPool(rng: () => number = Math.random): Character[] {
  const selected: Character[] = []
  const take = (source: readonly Character[], count: number): void => {
    const pool = [...source]
    while (selected.length < DRAFT_POOL_SIZE && count-- > 0 && pool.length > 0) {
      const index = Math.floor(rng() * pool.length)
      selected.push(pool.splice(index, 1)[0])
    }
  }
  take(KILLERS, 6)
  take(SURVIVORS, 6)
  const rest = CHARACTERS.filter(
    character => !selected.some(picked => picked.name === character.name),
  )
  take(rest, DRAFT_POOL_SIZE - selected.length)
  for (let index = selected.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1))
    ;[selected[index], selected[swap]] = [selected[swap], selected[index]]
  }
  return selected
}

function draftNeeded(format: BattleMode): number {
  return format === '2x2' ? 2 : 1
}

function draftAvailable(state: DraftState): Character[] {
  const banned = new Set(state.players.flatMap(player => player.bans))
  const picked = new Set(state.players.flatMap(player => player.picks))
  return state.pool.filter(
    character => !banned.has(character.name) && !picked.has(character.name),
  )
}

function draftCurrent(state: DraftState): DraftPlayer {
  return state.players[state.turn]
}

export function draftEmbed(state: DraftState): EmbedBuilder {
  const available = new Set(draftAvailable(state).map(character => character.name))
  const pool = state.pool.map(character => {
    const bannedBy = state.players.find(player => player.bans.includes(character.name))
    const pickedBy = state.players.find(player => player.picks.includes(character.name))
    const mark = bannedBy
      ? emojiText('cross', '❌')
      : pickedBy
        ? emojiText('check', '✅')
        : available.has(character.name)
          ? emojiText('dot', '▫️')
          : emojiText('dot', '▫️')
    const suffix = bannedBy
      ? ` — бан ${bannedBy.name}`
      : pickedBy
        ? ` — пик ${pickedBy.name}`
        : ' — свободен'
    const label = pickedBy
      ? userCharacterLabel(userOf(pickedBy.userId), character.name)
      : characterLabel(character.name)
    return `${mark} ${label}${suffix}`
  })
  const current = draftCurrent(state)
  const abilityCharacter =
    state.phase === 'ability' ? current.chosen[state.abilityIndex] : undefined
  const phase =
    state.phase === 'ban'
      ? `Баны · ${state.banIndex + 1}/4`
      : state.phase === 'pick'
        ? `Пики · ${state.pickIndex + 1}/${state.pickOrder.length}`
        : state.phase === 'ability'
          ? `Способности · ${state.abilityIndex + 1}/${current.chosen.length}`
          : 'Выбор героев'
  const players = state.players.map(player => {
    const bans = player.bans.length > 0 ? player.bans.join(', ') : '—'
    const picks = player.picks.length > 0 ? player.picks.join(', ') : '—'
    const chosen =
      state.phase !== 'choose' && player.chosen.length > 0
        ? ` · выбор: ${player.chosen.join(', ')}`
        : ''
    const abilities = Object.entries(player.abilities)
      .map(([character, ability]) => `${character} — ${ability}`)
      .join(', ')
    return `**${player.name}** — баны: ${bans} · пики: ${picks}${chosen}` +
      (abilities ? ` · способности: ${abilities}` : '')
  })
  return new EmbedBuilder()
    .setColor(EMBED_COLORS.choose)
    .setTitle(
      `${emojiText('swordwhite', '⚔️')} Драфт · ${state.format === '2x2' ? '2 на 2' : '1 на 1'}`,
    )
    .setDescription(
      [
        `Ставка: **${state.wager}** ${emojiText('points', '🪙')}`,
        `Фаза: **${phase}** · Ходит: **${current.name}**`,
        '',
        '**Пул:**',
        ...pool,
        '',
        ...players,
        '',
        state.phase === 'choose'
          ? 'Выбор героев скрыт до конца фазы.'
          : state.phase === 'ability'
            ? `Выбери способность для ${abilityCharacter ?? '—'}.`
            : '90 секунд на выбор, потом автовыбор.',
      ].join('\n'),
    )
}

export function draftComponents(state: DraftState): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const current = draftCurrent(state)
  const available = draftAvailable(state)
  const choosing = state.phase === 'choose'
  const abilityCharacter =
    state.phase === 'ability' ? current.chosen[state.abilityIndex] : undefined
  const abilityBase = abilityCharacter ? characterByName(abilityCharacter) : undefined
  const options =
    state.phase === 'ability' && abilityBase
      ? availableSpecials(abilityBase).map(special => ({
          label: special.name,
          value: special.name,
          description: special.kind === abilityBase.special.kind ? 'Основная' : 'Альтернативная',
        }))
      : choosing
        ? current.picks.map(name => ({
            label: name,
            value: name,
            description: 'Выбрать для боя',
          }))
        : available.map(character => ({
            label: character.name,
            value: character.name,
            description: character.class ?? character.role,
          }))
  if (options.length === 0) return []
  const needed = choosing ? draftNeeded(state.format) : 1
  const menu = new StringSelectMenuBuilder()
    .setCustomId('pvp:draft:select')
    .setPlaceholder(
      state.phase === 'ban'
        ? 'Забанить героя'
        : state.phase === 'pick'
          ? 'Пикнуть героя'
          : state.phase === 'ability'
            ? `Способность: ${abilityCharacter ?? '—'}`
            : `Выбрать ${needed} героя для боя`,
    )
    .setMinValues(needed)
    .setMaxValues(needed)
    .addOptions(options.slice(0, 25))
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]
}

function advanceDraft(state: DraftState): boolean {
  if (state.phase === 'ban') {
    state.banIndex += 1
    if (state.banIndex >= 4) {
      state.phase = 'pick'
      state.pickIndex = 0
      state.turn = state.pickOrder[0] as 0 | 1
    } else {
      state.turn = (state.banIndex % 2) as 0 | 1
    }
    return false
  }
  if (state.phase === 'pick') {
    state.pickIndex += 1
    if (state.pickIndex >= state.pickOrder.length) {
      state.phase = 'choose'
      state.chooseIndex = 0
      state.turn = 0
    } else {
      state.turn = state.pickOrder[state.pickIndex] as 0 | 1
    }
    return false
  }
  if (state.phase === 'choose') {
    state.chooseIndex += 1
    if (state.chooseIndex >= 2) {
      state.phase = 'ability'
      state.turn = 0
      state.abilityIndex = 0
      return false
    }
    state.turn = state.chooseIndex as 0 | 1
    return false
  }
  state.abilityIndex += 1
  const current = state.players[state.turn]
  if (state.abilityIndex >= current.chosen.length) {
    if (state.turn === 0) {
      state.turn = 1
      state.abilityIndex = 0
      return false
    }
    return true
  }
  return false
}

function clearDraftTimer(messageId: string): void {
  const timer = draftTimers.get(messageId)
  if (timer) clearTimeout(timer)
  draftTimers.delete(messageId)
}

async function patchDraftMessage(client: Client, state: DraftState): Promise<void> {
  await client.rest
    .patch(Routes.channelMessage(state.channelId, state.messageId), {
      body: {
        embeds: [draftEmbed(state).toJSON()],
        components: draftComponents(state).map(row => row.toJSON()),
      },
    })
    .catch(() => {})
}

function armDraftTimer(client: Client, state: DraftState): void {
  clearDraftTimer(state.messageId)
  const timer = setTimeout(() => {
    void handleDraftTimeout(client, state.messageId)
  }, DRAFT_TURN_MS)
  timer.unref?.()
  draftTimers.set(state.messageId, timer)
}

async function startDraft(
  interaction: ButtonInteraction,
  config: DraftConfig,
): Promise<void> {
  if (drafts.size >= 200) {
    const oldest = drafts.keys().next().value
    if (oldest) {
      drafts.delete(oldest)
      clearDraftTimer(oldest)
    }
  }
  const state: DraftState = {
    messageId: config.messageId,
    channelId: config.channelId,
    format: config.format,
    wager: config.wager,
    pool: draftPool(),
    players: [
      { ...config.players[0], bans: [], picks: [], chosen: [], abilities: {} },
      { ...config.players[1], bans: [], picks: [], chosen: [], abilities: {} },
    ],
    phase: 'ban',
    turn: 0,
    banIndex: 0,
    pickIndex: 0,
    pickOrder: draftPickOrder(config.format),
    chooseIndex: 0,
    abilityIndex: 0,
    createdAt: Date.now(),
  }
  drafts.set(state.messageId, state)
  await interaction.update({
    content: '',
    embeds: [draftEmbed(state)],
    components: draftComponents(state),
  })
  armDraftTimer(interaction.client, state)
}

async function finishDraft(
  client: Client,
  state: DraftState,
  interaction?: ButtonInteraction | StringSelectMenuInteraction,
): Promise<void> {
  drafts.delete(state.messageId)
  clearDraftTimer(state.messageId)
  const teams = state.players.map(player =>
    player.chosen
      .map(name => {
        const base = characterByName(name)
        return base ? characterWithSpecial(base, player.abilities[name]) : undefined
      })
      .filter((character): character is Character => Boolean(character)),
  )
  const needed = draftNeeded(state.format)
  if (teams.some(team => team.length !== needed)) {
    if (interaction) {
      await replyError(interaction, 'Не удалось собрать составы драфта.')
    }
    return
  }
  const battle =
    state.format === '2x2'
      ? createTeamBattle(
          teams[0].map(character => ({
            userId: state.players[0].userId,
            name: state.players[0].name,
            character,
          })),
          teams[1].map(character => ({
            userId: state.players[1].userId,
            name: state.players[1].name,
            character,
          })),
        )
      : createBattle(
          {
            userId: state.players[0].userId,
            name: state.players[0].name,
            character: teams[0][0],
          },
          {
            userId: state.players[1].userId,
            name: state.players[1].name,
            character: teams[1][0],
          },
        )
  battles.set(state.messageId, battle)
  battleGameModes.set(state.messageId, 'draft')
  battleChannels.set(state.messageId, state.channelId)
  if (state.wager > 0) wagers.set(state.messageId, state.wager)
  const deadline = armBattleTimer(client, state.messageId, battle)
  const events = [
    `Драфт завершён: ${state.players[0].name} — ${teams[0].map(c => c.name).join(', ')}; ` +
      `${state.players[1].name} — ${teams[1].map(c => c.name).join(', ')}.`,
  ]
  if (interaction) {
    await withBattleTurnLanguage(battle, async () => {
      try {
        await interaction.update({
          embeds: [battleEmbed(battle, events, undefined, deadline)],
          components: battleComponents(battle),
        })
      } catch {
        await patchBattleMessage(
          client,
          state.messageId,
          state.channelId,
          battle,
          events,
          undefined,
          deadline,
          battleComponents(battle),
        )
      }
    })
  } else {
    await patchBattleMessage(
      client,
      state.messageId,
      state.channelId,
      battle,
      events,
      undefined,
      deadline,
      battleComponents(battle),
    )
  }
  notifyBattleStart(client, battle, state.channelId, state.messageId)
}

async function handleDraftSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const state = drafts.get(interaction.message.id)
  if (!state) {
    await replyError(interaction, 'Драфт уже окончен.')
    return
  }
  const current = draftCurrent(state)
  if (interaction.user.id !== current.userId) {
    await replyError(interaction, 'Сейчас выбирает другой игрок.')
    return
  }

  const values = [...new Set(interaction.values)]
  if (state.phase === 'ability') {
    const characterName = current.chosen[state.abilityIndex]
    const base = characterName ? characterByName(characterName) : undefined
    if (values.length !== 1 || !base) {
      await replyError(interaction, 'Нужно выбрать одну способность.')
      return
    }
    if (!availableSpecials(base).some(special => special.name === values[0])) {
      await replyError(interaction, 'У этого героя нет такой способности.')
      return
    }
    current.abilities[base.name] = values[0]
  } else if (state.phase === 'choose') {
    const needed = draftNeeded(state.format)
    if (values.length !== needed || values.some(name => !current.picks.includes(name))) {
      await replyError(interaction, `Нужно выбрать ${needed} героя из своих пиков.`)
      return
    }
    current.chosen = values
  } else {
    if (values.length !== 1) {
      await replyError(interaction, 'Нужно выбрать одного героя.')
      return
    }
    const [name] = values
    if (!draftAvailable(state).some(character => character.name === name)) {
      await replyError(interaction, 'Этот герой уже занят.')
      return
    }
    if (state.phase === 'ban') current.bans.push(name)
    else current.picks.push(name)
  }

  clearDraftTimer(state.messageId)
  if (advanceDraft(state)) {
    await finishDraft(interaction.client, state, interaction)
    return
  }
  try {
    await interaction.update({
      embeds: [draftEmbed(state)],
      components: draftComponents(state),
    })
  } catch {
    await patchDraftMessage(interaction.client, state)
  }
  armDraftTimer(interaction.client, state)
}

async function handleDraftTimeout(client: Client, messageId: string): Promise<void> {
  const state = drafts.get(messageId)
  if (!state) return
  const current = draftCurrent(state)
  if (state.phase === 'ability') {
    const characterName = current.chosen[state.abilityIndex]
    const base = characterName ? characterByName(characterName) : undefined
    const specials = base ? availableSpecials(base) : []
    if (base && specials.length > 0) {
      const special = specials[Math.floor(Math.random() * specials.length)]
      current.abilities[base.name] = special.name
    }
  } else if (state.phase === 'choose') {
    const needed = draftNeeded(state.format)
    const picks = [...current.picks]
    while (picks.length < needed) {
      const fallback = draftAvailable(state)[0]
      if (!fallback) break
      picks.push(fallback.name)
    }
    current.chosen = picks.slice(0, needed)
  } else {
    const available = draftAvailable(state)
    const pick = available[Math.floor(Math.random() * available.length)]
    if (!pick) {
      drafts.delete(messageId)
      clearDraftTimer(messageId)
      return
    }
    if (state.phase === 'ban') current.bans.push(pick.name)
    else current.picks.push(pick.name)
  }
  if (advanceDraft(state)) {
    await finishDraft(client, state)
    return
  }
  await patchDraftMessage(client, state)
  armDraftTimer(client, state)
}

async function handleChallengeButton(interaction: ButtonInteraction): Promise<void> {
  const challenge = challenges.get(interaction.message.id)
  if (!challenge) {
    await replyError(interaction, 'Этот вызов уже неактуален.')
    return
  }
  if (interaction.user.id !== challenge.opponentId) {
    await replyError(interaction, 'Это чужой вызов.')
    return
  }
  if (interaction.customId === 'pvp:decline') {
    challenges.delete(interaction.message.id)
    await interaction.update({
      content: `Вызов отклонён. **${challenge.challengerName}**, в другой раз.`,
      components: [],
    })
    return
  }
  releasePveBattles(interaction.user.id)
  releasePveBattles(challenge.challengerId)
  if (isUserInActiveBattle(interaction.user.id)) {
    await replyError(interaction, 'Ты уже участвуешь в другом бою.')
    return
  }
  if (isUserInActiveBattle(challenge.challengerId)) {
    challenges.delete(interaction.message.id)
    await interaction.update({
      content: 'Автор вызова уже участвует в другом бою. Создай новый через /пвп.',
      embeds: [],
      components: [],
    })
    return
  }

  let challenger = userOf(challenge.challengerId)
  let opponent = userOf(challenge.opponentId)

  if (challenge.wager > 0) {
    if (!wagerAllowed(challenger, challenge.wager) || !wagerAllowed(opponent, challenge.wager)) {
      await replyError(interaction, 'У кого-то не хватает монет на ставку.')
      return
    }
    challenger = { ...challenger, coins: challenger.coins - challenge.wager }
    opponent = { ...opponent, coins: opponent.coins - challenge.wager }
    store.users[challenge.challengerId] = challenger
    store.users[challenge.opponentId] = opponent
    persist()
  }

  challenges.delete(interaction.message.id)
  if (challenge.gameMode === 'draft') {
    await startDraft(interaction, {
      messageId: interaction.message.id,
      channelId: interaction.channelId,
      format: challenge.mode,
      wager: challenge.wager,
      players: [
        { userId: challenge.challengerId, name: challenge.challengerName },
        { userId: challenge.opponentId, name: interaction.user.displayName },
      ],
    })
    return
  }
  if ((challenge.bestOf ?? 1) > 1) {
    const duel = createDuel(
      interaction.message.id,
      interaction.channelId,
      challenge.challengerId,
      challenge.challengerName,
      challenge.opponentId,
      interaction.user.displayName,
      challenge.bestOf as 3 | 5,
      challenge.wager,
    )
    duels.set(duel.messageId, duel)
    await startDuelRound(interaction, duel)
    return
  }
  const battle =
    challenge.gameMode === 'random'
      ? randomBattleFor(
          challenge.mode,
          { userId: challenge.challengerId, name: challenge.challengerName },
          { userId: challenge.opponentId, name: interaction.user.displayName },
        )
      : challenge.mode === '2x2'
        ? createTeamBattle(
            teamEntries(challenger, challenge.challengerId, challenge.challengerName),
            teamEntries(opponent, challenge.opponentId, interaction.user.displayName),
          )
        : createBattle(
            {
              userId: challenge.challengerId,
              name: challenge.challengerName,
              character: activeCharacter(challenger),
            },
            {
              userId: challenge.opponentId,
              name: interaction.user.displayName,
              character: activeCharacter(opponent),
            },
          )
  battles.set(interaction.message.id, battle)
  battleGameModes.set(interaction.message.id, challenge.gameMode)
  battleChannels.set(interaction.message.id, interaction.channelId)
  if (challenge.wager > 0) wagers.set(interaction.message.id, challenge.wager)
  const deadline = armBattleTimer(interaction.client, interaction.message.id, battle)
  await withBattleTurnLanguage(battle, async () => {
    await interaction.update({
      embeds: [battleEmbed(battle, [], undefined, deadline)],
      components: battleComponents(battle),
    })
  })
  notifyBattleStart(
    interaction.client,
    battle,
    interaction.channelId,
    interaction.message.id,
  )
}

function createDuel(
  messageId: string,
  channelId: string,
  challengerId: string,
  challengerName: string,
  opponentId: string,
  opponentName: string,
  bestOf: 3 | 5,
  wager: number,
): DuelSeries {
  return {
    messageId,
    channelId,
    challengerId,
    challengerName,
    opponentId,
    opponentName,
    bestOf,
    wins: [0, 0],
    round: 1,
    challengerTeam: 0,
    wager,
    finished: false,
  }
}

function duelEntry(duel: DuelSeries, userId: string, name: string): FighterEntry {
  const user = userOf(userId)
  return { userId, name, character: activeCharacter(user) }
}

function duelBattle(duel: DuelSeries): Battle {
  const challenger = duelEntry(duel, duel.challengerId, duel.challengerName)
  const opponent = duelEntry(duel, duel.opponentId, duel.opponentName)
  return duel.challengerTeam === 0
    ? createBattle(challenger, opponent)
    : createBattle(opponent, challenger)
}

function duelNextComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const sword = emojiData('swordwhite')
  const button = new ButtonBuilder()
    .setCustomId('duel:next')
    .setLabel('Следующий раунд')
    .setStyle(ButtonStyle.Primary)
  if (sword) button.setEmoji(sword)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
}

function duelRematchComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const retry = emojiData('retry')
  const button = new ButtonBuilder()
    .setCustomId('duel:rematch')
    .setLabel('Реванш серии')
    .setStyle(ButtonStyle.Primary)
  if (retry) button.setEmoji(retry)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
}

async function startDuelRound(
  interaction: ButtonInteraction,
  duel: DuelSeries,
): Promise<void> {
  const battle = duelBattle(duel)
  battles.set(duel.messageId, battle)
  battleGameModes.set(duel.messageId, 'classic')
  battleChannels.set(duel.messageId, duel.channelId)
  const deadline = armBattleTimer(interaction.client, duel.messageId, battle)
  const score = `Серия **Bo${duel.bestOf}** · счёт **${duel.wins[0]}:${duel.wins[1]}**`
  await withBattleTurnLanguage(battle, async () => {
    await interaction.update({
      embeds: [battleEmbed(battle, [], score, deadline)],
      components: battleComponents(battle),
    })
  })
  notifyBattleStart(interaction.client, battle, duel.channelId, duel.messageId)
}

async function handleDuelButton(interaction: ButtonInteraction): Promise<void> {
  const duel = duels.get(interaction.message.id)
  if (!duel) {
    await replyError(interaction, 'Эта серия уже недоступна.')
    return
  }
  if (![duel.challengerId, duel.opponentId].includes(interaction.user.id)) {
    await replyError(interaction, 'Ты не участник этой серии.')
    return
  }
  if (interaction.customId === 'duel:next') {
    if (duel.finished) {
      await replyError(interaction, 'Серия уже окончена.')
      return
    }
    await startDuelRound(interaction, duel)
    return
  }
  if (interaction.customId === 'duel:rematch') {
    if (!duel.finished) {
      await replyError(interaction, 'Сначала закончи текущую серию.')
      return
    }
    if (isUserInActiveBattle(duel.challengerId) || isUserInActiveBattle(duel.opponentId)) {
      await replyError(interaction, 'Один из игроков уже участвует в другом бою.')
      return
    }
    if (duel.wager > 0) {
      const challenger = userOf(duel.challengerId)
      const opponent = userOf(duel.opponentId)
      if (!wagerAllowed(challenger, duel.wager) || !wagerAllowed(opponent, duel.wager)) {
        await replyError(interaction, 'У кого-то не хватает монет на ставку.')
        return
      }
      store.users[duel.challengerId] = { ...challenger, coins: challenger.coins - duel.wager }
      store.users[duel.opponentId] = { ...opponent, coins: opponent.coins - duel.wager }
      persist()
    }
    duel.wins = [0, 0]
    duel.round = 1
    duel.challengerTeam = 0
    duel.finished = false
    duels.set(duel.messageId, duel)
    await startDuelRound(interaction, duel)
  }
}

function isoUtcDate(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

export function survivalPanelEmbed(
  user: UserData,
  users: Record<string, UserData> = store.users,
): EmbedBuilder {
  const best = user.survivalBest
  const personal = best
    ? `Личный рекорд: **${best.wave}** волн · ${best.character} · ${isoUtcDate(best.at)}`
    : 'Личного рекорда пока нет.'
  const records = topSurvivalRecords(users)
  const top =
    records.length === 0
      ? 'Пока никто не играл.'
      : records
          .map(
            (entry, index) =>
              `${index + 1}. <@${entry.userId}> — **${entry.wave}** волн · ` +
              `${entry.character} · ${isoUtcDate(entry.at)}`,
          )
          .join('\n')

  return new EmbedBuilder()
    .setColor(EMBED_COLORS.battle)
    .setTitle('Выживание')
    .setDescription(personal)
    .addFields({ name: 'Топ-10', value: top })
    .setFooter({ text: 'Forsaken Simulator' })
}

export function survivalPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const skull = emojiData('skull')
  const start = new ButtonBuilder()
    .setCustomId('survival:start')
    .setLabel('Начать забег')
    .setStyle(ButtonStyle.Primary)
  if (skull) start.setEmoji(skull)
  const menu = new ButtonBuilder()
    .setCustomId('pve:menu')
    .setLabel('← Назад')
    .setStyle(ButtonStyle.Secondary)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(start, menu)]
}

function survivalNextComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const sword = emojiData('swordwhite')
  const points = emojiData('points')
  const next = new ButtonBuilder()
    .setCustomId('survival:next')
    .setLabel('Следующая волна')
    .setStyle(ButtonStyle.Primary)
  if (sword) next.setEmoji(sword)
  const end = new ButtonBuilder()
    .setCustomId('survival:end')
    .setLabel('Забрать награду')
    .setStyle(ButtonStyle.Success)
  if (points) end.setEmoji(points)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(next, end)]
}

function survivalAgainComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const retry = emojiData('retry')
  const again = new ButtonBuilder()
    .setCustomId('survival:again')
    .setLabel('Ещё раз')
    .setStyle(ButtonStyle.Primary)
  if (retry) again.setEmoji(retry)
  const records = new ButtonBuilder()
    .setCustomId('survival:menu')
    .setLabel('К рекордам')
    .setStyle(ButtonStyle.Secondary)
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(again, records)]
}

async function startSurvivalRound(
  interaction: ButtonInteraction,
  run: SurvivalRun,
): Promise<void> {
  const base = randomCharacter(Math.random)
  const stats = survivalEnemyStats(run.wave)
  const enemy: Character = { ...base, hp: stats.hp, attack: stats.attack }
  const battle = createBattle(
    { userId: run.userId, name: run.name, character: run.character },
    {
      userId: `bot:survival:${run.messageId}:${run.wave}`,
      name: `Волна ${run.wave} · ${base.name}`,
      character: enemy,
    },
  )
  battle.sides[0].hp = run.hp
  battle.sides[0].maxHp = run.maxHp
  if (run.rottenCorpses !== undefined) {
    battle.sides[0].rottenCorpses = run.rottenCorpses
  }
  for (const minion of run.minions ?? []) {
    addRottenMinion(battle, battle.sides[0], minion)
  }
  battle.sides[1].healingMultiplier = 0.4
  battles.set(run.messageId, battle)
  battleGameModes.set(run.messageId, 'classic')
  battleChannels.set(run.messageId, run.channelId)
  const deadline = armBattleTimer(interaction.client, run.messageId, battle)
  await interaction.update({
    embeds: [
      battleEmbed(
        battle,
        [],
        `Выживание · волна ${run.wave} · награда за забег: ${run.reward}`,
        deadline,
      ),
    ],
    components: battleComponents(battle),
  })
  notifyBattleStart(interaction.client, battle, run.channelId, run.messageId)
}

async function handleSurvivalButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.user.bot) return

  if (interaction.customId === 'survival:start' || interaction.customId === 'survival:menu') {
    const ownerId = pveOwners.get(interaction.message.id)
    if (!ownerId || interaction.user.id !== ownerId) {
      await replyError(interaction, 'Это чужое меню.')
      return
    }
    if (interaction.customId === 'survival:menu') {
      await interaction.update({
        embeds: [survivalPanelEmbed(userOf(ownerId), store.users)],
        components: survivalPanelComponents(),
        allowedMentions: { parse: [] },
      })
      return
    }
    if (isUserInActiveBattle(ownerId)) {
      await replyError(interaction, 'Сначала закончи текущий бой.')
      return
    }
    const user = userOf(ownerId)
    const character = activeCharacter(user)
    const run: SurvivalRun = {
      messageId: interaction.message.id,
      channelId: interaction.channelId,
      userId: ownerId,
      name: interaction.user.displayName,
      character,
      wave: 1,
      hp: character.hp,
      maxHp: character.hp,
      reward: 0,
    }
    trainingSetups.delete(interaction.message.id)
    survivalRuns.set(run.messageId, run)
    await startSurvivalRound(interaction, run)
    return
  }

  if (interaction.customId === 'survival:again') {
    if (isUserInActiveBattle(interaction.user.id)) {
      await replyError(interaction, 'Сначала закончи текущий бой.')
      return
    }
    const user = userOf(interaction.user.id)
    const character = activeCharacter(user)
    const next: SurvivalRun = {
      messageId: interaction.message.id,
      channelId: interaction.channelId,
      userId: interaction.user.id,
      name: interaction.user.displayName,
      character,
      wave: 1,
      hp: character.hp,
      maxHp: character.hp,
      reward: 0,
    }
    survivalRuns.set(next.messageId, next)
    await startSurvivalRound(interaction, next)
    return
  }
  const run = survivalRuns.get(interaction.message.id)
  if (!run) {
    await replyError(interaction, 'Этот забег уже окончен.')
    return
  }
  if (interaction.user.id !== run.userId) {
    await replyError(interaction, 'Это чужой забег.')
    return
  }
  if (interaction.customId === 'survival:next') {
    await startSurvivalRound(interaction, run)
    return
  }
  if (interaction.customId === 'survival:end') {
    const payout = run.reward
    const cleared = survivalClearedWaves(run.wave)
    const best = recordSurvivalBest(userOf(run.userId), cleared, run.character.name)
    store.users[run.userId] = payout > 0 ? grantCoins(best.user, payout) : best.user
    persist()
    rememberPveOwner(run.messageId, run.userId)
    survivalRuns.delete(run.messageId)
    persistBattleState()
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(EMBED_COLORS.victory)
          .setTitle(`${emojiText('skull', '💀')} Забег окончен`)
          .setDescription(
            [
              `Пройдено волн: **${cleared}**. Награда: **+${payout}** ${emojiText('points', '🪙')}.`,
              best.improved ? `Новый личный рекорд: **${cleared}** волн!` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          ),
      ],
      components: survivalAgainComponents(),
      allowedMentions: { parse: [] },
    })
    return
  }
}

function releasePveBattles(userId: string): number {
  let released = 0
  for (const [messageId, battle] of battles) {
    if (battle.finished) continue
    if (
      !battle.sides.some(
        side => side.userId === userId && !side.fake && !side.minion,
      )
    ) {
      continue
    }
    const bossState = bossBattles.get(messageId)
    const isPve =
      trainingBattles.has(messageId) ||
      (bossState !== undefined && !bossState.coop) ||
      survivalRuns.has(messageId) ||
      bossRushRuns.has(messageId) ||
      towerRuns.has(messageId) ||
      trialRuns.has(messageId)
    if (!isPve) continue
    survivalRuns.delete(messageId)
    bossRushRuns.delete(messageId)
    towerRuns.delete(messageId)
    trialRuns.delete(messageId)
    cleanupBattle(messageId)
    released += 1
  }
  return released
}

function isUserInActiveBattle(userId: string): boolean {
  for (const run of survivalRuns.values()) {
    if (run.userId === userId) return true
  }
  for (const duel of duels.values()) {
    if (!duel.finished && (duel.challengerId === userId || duel.opponentId === userId)) return true
  }
  for (const draft of drafts.values()) {
    if (draft.players.some(player => player.userId === userId)) return true
  }
  for (const battle of battles.values()) {
    if (battle.finished) continue
    if (
      battle.sides.some(
        side =>
          side.userId === userId &&
          !side.userId.startsWith('bot:') &&
          !side.userId.startsWith('boss:'),
      )
    ) {
      return true
    }
  }
  return false
}

async function handleOpenChallengeButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const offer = openChallenges.get(messageId)
  if (!offer) {
    await replyError(interaction, 'Это предложение уже неактуально.')
    return
  }

  if (interaction.customId === 'pvp:open:cancel') {
    if (interaction.user.id !== offer.creatorId) {
      await replyError(interaction, 'Отменить предложение может только автор.')
      return
    }
    openChallenges.delete(messageId)
    await interaction.update({
      content: 'Открытый вызов отменён.',
      embeds: [],
      components: [],
    })
    return
  }

  if (interaction.user.id === offer.creatorId) {
    await replyError(interaction, 'Своё предложение принять нельзя.')
    return
  }
  if (interaction.user.bot) {
    await replyError(interaction, 'Ботам нельзя принимать вызовы.')
    return
  }
  if (Date.now() - offer.createdAt > OPEN_CHALLENGE_TTL) {
    openChallenges.delete(messageId)
    await interaction.update({
      content: 'Открытый вызов истёк. Создай новый через /пвп.',
      embeds: [],
      components: [],
    })
    return
  }
  releasePveBattles(interaction.user.id)
  releasePveBattles(offer.creatorId)
  if (isUserInActiveBattle(interaction.user.id)) {
    await replyError(interaction, 'Ты уже участвуешь в другом бою.')
    return
  }
  if (isUserInActiveBattle(offer.creatorId)) {
    openChallenges.delete(messageId)
    await interaction.update({
      content: 'Автор вызова уже участвует в другом бою. Создай новый через /пвп.',
      embeds: [],
      components: [],
    })
    return
  }

  let creator = userOf(offer.creatorId)
  let opponent = userOf(interaction.user.id)
  if (offer.wager > 0) {
    if (!wagerAllowed(creator, offer.wager)) {
      await replyError(interaction, 'У автора вызова не хватает монет на ставку.')
      return
    }
    if (!wagerAllowed(opponent, offer.wager)) {
      await replyError(interaction, 'Недостаточно монет для такой ставки.')
      return
    }
    creator = { ...creator, coins: creator.coins - offer.wager }
    opponent = { ...opponent, coins: opponent.coins - offer.wager }
    store.users[offer.creatorId] = creator
    store.users[interaction.user.id] = opponent
    persist()
  }

  openChallenges.delete(messageId)
  if (offer.gameMode === 'draft') {
    await startDraft(interaction, {
      messageId,
      channelId: interaction.channelId,
      format: offer.mode,
      wager: offer.wager,
      players: [
        { userId: offer.creatorId, name: offer.creatorName },
        { userId: interaction.user.id, name: interaction.user.displayName },
      ],
    })
    return
  }
  if ((offer.bestOf ?? 1) > 1) {
    const duel = createDuel(
      messageId,
      interaction.channelId,
      offer.creatorId,
      offer.creatorName,
      interaction.user.id,
      interaction.user.displayName,
      offer.bestOf as 3 | 5,
      offer.wager,
    )
    duels.set(duel.messageId, duel)
    await startDuelRound(interaction, duel)
    return
  }
  const battle =
    offer.gameMode === 'random'
      ? randomBattleFor(
          offer.mode,
          { userId: offer.creatorId, name: offer.creatorName },
          { userId: interaction.user.id, name: interaction.user.displayName },
        )
      : offer.mode === '2x2'
        ? createTeamBattle(
            teamEntries(creator, offer.creatorId, offer.creatorName),
            teamEntries(opponent, interaction.user.id, interaction.user.displayName),
          )
        : createBattle(
            {
              userId: offer.creatorId,
              name: offer.creatorName,
              character: activeCharacter(creator),
            },
            {
              userId: interaction.user.id,
              name: interaction.user.displayName,
              character: activeCharacter(opponent),
            },
          )

  battles.set(messageId, battle)
  battleGameModes.set(messageId, offer.gameMode)
  battleChannels.set(messageId, interaction.channelId)
  if (offer.wager > 0) wagers.set(messageId, offer.wager)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await withBattleTurnLanguage(battle, async () => {
    await interaction.update({
      embeds: [battleEmbed(battle, [], undefined, deadline)],
      components: battleComponents(battle),
    })
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handleBossStart(interaction: ButtonInteraction): Promise<void> {
  if (isUserInActiveBattle(interaction.user.id)) {
    await replyError(interaction, 'Сначала закончи текущий бой.')
    return
  }

  // Boss fights are always two heroes against the boss, even if an old
  // 1x1 button is still present on a panel sent before the update.
  const mode: BossMode = '2x2'
  const week = isoWeekKey()
  const day = isoDayKey()
  const user = userOf(interaction.user.id)
  const boss = bossCharacterForDay(mode, day)
  const bossEntry: FighterEntry = {
    userId: `boss:${week}:${interaction.id}`,
    name: `БОСС · ${boss.name}`,
    character: boss,
    boss: true,
  }
  const battle = createTeamBattle(teamEntries(user, interaction.user.id, interaction.user.displayName), [
    bossEntry,
  ])

  await interaction.reply({
    embeds: [battleEmbed(battle)],
    components: battleComponents(battle),
  })
  const message = await interaction.fetchReply()
  battles.set(message.id, battle)
  bossBattles.set(message.id, { mode, week, day })
  battleChannels.set(message.id, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, message.id, battle)
  await interaction.editReply({
    embeds: [battleEmbed(battle, [], undefined, deadline)],
    components: battleComponents(battle),
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, message.id)
}

async function handleBossCoopAgain(interaction: ButtonInteraction): Promise<void> {
  const finish = coopBossFinishes.get(interaction.message.id)
  if (!finish) {
    await replyError(interaction, 'Реванш больше недоступен.')
    return
  }
  const me = finish.players.find(player => player.id === interaction.user.id)
  if (!me) {
    await replyError(interaction, 'Ты не участвовал в этом бою.')
    return
  }
  const partner = finish.players.find(player => player.id !== interaction.user.id)
  if (!partner) {
    await replyError(interaction, 'Не получается найти напарника.')
    return
  }
  if (isUserInActiveBattle(interaction.user.id)) {
    await replyError(interaction, 'Сначала закончи текущий бой.')
    return
  }
  if (isUserInActiveBattle(partner.id)) {
    await replyError(interaction, 'Напарник уже участвует в другом бою.')
    return
  }

  coopBossFinishes.delete(interaction.message.id)
  const week = isoWeekKey()
  const now = Date.now()
  await interaction.reply({
    content: `<@${partner.id}>`,
    embeds: [bossCoopEmbed(interaction.user.displayName, week, partner.id)],
    components: bossCoopComponents(),
    allowedMentions: { users: [partner.id] },
  })
  const message = await interaction.fetchReply()
  if (coopBossInvites.size >= 200) {
    const oldest = coopBossInvites.keys().next().value
    if (oldest) coopBossInvites.delete(oldest)
  }
  coopBossInvites.set(message.id, {
    creatorId: interaction.user.id,
    creatorName: interaction.user.displayName,
    week,
    createdAt: now,
    targetId: partner.id,
  })
}

async function handleBossCoopButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  if (interaction.customId === 'boss:coop') {
    if (isUserInActiveBattle(interaction.user.id)) {
      await replyError(interaction, 'Сначала закончи текущий бой.')
      return
    }
    const now = Date.now()
    for (const [id, invite] of coopBossInvites) {
      if (now - invite.createdAt > OPEN_CHALLENGE_TTL) coopBossInvites.delete(id)
    }
    const week = isoWeekKey()
    await interaction.reply({
      embeds: [bossCoopEmbed(interaction.user.displayName, week)],
      components: bossCoopComponents(),
    })
    const message = await interaction.fetchReply()
    if (coopBossInvites.size >= 200) {
      const oldest = coopBossInvites.keys().next().value
      if (oldest) coopBossInvites.delete(oldest)
    }
    coopBossInvites.set(message.id, {
      creatorId: interaction.user.id,
      creatorName: interaction.user.displayName,
      week,
      createdAt: now,
    })
    return
  }

  const invite = coopBossInvites.get(messageId)
  if (!invite) {
    await replyError(interaction, 'Это приглашение уже неактуально.')
    return
  }
  if (interaction.customId === 'boss:coop:cancel') {
    if (interaction.user.id !== invite.creatorId) {
      await replyError(interaction, 'Отменить приглашение может только автор.')
      return
    }
    coopBossInvites.delete(messageId)
    await interaction.update({
      content: 'Приглашение на совместного босса отменено.',
      embeds: [],
      components: [],
    })
    return
  }
  if (interaction.user.id === invite.creatorId) {
    await replyError(interaction, 'Своё приглашение принять нельзя.')
    return
  }
  if (invite.targetId && interaction.user.id !== invite.targetId) {
    await replyError(interaction, 'Это приглашение для другого игрока.')
    return
  }
  if (interaction.user.bot) {
    await replyError(interaction, 'Ботам нельзя принимать приглашения.')
    return
  }
  if (Date.now() - invite.createdAt > OPEN_CHALLENGE_TTL) {
    coopBossInvites.delete(messageId)
    await interaction.update({
      content: 'Приглашение истекло. Открой /пве заново.',
      embeds: [],
      components: [],
    })
    return
  }
  if (isUserInActiveBattle(interaction.user.id)) {
    await replyError(interaction, 'Ты уже участвуешь в другом бою.')
    return
  }
  if (isUserInActiveBattle(invite.creatorId)) {
    coopBossInvites.delete(messageId)
    await interaction.update({
      content: 'Автор приглашения уже участвует в другом бою. Открой /пве заново.',
      embeds: [],
      components: [],
    })
    return
  }

  const creator = userOf(invite.creatorId)
  const partner = userOf(interaction.user.id)
  const week = isoWeekKey()
  const day = isoDayKey()
  const battle = coopBossBattle(
    {
      userId: invite.creatorId,
      name: invite.creatorName,
      character: activeCharacter(creator),
    },
    {
      userId: interaction.user.id,
      name: interaction.user.displayName,
      character: activeCharacter(partner),
    },
    week,
    day,
  )

  coopBossInvites.delete(messageId)
  battles.set(messageId, battle)
  bossBattles.set(messageId, { mode: '2x2', week, day, coop: true })
  battleChannels.set(messageId, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await withBattleTurnLanguage(battle, async () => {
    await interaction.update({
      embeds: [battleEmbed(battle, [], undefined, deadline)],
      components: battleComponents(battle),
    })
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handleRematch(interaction: ButtonInteraction): Promise<void> {
  const data = finishedBattles.get(interaction.message.id)
  if (!data) {
    await replyError(interaction, 'Реванш больше недоступен.')
    return
  }
  if (!data.players.some(player => player.userId === interaction.user.id)) {
    await replyError(interaction, 'Ты не участвовал в этом бою.')
    return
  }

  const opponent = data.players.find(player => player.userId !== interaction.user.id)
  if (!opponent) {
    await replyError(interaction, 'Не получается найти соперника.')
    return
  }
  if (data.wager > 0 && !wagerAllowed(userOf(interaction.user.id), data.wager)) {
    await replyError(interaction, 'Недостаточно монет для такой ставки.')
    return
  }

  finishedBattles.delete(interaction.message.id)
  await interaction.reply(
    challengeReplyOptions(
      interaction.user.displayName,
      opponent.userId,
      data.wager,
      data.mode,
      data.gameMode,
    ),
  )
  const message = await interaction.fetchReply()
  challenges.set(message.id, {
    challengerId: interaction.user.id,
    challengerName: interaction.user.displayName,
    opponentId: opponent.userId,
    wager: data.wager,
    mode: data.mode,
    gameMode: data.gameMode,
  })
}

async function handleSurrender(interaction: ButtonInteraction): Promise<void> {
  const battle = battles.get(interaction.message.id)
  if (!battle) {
    await replyError(interaction, 'Этот бой уже окончен.')
    return
  }

  let result: ReturnType<typeof surrender>
  try {
    result = surrender(battle, interaction.user.id)
  } catch (error) {
    await replyError(interaction, error instanceof Error ? error.message : 'Не получилось сдаться.')
    return
  }

  clearTurnPing(interaction.client, interaction.message.id)
  const messageId = interaction.message.id
  const loserTeam = (1 - result.winner) as 0 | 1
  const prefix = `**${teamLabel(result.battle, loserTeam)}** сдаётся.`
  const finished = finishBattleState(messageId, result.battle, prefix)

  await updateBattleInteraction(
    interaction,
    messageId,
    result.battle,
    [],
    finished.note,
    finished.components,
  )
}

async function handleBattleButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === 'pvp:surrender') {
    await handleSurrender(interaction)
    return
  }

  const battle = battles.get(interaction.message.id)
  if (!battle) {
    await replyError(interaction, 'Этот бой уже окончен.')
    return
  }
  if (interaction.customId === 'pvp:status') {
    await interaction.reply({
      embeds: [statusEmbed(battle)],
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  if (interaction.customId === 'pvp:stats') {
    await interaction.reply({
      embeds: [battleStatsEmbed(battle)],
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  const side = battle.sides[battle.turn]
  if (interaction.user.id !== side.userId) {
    await replyError(interaction, 'Сейчас не твой ход.')
    return
  }

  if (interaction.customId === 'pvp:forecast') {
    await interaction.reply({
      embeds: [forecastEmbed(battle, side, battleLogs.get(interaction.message.id) ?? [])],
      flags: MessageFlags.Ephemeral,
    })
    return
  }

  const action = interaction.customId.split(':')[1] as Action
  const enemies = battle.sides
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.team !== side.team && candidate.hp > 0)
    .map(({ index }) => index)
  const protectsAlly = action === 'special' && specialNeedsAllyTarget(side)
  const targets = protectsAlly
    ? battle.sides
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => candidate.team === side.team && candidate.hp > 0)
        .map(({ index }) => index)
    : enemies
  const needsTarget =
    action === 'attack' ||
    (action === 'special' && (specialNeedsEnemyTarget(side) || protectsAlly))
  const displayedTargets = [...targets]
  if (displayedTargets.some(index => battle.sides[index]?.fake)) {
    for (let index = displayedTargets.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1))
      ;[displayedTargets[index], displayedTargets[swap]] = [
        displayedTargets[swap],
        displayedTargets[index],
      ]
    }
  }

  if (needsTarget && displayedTargets.length > 1) {
    if (pendingTargets.size >= 500) {
      const oldest = pendingTargets.keys().next().value
      if (oldest) pendingTargets.delete(oldest)
    }
    pendingTargets.set(interaction.message.id, {
      userId: interaction.user.id,
      action,
      turn: battle.turn,
      targets: displayedTargets,
    })
    await interaction.update({
      components: targetComponents(
        battle,
        displayedTargets,
        protectsAlly ? 'ally' : 'enemy',
      ),
    })
    return
  }

  await executeBattleAction(interaction, battle, action)
}

async function restoreActionMenu(
  interaction: ButtonInteraction,
  messageId: string,
  battle: Battle,
): Promise<void> {
  pendingTargets.delete(messageId)
  const deadline = battleDeadlines.get(messageId)
  try {
    await interaction.update({
      embeds: [battleEmbed(battle, [], undefined, deadline)],
      components: battleComponents(battle),
    })
  } catch {
    await patchBattleMessage(
      interaction.client,
      messageId,
      interaction.channelId,
      battle,
      [],
      undefined,
      deadline,
      battleComponents(battle),
    )
  }
}

async function handleTargetButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const pending = pendingTargets.get(messageId)
  const battle = battles.get(messageId)
  const currentSide = battle && !battle.finished ? battle.sides[battle.turn] : undefined
  const canRestore =
    currentSide?.userId === interaction.user.id && !battle?.finished

  if (!pending) {
    if (battle && canRestore) {
      await restoreActionMenu(interaction, messageId, battle)
      return
    }
    await replyError(interaction, 'Выбор цели уже неактуален.')
    return
  }
  if (interaction.user.id !== pending.userId) {
    if (battle && canRestore && pending.turn !== battle.turn) {
      await restoreActionMenu(interaction, messageId, battle)
      return
    }
    await replyError(interaction, 'Цель выбирает другой игрок.')
    return
  }

  if (!battle) {
    pendingTargets.delete(messageId)
    await replyError(interaction, 'Этот бой уже окончен.')
    return
  }
  if (
    battle.finished ||
    battle.turn !== pending.turn ||
    battle.sides[battle.turn].userId !== interaction.user.id
  ) {
    if (canRestore) {
      await restoreActionMenu(interaction, messageId, battle)
      return
    }
    pendingTargets.delete(messageId)
    await replyError(interaction, 'Ход уже сменился.')
    return
  }

  const raw = interaction.customId.slice('pvp:target:'.length)
  if (raw === 'cancel') {
    pendingTargets.delete(messageId)
    await interaction.update({ components: battleComponents(battle) })
    return
  }
  if (raw === 'minions' || raw.startsWith('minions:')) {
    const type = raw.split(':')[1]
    const minionIndex = pending.targets.find(index => {
      const side = battle.sides[index]
      if (!side?.minion || side.hp <= 0) return false
      if (type === 'pizza') return side.pizzaMinion === true
      if (type === 'sentry') return side.structure === 'sentry'
      if (type === 'dispenser') return side.structure === 'dispenser'
      if (type === 'rotten') return !side.pizzaMinion && !side.structure
      return true
    })
    if (minionIndex === undefined) {
      await replyError(interaction, 'Живых миньонов не осталось.')
      return
    }
    pendingTargets.delete(messageId)
    await executeBattleAction(interaction, battle, pending.action, minionIndex)
    return
  }

  const targetIndex = Number(raw)
  if (!pending.targets.includes(targetIndex)) {
    await replyError(interaction, 'Эту цель выбрать нельзя.')
    return
  }

  pendingTargets.delete(messageId)
  await executeBattleAction(interaction, battle, pending.action, targetIndex)
}

async function executeBattleAction(
  interaction: ButtonInteraction,
  battle: Battle,
  action: Action,
  targetIndex?: number,
): Promise<void> {
  const messageId = interaction.message.id
  if (battleActionLocks.has(messageId)) {
    await replyError(interaction, 'Ход уже обрабатывается.')
    return
  }
  battleActionLocks.add(messageId)
  try {
    pendingTargets.delete(messageId)
    stopBattleTimer(messageId)
    const side = battle.sides[battle.turn]
    if (action === 'special' && !canUseSpecialNow(side)) {
      // A stale button from before an automated turn can arrive after the
      // cooldown has started; restore the panel instead of throwing.
      await restoreActionMenu(interaction, messageId, battle)
      return
    }
    let result: ReturnType<typeof takeTurn>
    try {
      result = takeTurn(battle, action, Math.random, targetIndex)
    } catch (error) {
      armBattleTimer(interaction.client, messageId, battle)
      throw error
    }
    // A free LLM can take a few seconds; acknowledge the click first so Discord
    // does not mark the interaction as failed.
    const upcomingLlm = llmAiEnabled() && battleCouldUseLlm(result.battle)
    if (upcomingLlm && !interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate()
    }
    if (upcomingLlm && interaction.deferred) {
      // Remove the buttons and show that the automated side is thinking, so a
      // slow free model does not look like a frozen battle.
      await withBattleTurnLanguage(result.battle, async () => {
        await interaction
          .editReply({
            embeds: [
              battleEmbed(
                result.battle,
                result.events,
                `${emojiText('neural', '🤖')} Нейросеть думает…`,
              ),
            ],
            components: [],
          })
          .catch(() => {})
      })
    }
    lastTurnPingUser.set(messageId, side.userId)
    clearTurnPing(interaction.client, messageId)
    let current = result.battle
    const events = [...result.events]
    current = await runAutomatedTurns(
      current,
      events,
      battleLogs.get(messageId) ?? [],
    )
    const stored = battles.get(messageId)
    if (!stored || stored.finished) return
    appendBattleLog(messageId, events)

    if (current.finished) {
      const finished = finishBattleState(messageId, current)
      await updateBattleInteraction(
        interaction,
        messageId,
        current,
        events,
        finished.note,
        finished.components,
      )
      return
    }

    resetTimeoutStrikes(messageId, side.userId)
    battles.set(messageId, current)
    const deadline = armBattleTimer(interaction.client, messageId, current)
    await updateBattleInteraction(
      interaction,
      messageId,
      current,
      events,
      undefined,
      battleComponents(current),
      deadline,
    )
    notifyNextTurn(interaction.client, current, interaction.channelId, messageId)
  } finally {
    battleActionLocks.delete(messageId)
  }
}

function dmComponentsFor(
  battle: Battle,
  userId: string,
  matchId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  if (battle.finished) return []
  return battle.sides[battle.turn]?.userId === userId
    ? battleComponents(battle, `dmatch:${matchId}`)
    : []
}

function dmAgainComponents(match: DmMatch): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`dmatch:${match.id}:again`)
        .setLabel('Найти ещё')
        .setStyle(ButtonStyle.Success),
    ),
  ]
}

async function clearDmPing(client: Client, match: DmMatch): Promise<void> {
  if (!match.ping) return
  const ping = match.ping
  match.ping = null
  await client.rest.delete(Routes.channelMessage(ping.channelId, ping.messageId)).catch(() => {})
}

async function notifyDmTurn(client: Client, match: DmMatch): Promise<void> {
  await clearDmPing(client, match)
  const active = match.battle.sides[match.battle.turn]
  if (!active || match.battle.finished) return
  const user = await client.users.fetch(active.userId).catch(() => null)
  if (!user) return
  const dm = await user.createDM().catch(() => null)
  if (!dm) return
  const content = translateText(
    `${emojiText('swordwhite', '⚔️')} Твой ход! ${active.character.name}.`,
    userOf(active.userId).language,
  )
  const message = await dm
    .send({
      content: `<@${active.userId}> ${content}`,
      allowedMentions: { users: [active.userId] },
    })
    .catch(() => null)
  if (message) {
    match.ping = { userId: active.userId, channelId: dm.id, messageId: message.id }
  }
}

async function syncDmMatch(
  client: Client,
  match: DmMatch,
  events: string[],
  note?: string,
): Promise<void> {
  for (const player of match.players) {
    const components = match.battle.finished
      ? dmAgainComponents(match)
      : dmComponentsFor(match.battle, player.userId, match.id)
    await withLanguage(userOf(player.userId).language, async () => {
      await client.rest
        .patch(Routes.channelMessage(player.channelId, player.messageId), {
          body: {
            embeds: [battleEmbed(match.battle, events, note).toJSON()],
            components: components.map(row => row.toJSON()),
          },
        })
        .catch(() => {})
    })
  }
}

async function queueDmUser(client: Client, userId: string): Promise<boolean> {
  if (dmMatchByUser.has(userId)) return false
  if (!dmQueue.includes(userId)) dmQueue.push(userId)
  await tryMatchDmQueue(client)
  return true
}

async function tryMatchDmQueue(client: Client): Promise<void> {
  while (dmQueue.length >= 2) {
    const { pair, rest } = takeDmPair(dmQueue)
    dmQueue.splice(0, dmQueue.length, ...rest)
    if (!pair) return
    const [firstId, secondId] = pair
    if (dmMatchByUser.has(firstId) || dmMatchByUser.has(secondId)) continue

    const firstUser = await client.users.fetch(firstId).catch(() => null)
    const secondUser = await client.users.fetch(secondId).catch(() => null)
    const firstDm = firstUser ? await firstUser.createDM().catch(() => null) : null
    const secondDm = secondUser ? await secondUser.createDM().catch(() => null) : null
    if (!firstUser || !secondUser || !firstDm || !secondDm) {
      if (firstDm) dmQueue.unshift(firstId)
      if (secondDm) dmQueue.unshift(secondId)
      continue
    }

    let battle: Battle
    try {
      battle = createDmBattle(
        {
          userId: firstId,
          name: firstUser.displayName ?? firstUser.username,
          character: activeCharacter(userOf(firstId)),
        },
        {
          userId: secondId,
          name: secondUser.displayName ?? secondUser.username,
          character: activeCharacter(userOf(secondId)),
        },
      )
    } catch {
      continue
    }

    const id = (++dmMatchCounter).toString(36)
    const firstMessage = await withLanguage(userOf(firstId).language, async () =>
      firstDm
        .send({
          embeds: [battleEmbed(battle)],
          components: dmComponentsFor(battle, firstId, id),
        })
        .catch(() => null),
    )
    const secondMessage = await withLanguage(userOf(secondId).language, async () =>
      secondDm
        .send({
          embeds: [battleEmbed(battle)],
          components: dmComponentsFor(battle, secondId, id),
        })
        .catch(() => null),
    )
    if (!firstMessage || !secondMessage) {
      if (firstMessage) await firstMessage.delete().catch(() => {})
      if (secondMessage) await secondMessage.delete().catch(() => {})
      if (firstMessage) dmQueue.unshift(firstId)
      if (secondMessage) dmQueue.unshift(secondId)
      continue
    }

    const match: DmMatch = {
      id,
      battle,
      players: [
        {
          userId: firstId,
          name: battle.sides[0].name,
          channelId: firstDm.id,
          messageId: firstMessage.id,
        },
        {
          userId: secondId,
          name: battle.sides[1].name,
          channelId: secondDm.id,
          messageId: secondMessage.id,
        },
      ],
      ping: null,
    }
    if (dmMatches.size >= 100) {
      const finished = [...dmMatches.entries()].find(([, entry]) => entry.battle.finished)
      if (finished) dmMatches.delete(finished[0])
    }
    dmMatches.set(id, match)
    dmMatchByUser.set(firstId, id)
    dmMatchByUser.set(secondId, id)
    await notifyDmTurn(client, match)
  }
}

async function handleGlobalPvpButton(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id
  if (dmMatchByUser.has(userId)) {
    await replyError(interaction, 'Ты уже в глобальном бою.')
    return
  }
  await interaction.reply({
    content: 'Ищу соперника на всех серверах…',
    flags: MessageFlags.Ephemeral,
  })
  await queueDmUser(interaction.client, userId)
}

function settleDmMatch(match: DmMatch): string | undefined {
  let note: string | undefined
  if (match.battle.winner !== null) {
    const record = recordBattle(match.battle, match.battle.winner, 0, false, 'classic')
    note = record.notes.length > 0 ? record.notes.join('\n') : undefined
    persist()
  } else {
    note = 'Бой окончен вничью.'
  }
  dmMatchByUser.delete(match.players[0].userId)
  dmMatchByUser.delete(match.players[1].userId)
  return note
}

async function handleDmMatchButton(interaction: ButtonInteraction): Promise<void> {
  const [, id, action] = interaction.customId.split(':')
  const match = dmMatches.get(id)
  if (!match) {
    await replyError(interaction, 'Этот бой уже недоступен.')
    return
  }
  if (!match.players.some(player => player.userId === interaction.user.id)) {
    await replyError(interaction, 'Это чужой бой.')
    return
  }
  if (action === 'again') {
    const queued = await queueDmUser(interaction.client, interaction.user.id)
    await interaction.reply({
      content: queued ? 'Снова ищу соперника…' : 'Ты уже в бою.',
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  const side = match.battle.sides.find(
    candidate => candidate.userId === interaction.user.id,
  )
  if (!side) {
    await replyError(interaction, 'Это чужой бой.')
    return
  }
  if (action === 'forecast') {
    await interaction.reply({
      embeds: [forecastEmbed(match.battle, side, [])],
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  if (action === 'status') {
    await interaction.reply({
      embeds: [statusEmbed(match.battle)],
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  if (action === 'stats') {
    await interaction.reply({
      embeds: [battleStatsEmbed(match.battle)],
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  if (match.battle.finished) {
    await replyError(interaction, 'Бой уже окончен.')
    return
  }
  if (action === 'surrender') {
    await interaction.deferUpdate()
    match.battle.finished = true
    match.battle.winner = (1 - side.team) as 0 | 1
    await clearDmPing(interaction.client, match)
    const note = settleDmMatch(match)
    await syncDmMatch(interaction.client, match, [], note)
    return
  }
  if (dmMatchTurnUserId(match.battle) !== interaction.user.id) {
    await replyError(interaction, 'Сейчас не твой ход.')
    return
  }
  const actionName = action as Action
  if (!['attack', 'special', 'juke', 'rest'].includes(actionName)) {
    await replyError(interaction, 'Неизвестное действие.')
    return
  }

  await interaction.deferUpdate()
  let result: ReturnType<typeof takeTurn>
  try {
    result = takeTurn(match.battle, actionName, Math.random)
  } catch (error) {
    await interaction
      .followUp({
        content: error instanceof Error ? error.message : 'Не получилось выполнить действие.',
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {})
    return
  }
  match.battle = result.battle
  await clearDmPing(interaction.client, match)

  const note = match.battle.finished ? settleDmMatch(match) : undefined
  await syncDmMatch(interaction.client, match, result.events, note)
  if (!match.battle.finished) await notifyDmTurn(interaction.client, match)
}

async function handleTopPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = Number.parseInt(interaction.customId.split(':')[2] ?? '0', 10)
  await interaction.update({
    embeds: [topEmbed(page)],
    components: topComponents(page),
  })
}

async function handleHub(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
  const ownerId = hubOwners.get(interaction.message.id)
  if (!ownerId) {
    await replyError(interaction, 'Панель устарела. Открой /профиль заново.')
    return
  }
  if (interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужой профиль.')
    return
  }
  const user = userOf(ownerId)

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'quest:reroll') {
      try {
        const updated = rerollQuest(user, interaction.values[0])
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [questsEmbed(updated)],
          components: questsComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось заменить квест.',
        )
      }
      return
    }

    if (interaction.customId === 'presets:apply') {
      try {
        const updated = applyLoadoutPreset(user, interaction.values[0])
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [presetsEmbed(updated, 'Пресет применён.')],
          components: presetsComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось применить пресет.',
        )
      }
      return
    }

    if (interaction.customId === 'presets:delete') {
      const updated = deleteLoadoutPreset(user, interaction.values[0])
      store.users[ownerId] = updated
      persist()
      await interaction.update({
        embeds: [presetsEmbed(updated, 'Пресет удалён.')],
        components: presetsComponents(updated),
      })
      return
    }

    if (interaction.customId === 'hub:buy') {
      const character = characterByName(interaction.values[0])
      if (!character) {
        await replyError(interaction, 'Такого персонажа нет.')
        return
      }
      try {
        const updated = buyCharacter(user, character)
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [
            shopEmbed(
              updated,
              `${emojiText('check', '✅')} **${characterLabel(character.name)}** куплен за ` +
                `${character.price} ${emojiText('points', '🪙')}. Баланс: ${updated.coins} ${emojiText('points', '🪙')}`,
            ),
          ],
          components: shopComponents(updated),
        })
      } catch (error) {
        await replyError(interaction, error instanceof Error ? error.message : 'Не получилось купить.')
      }
      return
    }

    if (interaction.customId === 'hub:select') {
      const characterName = interaction.values[0]
      try {
        const updated = setActive(user, characterName)
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [chooseEmbed(updated)],
          components: chooseComponents(updated),
        })
      } catch (error) {
        await replyError(interaction, error instanceof Error ? error.message : 'Не получилось выбрать.')
      }
      return
    }

    if (interaction.customId === 'hub:partner') {
      try {
        const value = interaction.values[0]
        const updated = setPartner(user, value === 'auto' ? null : value)
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [chooseEmbed(updated)],
          components: chooseComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось выбрать напарника.',
        )
      }
      return
    }

    if (interaction.customId === 'hub:partnerAbility') {
      try {
        const partner = partnerCharacter(user)
        const updated = setLoadout(user, partner.name, interaction.values[0])
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [chooseEmbed(updated)],
          components: chooseComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось сменить способность напарника.',
        )
      }
      return
    }

    if (interaction.customId === 'hub:ability') {
      const active = characterByName(user.active ?? '')
      if (!active) {
        await replyError(interaction, 'Сначала выбери персонажа.')
        return
      }
      try {
        const updated = setLoadout(user, active.name, interaction.values[0])
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [chooseEmbed(updated)],
          components: chooseComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось сменить способность.',
        )
      }
      return
    }

    if (interaction.customId === 'cosmetics:item') {
      const value = interaction.values[0]
      if (value === 'accent_custom') {
        const custom = cosmeticById('accent_custom')
        if (custom && !user.cosmetics.owned.includes(custom.id) && user.coins < custom.price) {
          await replyError(
            interaction,
            `Не хватает монет: нужно ${custom.price}, у тебя ${user.coins}.`,
          )
          return
        }
        await interaction.showModal(customColorModal(ownerId, user.cosmetics.customColor))
        return
      }
      try {
        const updated =
          value === 'none'
            ? clearCosmetics(user)
            : user.cosmetics.owned.includes(value)
              ? equipCosmetic(user, value)
              : buyCosmetic(user, value)
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [cosmeticsEmbed(updated)],
          components: cosmeticsComponents(updated),
        })
      } catch (error) {
        await replyError(
          interaction,
          error instanceof Error ? error.message : 'Не получилось применить косметику.',
        )
      }
      return
    }
  }

  switch (interaction.customId) {
    case 'hub:shop':
      await interaction.update({ embeds: [shopEmbed(user)], components: shopComponents(user) })
      return
    case 'hub:choose':
      await interaction.update({
        embeds: [chooseEmbed(user)],
        components: chooseComponents(user),
      })
      return
    case 'hub:bonus':
      try {
        const updated = claimDailyBonus(user)
        store.users[ownerId] = updated
        persist()
        await interaction.update({
          embeds: [
            profileEmbed(
              ownerId,
              updated,
              interaction.user.displayName,
              `${emojiText('robux', '🎁')} +${DAILY_BONUS} монет`,
            ),
          ],
          components: hubComponents(updated),
        })
      } catch (error) {
        await replyError(interaction, error instanceof Error ? error.message : 'Бонус недоступен.')
      }
      return
    case 'hub:top':
      await interaction.update({ embeds: [topEmbed(0)], components: topComponents(0) })
      return
    case 'hub:chars':
      await interaction.update({
        embeds: [characterPromptEmbed()],
        components: characterBrowserComponents(
          true,
          undefined,
          user,
          false,
          characterFilters.get(interaction.message.id) ?? 'all',
        ),
      })
      return
    case 'hub:achievements':
      await interaction.update({
        embeds: [achievementsEmbed(user)],
        components: [backRow()],
      })
      return
    case 'hub:quests': {
      const updated = ensureWeeklyQuest(ensureQuests(user))
      if (updated !== user) {
        store.users[ownerId] = updated
        persist()
      }
      await interaction.update({
        embeds: [questsEmbed(updated)],
        components: questsComponents(updated),
      })
      return
    }
    case 'hub:history':
      await interaction.update({
        embeds: [historyEmbed(user)],
        components: [backRow()],
      })
      return
    case 'hub:cosmetics':
      await interaction.update({
        embeds: [cosmeticsEmbed(user)],
        components: cosmeticsComponents(user),
      })
      return
    case 'hub:presets':
      await interaction.update({
        embeds: [presetsEmbed(user)],
        components: presetsComponents(user),
      })
      return
    case 'hub:back':
      await interaction.update({
        embeds: [profileEmbed(ownerId, user, interaction.user.displayName)],
        components: hubComponents(user),
      })
      return
  }
}

async function handleCharacterSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const character = characterByName(interaction.values[0])
  if (!character) {
    await replyError(interaction, 'Такого персонажа нет.')
    return
  }

  const ownerId = hubOwners.get(interaction.message.id)
  if (ownerId && interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая панель.')
    return
  }

  const user = getUser(store, ownerId ?? interaction.user.id)
  const filter = characterFilters.get(interaction.message.id) ?? 'all'
  await interaction.update({
    embeds: [characterEmbed(character, user)],
    components: characterBrowserComponents(
      Boolean(ownerId),
      character,
      user,
      Boolean(ownerId),
      filter,
    ),
  })
}

async function handleCharacterFilter(interaction: StringSelectMenuInteraction): Promise<void> {
  const ownerId = hubOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая панель.')
    return
  }
  const user = userOf(ownerId)
  const filter = interaction.values[0] as CharacterFilter
  characterFilters.set(interaction.message.id, filter)
  await interaction.update({
    embeds: [characterPromptEmbed()],
    components: characterBrowserComponents(true, undefined, user, false, filter),
  })
}

async function handleCharacterAction(interaction: ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':')
  const action = parts[1]
  const character = CHARACTERS[Number.parseInt(parts[2] ?? '', 10)]
  const characterName = character?.name ?? ''
  if (!character) {
    await replyError(interaction, 'Такого персонажа нет.')
    return
  }
  const ownerId = hubOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая панель.')
    return
  }
  const user = userOf(ownerId)
  if (action === 'favorite') {
    try {
      const updated = toggleFavorite(user, characterName)
      store.users[ownerId] = updated
      persist()
      await interaction.update({
        embeds: [characterEmbed(character, updated)],
        components: characterBrowserComponents(
          true,
          character,
          updated,
          true,
          characterFilters.get(interaction.message.id) ?? 'all',
        ),
      })
    } catch (error) {
      await replyError(
        interaction,
        error instanceof Error ? error.message : 'Не получилось изменить избранное.',
      )
    }
    return
  }
  if (action === 'prestige') {
    try {
      const result = prestigeCharacter(user, characterName)
      store.users[ownerId] = result.user
      persist()
      await interaction.update({
        embeds: [characterEmbed(character, result.user)],
        components: characterBrowserComponents(
          true,
          character,
          result.user,
          true,
          characterFilters.get(interaction.message.id) ?? 'all',
        ),
      })
      await interaction.followUp({
        content:
          `${emojiText('xp', '⭐')} Престиж **${result.prestige}**! ` +
          `+${result.reward} ${emojiText('points', '🪙')}.`,
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      await replyError(
        interaction,
        error instanceof Error ? error.message : 'Не получилось повысить престиж.',
      )
    }
  }
}

export function presetSaveModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('presets:save:modal')
    .setTitle('Сохранить пресет')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('name')
          .setLabel('Название пресета')
          .setMaxLength(32)
          .setRequired(true)
          .setStyle(TextInputStyle.Short),
      ),
    )
}

async function handlePresetSaveModal(interaction: ModalSubmitInteraction): Promise<void> {
  const userId = interaction.user.id
  const name = interaction.fields.getTextInputValue('name')
  try {
    const updated = saveLoadoutPreset(userOf(userId), name)
    store.users[userId] = updated
    persist()
    await interaction.update({
      embeds: [presetsEmbed(updated, 'Пресет сохранён.')],
      components: presetsComponents(updated),
    })
  } catch (error) {
    await interaction.reply({
      content: error instanceof Error ? error.message : 'Не получилось сохранить пресет.',
      flags: MessageFlags.Ephemeral,
    })
  }
}

export function customColorModal(ownerId: string, current: string | null): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId('hex')
    .setLabel('HEX-код цвета')
    .setPlaceholder('#ff00aa')
    .setMinLength(6)
    .setMaxLength(7)
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
  if (current) input.setValue(current)

  return new ModalBuilder()
    .setCustomId(`cosmetics:hex:${ownerId}`)
    .setTitle('Свой цвет профиля')
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
}

async function handleCustomColorSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const ownerId = interaction.customId.slice('cosmetics:hex:'.length)
  if (!/^\d+$/.test(ownerId) || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая панель.')
    return
  }

  const normalized = normalizeHexColor(interaction.fields.getTextInputValue('hex'))
  if (!normalized) {
    await replyError(interaction, 'Нужен HEX-код вида #ff00aa.')
    return
  }

  let user = userOf(ownerId)
  try {
    if (!user.cosmetics.owned.includes('accent_custom')) {
      user = buyCosmetic(user, 'accent_custom')
    }
    user = setCustomColor(user, normalized)
    store.users[ownerId] = user
    persist()
  } catch (error) {
    await replyError(
      interaction,
      error instanceof Error ? error.message : 'Не получилось сохранить цвет.',
    )
    return
  }

  try {
    await interaction.update({
      embeds: [cosmeticsEmbed(user)],
      components: cosmeticsComponents(user),
    })
  } catch {
    await interaction
      .reply({ content: `Цвет ${normalized} сохранён.`, flags: MessageFlags.Ephemeral })
      .catch(() => {})
  }
}

async function handleSettingsSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const language = interaction.values[0] === 'en' ? 'en' : 'ru'
  const updated = setLanguage(userOf(interaction.user.id), language)
  store.users[interaction.user.id] = updated
  persist()
  setActiveLanguage(language)
  await interaction.update({
    embeds: [settingsEmbed(updated)],
    components: settingsComponents(updated),
  })
}

async function handleSpecialSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const index = Number(interaction.customId.slice('char:special:'.length))
  const character = CHARACTERS[index]
  if (!character) {
    await replyError(interaction, 'Такого персонажа нет.')
    return
  }
  const characterName = character.name

  const ownerId = hubOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая карточка.')
    return
  }

  try {
    const updated = setLoadout(userOf(ownerId), characterName, interaction.values[0])
    store.users[ownerId] = updated
    persist()
    await interaction.update({
      embeds: [characterEmbed(character, updated)],
      components: characterBrowserComponents(true, character, updated, true),
    })
  } catch (error) {
    await replyError(
      interaction,
      error instanceof Error ? error.message : 'Не получилось сменить способность.',
    )
  }
}

async function handleSkinSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const index = Number(interaction.customId.slice('char:skin:'.length))
  const character = CHARACTERS[index]
  if (!character) {
    await replyError(interaction, 'Такого персонажа нет.')
    return
  }
  const ownerId = hubOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужая карточка.')
    return
  }
  const value = interaction.values[0]
  try {
    const updated = setEquippedSkin(
      userOf(ownerId),
      character.name,
      value === 'none' ? null : value,
    )
    store.users[ownerId] = updated
    persist()
    await interaction.update({
      embeds: [characterEmbed(character, updated)],
      components: characterBrowserComponents(true, character, updated, true),
    })
  } catch (error) {
    await replyError(
      interaction,
      error instanceof Error ? error.message : 'Не получилось сменить скин.',
    )
  }
}

async function handleDebugCoinsModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.user.id !== OWNER_ID) {
    await replyError(interaction, 'Команда только для владельца бота.')
    return
  }
  const amount = Number(interaction.fields.getTextInputValue('amount').trim())
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
    await replyError(interaction, 'Сумма должна быть от 1 до 1 000 000.')
    return
  }
  const rawTarget = interaction.fields.getTextInputValue('target').trim()
  const targetId = rawTarget ? (rawTarget.match(/\d{17,20}/)?.[0] ?? '') : interaction.user.id
  if (!targetId) {
    await replyError(interaction, 'Укажи ID или упоминание игрока.')
    return
  }
  let target
  try {
    target = targetId === interaction.user.id ? interaction.user : await interaction.client.users.fetch(targetId)
  } catch {
    await replyError(interaction, 'Не получается найти такого игрока.')
    return
  }
  if (target.bot) {
    await replyError(interaction, 'Ботам монеты не выдаём.')
    return
  }
  const user = grantCoins(userOf(target.id), amount)
  store.users[target.id] = user
  persist()
  const coin = emojiText('points', '🪙')
  const recipient =
    target.id === interaction.user.id ? 'Начислено' : `**${target.displayName}** получает`
  await interaction.reply({
    content: `${emojiText('points', '💸')} ${recipient} ${amount} ${coin}. Баланс: ${user.coins} ${coin}`,
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  })
}

async function handleDebugButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.user.id !== OWNER_ID) {
    await replyError(interaction, 'Команда только для владельца бота.')
    return
  }
  if (interaction.customId === 'debug:coins') {
    await interaction.showModal(debugCoinsModal())
    return
  }
  if (interaction.customId === 'debug:test') {
    const setup: DebugTestSetup = {
      ownerId: interaction.user.id,
      mode: '1x1',
      battlesPerPair: DEBUG_BATTLES_DEFAULT,
    }
    debugTests.set(interaction.message.id, setup)
    await interaction.update({
      embeds: [debugTestEmbed(setup)],
      components: debugTestComponents(setup),
    })
    return
  }
  if (interaction.customId === 'debug:arena') {
    debugTests.delete(interaction.message.id)
    await interaction.update({
      embeds: [arenaIntroEmbed()],
      components: arenaIntroComponents(),
    })
    return
  }
  if (interaction.customId === 'debug:arena:start') {
    if (!llmAiEnabled()) {
      await replyError(
        interaction,
        'Ключи нейросети не заданы — арена не сможет играть за модель.',
      )
      return
    }
    await interaction.deferUpdate()
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('debug:menu')
        .setLabel('← Назад')
        .setStyle(ButtonStyle.Secondary),
    )
    try {
      await interaction.editReply({
        embeds: [arenaProgressEmbed(0, ARENA_BATTLES)],
        components: [],
      })
      const result = await runLlmArena({
        onProgress: async (done, total) => {
          await interaction
            .editReply({
              embeds: [arenaProgressEmbed(done, total)],
              components: [],
            })
            .catch(() => {})
        },
      })
      await interaction.editReply({
        embeds: [arenaEmbed(result)],
        components: [backRow],
      })
    } catch (error) {
      await interaction.editReply({
        content:
          error instanceof Error ? error.message : 'Не получилось прогнать арену.',
        embeds: [],
        components: [backRow],
      })
    }
    return
  }
  if (interaction.customId === 'debug:status') {
    debugTests.delete(interaction.message.id)
    await interaction.update({
      embeds: [debugStatusEmbed(interaction.client)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('debug:menu')
            .setLabel('← Назад')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    })
    return
  }
  if (interaction.customId === 'debug:test:start') {
    const setup = debugTests.get(interaction.message.id)
    if (!setup) {
      await replyError(interaction, 'Настройка теста устарела. Открой /дебаг заново.')
      return
    }
    await interaction.deferUpdate()
    try {
      const simulation = await simulateBalance({
        battlesPerPair: setup.battlesPerPair ?? DEBUG_BATTLES_DEFAULT,
        mode: setup.mode,
        character: setup.character,
        special: setup.special,
      })
      await interaction.editReply({
        embeds: [balanceEmbed(simulation)],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('debug:menu')
              .setLabel('← Назад')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      })
    } catch (error) {
      await interaction.editReply({
        content: error instanceof Error ? error.message : 'Не получилось прогнать тест.',
        embeds: [],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId('debug:menu')
              .setLabel('← Назад')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      })
    }
    return
  }
  if (interaction.customId === 'debug:menu') {
    debugTests.delete(interaction.message.id)
    await interaction.update({
      embeds: [debugPanelEmbed()],
      components: debugPanelComponents(),
    })
  }
}

async function handleDebugTestSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (interaction.user.id !== OWNER_ID) {
    await replyError(interaction, 'Команда только для владельца бота.')
    return
  }
  const setup = debugTests.get(interaction.message.id) ?? {
    ownerId: interaction.user.id,
    mode: '1x1' as const,
  }
  const value = interaction.values[0]
  if (interaction.customId === 'debug:test:mode') {
    setup.mode = parseBattleMode(value)
  } else if (interaction.customId === 'debug:test:character') {
    setup.character = value === 'all' ? undefined : value
    setup.special = undefined
  } else if (interaction.customId === 'debug:test:special') {
    setup.special = value === 'all' ? undefined : value
  } else if (interaction.customId === 'debug:test:battles') {
    const battles = Number.parseInt(value, 10)
    if (Number.isFinite(battles)) {
      setup.battlesPerPair = Math.max(1, Math.min(200, battles))
    }
  }
  debugTests.set(interaction.message.id, setup)
  await interaction.update({
    embeds: [debugTestEmbed(setup)],
    components: debugTestComponents(setup),
  })
}

function bossRushBattle(
  user: UserData,
  ownerId: string,
  displayName: string,
  run: BossRushRun,
): Battle {
  const boss = bossRushBoss(run)
  const bossEntry: FighterEntry = {
    userId: `bossrush:${run.seed}:${run.stage}`,
    name: `БОСС · ${boss.character.name}`,
    character: boss.character,
    boss: true,
  }
  return run.mode === '2x2'
    ? createTeamBattle(teamEntries(user, ownerId, displayName), [bossEntry])
    : createBattle(
        { userId: ownerId, name: displayName, character: activeCharacter(user) },
        bossEntry,
      )
}

function applyBossRushHp(battle: Battle, run: BossRushRun): void {
  for (const side of battle.sides) {
    if (side.team !== 0 || side.fake || side.minion) continue
    side.hp = Math.max(1, Math.round(side.maxHp * run.hpRatio))
    side.tempHp = 0
    side.tempHpTurns = 0
  }
}

export function towerBattle(
  user: UserData,
  ownerId: string,
  displayName: string,
  run: TowerRun,
): Battle {
  const floor = towerFloor(run.floor, run.seed)
  const battle = createTowerBattle(floor, teamEntries(user, ownerId, displayName))
  applyTowerUpgrades(battle, run)
  return battle
}

export function trialBattle(
  ownerId: string,
  displayName: string,
  trial: Trial,
  character: Character,
  seed: number,
): Battle {
  const battle = createTrialBattle(trial, character, seed)
  for (const side of battle.sides) {
    if (side.userId === 'trial:player') {
      side.userId = ownerId
      side.name = displayName
    } else if (side.userId === 'trial:ally') {
      side.userId = `bot:trial:ally:${trial.id}:${seed}`
      side.name = 'Напарник'
    } else if (side.userId.startsWith('bot:trial:')) {
      side.name = side.character.name
    }
  }
  return battle
}

async function launchBossRushBattle(
  interaction: ButtonInteraction,
  ownerId: string,
  run: BossRushRun,
  messageId: string,
): Promise<void> {
  await interaction.deferUpdate()
  const user = userOf(ownerId)
  const battle = bossRushBattle(user, ownerId, interaction.user.displayName, run)
  applyBossRushHp(battle, run)
  bossRushRuns.set(messageId, { ownerId, run })
  rememberPveOwner(messageId, ownerId)
  battles.set(messageId, battle)
  battleChannels.set(messageId, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await interaction.editReply({
    embeds: [battleEmbed(battle, [], undefined, deadline)],
    components: battleComponents(battle),
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handleBossRushButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const state = bossRushRuns.get(messageId)
  const ownerId = state?.ownerId ?? pveOwners.get(messageId)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужой забег.')
    return
  }
  if (interaction.customId === 'bossrush:next') {
    if (!state || state.run.status !== 'active') {
      await replyError(interaction, 'Забег уже окончен.')
      return
    }
    await launchBossRushBattle(interaction, ownerId, state.run, messageId)
    return
  }
  if (interaction.customId.startsWith('bossrush:start:')) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
    const run = createBossRush('2x2', seed)
    await launchBossRushBattle(interaction, ownerId, run, messageId)
  }
}

async function launchTowerBattle(
  interaction: ButtonInteraction,
  ownerId: string,
  run: TowerRun,
  messageId: string,
): Promise<void> {
  await interaction.deferUpdate()
  const user = userOf(ownerId)
  const battle = towerBattle(user, ownerId, interaction.user.displayName, run)
  towerRuns.set(messageId, { ownerId, run })
  rememberPveOwner(messageId, ownerId)
  battles.set(messageId, battle)
  battleChannels.set(messageId, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await interaction.editReply({
    embeds: [battleEmbed(battle, [], undefined, deadline)],
    components: battleComponents(battle),
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handleTowerButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const state = towerRuns.get(messageId)
  const ownerId = state?.ownerId ?? pveOwners.get(messageId)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужой забег.')
    return
  }
  if (interaction.customId.startsWith('tower:upgrade:')) {
    if (!state || state.run.status !== 'active') {
      await replyError(interaction, 'Забег уже окончен.')
      return
    }
    const upgrade = interaction.customId.slice('tower:upgrade:'.length) as TowerUpgradeId
    const choices = towerUpgradeChoices(state.run.seed, state.run.floor - 1)
    if (!choices.includes(upgrade)) {
      await replyError(interaction, 'Это усиление недоступно.')
      return
    }
    const nextRun: TowerRun = {
      ...state.run,
      upgrades: [...(state.run.upgrades ?? []), upgrade],
    }
    await launchTowerBattle(interaction, ownerId, nextRun, messageId)
    return
  }
  if (interaction.customId === 'tower:next') {
    if (!state || state.run.status !== 'active') {
      await replyError(interaction, 'Забег уже окончен.')
      return
    }
    await launchTowerBattle(interaction, ownerId, state.run, messageId)
    return
  }
  if (interaction.customId === 'tower:start') {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
    await launchTowerBattle(interaction, ownerId, createTowerRun(seed), messageId)
  }
}

function trialById(id: string): Trial | undefined {
  return TRIALS.find(trial => trial.id === id)
}

async function launchTrialBattle(
  interaction: ButtonInteraction,
  ownerId: string,
  trial: Trial,
  messageId: string,
): Promise<void> {
  const user = userOf(ownerId)
  const base = characterByName(trial.characterName)
  if (!base) {
    await replyError(interaction, 'Испытание недоступно.')
    return
  }
  if (!user.owned.includes(base.name)) {
    await replyError(interaction, `Сначала открой персонажа **${base.name}**.`)
    return
  }
  await interaction.deferUpdate()
  const character = trialCharacterFor(trial, user)
  const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
  const battle = trialBattle(ownerId, interaction.user.displayName, trial, character, seed)
  trialRuns.set(messageId, { ownerId, trialId: trial.id })
  rememberPveOwner(messageId, ownerId)
  battles.set(messageId, battle)
  battleChannels.set(messageId, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await interaction.editReply({
    embeds: [battleEmbed(battle, [], undefined, deadline)],
    components: battleComponents(battle),
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handleTrialButton(interaction: ButtonInteraction): Promise<void> {
  const messageId = interaction.message.id
  const ownerId = pveOwners.get(messageId) ?? trialRuns.get(messageId)?.ownerId
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужое испытание.')
    return
  }
  const trialId = interaction.customId.replace(/^trials:start:/, '')
  const trial = trialById(trialId)
  if (!trial) {
    await replyError(interaction, 'Испытание не найдено.')
    return
  }
  await launchTrialBattle(interaction, ownerId, trial, messageId)
}

async function handleTrialsSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const ownerId = pveOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужое меню.')
    return
  }
  const trial = trialById(interaction.values[0])
  if (!trial) {
    await replyError(interaction, 'Испытание не найдено.')
    return
  }
  await interaction.update({
    embeds: [trialsPanelEmbed(trial)],
    components: trialStartComponents(trial),
  })
}

async function startTrainingBattle(
  interaction: ButtonInteraction,
  setup: TrainingSetup,
  messageId: string,
): Promise<void> {
  await interaction.deferUpdate()
  const user = userOf(setup.ownerId)
  const botCharacter = trainingBotCharacter(setup)
  const botPartner = trainingBotPartnerCharacter(setup)
  const entries = trainingEntries(
    user,
    setup,
    setup.ownerId,
    interaction.user.displayName,
  )

  let battle: Battle
  if (setup.mode === '2x2') {
    battle = createTeamBattle(entries, [
      {
        userId: `bot:${interaction.id}:1`,
        name: 'Тренировочный бот',
        character: botCharacter,
      },
      {
        userId: `bot:${interaction.id}:2`,
        name: 'Тренировочный бот',
        character: botPartner,
      },
    ])
  } else {
    battle = createBattle(entries[0], {
      userId: `bot:${interaction.id}`,
      name: 'Тренировочный бот',
      character: botCharacter,
    })
  }

  trainingSetups.delete(messageId)
  pveOwners.delete(messageId)
  battles.set(messageId, battle)
  trainingBattles.add(messageId)
  battleChannels.set(messageId, interaction.channelId)
  const deadline = armBattleTimer(interaction.client, messageId, battle)
  await withBattleTurnLanguage(battle, async () => {
    await interaction.editReply({
      embeds: [battleEmbed(battle, [], undefined, deadline)],
      components: battleComponents(battle),
    })
  })
  notifyBattleStart(interaction.client, battle, interaction.channelId, messageId)
}

async function handlePveButton(interaction: ButtonInteraction): Promise<void> {
  const ownerId = pveOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужое меню.')
    return
  }
  const user = userOf(ownerId)
  if (interaction.customId === 'pve:modes') {
    trainingSetups.delete(interaction.message.id)
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [pveModesEmbed()],
      components: pveModesComponents(),
    })
    return
  }
  if (interaction.customId === 'pve:bossmodes') {
    trainingSetups.delete(interaction.message.id)
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [pveBossModesEmbed()],
      components: pveBossModesComponents(),
    })
    return
  }
  if (interaction.customId === 'pve:tower') {
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [towerPanelEmbed()],
      components: towerPanelComponents(),
    })
    return
  }
  if (interaction.customId === 'pve:trials') {
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [trialsPanelEmbed(undefined, user)],
      components: trialsPanelComponents(user),
    })
    return
  }
  if (interaction.customId === 'pve:boss') {
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [bossPanelEmbed(user)],
      components: pveBossComponents(),
    })
    return
  }
  if (interaction.customId === 'pve:bossrush') {
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [bossRushPanelEmbed()],
      components: bossRushPanelComponents(),
    })
    return
  }
  if (interaction.customId === 'pve:training') {
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    const bot = randomCharacter(Math.random)
    const partnerPool = CHARACTERS.filter(character => character.name !== bot.name)
    const botPartner =
      partnerPool[Math.floor(Math.random() * partnerPool.length)] ?? bot
    const setup: TrainingSetup = {
      ownerId,
      mode: '1x1',
      page: 'player',
      botCharacter: bot.name,
      botAbility: bot.special.name,
      botPartner: botPartner.name,
      botPartnerAbility: botPartner.special.name,
    }
    trainingSetups.set(interaction.message.id, setup)
    await interaction.update({
      embeds: [trainingSetupEmbed(user, setup)],
      components: trainingSetupComponents(user, setup),
    })
    return
  }
  if (interaction.customId === 'pve:survival') {
    trainingSetups.delete(interaction.message.id)
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [survivalPanelEmbed(user, store.users)],
      components: survivalPanelComponents(),
      allowedMentions: { parse: [] },
    })
    return
  }
  if (
    interaction.customId === 'pve:training:page:enemies' ||
    interaction.customId === 'pve:training:page:player'
  ) {
    const setup = trainingSetups.get(interaction.message.id)
    if (!setup) {
      await replyError(interaction, 'Настройка тренировки устарела. Открой /пве заново.')
      return
    }
    setup.page = interaction.customId.endsWith('enemies') ? 'enemies' : 'player'
    trainingSetups.set(interaction.message.id, setup)
    await interaction.update({
      embeds: [trainingSetupEmbed(user, setup)],
      components: trainingSetupComponents(user, setup),
    })
    return
  }
  if (interaction.customId === 'pve:training:mode') {
    const setup = trainingSetups.get(interaction.message.id)
    if (!setup) {
      await replyError(interaction, 'Настройка тренировки устарела. Открой /пве заново.')
      return
    }
    setup.mode = setup.mode === '1x1' ? '2x2' : '1x1'
    trainingSetups.set(interaction.message.id, setup)
    await interaction.update({
      embeds: [trainingSetupEmbed(user, setup)],
      components: trainingSetupComponents(user, setup),
    })
    return
  }
  if (interaction.customId === 'pve:training:start') {
    const setup = trainingSetups.get(interaction.message.id)
    if (!setup) {
      await replyError(interaction, 'Настройка тренировки устарела. Открой /пве заново.')
      return
    }
    await startTrainingBattle(interaction, setup, interaction.message.id)
    return
  }
  if (interaction.customId === 'pve:menu') {
    trainingSetups.delete(interaction.message.id)
    bossRushRuns.delete(interaction.message.id)
    towerRuns.delete(interaction.message.id)
    trialRuns.delete(interaction.message.id)
    await interaction.update({
      embeds: [pvePanelEmbed()],
      components: pvePanelComponents(),
    })
  }
}

async function handlePveTrainingSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const ownerId = pveOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужое меню.')
    return
  }
  const setup = trainingSetups.get(interaction.message.id) ?? {
    ownerId,
    mode: '1x1' as const,
  }
  const value = interaction.values[0]
  if (interaction.customId === 'pve:training:player-character') {
    const base = value === 'random' ? randomCharacter(Math.random) : characterByName(value)
    if (base) {
      setup.playerCharacter = base.name
      setup.playerAbility = base.special.name
    }
  } else if (interaction.customId === 'pve:training:character') {
    const base = value === 'random' ? randomCharacter(Math.random) : characterByName(value)
    if (base) {
      setup.botCharacter = base.name
      setup.botAbility = base.special.name
    }
  } else if (interaction.customId === 'pve:training:bot-ability') {
    setup.botAbility = value
  } else if (interaction.customId === 'pve:training:bot-partner') {
    const base = value === 'random' ? randomCharacter(Math.random) : characterByName(value)
    if (base) {
      setup.botPartner = base.name
      setup.botPartnerAbility = base.special.name
    }
  } else if (interaction.customId === 'pve:training:bot-partner-ability') {
    setup.botPartnerAbility = value
  } else if (interaction.customId === 'pve:training:ability') {
    setup.playerAbility = value
  } else if (interaction.customId === 'pve:training:partner') {
    const base = value === 'random' ? randomCharacter(Math.random) : characterByName(value)
    if (base) {
      setup.partner = base.name
      setup.partnerAbility = base.special.name
    }
  } else if (interaction.customId === 'pve:training:partner-ability') {
    setup.partnerAbility = value
  }
  trainingSetups.set(interaction.message.id, setup)
  const user = userOf(ownerId)
  await interaction.update({
    embeds: [trainingSetupEmbed(user, setup)],
    components: trainingSetupComponents(user, setup),
  })
}

async function handlePveBossInvite(
  interaction: UserSelectMenuInteraction,
): Promise<void> {
  const ownerId = pveOwners.get(interaction.message.id)
  if (!ownerId || interaction.user.id !== ownerId) {
    await replyError(interaction, 'Это чужое меню.')
    return
  }
  const targetId = interaction.values[0]
  if (!targetId) {
    await replyError(interaction, 'Не получилось выбрать игрока.')
    return
  }
  if (targetId === ownerId) {
    await replyError(interaction, 'Себя приглашать не надо.')
    return
  }
  const target = interaction.users.get(targetId)
  if (target?.bot) {
    await replyError(interaction, 'С ботами не дерёмся.')
    return
  }
  if (isUserInActiveBattle(ownerId) || isUserInActiveBattle(targetId)) {
    await replyError(interaction, 'Один из игроков уже участвует в бою.')
    return
  }
  const week = isoWeekKey()
  const now = Date.now()
  await interaction.reply({
    content: `<@${targetId}>`,
    embeds: [bossCoopEmbed(interaction.user.displayName, week, targetId)],
    components: bossCoopComponents(),
    allowedMentions: { users: [targetId] },
  })
  const message = await interaction.fetchReply()
  if (coopBossInvites.size >= 200) {
    const oldest = coopBossInvites.keys().next().value
    if (oldest) coopBossInvites.delete(oldest)
  }
  coopBossInvites.set(message.id, {
    creatorId: ownerId,
    creatorName: interaction.user.displayName,
    week,
    createdAt: now,
    targetId,
  })
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  if (shouldPromptLanguage(userOf(interaction.user.id), interaction.customId)) {
    languagePromptSource.set(interaction.user.id, 'button')
    await interaction.reply({
      embeds: [languagePickerEmbed()],
      components: languagePickerComponents(),
      flags: MessageFlags.Ephemeral,
    })
    return
  }
  if (interaction.customId.startsWith('skin:equip:')) {
    const [userId, character, skinId] = interaction.customId
      .slice('skin:equip:'.length)
      .split(':')
    if (interaction.user.id !== userId) {
      await replyError(interaction, 'Этот скин открыт другому игроку.')
      return
    }
    try {
      const updated = setEquippedSkin(userOf(userId), character, skinId)
      store.users[userId] = updated
      persist()
      const equippedId = updated.equippedSkins[character]
      const equipped = equippedId ? skinById(equippedId) : undefined
      await interaction.reply({
        content: equipped
          ? `Надет: ${skinName(equipped, updated.language)}`
          : 'Скин надет.',
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      await replyError(
        interaction,
        error instanceof Error ? error.message : 'Не получилось надеть скин.',
      )
    }
    return
  }
  if (interaction.customId === 'settings:compact') {
    const user = userOf(interaction.user.id)
    const updated = { ...user, compactMode: !user.compactMode }
    store.users[interaction.user.id] = updated
    persist()
    await interaction.update({
      embeds: [settingsEmbed(updated)],
      components: settingsComponents(updated),
    })
    return
  }
  if (
    interaction.customId === 'onboarding:lang:ru' ||
    interaction.customId === 'onboarding:lang:en'
  ) {
    const language = interaction.customId === 'onboarding:lang:en' ? 'en' : 'ru'
    const source = languagePromptSource.get(interaction.user.id)
    languagePromptSource.delete(interaction.user.id)
    const user = userOf(interaction.user.id)
    const updated = { ...user, language, onboarded: true }
    store.users[interaction.user.id] = updated
    persist()
    setActiveLanguage(language)
    const note =
      source === 'button'
        ? language === 'en'
          ? 'Now press the same button again to continue.'
          : 'Теперь нажми ту же кнопку ещё раз, чтобы продолжить.'
        : undefined
    await interaction.update({
      embeds: [onboardingEmbed(updated, note)],
      components: onboardingComponents(updated),
    })
    return
  }
  if (interaction.customId === 'onboarding:done') {
    const user = userOf(interaction.user.id)
    await interaction.update({
      content: user.language === 'en' ? 'Done. Good luck!' : 'Готово. Удачи!',
      embeds: [],
      components: [],
    })
    return
  }
  if (interaction.customId.startsWith('survival:')) {
    await handleSurvivalButton(interaction)
    return
  }
  if (interaction.customId.startsWith('duel:')) {
    await handleDuelButton(interaction)
    return
  }
  if (interaction.customId.startsWith('debug:')) {
    await handleDebugButton(interaction)
    return
  }
  if (interaction.customId.startsWith('pve:')) {
    await handlePveButton(interaction)
    return
  }
  if (interaction.customId.startsWith('bossrush:')) {
    await handleBossRushButton(interaction)
    return
  }
  if (interaction.customId.startsWith('tower:')) {
    await handleTowerButton(interaction)
    return
  }
  if (interaction.customId.startsWith('trials:')) {
    await handleTrialButton(interaction)
    return
  }
  if (interaction.customId.startsWith('top:')) {
    await handleTopPageButton(interaction)
    return
  }
  if (interaction.customId === 'presets:save') {
    const ownerId = hubOwners.get(interaction.message.id)
    if (!ownerId || interaction.user.id !== ownerId) {
      await replyError(interaction, 'Это чужая панель.')
      return
    }
    await interaction.showModal(presetSaveModal())
    return
  }
  if (
    interaction.customId.startsWith('char:favorite:') ||
    interaction.customId.startsWith('char:prestige:')
  ) {
    await handleCharacterAction(interaction)
    return
  }
  if (interaction.customId.startsWith('hub:')) {
    await handleHub(interaction)
    return
  }
  if (interaction.customId === 'boss:coop:again') {
    await handleBossCoopAgain(interaction)
    return
  }
  if (interaction.customId === 'boss:coop' || interaction.customId.startsWith('boss:coop:')) {
    await handleBossCoopButton(interaction)
    return
  }
  if (interaction.customId.startsWith('boss:start:')) {
    await handleBossStart(interaction)
    return
  }
  if (interaction.customId.startsWith('dmatch:')) {
    await handleDmMatchButton(interaction)
    return
  }
  if (interaction.customId === 'pvp:global') {
    await handleGlobalPvpButton(interaction)
    return
  }
  if (interaction.customId.startsWith('pvp:setup:')) {
    await handlePvpSetupButton(interaction)
    return
  }
  if (interaction.customId.startsWith('pvp:open:')) {
    await handleOpenChallengeButton(interaction)
    return
  }
  if (interaction.customId === 'pvp:accept' || interaction.customId === 'pvp:decline') {
    await handleChallengeButton(interaction)
    return
  }
  if (interaction.customId === 'pvp:rematch') {
    await handleRematch(interaction)
    return
  }
  if (interaction.customId.startsWith('pvp:target:')) {
    await handleTargetButton(interaction)
    return
  }
  if (interaction.customId.startsWith('pvp:')) {
    await handleBattleButton(interaction)
  }
}

async function main(): Promise<void> {
  process.on('unhandledRejection', reason => {
    appendErrorLog(ERROR_LOG_PATH, reason, 'unhandledRejection')
    console.error('[bot] необработанный rejection:', reason)
  })
  process.on('uncaughtException', error => {
    appendErrorLog(ERROR_LOG_PATH, error, 'uncaughtException')
    console.error('[bot] необработанное исключение:', error)
    process.exit(1)
  })
  store = loadStore(DATA_PATH)
  if (pruneSyntheticUsers(store)) persist()
  backupDataFiles(dirname(DATA_PATH))
  setInterval(() => backupDataFiles(dirname(DATA_PATH)), 24 * 60 * 60 * 1000).unref?.()
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env')
  const envContents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null
  importLlmEnv(envContents)
  if (policyAiEnabled()) {
    if (policyAvailable()) {
      console.log(`[bot] Policy AI: модель загружена — ${policyWeightsPath()}`)
    } else {
      console.warn(
        `[bot] Policy AI: POLICY_AI=1, но ${policyWeightsPath()} не найден — ` +
          'работает LLM/эвристика.',
      )
    }
  }
  void startLocalLlm()
  const token = resolveToken(process.env.DISCORD_BOT_TOKEN, envContents)
  const commands = commandDefinitions()

  const client = new Client({ intents: [GatewayIntentBits.Guilds] })

  client.once('clientReady', async readyClient => {
    readyClient.user.setPresence(botPresence())
    const snapshot = loadBattleState(BATTLE_STATE_PATH)
    if (snapshot) restoreBattleState(snapshot, readyClient)
    try {
      await readyClient.application.commands.set(commands.map(command => command.toJSON()))
      console.log(`[bot] вошёл как ${readyClient.user.tag}; команд: ${commands.length}`)
      void warmLlmModel()
    } catch (error) {
      appendErrorLog(ERROR_LOG_PATH, error, 'register-commands')
      console.error('[bot] не удалось зарегистрировать команды:', error)
    }
  })

  client.on('interactionCreate', async interaction => {
    const language = interaction.user ? userOf(interaction.user.id).language : 'ru'
    await withLanguage(language, async () => {
      localizeInteraction(interaction)
      try {
        rememberInteraction(interaction)
        if (interaction.isAutocomplete()) {
          await handleAutocomplete(interaction)
          return
        }
        if (interaction.isModalSubmit()) {
          if (interaction.customId === 'pvp:setup:wager:modal') {
            await handlePvpSetupModal(interaction)
            return
          }
          if (interaction.customId.startsWith('cosmetics:hex:')) {
            await handleCustomColorSubmit(interaction)
            return
          }
          if (interaction.customId === 'debug:coins:modal') {
            await handleDebugCoinsModal(interaction)
            return
          }
          if (interaction.customId === 'presets:save:modal') {
            await handlePresetSaveModal(interaction)
            return
          }
        }
        if (interaction.isStringSelectMenu()) {
          if (interaction.customId.startsWith('pvp:setup:')) {
            await handlePvpSetupSelect(interaction)
            return
          }
          if (interaction.customId === 'pvp:draft:select') {
            await handleDraftSelect(interaction)
            return
          }
          if (interaction.customId === 'char:filter') {
            await handleCharacterFilter(interaction)
            return
          }
          if (interaction.customId === 'char:view') {
            await handleCharacterSelect(interaction)
            return
          }
          if (interaction.customId.startsWith('char:special:')) {
            await handleSpecialSelect(interaction)
            return
          }
          if (interaction.customId.startsWith('char:skin:')) {
            await handleSkinSelect(interaction)
            return
          }
          if (interaction.customId.startsWith('pve:training:')) {
            await handlePveTrainingSelect(interaction)
            return
          }
          if (interaction.customId === 'trials:select') {
            await handleTrialsSelect(interaction)
            return
          }
          if (interaction.customId.startsWith('debug:test:')) {
            await handleDebugTestSelect(interaction)
            return
          }
          if (interaction.customId === 'settings:language') {
            await handleSettingsSelect(interaction)
            return
          }
          await handleHub(interaction)
          return
        }
        if (interaction.isUserSelectMenu()) {
          if (interaction.customId === 'pve:boss:invite') {
            await handlePveBossInvite(interaction)
            return
          }
        }
        if (interaction.isButton()) {
          await handleButton(interaction)
          return
        }
        if (interaction.isChatInputCommand()) {
          await handleCommand(interaction)
        }
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined
        // 10062 = the interaction token expired (for example, a click that
        // arrived while the bot was restarting). There is nothing to respond to.
        if (code === 10062) return
        const interactionLabel =
          interaction.isChatInputCommand()
            ? `command:${interaction.commandName}`
            : interaction.isButton() || interaction.isAnySelectMenu()
              ? interaction.customId
              : interaction.id
        appendErrorLog(ERROR_LOG_PATH, error, `interaction:${interactionLabel}`)
        console.error(
          `[bot] ошибка обработки взаимодействия (${interactionLabel}):`,
          error,
        )
        if (interaction.isRepliable() && !interaction.replied) {
          const options = { content: 'Что-то пошло не так.', flags: MessageFlags.Ephemeral }
          const reply = interaction.deferred
            ? interaction.followUp(options)
            : interaction.reply(options)
          await reply.catch(() => {})
        }
      }
    })
  })

  client.on('error', error => {
    appendErrorLog(ERROR_LOG_PATH, error, 'client')
    console.error('[bot] ошибка клиента:', error)
  })

  await client.login(token)
}

if (import.meta.main) {
  main().catch(error => {
    appendErrorLog(ERROR_LOG_PATH, error, 'startup')
    console.error('[bot] не запустился:', error)
    process.exit(1)
  })
}
