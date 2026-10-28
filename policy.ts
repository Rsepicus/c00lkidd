import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { immediateDamage, type BotDecision } from './ai'
import { buildLocalCandidates, type LocalCandidate } from './llm-ai'
import { canUseSpecialNow, specialOf, type Battle, type Side } from './pvp'

/**
 * Small learned policy for automated sides.
 *
 * The network scores legal candidates produced by the same builder the local
 * LLM uses. It is intentionally tiny: one tanh hidden layer and one scalar
 * output per candidate, so inference is instant and the weights fit in JSON.
 * Training happens offline in policy-train.ts; only inference runs on the bot
 * host.
 */

export const POLICY_FEATURE_COUNT = 60

export type PolicyWeights = {
  version: number
  features: number
  hidden: number
  w1: number[]
  b1: number[]
  w2: number[]
  b2: number
  meta?: {
    trainedAt?: string
    examples?: number
    accuracy?: number
    teacher?: string
  }
}

export type PolicyTurn = {
  decision: BotDecision
  provider: 'Policy'
  model: string
  keyIndex: number
  keyCount: number
}

let cachedWeights: PolicyWeights | null | undefined

function defaultWeightsPath(): string {
  return fileURLToPath(new URL('./policy-weights.json', import.meta.url))
}

export function policyWeightsPath(): string {
  return process.env.POLICY_WEIGHTS?.trim() || defaultWeightsPath()
}

export function resetPolicyWeightsCache(): void {
  cachedWeights = undefined
}

function finiteArray(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(item => typeof item === 'number' && Number.isFinite(item))
  )
}

function validWeights(value: unknown): value is PolicyWeights {
  if (!value || typeof value !== 'object') return false
  const weights = value as Partial<PolicyWeights>
  if (weights.features !== POLICY_FEATURE_COUNT) return false
  if (typeof weights.hidden !== 'number' || weights.hidden <= 0) return false
  const hidden = weights.hidden
  return (
    finiteArray(weights.w1, hidden * POLICY_FEATURE_COUNT) &&
    finiteArray(weights.b1, hidden) &&
    finiteArray(weights.w2, hidden) &&
    typeof weights.b2 === 'number' &&
    Number.isFinite(weights.b2)
  )
}

export function loadPolicyWeights(): PolicyWeights | null {
  if (cachedWeights !== undefined) return cachedWeights
  try {
    const path = policyWeightsPath()
    if (!existsSync(path)) {
      cachedWeights = null
      return null
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    cachedWeights = validWeights(parsed) ? parsed : null
    return cachedWeights
  } catch {
    cachedWeights = null
    return null
  }
}

/** POLICY_AI=1 switches automated sides to the learned policy. */
export function policyAiEnabled(): boolean {
  return /^(1|true|yes|on)$/i.test(process.env.POLICY_AI?.trim() ?? '')
}

export function policyAvailable(): boolean {
  return loadPolicyWeights() !== null
}

const HEAL_KINDS = new Set([
  'heal',
  'pray',
  'battery',
  'regeneration',
  'shield',
  'block',
  'dispenser',
  'purified',
  'pulse',
  'rejuvenate',
])

const CONTROL_KINDS = new Set([
  'stun',
  'glitch',
  'weakness',
  'vulnerable',
  'creatures',
  'hemorrhage',
  'bleed',
  'poison',
  'burn',
  'trap',
  'turret',
  'seeker',
  'stigmatize',
])

function hpRatio(side: Side): number {
  return side.maxHp > 0 ? Math.max(0, Math.min(1, side.hp / side.maxHp)) : 0
}

function effectiveHp(side: Side): number {
  return Math.max(0, side.hp + side.tempHp + side.shatterpoint)
}

function livingSides(
  battle: Battle,
  side: Side,
  team: 'ally' | 'enemy',
): Side[] {
  const sameTeam = team === 'ally'
  const all = battle.sides.filter(
    candidate =>
      candidate.hp > 0 &&
      !candidate.fake &&
      (sameTeam ? candidate.team === side.team : candidate.team !== side.team),
  )
  if (team === 'enemy') {
    const real = all.filter(candidate => !candidate.minion)
    return real.length > 0 ? real : all
  }
  return all.filter(candidate => !candidate.minion)
}

function maxOf(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0
}

export function candidateFeatures(
  battle: Battle,
  side: Side,
  candidate: LocalCandidate,
): number[] {
  const enemies = livingSides(battle, side, 'enemy')
  const allies = livingSides(battle, side, 'ally')
  const lowestEnemy = enemies.reduce<Side | null>(
    (best, enemy) =>
      !best || effectiveHp(enemy) < effectiveHp(best) ? enemy : best,
    null,
  )
  const target =
    candidate.decision.targetIndex !== undefined
      ? battle.sides[candidate.decision.targetIndex]
      : undefined
  const action = candidate.decision.action
  const specialIndex = candidate.decision.specialIndex ?? 0
  const special =
    action === 'special' ? specialOf(side, specialIndex) : undefined
  const damage =
    action === 'attack'
      ? side.character.attack
      : special
        ? immediateDamage(special, side)
        : 0
  const readySlots = side.boss ? [0, 1] : [0]
  const readyCount = readySlots.filter(index => canUseSpecialNow(side, index)).length
  const basicLethal =
    lowestEnemy && side.character.attack >= effectiveHp(lowestEnemy) ? 1 : 0
  const restValue =
    side.hp < side.maxHp ||
    (side.effects.hemorrhage ?? 0) > 0 ||
    side.character.name === 'Veeronica'
      ? 1
      : 0
  const targetSupport = target?.character.class === 'Support' ? 1 : 0
  const targetBoss = target?.boss ? 1 : 0
  const targetLowest = target && lowestEnemy && target.id === lowestEnemy.id ? 1 : 0
  const targetEffectiveRatio = target
    ? Math.max(0, Math.min(1, effectiveHp(target) / Math.max(1, target.maxHp)))
    : 0
  const lethal =
    damage > 0 && target && damage >= effectiveHp(target) ? 1 : 0
  const healCandidate = special && HEAL_KINDS.has(special.kind) ? 1 : 0
  const controlCandidate = special && CONTROL_KINDS.has(special.kind) ? 1 : 0
  const lowestEffectiveRatio = lowestEnemy
    ? Math.max(0, Math.min(1, effectiveHp(lowestEnemy) / Math.max(1, lowestEnemy.maxHp)))
    : 0
  const ownStatuses =
    Object.values(side.effects).filter(turns => (turns ?? 0) > 0).length
  const enemyStatuses =
    enemies.length > 0
      ? enemies.reduce(
          (sum, enemy) =>
            sum +
            Object.values(enemy.effects).filter(turns => (turns ?? 0) > 0).length,
          0,
        ) / enemies.length
      : 0

  return [
    hpRatio(side),
    Math.max(0, Math.min(1, side.tempHp / Math.max(1, side.maxHp))),
    Math.max(0, Math.min(1, side.character.attack / 30)),
    Math.max(0, Math.min(1, side.cooldown / 6)),
    Math.max(0, Math.min(1, side.secondCooldown / 6)),
    Math.max(0, Math.min(1, side.charge / 100)),
    Math.max(0, Math.min(1, side.shield / 100)),
    side.boss ? 1 : 0,
    side.character.class === 'Support' ? 1 : 0,
    side.character.role === 'killer' ? 1 : 0,
    side.juking ? 1 : 0,
    side.blocking ? 1 : 0,
    side.dodging ? 1 : 0,
    (side.effects.hemorrhage ?? 0) > 0 ? 1 : 0,
    side.stunned ? 1 : 0,
    Math.min(1, allies.length / 3),
    Math.min(1, enemies.length / 3),
    lowestEnemy ? hpRatio(lowestEnemy) : 0,
    enemies.length > 0
      ? enemies.reduce((sum, enemy) => sum + hpRatio(enemy), 0) / enemies.length
      : 0,
    allies.length > 0
      ? allies.reduce((sum, ally) => sum + hpRatio(ally), 0) / allies.length
      : 0,
    Math.min(1, enemies.filter(enemy => enemy.character.class === 'Support').length / 2),
    enemies.filter(enemy => enemy.boss).length > 0 ? 1 : 0,
    Math.max(0, Math.min(1, maxOf(enemies.map(enemy => enemy.character.attack)) / 30)),
    Math.min(1, readyCount / 2),
    Math.max(0, Math.min(1, battle.clock / 50)),
    Math.max(0, Math.min(1, 1 - hpRatio(side))),
    basicLethal,
    restValue,
    action === 'attack' ? 1 : 0,
    action === 'special' ? 1 : 0,
    action === 'juke' ? 1 : 0,
    action === 'rest' ? 1 : 0,
    target ? 1 : 0,
    target && target.team === side.team ? 1 : 0,
    target && target.id === side.id ? 1 : 0,
    target ? hpRatio(target) : 0,
    target ? Math.max(0, Math.min(1, target.tempHp / Math.max(1, target.maxHp))) : 0,
    targetSupport,
    targetBoss,
    Math.max(0, Math.min(1, damage / 40)),
    lethal,
    targetLowest,
    target ? Math.max(0, Math.min(1, target.character.attack / 30)) : 0,
    healCandidate,
    action === 'special' ? (canUseSpecialNow(side, specialIndex) ? 1 : 0) : 0,
    targetEffectiveRatio,
    target ? Math.max(0, Math.min(1, target.shield / 100)) : 0,
    target?.juking ? 1 : 0,
    target?.dodging ? 1 : 0,
    target ? Math.max(0, Math.min(1, target.cooldown / 6)) : 0,
    target?.character.role === 'killer' ? 1 : 0,
    special?.kind === 'block' ? 1 : 0,
    special?.kind === 'dodge' ? 1 : 0,
    damage > 0 ? 1 : 0,
    controlCandidate,
    target ? 1 - targetEffectiveRatio : 0,
    lowestEffectiveRatio,
    Math.max(0, Math.min(1, ownStatuses / 4)),
    Math.max(0, Math.min(1, enemyStatuses / 4)),
    target?.minion ? 1 : 0,
  ]
}

export function scoreFeatures(
  weights: PolicyWeights,
  features: number[],
): number {
  let score = weights.b2
  for (let hidden = 0; hidden < weights.hidden; hidden++) {
    let value = weights.b1[hidden]
    const offset = hidden * weights.features
    for (let index = 0; index < weights.features; index++) {
      value += weights.w1[offset + index] * features[index]
    }
    score += weights.w2[hidden] * Math.tanh(value)
  }
  return score
}

/** Chooses a legal candidate from the learned distribution. */
export function choosePolicyTurn(
  battle: Battle,
  rng: () => number = Math.random,
): PolicyTurn | null {
  const weights = loadPolicyWeights()
  if (!weights) return null
  const side = battle.sides[battle.turn]
  if (!side || side.hp <= 0 || side.stunned || side.minion || side.fake) return null
  const candidates = buildLocalCandidates(battle, 100)
  if (candidates.length === 0) return null

  const scores = candidates.map(candidate =>
    scoreFeatures(weights, candidateFeatures(battle, side, candidate)),
  )
  if (!scores.every(score => Number.isFinite(score))) return null
  const temperature = Math.max(
    0.05,
    Number(process.env.POLICY_TEMPERATURE) || 0.1,
  )
  const max = Math.max(...scores)
  const exps = scores.map(score => Math.exp((score - max) / temperature))
  const total = exps.reduce((sum, value) => sum + value, 0) || 1
  let roll = rng() * total
  let chosen = 0
  for (let index = 0; index < exps.length; index++) {
    roll -= exps[index]!
    if (roll <= 0) {
      chosen = index
      break
    }
    chosen = index
  }
  return {
    decision: candidates[chosen].decision,
    provider: 'Policy',
    model: `mlp-${weights.hidden}`,
    keyIndex: 0,
    keyCount: 1,
  }
}
