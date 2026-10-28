import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  chooseBossAction,
  chooseBotTurn,
  hybridizeDecision,
} from './ai'
import {
  buildLocalCandidates,
  chooseLlmTurn,
  importLlmEnv,
  llmAiEnabled,
  type LlmTurn,
} from './llm-ai'
import {
  candidateFeatures,
  POLICY_FEATURE_COUNT,
} from './policy'
import { makeRng, randomBattle, sameDecision } from './policy-sim'
import { takeTurn } from './pvp'

/**
 * Collects GPT-OSS / OpenRouter decisions for policy training.
 *
 * Run on a machine that has GROQ_API_KEY(S) or OPENROUTER_API_KEY in .env or
 * the environment:
 *   POLICY_LLM_CALLS=300 bun policy-collect-llm.ts
 *   POLICY_DATASET=policy-dataset.jsonl POLICY_EPOCHS=12 bun policy-train.ts
 *
 * The output is JSONL; no API keys or Discord data are written to it.
 */

const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env')
const envContents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null
importLlmEnv(envContents)
// The collector is for a strong remote teacher, not the tiny local model.
if (process.env.POLICY_LLM_ALLOW_LOCAL !== '1') {
  process.env.LOCAL_LLM_ENABLED = '0'
}
if (!process.env.LLM_PROVIDER_ORDER?.trim()) {
  process.env.LLM_PROVIDER_ORDER = 'groq,openrouter'
}
// Keep raw model choices unless the caller explicitly wants hybrid labels.
if (process.env.POLICY_LLM_HYBRID !== '1') {
  process.env.LLM_HYBRID = '0'
}

const BATTLES = Number(process.env.POLICY_LLM_BATTLES) || 120
const MAX_CALLS = Number(process.env.POLICY_LLM_CALLS) || 150
const MAX_TURNS = Number(process.env.POLICY_LLM_MAX_TURNS) || 35
const OUTPUT = process.env.POLICY_LLM_DATASET?.trim() || 'policy-dataset.jsonl'
const MOCK = process.env.POLICY_LLM_MOCK === '1'
const SEED = Number(process.env.POLICY_LLM_SEED) || 0xc011ec7

type Example = {
  xs: number[][]
  y: number
  provider: string
  model: string
}

type TeacherTurn = {
  decision: LlmTurn['decision']
  provider: string
  model: string
}

function heuristicDecision(battle: Parameters<typeof takeTurn>[0], rng: () => number) {
  const side = battle.sides[battle.turn]
  const raw = side.boss
    ? chooseBossAction(battle, rng)
    : chooseBotTurn(battle, rng)
  return hybridizeDecision(battle, raw).decision
}

function mockTurn(
  battle: Parameters<typeof takeTurn>[0],
  rng: () => number,
): TeacherTurn {
  return {
    decision: heuristicDecision(battle, rng),
    provider: 'Mock',
    model: 'hybrid',
  }
}

async function main(): Promise<void> {
  if (!MOCK && !llmAiEnabled()) {
    throw new Error(
      'No LLM keys found. Put GROQ_API_KEYS/GROQ_API_KEY or OPENROUTER_API_KEY ' +
        'in .env or the environment, or run POLICY_LLM_MOCK=1 to test the pipeline.',
    )
  }

  const rng = makeRng(SEED)
  const examples: Example[] = []
  const models = new Map<string, number>()
  let attempts = 0
  let failures = 0
  let skipped = 0
  let stop = false

  for (let battleIndex = 0; battleIndex < BATTLES && !stop; battleIndex++) {
    const llmTeam = rng() < 0.5 ? 0 : 1
    let battle = randomBattle(rng, { bossChance: 0, twoVTwoChance: 0.3 })
    const recent: string[] = []
    let guard = 0

    while (!battle.finished && battle.clock < MAX_TURNS && guard++ < 120) {
      const side = battle.sides[battle.turn]
      if (!side || side.hp <= 0 || side.minion || side.fake) break
      let decision: LlmTurn['decision']
      if (side.team === llmTeam) {
        attempts += 1
        const turn = MOCK
          ? mockTurn(battle, rng)
          : await chooseLlmTurn(battle, recent.slice(-6), { ignoreScope: true })
        if (turn) {
          failures = 0
          decision = turn.decision
          const candidates = buildLocalCandidates(battle, 100)
          const chosen = candidates.findIndex(candidate =>
            sameDecision(candidate.decision, turn.decision),
          )
          if (chosen >= 0) {
            const xs = candidates.map(candidate =>
              candidateFeatures(battle, side, candidate),
            )
            examples.push({
              xs,
              y: chosen,
              provider: turn.provider,
              model: turn.model,
            })
            const label = `${turn.provider} ${turn.model}`
            models.set(label, (models.get(label) ?? 0) + 1)
          } else {
            skipped += 1
          }
          if (attempts % 10 === 0 || examples.length % 25 === 0) {
            console.log(
              `[collect] attempts ${attempts}/${MAX_CALLS} · examples ${examples.length} · ` +
                `last ${turn.provider} ${turn.model}`,
            )
          }
        } else {
          failures += 1
          decision = heuristicDecision(battle, rng)
          if (failures >= 5) {
            console.warn('[collect] too many LLM failures, stopping.')
            stop = true
          }
        }
      } else {
        decision = heuristicDecision(battle, rng)
      }
      if (attempts >= MAX_CALLS) stop = true
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

  if (examples.length === 0) {
    throw new Error('No examples collected.')
  }
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(
    OUTPUT,
    examples.map(example => JSON.stringify(example)).join('\n') + '\n',
    'utf8',
  )
  console.log(
    `[collect] wrote ${OUTPUT}: ${examples.length} examples from ${attempts} attempts ` +
      `(${skipped} decisions without a matching candidate)`,
  )
  for (const [label, count] of models) {
    console.log(`[collect] ${label}: ${count}`)
  }
  console.log(
    `[collect] train with: POLICY_DATASET=${OUTPUT} POLICY_EPOCHS=12 bun policy-train.ts`,
  )
}

main().catch(error => {
  console.error('[collect]', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
