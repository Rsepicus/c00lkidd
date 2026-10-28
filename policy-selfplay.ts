import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chooseBossAction, chooseBotTurn } from './ai'
import { buildLocalCandidates } from './llm-ai'
import {
  candidateFeatures,
  loadPolicyWeights,
  POLICY_FEATURE_COUNT,
  scoreFeatures,
  type PolicyWeights,
} from './policy'
import { makeRng, randomBattle } from './policy-sim'
import { takeTurn, type Battle } from './pvp'

/**
 * Optional self-play fine-tuning for policy.ts.
 *
 * Starts from policy-weights.json, plays the policy against the heuristic, and
 * applies REINFORCE updates: winning battles reinforce the sampled choices,
 * losing battles push away from them. The baseline file is never overwritten;
 * the result goes to policy-weights-selfplay.json unless POLICY_RL_OUTPUT says
 * otherwise.
 */

const BATTLES = Number(process.env.POLICY_RL_BATTLES) || 1500
const BATCH = Number(process.env.POLICY_RL_BATCH) || 12
const LEARNING_RATE = Number(process.env.POLICY_RL_LR) || 0.001
const TEMPERATURE = Number(process.env.POLICY_RL_TEMP) || 0.6
const EVAL_TEMP = Number(process.env.POLICY_RL_EVAL_TEMP) || 0.05
const EVAL_BATTLES = Number(process.env.POLICY_RL_EVAL_BATTLES) || 80
const SEED = Number(process.env.POLICY_RL_SEED) || 0x5e1f91a7
const OUTPUT = process.env.POLICY_RL_OUTPUT?.trim()
  ? resolve(process.env.POLICY_RL_OUTPUT.trim())
  : resolve('policy-weights-selfplay.json')
const MAX_TURNS = 40

type Weights = {
  w1: number[]
  b1: number[]
  w2: number[]
  b2: number
}

type Decision = {
  xs: number[][]
  y: number
  probs: number[]
}

type Gradient = {
  dw1: number[]
  db1: number[]
  dw2: number[]
  db2: number
}

function toWeights(source: PolicyWeights): Weights {
  return {
    w1: [...source.w1],
    b1: [...source.b1],
    w2: [...source.w2],
    b2: source.b2,
  }
}

function toPolicy(source: Weights): PolicyWeights {
  return {
    version: 1,
    features: POLICY_FEATURE_COUNT,
    hidden: source.w2.length,
    w1: source.w1,
    b1: source.b1,
    w2: source.w2,
    b2: source.b2,
    meta: { teacher: 'self-play' },
  }
}

function softmax(scores: number[], temperature: number): number[] {
  const scaled = scores.map(score => score / Math.max(0.05, temperature))
  const max = Math.max(...scaled)
  const exps = scaled.map(score => Math.exp(score - max))
  const total = exps.reduce((sum, value) => sum + value, 0) || 1
  return exps.map(value => value / total)
}

function sample(probs: number[], rng: () => number): number {
  let roll = rng()
  for (let index = 0; index < probs.length; index++) {
    roll -= probs[index]!
    if (roll <= 0) return index
  }
  return probs.length - 1
}

function policyTurn(
  weights: Weights,
  battle: Battle,
  rng: () => number,
  temperature: number,
): { decision: ReturnType<typeof buildLocalCandidates>[number]['decision']; record: Decision } | null {
  const side = battle.sides[battle.turn]
  if (!side || side.hp <= 0 || side.stunned || side.minion || side.fake) return null
  const candidates = buildLocalCandidates(battle, 100)
  if (candidates.length === 0) return null
  const xs = candidates.map(candidate => candidateFeatures(battle, side, candidate))
  const model = toPolicy(weights)
  const probs = softmax(
    xs.map(features => scoreFeatures(model, features)),
    temperature,
  )
  const y = sample(probs, rng)
  return {
    decision: candidates[y]!.decision,
    record: { xs, y, probs },
  }
}

function emptyGradient(weights: Weights): Gradient {
  return {
    dw1: Array.from({ length: weights.w1.length }, () => 0),
    db1: Array.from({ length: weights.b1.length }, () => 0),
    dw2: Array.from({ length: weights.w2.length }, () => 0),
    db2: 0,
  }
}

/** Adds the REINFORCE gradient for one decision to the batch. */
function addDecisionGradient(
  weights: Weights,
  decision: Decision,
  advantage: number,
  gradient: Gradient,
): void {
  const hiddenCount = weights.w2.length
  const hiddenValues: number[][] = []
  for (const x of decision.xs) {
    const hidden = Array.from({ length: hiddenCount }, () => 0)
    for (let unit = 0; unit < hiddenCount; unit++) {
      let value = weights.b1[unit]!
      const offset = unit * POLICY_FEATURE_COUNT
      for (let feature = 0; feature < POLICY_FEATURE_COUNT; feature++) {
        value += weights.w1[offset + feature]! * x[feature]!
      }
      hidden[unit] = Math.tanh(value)
    }
    hiddenValues.push(hidden)
  }

  for (let candidate = 0; candidate < decision.xs.length; candidate++) {
    const dScore =
      advantage * ((candidate === decision.y ? 1 : 0) - (decision.probs[candidate] ?? 0))
    if (dScore === 0) continue
    const x = decision.xs[candidate]!
    const hidden = hiddenValues[candidate]!
    gradient.db2 += dScore
    for (let unit = 0; unit < hiddenCount; unit++) {
      gradient.dw2[unit] += dScore * hidden[unit]!
      const dz = dScore * weights.w2[unit]! * (1 - hidden[unit]! * hidden[unit]!)
      gradient.db1[unit] += dz
      const offset = unit * POLICY_FEATURE_COUNT
      for (let feature = 0; feature < POLICY_FEATURE_COUNT; feature++) {
        gradient.dw1[offset + feature] += dz * x[feature]!
      }
    }
  }
}

function applyGradient(
  weights: Weights,
  gradient: Gradient,
  scale: number,
): void {
  const rate = LEARNING_RATE * scale
  for (let index = 0; index < weights.w1.length; index++) {
    weights.w1[index] = weights.w1[index]! + rate * gradient.dw1[index]!
  }
  for (let index = 0; index < weights.b1.length; index++) {
    weights.b1[index] = weights.b1[index]! + rate * gradient.db1[index]!
  }
  for (let index = 0; index < weights.w2.length; index++) {
    weights.w2[index] = weights.w2[index]! + rate * gradient.dw2[index]!
  }
  weights.b2 += rate * gradient.db2
}

function winReward(battle: Battle, policyTeam: 0 | 1): number {
  const win = battle.winner === policyTeam ? 1 : battle.winner === null ? 0 : -1
  const policyDamage = battle.sides
    .filter(side => side.team === policyTeam)
    .reduce((sum, side) => sum + side.damageDealt, 0)
  const enemyDamage = battle.sides
    .filter(side => side.team !== policyTeam)
    .reduce((sum, side) => sum + side.damageDealt, 0)
  const shaped = Math.max(-1, Math.min(1, (policyDamage - enemyDamage) / 100))
  return win + 0.25 * shaped
}

function runBattle(
  weights: Weights,
  rng: () => number,
  temperature: number,
  record: boolean,
): { battle: Battle; decisions: Decision[]; policyTeam: 0 | 1 } {
  const policyTeam = rng() < 0.5 ? 0 : 1
  let battle = randomBattle(rng, { bossChance: 0.12, twoVTwoChance: 0.3 })
  const decisions: Decision[] = []
  let guard = 0
  while (!battle.finished && battle.clock < MAX_TURNS && guard++ < 120) {
    const side = battle.sides[battle.turn]
    if (!side || side.hp <= 0 || side.minion || side.fake) break
    let decision
    if (side.team === policyTeam) {
      const turn = policyTurn(weights, battle, rng, temperature)
      if (turn) {
        decision = turn.decision
        if (record) decisions.push(turn.record)
      } else {
        decision = side.boss
          ? chooseBossAction(battle, rng)
          : chooseBotTurn(battle, rng)
      }
    } else {
      decision = side.boss
        ? chooseBossAction(battle, rng)
        : chooseBotTurn(battle, rng)
    }
    const result = takeTurn(
      battle,
      decision.action,
      rng,
      decision.targetIndex,
      decision.specialIndex,
    )
    battle = result.battle
  }
  return { battle, decisions: record ? decisions : [], policyTeam }
}

function evaluate(weights: Weights, rng: () => number, battles: number): {
  wins: number
  losses: number
  draws: number
} {
  let wins = 0
  let losses = 0
  let draws = 0
  for (let index = 0; index < battles; index++) {
    const result = runBattle(weights, rng, EVAL_TEMP, false)
    if (result.battle.winner === result.policyTeam) wins += 1
    else if (result.battle.winner === null) draws += 1
    else losses += 1
  }
  return { wins, losses, draws }
}

function main(): void {
  const source = loadPolicyWeights()
  if (!source) {
    throw new Error(
      'policy-weights.json not found. Train the base policy first: bun policy-train.ts',
    )
  }
  const weights = toWeights(source)
  const rng = makeRng(SEED)
  const evalRng = makeRng(SEED ^ 0x9e3779b9)
  const initialEval = evaluate(weights, evalRng, EVAL_BATTLES)
  console.log(
    `[rl] initial: ${initialEval.wins}W ${initialEval.losses}L ${initialEval.draws}D ` +
      `(${EVAL_BATTLES} battles)`,
  )
  let bestEval = initialEval
  let bestWeights = toWeights(weights)
  let baseline = 0
  let pending = emptyGradient(weights)
  let pendingBattles = 0
  let rewardSum = 0

  for (let battleIndex = 1; battleIndex <= BATTLES; battleIndex++) {
    const result = runBattle(weights, rng, TEMPERATURE, true)
    const reward = winReward(result.battle, result.policyTeam)
    rewardSum += reward
    const advantage = Math.max(-2, Math.min(2, reward - baseline))
    baseline = baseline * 0.98 + reward * 0.02
    if (result.decisions.length > 0) {
      for (const decision of result.decisions) {
        addDecisionGradient(weights, decision, advantage, pending)
      }
      pendingBattles += 1
    }
    if (pendingBattles >= BATCH) {
      applyGradient(weights, pending, 1 / Math.max(1, pendingBattles))
      pending = emptyGradient(weights)
      pendingBattles = 0
    }

    if (battleIndex % 100 === 0) {
      console.log(
        `[rl] battle ${battleIndex}/${BATTLES} · avg reward ` +
          `${(rewardSum / battleIndex).toFixed(3)} · baseline ${baseline.toFixed(3)}`,
      )
    }
    if (battleIndex % 250 === 0 || battleIndex === BATTLES) {
      const evaluation = evaluate(weights, evalRng, EVAL_BATTLES)
      const score = evaluation.wins - evaluation.losses
      const bestScore = bestEval.wins - bestEval.losses
      console.log(
        `[rl] eval ${battleIndex}: ${evaluation.wins}W ${evaluation.losses}L ` +
          `${evaluation.draws}D`,
      )
      if (score > bestScore) {
        bestEval = evaluation
        bestWeights = toWeights(weights)
        console.log('[rl] new best — saved for output')
      }
    }
  }

  const output = { ...toPolicy(bestWeights), meta: { teacher: 'self-play' } }
  writeFileSync(OUTPUT, `${JSON.stringify(output)}\n`, 'utf8')
  console.log(
    `[rl] wrote ${OUTPUT} · best ${bestEval.wins}W ${bestEval.losses}L ` +
      `${bestEval.draws}D (${EVAL_BATTLES} battles)`,
  )
  console.log(
    '[rl] To use it: copy the file over policy-weights.json, then run the arena.',
  )
}

main()
