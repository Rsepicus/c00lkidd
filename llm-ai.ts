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
 * Optional LLM combat brain for automated sides.
 *
 * OpenRouter is tried first, then Groq as a separate free fallback. The
 * heuristic in ai.ts stays the source of truth: the LLM only decides when a
 * provider answers quickly with a legal action. Any failure, timeout or rate
 * limit falls back to the heuristic, so battles never stall.
 */

const DEFAULT_OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const DEFAULT_GROQ_BASE = 'https://api.groq.com/openai/v1'
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
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
const OPENROUTER_DAILY_LIMIT = 'free-models-per-day'

// Chat models first: reasoning and code models are slow or bad at tactics.
const PREFERRED_FREE_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
]
const EXCLUDED_MODEL = /(embed|whisper|tts|rerank|moderation|image|code|coder|math|reason)/i

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

type ProviderId = 'openrouter' | 'groq'

type Provider = {
  id: ProviderId
  label: string
  keys: string[]
  baseUrl: string
  model: () => Promise<string | null>
  headers: Record<string, string>
  /** OpenRouter's free-models-per-day limit can be detected in its 429 body. */
  hasDailyFreeLimit: boolean
}

type RequestResult = { decision: BotDecision | null; failed: boolean }

export type LlmTurn = {
  decision: BotDecision
  provider: string
  model: string
  keyIndex: number
  keyCount: number
}

let inFlight = 0
let discoveryBlockedUntil = 0
let cachedOpenRouterModel: string | null = null
let resolvePromise: Promise<string | null> | null = null
const providerPauses = new Map<ProviderId, number>()
const keyPauses = new Map<string, number>()
const keyRotation = new Map<ProviderId, number>()

/** Accepts comma-, space- or newline-separated keys and drops duplicates. */
export function parseApiKeys(...values: Array<string | undefined>): string[] {
  const keys = values
    .flatMap(value => (value ?? '').split(/[\s,]+/))
    .map(value => value.trim())
    .filter(Boolean)
  return [...new Set(keys)]
}

function openRouterKeys(): string[] {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return key ? [key] : []
}

function groqKeys(): string[] {
  return parseApiKeys(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY)
}

export function llmAiEnabled(): boolean {
  return openRouterKeys().length > 0 || groqKeys().length > 0
}

export function llmDebugEnabled(): boolean {
  const value = process.env.OPENROUTER_DEBUG?.trim().toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

function llmScope(): 'all' | 'boss' {
  return process.env.OPENROUTER_SCOPE === 'boss' ? 'boss' : 'all'
}

function timeoutMs(): number {
  const configured = Number(process.env.OPENROUTER_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS
}

function apiBase(envName: string, fallback: string): string {
  const configured = process.env[envName]?.trim()
  return (configured || fallback).replace(/\/+$/, '')
}

/** Milliseconds until the next UTC midnight, used for a daily free-model cap. */
function msUntilUtcMidnight(now = Date.now()): number {
  const date = new Date(now)
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  return Math.max(60_000, next - now + 60_000)
}

/** How long a provider should stay paused after a failed request. */
export function llmPauseMs(
  status: number,
  body: string,
  hasDailyFreeLimit: boolean,
  now = Date.now(),
): number {
  if (status === 401 || status === 403 || status === 402) return PAUSE_AUTH_MS
  if (status === 429) {
    if (hasDailyFreeLimit && body.includes(OPENROUTER_DAILY_LIMIT)) {
      return msUntilUtcMidnight(now)
    }
    return PAUSE_RATE_LIMIT_MS
  }
  if (status === 0) return PAUSE_NETWORK_MS
  return PAUSE_ERROR_MS
}

function keyStateId(provider: Provider, keyIndex: number): string {
  return `${provider.id}:${keyIndex}`
}

function pauseKey(
  provider: Provider,
  keyIndex: number,
  status: number,
  detail: string,
  now = Date.now(),
): void {
  const keyLabel =
    provider.keys.length > 1 ? `, ключ ${keyIndex + 1}/${provider.keys.length}` : ''
  if (status === 404) {
    if (provider.id === 'openrouter') cachedOpenRouterModel = null
    providerPauses.set(
      provider.id,
      Math.max(providerPauses.get(provider.id) ?? 0, now + PAUSE_ERROR_MS),
    )
    console.warn(
      `[bot] LLM AI (${provider.label}${keyLabel}) на паузе (404 ${detail}); ` +
        'провайдер временно пропускается.',
    )
    return
  }
  const duration = llmPauseMs(status, detail, provider.hasDailyFreeLimit, now)
  const id = keyStateId(provider, keyIndex)
  keyPauses.set(id, Math.max(keyPauses.get(id) ?? 0, now + duration))
  const dailyLimit =
    status === 429 &&
    provider.hasDailyFreeLimit &&
    detail.includes(OPENROUTER_DAILY_LIMIT)
  const reason = dailyLimit
    ? 'дневной лимит бесплатных моделей исчерпан'
    : `${status || 'сеть'} ${detail}`.trim()
  console.warn(
    `[bot] LLM AI (${provider.label}${keyLabel}) на паузе (${reason}); ` +
      'ключ временно пропускается.',
  )
}

async function discoverOpenRouterModel(): Promise<string | null> {
  if (Date.now() < discoveryBlockedUntil) return null
  const baseUrl = apiBase('OPENROUTER_BASE_URL', DEFAULT_OPENROUTER_BASE)
  try {
    const response = await fetch(`${baseUrl}/models`, {
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
      .filter(row => !EXCLUDED_MODEL.test(row.id as string))
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

async function resolveOpenRouterModel(): Promise<string | null> {
  const configured = process.env.OPENROUTER_MODEL?.trim()
  if (configured) return configured
  if (cachedOpenRouterModel) return cachedOpenRouterModel
  if (resolvePromise) return resolvePromise
  resolvePromise = (async () => {
    const model = await discoverOpenRouterModel()
    if (model) cachedOpenRouterModel = model
    return model
  })()
  try {
    return await resolvePromise
  } finally {
    resolvePromise = null
  }
}

function providers(): Provider[] {
  const orKeys = openRouterKeys()
  const gqKeys = groqKeys()
  const list: Provider[] = []
  if (orKeys.length > 0) {
    list.push({
      id: 'openrouter',
      label: 'OpenRouter',
      keys: orKeys,
      baseUrl: apiBase('OPENROUTER_BASE_URL', DEFAULT_OPENROUTER_BASE),
      model: resolveOpenRouterModel,
      headers: APP_HEADERS,
      hasDailyFreeLimit: true,
    })
  }
  if (gqKeys.length > 0) {
    list.push({
      id: 'groq',
      label: 'Groq',
      keys: gqKeys,
      baseUrl: apiBase('GROQ_BASE_URL', DEFAULT_GROQ_BASE),
      model: async () => process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL,
      headers: {},
      hasDailyFreeLimit: false,
    })
  }
  return list
}

/** Fetches model lists once so the first battle turn is not delayed. */
export async function warmLlmModel(): Promise<void> {
  for (const provider of providers()) {
    const model = await provider.model()
    if (model) {
      const keys = provider.keys.length > 1 ? ` (ключей: ${provider.keys.length})` : ''
      console.log(`[bot] LLM AI: ${provider.label} — ${model}${keys}`)
    } else {
      console.warn(
        `[bot] LLM AI: ${provider.label} — модель не найдена, провайдер пропускается.`,
      )
    }
  }
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
    const ids = enemies.map(enemy => `#${enemy.id}`).join(', ')
    lines.push(`- attack: pick one enemy target from [${ids}]`)
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

async function requestDecision(
  provider: Provider,
  key: string,
  keyIndex: number,
  model: string,
  battle: Battle,
): Promise<RequestResult> {
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...provider.headers,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildLlmPrompt(battle) },
        ],
        temperature: 0.2,
        max_tokens: 80,
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 160)
      pauseKey(provider, keyIndex, response.status, detail)
      return { decision: null, failed: true }
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') return { decision: null, failed: true }
    const decision = parseLlmDecision(content, battle)
    if (!decision && llmDebugEnabled()) {
      const keyLabel = provider.keys.length > 1 ? `, ключ ${keyIndex + 1}` : ''
      console.warn(
        `[bot] LLM AI (${provider.label}${keyLabel}) вернул невалидный ответ: ` +
          content.slice(0, 120),
      )
    }
    return { decision, failed: false }
  } catch (error) {
    const name = error instanceof Error ? error.name : 'network error'
    pauseKey(provider, keyIndex, 0, name)
    return { decision: null, failed: true }
  }
}

export async function chooseLlmTurn(battle: Battle): Promise<LlmTurn | null> {
  const side = battle.sides[battle.turn]
  if (!side || battle.finished || side.hp <= 0) return null
  if (side.minion || side.fake) return null
  if (side.stunned) return null
  if (llmScope() === 'boss' && !side.boss) return null
  const list = providers()
  if (list.length === 0) return null
  if (inFlight >= MAX_CONCURRENT) return null

  let attempts = 0
  for (const provider of list) {
    if (inFlight >= MAX_CONCURRENT || attempts >= 2) break
    if (Date.now() < (providerPauses.get(provider.id) ?? 0)) continue
    const model = await provider.model()
    // No model means this provider cannot answer; try the next one.
    if (!model) continue
    const available = provider.keys
      .map((key, index) => ({ key, index }))
      .filter(
        ({ index }) =>
          Date.now() >= (keyPauses.get(keyStateId(provider, index)) ?? 0),
      )
    if (available.length === 0) continue
    const rotation = keyRotation.get(provider.id) ?? 0
    const start = rotation % available.length
    const ordered = [...available.slice(start), ...available.slice(0, start)]
    let used = 0
    for (const candidate of ordered) {
      if (attempts >= 2 || inFlight >= MAX_CONCURRENT) break
      attempts += 1
      used += 1
      keyRotation.set(provider.id, rotation + used)
      inFlight += 1
      try {
        const result = await requestDecision(
          provider,
          candidate.key,
          candidate.index,
          model,
          battle,
        )
        if (result.decision) {
          return {
            decision: result.decision,
            provider: provider.label,
            model,
            keyIndex: candidate.index,
            keyCount: provider.keys.length,
          }
        }
        // A valid provider response with an unusable answer: do not spend a
        // second key or provider's quota on the same turn.
        if (!result.failed) return null
      } finally {
        inFlight -= 1
      }
    }
  }
  return null
}
