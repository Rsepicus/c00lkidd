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

export type TrialObjective = 'win' | 'survive' | 'special' | 'win_without_rest'

export type Trial = {
  id: string
  characterName: string
  mode: TrialMode
  objective: TrialObjective
  target: number
  bonusXp: number
}

export type TrialResult = {
  won: boolean
  turns: number
  abilityUses: number
  rests: number
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
    objective: 'win_without_rest',
    target: 1,
    bonusXp: 40,
  },
  {
    id: 'c00lkidd',
    characterName: 'c00lkidd',
    mode: '1x1',
    objective: 'special',
    target: 3,
    bonusXp: 50,
  },
  {
    id: 'john-doe',
    characterName: 'John Doe',
    mode: '1x1',
    objective: 'survive',
    target: 8,
    bonusXp: 40,
  },
  {
    id: 'noli',
    characterName: 'Noli',
    mode: '1x1',
    objective: 'win',
    target: 1,
    bonusXp: 50,
  },
  {
    id: '1x1x1x1',
    characterName: '1x1x1x1',
    mode: '1x1',
    objective: 'special',
    target: 2,
    bonusXp: 70,
  },
  {
    id: 'guest-666',
    characterName: 'Guest 666',
    mode: '1x1',
    objective: 'special',
    target: 3,
    bonusXp: 60,
  },
  {
    id: 'nosferatu',
    characterName: 'Nosferatu',
    mode: '1x1',
    objective: 'survive',
    target: 10,
    bonusXp: 60,
  },
  {
    id: 'azure',
    characterName: 'Azure',
    mode: '1x1',
    objective: 'special',
    target: 3,
    bonusXp: 60,
  },
  {
    id: 'noob',
    characterName: 'Noob',
    mode: '2x2',
    objective: 'survive',
    target: 8,
    bonusXp: 40,
  },
  {
    id: 'shedletsky',
    characterName: 'Shedletsky',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 50,
  },
  {
    id: 'elliot',
    characterName: 'Elliot',
    mode: '2x2',
    objective: 'win_without_rest',
    target: 1,
    bonusXp: 50,
  },
  {
    id: '007n7',
    characterName: '007n7',
    mode: '2x2',
    objective: 'survive',
    target: 10,
    bonusXp: 50,
  },
  {
    id: 'guest-1337',
    characterName: 'Guest 1337',
    mode: '2x2',
    objective: 'win_without_rest',
    target: 1,
    bonusXp: 60,
  },
  {
    id: 'two-time',
    characterName: 'Two Time',
    mode: '2x2',
    objective: 'survive',
    target: 12,
    bonusXp: 70,
  },
  {
    id: 'builderman',
    characterName: 'Builderman',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 50,
  },
  {
    id: 'dusekkar',
    characterName: 'Dusekkar',
    mode: '2x2',
    objective: 'special',
    target: 2,
    bonusXp: 50,
  },
  {
    id: 'taph',
    characterName: 'Taph',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 50,
  },
  {
    id: 'chance',
    characterName: 'Chance',
    mode: '2x2',
    objective: 'win',
    target: 1,
    bonusXp: 50,
  },
  {
    id: 'veeronica',
    characterName: 'Veeronica',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 60,
  },
  {
    id: 'jane-doe',
    characterName: 'Jane Doe',
    mode: '2x2',
    objective: 'special',
    target: 3,
    bonusXp: 60,
  },
  {
    id: 'helperbot',
    characterName: 'Helperbot',
    mode: '2x2',
    objective: 'special',
    target: 4,
    bonusXp: 60,
  },
]

export function trialForCharacter(name: string): Trial | undefined {
  return TRIALS.find(trial => trial.characterName === name)
}

export function trialClaimKey(trial: Trial): string {
  return `${TRIAL_CLAIM_PREFIX}${trial.id}`
}

export function checkTrialResult(trial: Trial, result: TrialResult): boolean {
  switch (trial.objective) {
    case 'win':
      return result.won
    case 'survive':
      return result.turns >= trial.target
    case 'special':
      return result.abilityUses >= trial.target
    case 'win_without_rest':
      return result.won && result.rests === 0
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
