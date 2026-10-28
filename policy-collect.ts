import {
  chooseBossAction,
  chooseBotTurn,
  hybridizeDecision,
} from './ai'
import { buildLocalCandidates, chooseLlmTurn, type LlmTurn } from './llm-ai'
import { candidateFeatures } from './policy'
import { makeRng, randomBattle, sameDecision } from './policy-sim'
import { takeTurn, type Battle } from './pvp'

export type PolicyDatasetExample = {
  xs: number[][]
  y: number
  provider: string
  model: string
}

export type CollectOptions = {
  battles?: number
  maxCalls?: number
  maxTurns?: number
  seed?: number
  mock?: boolean
  onProgress?: (attempts: number, maxCalls: number, examples: number) => void
}

export type CollectResult = {
  examples: PolicyDatasetExample[]
  attempts: number
  skipped: number
  models: Record<string, number>
  stopped: boolean
}

type TeacherTurn = {
  decision: LlmTurn['decision']
  provider: string
  model: string
}

function heuristicDecision(battle: Battle, rng: () => number): LlmTurn['decision'] {
  const side = battle.sides[battle.turn]
  const raw = side.boss
    ? chooseBossAction(battle, rng)
    : chooseBotTurn(battle, rng)
  return hybridizeDecision(battle, raw).decision
}

function mockTurn(battle: Battle, rng: () => number): TeacherTurn {
  return {
    decision: heuristicDecision(battle, rng),
    provider: 'Mock',
    model: 'hybrid',
  }
}

/** Collects GPT-OSS/OpenRouter decisions and maps them to policy candidates. */
export async function collectLlmExamples(
  options: CollectOptions = {},
): Promise<CollectResult> {
  const battles = options.battles ?? 120
  const maxCalls = options.maxCalls ?? 150
  const maxTurns = options.maxTurns ?? 35
  const rng = makeRng(options.seed ?? 0xc011ec7)
  const examples: PolicyDatasetExample[] = []
  const models = new Map<string, number>()
  let attempts = 0
  let failures = 0
  let skipped = 0
  let stop = false

  for (let battleIndex = 0; battleIndex < battles && !stop; battleIndex++) {
    const llmTeam = rng() < 0.5 ? 0 : 1
    let battle = randomBattle(rng, { bossChance: 0, twoVTwoChance: 0.3 })
    const recent: string[] = []
    let guard = 0

    while (!battle.finished && !stop && battle.clock < maxTurns && guard++ < 120) {
      const side = battle.sides[battle.turn]
      if (!side || side.hp <= 0 || side.minion || side.fake) break
      let decision: LlmTurn['decision']
      if (side.team === llmTeam) {
        attempts += 1
        const turn = options.mock
          ? mockTurn(battle, rng)
          : await chooseLlmTurn(battle, recent.slice(-6), {
              ignoreScope: true,
              providers: ['groq', 'openrouter'],
            })
        if (turn) {
          failures = 0
          decision = turn.decision
          const candidates = buildLocalCandidates(battle, 100)
          const chosen = candidates.findIndex(candidate =>
            sameDecision(candidate.decision, turn.decision),
          )
          if (chosen >= 0) {
            examples.push({
              xs: candidates.map(candidate =>
                candidateFeatures(battle, side, candidate),
              ),
              y: chosen,
              provider: turn.provider,
              model: turn.model,
            })
            const label = `${turn.provider} ${turn.model}`
            models.set(label, (models.get(label) ?? 0) + 1)
          } else {
            skipped += 1
          }
          options.onProgress?.(attempts, maxCalls, examples.length)
        } else {
          failures += 1
          decision = heuristicDecision(battle, rng)
          if (failures >= 5) {
            stop = true
          }
          options.onProgress?.(attempts, maxCalls, examples.length)
        }
      } else {
        decision = heuristicDecision(battle, rng)
      }
      if (attempts >= maxCalls) stop = true
      if (!decision) break

      const result = takeTurn(
        battle,
        decision.action,
        rng,
        decision.targetIndex,
        decision.specialIndex,
      )
      battle = result.battle
      recent.push(...result.events)
      if (recent.length > 20) recent.splice(0, recent.length - 20)
    }
  }

  return {
    examples,
    attempts,
    skipped,
    models: Object.fromEntries(models),
    stopped: stop,
  }
}
