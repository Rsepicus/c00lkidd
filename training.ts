import {
  CHARACTERS,
  characterByName,
  characterWithSpecial,
  type Character,
  type Rng,
} from './forsaken'
import {
  createBattle,
  createTeamBattle,
  type Battle,
  type BattleMode,
  type FighterEntry,
} from './pvp'
import { recordCharacterResult } from './progress'
import { isRealUserId, type UserData } from './store'

/** A real shadow needs this many recorded PvP battles, unless it has a custom build. */
export const GHOST_MIN_PVP_BATTLES = 3

/** Synthetic shadows must use this id prefix so they never leak into persisted users. */
export const TRAINING_BOT_ID_PREFIX = 'bot:training:'

export type GhostSnapshot = {
  userId: string
  name: string
  character: Character
  partner?: Character
}

export type GhostBattleEntries = {
  player: FighterEntry[]
  opponents: FighterEntry[]
}

function loadoutSpecial(user: UserData, characterName: string): string | undefined {
  if (!user.loadouts || !Object.prototype.hasOwnProperty.call(user.loadouts, characterName)) {
    return undefined
  }
  return user.loadouts[characterName]
}

/**
 * Eligibility is deliberately stricter than "the account exists":
 * - the active character must resolve to a real CHARACTERS entry;
 * - and the account must have at least three PvP battles OR a loadout entry for
 *   the active character.
 *
 * The second branch makes a configured Noob a valid shadow even before its first
 * battle, while a stock Noob (or any other untouched free account) stays out.
 */
export function ghostEligible(user: UserData | null | undefined): boolean {
  if (!user || typeof user.active !== 'string' || !characterByName(user.active)) {
    return false
  }

  const pvpBattles = user.wins + user.losses
  const customBuild = loadoutSpecial(user, user.active) !== undefined
  return pvpBattles >= GHOST_MIN_PVP_BATTLES || customBuild
}

/**
 * UserData has no Discord display name and synthetic ids are not user ids.
 * Derive a stable label from the last four id characters instead of retaining
 * a transient Discord nickname in battle snapshots.
 */
export function shadowName(userId: string): string {
  const suffix = typeof userId === 'string' ? userId.slice(-4) : ''
  return suffix ? `Тень ${suffix}` : 'Тень'
}

/**
 * Build a battle-ready snapshot from persisted data. Specials are taken from
 * the loadout when valid; forsaken's selectedSpecial falls back to the primary
 * special for stale or unknown entries. Invalid/self partners are omitted.
 */
export function ghostSnapshot(user: UserData, userId = ''): GhostSnapshot {
  const active = typeof user.active === 'string' ? characterByName(user.active) : undefined
  if (!active) throw new Error('У пользователя нет активного персонажа для тени.')

  const snapshot: GhostSnapshot = {
    userId,
    name: shadowName(userId),
    character: characterWithSpecial(active, loadoutSpecial(user, active.name)),
  }

  if (user.partner && user.partner !== active.name) {
    const partner = characterByName(user.partner)
    if (partner) {
      snapshot.partner = characterWithSpecial(
        partner,
        loadoutSpecial(user, partner.name),
      )
    }
  }

  return snapshot
}

function compareIds([left]: [string, UserData], [right]: [string, UserData]): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** Eligible real users, excluding self, in stable id order. */
export function eligibleGhosts(
  users: Record<string, UserData>,
  selfId: string,
): GhostSnapshot[] {
  return Object.entries(users)
    .filter(([userId, user]) => (
      userId !== selfId &&
      isRealUserId(userId) &&
      ghostEligible(user)
    ))
    .sort(compareIds)
    .map(([userId, user]) => ghostSnapshot(user, userId))
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const roll = rng()
    const normalized = Number.isFinite(roll)
      ? Math.min(Math.max(roll, 0), 1 - Number.EPSILON)
      : 0
    const swapIndex = Math.floor(normalized * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function fallbackGhost(slot: number, mode: BattleMode): GhostSnapshot {
  const offset = mode === '2x2' ? 1 : 0
  const baseIndex = (slot * 2 + offset) % CHARACTERS.length
  const base = CHARACTERS[baseIndex]
  const snapshot: GhostSnapshot = {
    userId: `${TRAINING_BOT_ID_PREFIX}${mode}:${slot + 1}`,
    name: `Тренировочный бот ${slot + 1}`,
    character: base,
  }
  if (mode === '2x2') {
    snapshot.partner = CHARACTERS[(baseIndex + 1) % CHARACTERS.length]
  }
  return snapshot
}

/**
 * Pick up to `count` real shadows, then fill every missing slot with a
 * deterministic bot team. The function therefore always returns exactly
 * `count` snapshots (after flooring and clamping count to zero).
 */
export function pickGhostOpponents(
  users: Record<string, UserData>,
  selfId: string,
  count: number,
  rng: Rng = Math.random,
  mode: BattleMode = '1x1',
): GhostSnapshot[] {
  const requested = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (requested === 0) return []

  const real = shuffle(eligibleGhosts(users, selfId), rng)
  const selected = real.slice(0, requested)
  for (let slot = selected.length; slot < requested; slot++) {
    selected.push(fallbackGhost(slot, mode))
  }
  return selected
}

function fighter(snapshot: GhostSnapshot, selectedCharacter: Character): FighterEntry {
  return {
    userId: snapshot.userId,
    name: snapshot.name,
    character: selectedCharacter,
  }
}

/**
 * Convert the player's snapshot and opposing snapshots into the entry arrays
 * accepted by createBattle/createTeamBattle. In 1x1 only the active characters
 * are used. In 2x2 each side gets two entries: a configured partner first,
 * then another shadow's active character if a single snapshot has no partner.
 */
export function ghostBattleEntries(
  player: GhostSnapshot,
  opponents: readonly GhostSnapshot[],
  mode: BattleMode,
): GhostBattleEntries {
  if (opponents.length === 0) {
    throw new Error('Для тренировочного боя нужна хотя бы одна тень.')
  }

  if (mode !== '2x2') {
    return {
      player: [fighter(player, player.character)],
      opponents: [fighter(opponents[0], opponents[0].character)],
    }
  }

  const playerEntries = [
    fighter(player, player.character),
    fighter(player, player.partner ?? player.character),
  ]

  const opponentEntries: FighterEntry[] = []
  for (const opponent of opponents) {
    opponentEntries.push(fighter(opponent, opponent.character))
    if (opponent.partner) {
      opponentEntries.push(fighter(opponent, opponent.partner))
    }
    if (opponentEntries.length >= 2) break
  }
  while (opponentEntries.length < 2) {
    opponentEntries.push({ ...opponentEntries[0] })
  }

  return {
    player: playerEntries,
    opponents: opponentEntries.slice(0, 2),
  }
}

/** Build the actual pvp.ts battle object for a training ghost encounter. */
export function createGhostBattle(
  player: GhostSnapshot,
  opponents: readonly GhostSnapshot[],
  mode: BattleMode,
): Battle {
  const entries = ghostBattleEntries(player, opponents, mode)
  return mode === '2x2'
    ? createTeamBattle(entries.player, entries.opponents)
    : createBattle(entries.player[0], entries.opponents[0])
}

/**
 * Training ghosts are mastery-only: countBattle is false, so overall W/L,
 * streaks, quests, history, achievements and battle stats stay untouched.
 * Mastery XP, its coin rewards and milestone claims are intentionally kept.
 */
export function recordGhostResult(
  user: UserData,
  characterName: string,
  won: boolean,
  bonusXp = 0,
): ReturnType<typeof recordCharacterResult> {
  return recordCharacterResult(user, characterName, won, false, bonusXp)
}
