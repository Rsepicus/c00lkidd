import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importLlmEnv, llmAiEnabled } from './llm-ai'
import { collectLlmExamples } from './policy-collect'

/**
 * Collects GPT-OSS / OpenRouter decisions for policy training.
 *
 * Run on a machine that can reach the provider:
 *   POLICY_LLM_CALLS=300 bun policy-collect-llm.ts
 *   POLICY_DATASET=policy-dataset.jsonl POLICY_EPOCHS=12 bun policy-train.ts
 *
 * The output is JSONL; no API keys or Discord data are written to it.
 */

const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env')
const envContents = existsSync(envPath) ? readFileSync(envPath, 'utf8') : null
importLlmEnv(envContents)
if (process.env.POLICY_LLM_ALLOW_LOCAL !== '1') {
  process.env.LOCAL_LLM_ENABLED = '0'
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

async function main(): Promise<void> {
  if (!MOCK && !llmAiEnabled()) {
    throw new Error(
      'No LLM keys found. Put GROQ_API_KEYS/GROQ_API_KEY or OPENROUTER_API_KEY ' +
        'in .env or the environment, or run POLICY_LLM_MOCK=1 to test the pipeline.',
    )
  }
  console.log(
    `[collect] battles ${BATTLES}, max calls ${MAX_CALLS}, mock ${MOCK ? 'yes' : 'no'}`,
  )
  const result = await collectLlmExamples({
    battles: BATTLES,
    maxCalls: MAX_CALLS,
    maxTurns: MAX_TURNS,
    seed: SEED,
    mock: MOCK,
    onProgress: (attempts, maxCalls, examples) => {
      if (attempts % 10 === 0 || examples % 25 === 0) {
        console.log(
          `[collect] attempts ${attempts}/${maxCalls} · examples ${examples}`,
        )
      }
    },
  })
  if (result.examples.length === 0) {
    throw new Error(
      `No examples collected after ${result.attempts} attempts. ` +
        'Check provider keys/network; Groq 403 usually means the key or region is blocked.',
    )
  }
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(
    OUTPUT,
    result.examples.map(example => JSON.stringify(example)).join('\n') + '\n',
    'utf8',
  )
  console.log(
    `[collect] wrote ${OUTPUT}: ${result.examples.length} examples from ` +
      `${result.attempts} attempts (${result.skipped} without a matching candidate)`,
  )
  for (const [label, count] of Object.entries(result.models)) {
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
