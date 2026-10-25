import { CHARACTERS, type Character } from './forsaken'
import {
  masteryLevel,
  recordCharacterResult,
  type MasteryMilestone,
} from './progress'
import {
  createBattle,
  createTeamBattle,
  type Battle,
  type FighterEntry,
} from './pvp'
import type { Skin } from './skins'
import type { UserData } from './store'

export type TrialMode = '1x1' | '2x2'

export type TrialObjective =
  | 'win'
  | 'survive'
  | 'special'
  | 'win_without_rest'
  | 'heal'
  | 'damage'
  | 'summon'
  | 'block'
  | 'stun'
  | 'revive'

export type Trial = {
  id: string
  characterName: string
  mode: TrialMode
  objective: TrialObjective
  target: number
  bonusXp: number
  /** Ability the trial is built around; omitted to use the player's loadout. */
  specialName?: string
}

export type TrialResult = {
  won: boolean
  turns: number
  abilityUses: number
  rests: number
  damageDealt?: number
  healingDone?: number
  summoned?: number
  blocks?: number
  stuns?: number
  revives?: number
}

export type TrialClaimResult = {
  user: UserData
  claimed: boolean
  xpGained: number
  level: number
  leveledUp: boolean
  reward: number
  milestoneReward: number
  milestones: MasteryMilestone[]
  skinsUnlocked: Skin[]
}

export const TRIAL_CLAIM_PREFIX = 'pve:'

export const TRIALS: readonly Trial[] = [
  {
    id: 'jason',
    characterName: 'Jason',
    mode: '1x1',
    objective: 'damage',
    target: 60,
    bonusXp: 40,
    specialName: 'Gashing Wound',
  },
  {
    id: 'c00lkidd',
    characterName: 'c00lkidd',
    mode: '1x1',
    objective: 'summon',
    target: 4,
    bonusXp: 50,
    specialName: 'Pizza Delivery',
  },
  {
    id: 'john-doe',
    characterName: 'John Doe',
    mode: '1x1',
    objective: 'survive',
    target: 8,
    bonusXp: 40,
    specialName: 'Digital Footprint',
  },
  {
    id: 'noli',
    characterName: 'Noli',
    mode: '1x1',
    objective: 'win',
    target: 1,
    bonusXp: 50,
    specialName: 'Observant',
  },
  {
    id: '1x1x1x1',
    characterName: '1x1x1x1',
    mode: '2x2',
    objective: 'summon',
    target: 1,
    bonusXp: 70,
    specialName: 'Rejuvenate the Rotten',
  },
  {
    id: 'guest-666',
    characterName: 'Guest 666',
    mode: '1x1',
    objective: 'special',
    target: 3,
    bonusXp: 60,
    specialName: 'Infernal Cry',
  },
  {
    id: 'nosferatu',
    characterName: 'Nosferatu',
    mode: '1x1',
    objective: 'survive',
    target: 10,
    bonusXp: 60,
    specialName: 'Ascension',
  },
  {
    id: 'azure',
    characterName: 'Azure',
    mode: '1x1',
    objective: 'special',
    target: 3,
    bonusXp: 60,
    specialName: 'Seeker Bulb',
  },
  {
    id: 'noob',
    characterName: 'Noob',
    mode: '2x2',
    objective: 'heal',
    target: 40,
    bonusXp: 40,
    specialName: 'Slateskin Potion',
  },
  {
    id: 'shedletsky',
    characterName: 'Shedletsky',
    mode: '2x2',
    objective: 'heal',
    target: 60,
    bonusXp: 50,
    specialName: 'Fried Chicken',
  },
  {
    id: 'elliot',
    characterName: 'Elliot',
    mode: '2x2',
    objective: 'heal',
    target: 60,
    bonusXp: 50,
    specialName: 'Pizza Throw',
  },
  {
    id: '007n7',
    characterName: '007n7',
    mode: '2x2',
    objective: 'survive',
    target: 10,
    bonusXp: 50,
    specialName: 'Clone',
  },
  {
    id: 'guest-1337',
    characterName: 'Guest 1337',
    mode: '2x2',
    objective: 'block',
    target: 2,
    bonusXp: 60,
    specialName: 'Block',
  },
  {
    id: 'two-time',
    characterName: 'Two Time',
    mode: '2x2',
    objective: 'revive',
    target: 1,
    bonusXp: 70,
    specialName: 'Oblation',
  },
  {
    id: 'builderman',
    characterName: 'Builderman',
    mode: '2x2',
    objective: 'summon',
    target: 2,
    bonusXp: 50,
  },
  {
    id: 'dusekkar',
    characterName: 'Dusekkar',
    mode: '2x2',
    objective: 'special',
    target: 2,
    bonusXp: 50,
    specialName: 'Spawn Protection',
  },
  {
    id: 'taph',
    characterName: 'Taph',
    mode: '2x2',
    objective: 'stun',
    target: 2,
    bonusXp: 50,
    specialName: 'Subspace Tripmine',
  },
  {
    id: 'chance',
    characterName: 'Chance',
    mode: '2x2',
    objective: 'win',
    target: 1,
    bonusXp: 50,
    specialName: 'Coin Flip',
  },
  {
    id: 'veeronica',
    characterName: 'Veeronica',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 60,
    specialName: 'Activate Battery',
  },
  {
    id: 'jane-doe',
    characterName: 'Jane Doe',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 60,
    specialName: 'Crystal Pitch',
  },
  {
    id: 'helperbot',
    characterName: 'Helperbot',
    mode: '2x2',
    objective: 'special',
    target: 4,
    bonusXp: 60,
    specialName: 'Pulse',
  },
]

export function trialForCharacter(name: string): Trial | undefined {
  return TRIALS.find(trial => trial.characterName === name)
}

export function trialClaimKey(trial: Trial): string {
  // The objective is part of the key so reworked trials become playable again
  // without erasing the rewards players already earned.
  return `${TRIAL_CLAIM_PREFIX}${trial.id}:${trial.objective}:${trial.target}:${
    trial.specialName ?? 'loadout'
  }`
}

/** Current progress of the trial's objective for the result screen. */
export function trialProgress(trial: Trial, result: TrialResult): number {
  switch (trial.objective) {
    case 'win':
      return result.won ? 1 : 0
    case 'survive':
      return result.turns
    case 'special':
      return result.abilityUses
    case 'win_without_rest':
      return result.won && result.rests === 0 ? 1 : 0
    case 'heal':
      return result.healingDone ?? 0
    case 'damage':
      return result.damageDealt ?? 0
    case 'summon':
      return result.summoned ?? 0
    case 'block':
      return result.blocks ?? 0
    case 'stun':
      return result.stuns ?? 0
    case 'revive':
      return result.revives ?? 0
  }
}

export function checkTrialResult(trial: Trial, result: TrialResult): boolean {
  return trialProgress(trial, result) >= trial.target
}

/** Reads the trial metrics of the human side that played the trial. */
export function trialResultFromBattle(battle: Battle, ownerId: string): TrialResult {
  const side = battle.sides.find(
    candidate =>
      candidate.userId === ownerId &&
      candidate.team === 0 &&
      !candidate.fake &&
      !candidate.minion,
  )
  return {
    won: battle.winner === 0,
    turns: side?.turns ?? 0,
    abilityUses: side?.abilityUses ?? 0,
    rests: side?.rests ?? 0,
    damageDealt: side?.damageDealt ?? 0,
    healingDone: side?.healingDone ?? 0,
    summoned: side?.minionsSummoned ?? 0,
    blocks: side?.blocks ?? 0,
    stuns: side?.stuns ?? 0,
    revives: side?.revives ?? 0,
  }
}

export function trialReward(trial: Trial): number {
  return trial.bonusXp
}

type Seed = number | string

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index++) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

function seedValue(seed: Seed): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return Math.floor(seed) >>> 0
  }
  return hash(String(seed))
}

function makeRng(trialId: string, seed: Seed): () => number {
  let state = (hash(trialId) + seedValue(seed)) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function takeRandom(pool: Character[], rng: () => number, offset = 0): Character {
  const index = (Math.floor(rng() * pool.length) + offset) % pool.length
  return pool.splice(index, 1)[0]
}

function playerEntry(character: Character): FighterEntry {
  return { userId: 'trial:player', name: 'player', character }
}

function allyEntry(character: Character): FighterEntry {
  return { userId: 'trial:ally', name: 'ally', character }
}

function botEntry(trial: Trial, character: Character, slot: number): FighterEntry {
  return {
    userId: `bot:trial:${trial.id}:${slot}`,
    name: 'bot',
    character,
  }
}

export function createTrialBattle(
  trial: Trial,
  playerCharacter: Character,
  seed: Seed,
): Battle {
  if (playerCharacter.name !== trial.characterName) {
    throw new Error('Trial character mismatch.')
  }

  const rng = makeRng(trial.id, seed)
  const offset = seedValue(seed)
  const pool = CHARACTERS.filter(character => character.name !== playerCharacter.name)
  const opponentCount = trial.mode === '2x2' ? 2 : 1
  const teammate = trial.mode === '2x2' ? takeRandom(pool, rng, offset) : undefined
  const opponents = Array.from({ length: opponentCount }, (_, index) =>
    botEntry(trial, takeRandom(pool, rng, offset), index + 1),
  )

  if (trial.mode === '2x2' && teammate) {
    return createTeamBattle(
      [playerEntry(playerCharacter), allyEntry(teammate)],
      opponents,
    )
  }
  return createBattle(playerEntry(playerCharacter), opponents[0])
}

function noClaim(user: UserData, trial: Trial): TrialClaimResult {
  return {
    user,
    claimed: false,
    xpGained: 0,
    level: masteryLevel(user.characterStats[trial.characterName]?.xp ?? 0),
    leveledUp: false,
    reward: 0,
    milestoneReward: 0,
    milestones: [],
    skinsUnlocked: [],
  }
}

export function claimTrialResult(
  user: UserData,
  trial: Trial,
  cleared: boolean,
): TrialClaimResult {
  const key = trialClaimKey(trial)
  if (!cleared || (user.trialClaimed[key] ?? 0) > 0) return noClaim(user, trial)

  const progress = recordCharacterResult(
    user,
    trial.characterName,
    cleared,
    false,
    trial.bonusXp,
  )
  return {
    user: {
      ...progress.user,
      trialClaimed: {
        ...progress.user.trialClaimed,
        [key]: 1,
      },
    },
    claimed: true,
    xpGained: progress.xpGained,
    level: progress.level,
    leveledUp: progress.leveledUp,
    reward: progress.reward,
    milestoneReward: progress.milestoneReward,
    milestones: progress.milestones,
    skinsUnlocked: progress.skinsUnlocked,
  }
}
