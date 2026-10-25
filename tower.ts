import {
  CHARACTERS,
  availableSpecials,
  characterWithSpecial,
  type Rng,
} from './forsaken'
import { createTeamBattle, type Battle, type FighterEntry } from './pvp'

/** Number of floors in a complete tower run. Floors are numbered 1-10. */
export const TOWER_FLOORS = 10

/**
 * Difficulty curve, indexed by floor - 1.
 *
 * HP:     1.00, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25, 2.50, 2.80
 * Attack: 1.00, 1.12, 1.24, 1.38, 1.52, 1.68, 1.86, 2.04, 2.22, 2.40
 *
 * Multipliers are applied to the base character HP and attack, then rounded.
 * HP grows by 15-25 percentage points per floor; attack grows by 12-18.
 */
const TOWER_HP_MULTIPLIERS = [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2, 2.25, 2.5, 2.8] as const
const TOWER_ATTACK_MULTIPLIERS = [
  1, 1.12, 1.24, 1.38, 1.52, 1.68, 1.86, 2.04, 2.22, 2.4,
] as const

export const TOWER_REWARDS = [
  50, 80, 115, 155, 200, 255, 320, 395, 480, 600,
] as const

export type TowerUpgradeId = 'power' | 'vitality' | 'guard' | 'dodge' | 'fortune'

export type TowerUpgrade = {
  id: TowerUpgradeId
  name: string
  description: string
}

export const TOWER_UPGRADES: Record<TowerUpgradeId, TowerUpgrade> = {
  power: { id: 'power', name: 'Сила', description: '+3 атаки обоим бойцам.' },
  vitality: {
    id: 'vitality',
    name: 'Живучесть',
    description: '+20 максимального HP обоим бойцам.',
  },
  guard: { id: 'guard', name: 'Щит', description: 'Начинать бой с 30% щита.' },
  dodge: { id: 'dodge', name: 'Уворот', description: '+10% уворота.' },
  fortune: { id: 'fortune', name: 'Удача', description: '+15% монет за этаж.' },
}

export type TowerFloor = {
  floor: number
  enemies: FighterEntry[]
  reward: number
  hpMultiplier: number
  attackMultiplier: number
  seed: number
}

export type TowerRunStatus = 'active' | 'failed' | 'completed'

export type TowerRun = {
  seed: number
  floor: number
  cleared: number
  status: TowerRunStatus
  upgrades: TowerUpgradeId[]
}

export type TowerSummary = {
  seed: number
  status: TowerRunStatus
  floor: number
  totalFloors: number
  floorsCleared: number
  nextFloor: number | null
  rewardEarned: number
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new RangeError('Сид башни должен быть конечным числом.')
  }
  return Math.trunc(seed) >>> 0
}

function assertFloor(floor: number): number {
  if (!Number.isInteger(floor) || floor < 1 || floor > TOWER_FLOORS) {
    throw new RangeError(`Этаж башни должен быть от 1 до ${TOWER_FLOORS}.`)
  }
  return floor
}

function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function floorRng(seed: number, floor: number): Rng {
  let mixed = (seed ^ Math.imul(floor, 0x9e3779b1)) >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0
  return mulberry32((mixed ^ (mixed >>> 13)) >>> 0)
}

export function towerReward(floor: number): number {
  return TOWER_REWARDS[assertFloor(floor) - 1]
}

/**
 * Builds one seeded tower floor. The same seed and floor always produce the
 * same two characters, in the same order, with the same selected specials.
 */
export function towerFloor(index: number, seed: number): TowerFloor {
  const floor = assertFloor(index)
  const normalizedSeed = normalizeSeed(seed)
  const rng = floorRng(normalizedSeed, floor)
  const pool = [...CHARACTERS]
  const enemies: FighterEntry[] = []
  const hpMultiplier = TOWER_HP_MULTIPLIERS[floor - 1]
  const attackMultiplier = TOWER_ATTACK_MULTIPLIERS[floor - 1]

  for (let slot = 0; slot < 2; slot++) {
    const base = pool.splice(Math.floor(rng() * pool.length), 1)[0]
    const specials = availableSpecials(base)
    const special = specials[Math.floor(rng() * specials.length)]
    const selected = characterWithSpecial(base, special.name)
    const character = {
      ...selected,
      hp: Math.max(1, Math.round(base.hp * hpMultiplier)),
      attack: Math.max(1, Math.round(base.attack * attackMultiplier)),
    }

    enemies.push({
      userId: `bot:tower:${normalizedSeed}:${floor}:${slot + 1}`,
      name: `Башня ${floor} · ${base.name}`,
      character,
    })
  }

  return {
    floor,
    enemies,
    reward: towerReward(floor),
    hpMultiplier,
    attackMultiplier,
    seed: normalizedSeed,
  }
}

export function createTowerBattle(
  floor: TowerFloor,
  playerEntries: FighterEntry[],
): Battle {
  if (!floor || !Array.isArray(floor.enemies) || floor.enemies.length !== 2) {
    throw new RangeError('Этаж башни должен содержать двух противников.')
  }
  if (!Array.isArray(playerEntries) || playerEntries.length !== 2) {
    throw new RangeError('Для башни нужна команда из двух бойцов.')
  }
  return createTeamBattle(playerEntries, floor.enemies)
}

export function createTowerRun(seed: number): TowerRun {
  return {
    seed: normalizeSeed(seed),
    floor: 1,
    cleared: 0,
    status: 'active',
    upgrades: [],
  }
}

function countUpgrades(upgrades: TowerUpgradeId[]): Record<TowerUpgradeId, number> {
  const counts: Record<TowerUpgradeId, number> = {
    power: 0,
    vitality: 0,
    guard: 0,
    dodge: 0,
    fortune: 0,
  }
  for (const upgrade of upgrades) {
    if (upgrade in counts) counts[upgrade] += 1
  }
  return counts
}

/** Three distinct upgrades offered after clearing `floor`. */
export function towerUpgradeChoices(seed: number, floor: number): TowerUpgradeId[] {
  const normalizedSeed = normalizeSeed(seed)
  const rng = floorRng(normalizedSeed, (Math.max(1, Math.floor(floor)) + TOWER_FLOORS) * 101)
  const pool = Object.keys(TOWER_UPGRADES) as TowerUpgradeId[]
  const choices: TowerUpgradeId[] = []
  while (choices.length < 3 && pool.length > 0) {
    const index = Math.floor(rng() * pool.length)
    choices.push(pool.splice(index, 1)[0])
  }
  return choices
}

export function towerRewardMultiplier(run: TowerRun): number {
  return 1 + 0.15 * countUpgrades(run.upgrades ?? []).fortune
}

/** Applies the run's upgrades to the player's two fighters for the next floor. */
export function applyTowerUpgrades(battle: Battle, run: TowerRun): void {
  const counts = countUpgrades(run.upgrades ?? [])
  for (const side of battle.sides) {
    if (side.team !== 0 || side.fake || side.minion) continue
    const attack = side.character.attack + 3 * counts.power
    const maxHp = side.character.hp + 20 * counts.vitality
    side.character = { ...side.character, attack, hp: maxHp }
    side.maxHp = maxHp
    side.hp = maxHp
    const shield = Math.min(60, 30 * counts.guard)
    if (shield > 0) side.shield = shield
    const bonusDodge = Math.min(0.4, 0.1 * counts.dodge)
    if (bonusDodge > 0) side.bonusDodge = (side.bonusDodge ?? 0) + bonusDodge
  }
}

/**
 * Applies a battle result without mutating the current run. A loss ends the
 * run at the attempted floor; a win on floor 10 completes it.
 */
export function advanceTowerRun(run: TowerRun, won: boolean): TowerRun {
  if (run.status !== 'active') return run
  if (!won) return { ...run, status: 'failed' }

  if (run.floor >= TOWER_FLOORS) {
    return {
      ...run,
      floor: TOWER_FLOORS,
      cleared: TOWER_FLOORS,
      status: 'completed',
    }
  }

  return {
    ...run,
    floor: run.floor + 1,
    cleared: Math.min(TOWER_FLOORS, run.cleared + 1),
  }
}

export function towerRunSummary(run: TowerRun): TowerSummary {
  const earned = TOWER_REWARDS.slice(0, Math.max(0, Math.min(TOWER_FLOORS, run.cleared))).reduce(
    (total, reward) => total + reward,
    0,
  )
  return {
    seed: run.seed,
    status: run.status,
    floor: run.floor,
    totalFloors: TOWER_FLOORS,
    floorsCleared: run.cleared,
    nextFloor:
      run.status === 'active' && run.floor < TOWER_FLOORS ? run.floor + 1 : null,
    rewardEarned: earned,
  }
}

export const towerSummary = towerRunSummary
