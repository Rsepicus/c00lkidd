import type { BotDecision } from './ai'
import { specialDescription } from './names'
import {
  canUseSpecialNow,
  cooldownAfterTick,
  specialNeedsAllyTarget,
  specialNeedsEnemyTarget,
  specialOf,
  type Battle,
  type Side,
} from './pvp'

/**
 * Optional OpenRouter-backed combat brain for automated sides.
 *
 * The heuristic in ai.ts stays the source of truth: the LLM only decides when
 * a free model answers quickly with a legal action. Any failure, timeout or
 * rate limit falls back to the heuristic, so battles never stall.
 */

const COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODELS_URL = 'https://openrouter.ai/api/v1/models'
const APP_HEADERS = {
  'HTTP-Referer': 'https://github.com/Rsepicus/c00lkidd',
  'X-Title': 'Forsaken Simulator',
  'User-Agent': 'ForsakenSimulator/1.0',
}
const DEFAULT_TIMEOUT_MS = 3000
const MAX_CONCURRENT = 2
const PAUSE_RATE_LIMIT_MS = 5 * 60_000
const PAUSE_AUTH_MS = 15 * 60_000
const PAUSE_ERROR_MS = 60_000
const PAUSE_NETWORK_MS = 30_000

// Chat models first: reasoning models are slow enough to be useless in a turn.
const PREFERRED_FREE_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
]

const SYSTEM_PROMPT = [
  'You are the combat AI of a turn-based Discord game.',
  'Choose the strongest legal action for the side you control.',
  'Rules:',
  '- attack deals attack + 0..4 damage to one living enemy.',
  '- special uses the chosen ability and is legal only when marked READY.',
  '- juke sets a +60% dodge stance against the next incoming attack.',
  '- rest heals about 10 HP and clears Hemorrhage.',
  '- Fake units are decoys: avoid them while real targets exist.',
  '- Prefer lethal damage, healing a low ally, or blocking a big incoming hit.',
  'Return ONLY one JSON object and nothing else:',
  '{"action":"attack|special|juke|rest","specialIndex":0,"target":<side id>}',
  'Omit target when the action needs none.',
].join('\n')

let inFlight = 0
let pausedUntil = 0
let discoveryBlockedUntil = 0
let cachedModel: string | null = null
let resolvePromise: Promise<string | null> | null = null

export function llmAiEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

function llmScope(): 'all' | 'boss' {
  return process.env.OPENROUTER_SCOPE === 'boss' ? 'boss' : 'all'
}

function timeoutMs(): number {
  const configured = Number(process.env.OPENROUTER_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS
}

function pause(reason: string, ms: number): void {
  pausedUntil = Math.max(pausedUntil, Date.now() + ms)
  console.warn(`[bot] LLM AI на паузе (${reason}); ходы считает эвристика.`)
}

async function discoverFreeModel(): Promise<string | null> {
  if (Date.now() < discoveryBlockedUntil) return null
  try {
    const response = await fetch(MODELS_URL, {
      headers: APP_HEADERS,
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) {
      discoveryBlockedUntil = Date.now() + PAUSE_ERROR_MS
      return null
    }
    const payload = (await response.json()) as {
      data?: Array<{
        id?: string
        pricing?: { prompt?: string; completion?: string }
      }>
    }
    const freeIds = (payload.data ?? [])
      .filter(row => typeof row.id === 'string' && row.id.endsWith(':free'))
      .filter(row => !/(embed|whisper|tts|rerank|moderation|image)/i.test(row.id as string))
      .filter(row => {
        const prompt = Number(row.pricing?.prompt)
        const completion = Number(row.pricing?.completion)
        return (!Number.isFinite(prompt) || prompt === 0) &&
          (!Number.isFinite(completion) || completion === 0)
      })
      .map(row => row.id as string)
    for (const preferred of PREFERRED_FREE_MODELS) {
      if (freeIds.includes(preferred)) return preferred
    }
    const chatty = freeIds.filter(id => /(instruct|chat)/i.test(id))
    const model = (chatty.length > 0 ? chatty : freeIds).sort()[0] ?? null
    if (!model) discoveryBlockedUntil = Date.now() + 10 * 60_000
    return model
  } catch {
    discoveryBlockedUntil = Date.now() + PAUSE_NETWORK_MS
    return null
  }
}

async function resolveModel(): Promise<string | null> {
  const configured = process.env.OPENROUTER_MODEL?.trim()
  if (configured) return configured
  if (cachedModel) return cachedModel
  if (resolvePromise) return resolvePromise
  resolvePromise = (async () => {
    const model = await discoverFreeModel()
    if (model) cachedModel = model
    return model
  })()
  try {
    return await resolvePromise
  } finally {
    resolvePromise = null
  }
}

/** Fetches the free model list once so the first battle turn is not delayed. */
export async function warmLlmModel(): Promise<void> {
  if (!llmAiEnabled()) return
  const model = await resolveModel()
  if (model) console.log(`[bot] LLM AI: модель ${model}`)
  else console.warn('[bot] LLM AI: бесплатная модель OpenRouter не найдена, работает эвристика.')
}

function describeSide(side: Side, withCooldowns = false): string {
  const bits = [
    `#${side.id} ${side.character.name}`,
    `HP ${side.hp}/${side.maxHp}`,
    `ATK ${side.character.attack}`,
  ]
  if (side.fake) bits.push('FAKE DECOY')
  if (side.minion) {
    bits.push(side.structure ?? (side.pizzaMinion ? 'pizza minion' : 'minion'))
  }
  if (side.shield > 0) bits.push(`shield ${side.shield}%`)
  if (side.tempHp > 0) bits.push(`temp HP ${side.tempHp}`)
  if (side.juking) bits.push('dodge stance')
  if (side.dodging) bits.push('next attack misses')
  if (side.counterReady) bits.push('counter ready')
  if (side.empoweredAttack) bits.push('empowered attack')
  if (side.charge > 0) bits.push(`charge ${side.charge}`)
  if (withCooldowns) {
    if (side.cooldown > 0) bits.push(`ability cd ${side.cooldown}`)
    if (side.secondCooldown > 0) bits.push(`ability2 cd ${side.secondCooldown}`)
  }
  const statuses = Object.entries(side.effects)
    .filter(([, turns]) => (turns ?? 0) > 0)
    .map(([name, turns]) => `${name.toUpperCase()}(${turns})`)
  if (statuses.length > 0) bits.push(statuses.join(' '))
  return bits.join(' · ')
}

function abilityLines(side: Side): string[] {
  const slots = side.boss && side.character.alternates?.[0] ? [0, 1] : [0]
  return slots.map(index => {
    const special = specialOf(side, index)
    const ready = canUseSpecialNow(side, index)
    const state = ready ? 'READY' : `cooldown ${cooldownAfterTick(side, index)}`
    const target = specialNeedsEnemyTarget(side, index)
      ? 'needs an enemy target'
      : specialNeedsAllyTarget(side, index)
        ? 'needs an ally target (may be self)'
        : 'no target'
    return `- special ${index}: ${special.name} | ${state} | ${target} | ${specialDescription(special, 'en')}`
  })
}

export function buildLlmPrompt(battle: Battle): string {
  const side = battle.sides[battle.turn]
  if (!side) return ''
  const allies = battle.sides.filter(
    member => member.team === side.team && member.id !== side.id && member.hp > 0,
  )
  const enemies = battle.sides.filter(
    member => member.team !== side.team && member.hp > 0,
  )
  const lines = [
    `Turn ${battle.clock}. You control ${describeSide(side, true)}.`,
    '',
    'YOUR ABILITIES:',
    ...abilityLines(side),
    '',
    'YOUR ALLIES:',
    ...(allies.length > 0 ? allies.map(ally => describeSide(ally, true)) : ['none']),
    '',
    'ENEMIES:',
    ...(enemies.length > 0 ? enemies.map(enemy => describeSide(enemy)) : ['none']),
    '',
    'LEGAL ACTIONS:',
  ]
  if (enemies.length > 0) {
    lines.push(`- attack: pick one enemy target from [${enemies.map(enemy => `#${enemy.id}`).join(', ')}]`)
  }
  lines.push('- special: only from the READY abilities above')
  lines.push('- juke: no target')
  lines.push('- rest: no target')
  return lines.join('\n')
}

function sideIndex(value: unknown): number | undefined {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN
  return Number.isInteger(numeric) ? numeric : undefined
}

function isLivingEnemy(battle: Battle, side: Side, index: number): boolean {
  const candidate = battle.sides[index]
  return Boolean(candidate && candidate.team !== side.team && candidate.hp > 0)
}

function isLivingAlly(battle: Battle, side: Side, index: number): boolean {
  const candidate = battle.sides[index]
  return Boolean(candidate && candidate.team === side.team && candidate.hp > 0)
}

/** Validates a model answer against the same rules the human buttons use. */
export function parseLlmDecision(raw: string, battle: Battle): BotDecision | null {
  const side = battle.sides[battle.turn]
  if (!side) return null
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }

  const action = typeof payload.action === 'string' ? payload.action.trim().toLowerCase() : ''
  if (action !== 'attack' && action !== 'special' && action !== 'juke' && action !== 'rest') {
    return null
  }

  if (action === 'juke' || action === 'rest') {
    return { action, specialIndex: 0 }
  }

  if (action === 'attack') {
    const target = sideIndex(payload.target ?? payload.targetIndex)
    if (target !== undefined && !isLivingEnemy(battle, side, target)) return null
    return { action, specialIndex: 0, targetIndex: target }
  }

  const specialIndex = sideIndex(payload.specialIndex) ?? 0
  if (specialIndex !== 0 && !(specialIndex === 1 && side.boss)) return null
  if (!canUseSpecialNow(side, specialIndex)) return null
  const target = sideIndex(payload.target ?? payload.targetIndex)
  if (specialNeedsEnemyTarget(side, specialIndex)) {
    if (target !== undefined && !isLivingEnemy(battle, side, target)) return null
    return { action, specialIndex, targetIndex: target }
  }
  if (specialNeedsAllyTarget(side, specialIndex)) {
    if (target !== undefined && !isLivingAlly(battle, side, target)) return null
    return { action, specialIndex, targetIndex: target }
  }
  return { action, specialIndex }
}

export async function chooseLlmTurn(battle: Battle): Promise<BotDecision | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) return null
  if (Date.now() < pausedUntil) return null
  if (inFlight >= MAX_CONCURRENT) return null
  const side = battle.sides[battle.turn]
  if (!side || battle.finished) return null
  if (side.minion || side.fake) return null
  if (side.stunned) return null
  if (llmScope() === 'boss' && !side.boss) return null
  const model = await resolveModel()
  if (!model) return null

  inFlight += 1
  try {
    const prompt = buildLlmPrompt(battle)
    const response = await fetch(COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        ...APP_HEADERS,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 160)
      if (response.status === 401 || response.status === 403 || response.status === 402) {
        pause(`${response.status} ${detail}`, PAUSE_AUTH_MS)
      } else if (response.status === 429) {
        pause(`429 ${detail}`, PAUSE_RATE_LIMIT_MS)
      } else {
        if (response.status === 404) cachedModel = null
        pause(`${response.status} ${detail}`, PAUSE_ERROR_MS)
      }
      return null
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    return typeof content === 'string' ? parseLlmDecision(content, battle) : null
  } catch (error) {
    const name = error instanceof Error ? error.name : 'network error'
    pause(name, PAUSE_NETWORK_MS)
    return null
  } finally {
    inFlight -= 1
  }
}
