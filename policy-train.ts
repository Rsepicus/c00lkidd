import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  chooseBossAction,
  chooseBotTurn,
  hybridizeDecision,
  type BotDecision,
} from './ai'
import { CHARACTERS, type Character } from './forsaken'
import { buildLocalCandidates } from './llm-ai'
import {
  candidateFeatures,
  POLICY_FEATURE_COUNT,
  scoreFeatures,
  type PolicyWeights,
} from './policy'
import {
  createBattle,
  createTeamBattle,
  takeTurn,
  type Battle,
  type FighterEntry,
} from './pvp'

/**
 * Offline behavior-cloning trainer for policy.ts.
 *
 * Run with `bun policy-train.ts` on a PC. It plays random battles with the
 * heuristic as the teacher, records the chosen legal candidate, and trains a
 * one-hidden-layer MLP with listwise softmax. The bot host only receives the
 * resulting policy-weights.json.
 */

const BATTLES = Number(process.env.POLICY_BATTLES) || 1200
const EPOCHS = Number(process.env.POLICY_EPOCHS) || 6
const HIDDEN = Number(process.env.POLICY_HIDDEN) || 16
const LEARNING_RATE = Number(process.env.POLICY_LR) || 0.025
const L2 = 0.00001
const MAX_TURNS = 40
const SEED = Number(process.env.POLICY_SEED) || 0x5eed1234
const TEACHER = process.env.POLICY_TEACHER === 'hybrid' ? 'hybrid' : 'heuristic'

type Example = {
  xs: number[][]
  y: number
}

type Weights = {
  w1: number[]
  b1: number[]
  w2: number[]
  b2: number
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function pick<T>(values: readonly T[], rng: () => number): T {
  return values[Math.floor(rng() * values.length)]!
}

function randomCharacter(rng: () => number): Character {
  return pick(CHARACTERS, rng)
}

function entry(
  userId: string,
  name: string,
  character: Character,
  boss = false,
): FighterEntry {
  return { userId, name, character, boss }
}

function randomBattle(rng: () => number): Battle {
  const teamSize = rng() < 0.7 ? 1 : 2
  const bossFight = rng() < 0.18
  const makeTeam = (userId: string, name: string): FighterEntry[] =>
    Array.from({ length: teamSize }, (_, index) =>
      entry(
        userId,
        name,
        randomCharacter(rng),
        bossFight && userId === 'b' && index === 0,
      ),
    )
  const left = makeTeam('a', 'A')
  const right = makeTeam('b', 'B')
  return teamSize === 2
    ? createTeamBattle(left, right)
    : createBattle(left[0]!, right[0]!)
}

function sameDecision(left: BotDecision, right: BotDecision): boolean {
  return (
    left.action === right.action &&
    (left.specialIndex ?? 0) === (right.specialIndex ?? 0) &&
    (left.targetIndex ?? -1) === (right.targetIndex ?? -1)
  )
}

function generateExamples(rng: () => number): Example[] {
  const examples: Example[] = []
  let turns = 0
  let skipped = 0
  for (let battleIndex = 0; battleIndex < BATTLES; battleIndex++) {
    let battle = randomBattle(rng)
    let guard = 0
    while (!battle.finished && battle.clock < MAX_TURNS && guard++ < 120) {
      const side = battle.sides[battle.turn]
      if (!side || side.hp <= 0 || side.minion || side.fake) break
      const rawTeacher = side.boss
        ? chooseBossAction(battle, rng)
        : chooseBotTurn(battle, rng)
      const teacher =
        TEACHER === 'hybrid'
          ? hybridizeDecision(battle, rawTeacher).decision
          : rawTeacher
      const candidates = buildLocalCandidates(battle, 100)
      if (candidates.length >= 2) {
        const chosen = candidates.findIndex(candidate =>
          sameDecision(candidate.decision, teacher),
        )
        if (chosen >= 0) {
          examples.push({
            xs: candidates.map(candidate =>
              candidateFeatures(battle, side, candidate),
            ),
            y: chosen,
          })
          turns += 1
        } else {
          skipped += 1
        }
      }
      const result = takeTurn(
        battle,
        teacher.action,
        rng,
        teacher.targetIndex,
        teacher.specialIndex,
      )
      battle = result.battle
    }
    if ((battleIndex + 1) % Math.max(1, Math.floor(BATTLES / 10)) === 0) {
      console.log(
        `[train] battles ${battleIndex + 1}/${BATTLES} · examples ${examples.length}`,
      )
    }
  }
  console.log(
    `[train] collected ${examples.length} decisions (${turns} turns, ${skipped} without a matching candidate)`,
  )
  return examples
}

function zeroes(length: number): number[] {
  return Array.from({ length }, () => 0)
}

function initWeights(rng: () => number): Weights {
  const w1 = Array.from(
    { length: HIDDEN * POLICY_FEATURE_COUNT },
    () => (rng() * 2 - 1) * 0.1,
  )
  const w2 = Array.from({ length: HIDDEN }, () => (rng() * 2 - 1) * 0.1)
  return { w1, b1: zeroes(HIDDEN), w2, b2: 0 }
}

function toWeights(weights: Weights): PolicyWeights {
  return {
    version: 1,
    features: POLICY_FEATURE_COUNT,
    hidden: HIDDEN,
    w1: weights.w1,
    b1: weights.b1,
    w2: weights.w2,
    b2: weights.b2,
  }
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores)
  const exps = scores.map(score => Math.exp(score - max))
  const sum = exps.reduce((total, value) => total + value, 0) || 1
  return exps.map(value => value / sum)
}

function evaluate(weights: Weights, examples: Example[]): { loss: number; accuracy: number } {
  let loss = 0
  let correct = 0
  const model = toWeights(weights)
  for (const example of examples) {
    const scores = example.xs.map(x => scoreFeatures(model, x))
    const probs = softmax(scores)
    loss -= Math.log(Math.max(1e-9, probs[example.y] ?? 0))
    const best = scores.indexOf(Math.max(...scores))
    if (best === example.y) correct += 1
  }
  return {
    loss: examples.length > 0 ? loss / examples.length : 0,
    accuracy: examples.length > 0 ? correct / examples.length : 0,
  }
}

function trainStep(weights: Weights, example: Example, rate: number): void {
  const hiddenValues: number[][] = []
  const scores: number[] = []
  for (const x of example.xs) {
    const hidden = zeroes(HIDDEN)
    let score = weights.b2
    for (let unit = 0; unit < HIDDEN; unit++) {
      let value = weights.b1[unit]!
      const offset = unit * POLICY_FEATURE_COUNT
      for (let feature = 0; feature < POLICY_FEATURE_COUNT; feature++) {
        value += weights.w1[offset + feature]! * x[feature]!
      }
      const activated = Math.tanh(value)
      hidden[unit] = activated
      score += weights.w2[unit]! * activated
    }
    hiddenValues.push(hidden)
    scores.push(score)
  }

  const probs = softmax(scores)
  const dw1 = zeroes(HIDDEN * POLICY_FEATURE_COUNT)
  const db1 = zeroes(HIDDEN)
  const dw2 = zeroes(HIDDEN)
  let db2 = 0

  for (let candidate = 0; candidate < example.xs.length; candidate++) {
    const dScore = probs[candidate]! - (candidate === example.y ? 1 : 0)
    if (dScore === 0) continue
    const x = example.xs[candidate]!
    const hidden = hiddenValues[candidate]!
    db2 += dScore
    for (let unit = 0; unit < HIDDEN; unit++) {
      dw2[unit] += dScore * hidden[unit]!
      const dz = dScore * weights.w2[unit]! * (1 - hidden[unit]! * hidden[unit]!)
      db1[unit] += dz
      const offset = unit * POLICY_FEATURE_COUNT
      for (let feature = 0; feature < POLICY_FEATURE_COUNT; feature++) {
        dw1[offset + feature] += dz * x[feature]!
      }
    }
  }

  for (let index = 0; index < weights.w1.length; index++) {
    const value = weights.w1[index]!
    weights.w1[index] = value - rate * (dw1[index]! + L2 * value)
  }
  for (let index = 0; index < weights.b1.length; index++) {
    weights.b1[index] = weights.b1[index]! - rate * db1[index]!
  }
  for (let index = 0; index < weights.w2.length; index++) {
    const value = weights.w2[index]!
    weights.w2[index] = value - rate * (dw2[index]! + L2 * value)
  }
  weights.b2 -= rate * db2
}

function main(): void {
  const rng = mulberry32(SEED)
  console.log(
    `[train] generating data: ${BATTLES} battles, hidden ${HIDDEN}, ${EPOCHS} epochs`,
  )
  const examples = generateExamples(rng)
  if (examples.length === 0) throw new Error('No training examples collected.')

  const shuffled = [...examples]
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1))
    ;[shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!]
  }
  const validationSize = Math.max(1, Math.floor(shuffled.length * 0.1))
  const validation = shuffled.slice(0, validationSize)
  const training = shuffled.slice(validationSize)

  const weights = initWeights(rng)
  let best = {
    weights: { ...weights, w1: [...weights.w1], b1: [...weights.b1], w2: [...weights.w2] },
    loss: Number.POSITIVE_INFINITY,
    accuracy: 0,
  }

  for (let epoch = 1; epoch <= EPOCHS; epoch++) {
    for (let index = training.length - 1; index > 0; index--) {
      const swap = Math.floor(rng() * (index + 1))
      ;[training[index], training[swap]] = [training[swap]!, training[index]!]
    }
    for (const example of training) {
      trainStep(weights, example, LEARNING_RATE)
    }
    const result = evaluate(weights, validation)
    console.log(
      `[train] epoch ${epoch}/${EPOCHS}: val loss ${result.loss.toFixed(4)}, ` +
        `agreement ${(result.accuracy * 100).toFixed(1)}%`,
    )
    if (result.loss < best.loss) {
      best = {
        weights: {
          ...weights,
          w1: [...weights.w1],
          b1: [...weights.b1],
          w2: [...weights.w2],
        },
        loss: result.loss,
        accuracy: result.accuracy,
      }
    }
  }

  const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
  const output: PolicyWeights = {
    ...toWeights(best.weights),
    w1: best.weights.w1.map(round),
    b1: best.weights.b1.map(round),
    w2: best.weights.w2.map(round),
    b2: round(best.weights.b2),
    meta: {
      trainedAt: new Date().toISOString(),
      examples: examples.length,
      accuracy: Math.round(best.accuracy * 10_000) / 10_000,
      teacher: TEACHER,
    },
  }
  const path = fileURLToPath(new URL('./policy-weights.json', import.meta.url))
  writeFileSync(path, `${JSON.stringify(output)}\n`, 'utf8')
  console.log(
    `[train] wrote ${path} (${examples.length} examples, ` +
      `validation agreement ${(best.accuracy * 100).toFixed(1)}%)`,
  )
}

main()
