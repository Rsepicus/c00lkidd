import {
  BOSS_ROSTER,
  bossCharacter,
  bossTuning,
  type BossMode,
} from './boss'
import { characterByName, type Character } from './forsaken'

/** Number of bosses in a complete Boss Rush run. */
export const BOSS_RUSH_STAGES = 5

/**
 * After a win, the party's remaining HP ratio is carried into the next stage
 * and then restored by this fraction of maximum HP (capped at full health).
 */
export const BOSS_RUSH_STAGE_HEAL = 0.25

/** Reward for clearing stage 1. */
export const BOSS_RUSH_REWARD_BASE = 100

/** Additional reward for every later stage. */
export const BOSS_RUSH_REWARD_STEP = 75

export type BossRushStatus = 'active' | 'completed' | 'failed'

/**
 * One planned stage of a run. `hp` and `attack` already include the stage
 * multiplier, so they can be used directly to build a battle FighterEntry.
 */
export type BossRushStage = {
  readonly stage: number
  readonly bossName: string
  readonly multiplier: number
  readonly hp: number
  readonly attack: number
}

/**
 * Serializable run state. Boss order and all stage stats are fixed when the
 * run is created, so replaying the same decisions with the same seed gives the
 * same result.
 */
export type BossRushRun = {
  readonly mode: BossMode
  readonly seed: number
  readonly stage: number
  readonly status: BossRushStatus
  readonly hpRatio: number
  readonly bossOrder: readonly string[]
  readonly stages: readonly BossRushStage[]
}

/** The current boss, together with a battle-ready Character. */
export type BossRushBoss = BossRushStage & { readonly character: Character }

export type BossRushSummary = {
  readonly mode: BossMode
  readonly seed: number
  readonly status: BossRushStatus
  readonly stage: number
  readonly totalStages: number
  readonly bossesDefeated: number
  readonly currentBoss: string
  readonly nextBoss: string | null
  readonly hpRatio: number
  readonly rewardEarned: number
}

/**
 * Documented difficulty curve: stage 1 is 1.05x the boss's normal stats,
 * rising by 0.15x per stage to 1.65x at stage 5.
 */
function stageMultiplier(stage: number): number {
  return Math.round((0.9 + 0.15 * stage) * 100) / 100
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new RangeError('Boss Rush seed must be a finite number.')
  }
  return Math.trunc(seed) >>> 0
}

/** Small deterministic PRNG; no randomness is shared with the battle engine. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function bossOrderFor(seed: number): string[] {
  if (BOSS_ROSTER.length === 0) {
    throw new Error('Boss Rush requires at least one boss in BOSS_ROSTER.')
  }

  const pool = [...BOSS_ROSTER]
  const random = seededRandom(seed)
  for (let index = pool.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1))
    const current = pool[index]!
    pool[index] = pool[swapWith]!
    pool[swapWith] = current
  }

  // Current roster has exactly five bosses. If it grows later, take a unique
  // seeded sample; if it shrinks, cycle rather than producing a short run.
  return Array.from(
    { length: BOSS_RUSH_STAGES },
    (_, index) => pool[index % pool.length]!,
  )
}

function stagePlan(bossName: string, stage: number, mode: BossMode): BossRushStage {
  const multiplier = stageMultiplier(stage)
  const tuning = bossTuning(bossName)
  const baseHp = mode === '2x2' ? tuning.hp2 : tuning.hp1
  const baseAttack = mode === '2x2' ? tuning.attack2 : tuning.attack1
  return {
    stage,
    bossName,
    multiplier,
    hp: Math.max(1, Math.round(baseHp * multiplier)),
    attack: Math.max(1, Math.round(baseAttack * multiplier)),
  }
}

/** Create an active stage-1 run with a deterministic seeded boss order. */
export function createBossRush(mode: BossMode, seed: number): BossRushRun {
  if (mode !== '1x1' && mode !== '2x2') {
    throw new RangeError('Boss Rush mode must be either "1x1" or "2x2".')
  }
  const normalizedSeed = normalizeSeed(seed)
  const bossOrder = bossOrderFor(normalizedSeed)
  const stages = bossOrder.map((bossName, index) =>
    stagePlan(bossName, index + 1, mode),
  )
  return {
    mode,
    seed: normalizedSeed,
    stage: 1,
    status: 'active',
    hpRatio: 1,
    bossOrder,
    stages,
  }
}

/** Build the current stage boss for a PvP battle. */
export function bossRushBoss(run: BossRushRun): BossRushBoss {
  const stage = run.stages[run.stage - 1]
  if (!stage) {
    throw new RangeError(`Boss Rush has no stage ${run.stage}.`)
  }

  // Unknown future roster entries (for example a new boss without character
  // data yet) still get a complete Character; known bosses keep their real
  // specials. The fallback week is derived from the run so even that path is
  // deterministic and does not depend on any particular boss being present.
  const base =
    characterByName(stage.bossName) ??
    bossCharacter(run.mode, `boss-rush:${run.seed}:${stage.stage}`)
  return {
    ...stage,
    character: {
      ...base,
      name: stage.bossName,
      hp: stage.hp,
      attack: stage.attack,
    },
  }
}

function clampHpRatio(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('Remaining HP ratio must be a finite number.')
  }
  return Math.max(0, Math.min(1, value))
}

/**
 * Resolve one stage.
 *
 * - A loss fails the run immediately at the current stage (HP ratio 0).
 * - A win carries the supplied HP ratio (or the existing ratio when omitted)
 *   into the next stage, then heals BOSS_RUSH_STAGE_HEAL of max HP, capped at
 *   1. The final win completes the run without an intermission heal.
 * - Terminal runs are returned unchanged, making repeated calls harmless.
 */
export function advanceBossRush(
  run: BossRushRun,
  won: boolean,
  remainingHpRatio?: number,
): BossRushRun {
  if (run.status !== 'active') return run

  if (!won) {
    return { ...run, status: 'failed', hpRatio: 0 }
  }

  const ratio =
    remainingHpRatio === undefined
      ? run.hpRatio
      : clampHpRatio(remainingHpRatio)

  if (run.stage >= BOSS_RUSH_STAGES) {
    return { ...run, status: 'completed', hpRatio: ratio }
  }

  return {
    ...run,
    stage: run.stage + 1,
    hpRatio: Math.min(1, ratio + BOSS_RUSH_STAGE_HEAL),
  }
}

/** Deterministic stage reward; later stages always pay more. */
export function bossRushReward(stage: number): number {
  if (!Number.isInteger(stage) || stage < 1 || stage > BOSS_RUSH_STAGES) {
    throw new RangeError(
      `Boss Rush reward stage must be an integer from 1 to ${BOSS_RUSH_STAGES}.`,
    )
  }
  return BOSS_RUSH_REWARD_BASE + (stage - 1) * BOSS_RUSH_REWARD_STEP
}

/** Compact, non-localized data for store/UI integration. */
export function bossRushSummary(run: BossRushRun): BossRushSummary {
  const current = run.stages[run.stage - 1]
  if (!current) {
    throw new RangeError(`Boss Rush has no stage ${run.stage}.`)
  }

  const bossesDefeated =
    run.status === 'completed'
      ? BOSS_RUSH_STAGES
      : Math.max(0, run.stage - 1)
  let rewardEarned = 0
  for (let stage = 1; stage <= bossesDefeated; stage++) {
    rewardEarned += bossRushReward(stage)
  }

  const next =
    run.status === 'active' && run.stage < BOSS_RUSH_STAGES
      ? run.stages[run.stage]?.bossName ?? null
      : null

  return {
    mode: run.mode,
    seed: run.seed,
    status: run.status,
    stage: run.stage,
    totalStages: BOSS_RUSH_STAGES,
    bossesDefeated,
    currentBoss: current.bossName,
    nextBoss: next,
    hpRatio: run.hpRatio,
    rewardEarned,
  }
}
