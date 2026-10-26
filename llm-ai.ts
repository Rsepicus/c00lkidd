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
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b'
const APP_HEADERS = {
  'HTTP-Referer': 'https://github.com/Rsepicus/c00lkidd',
  'X-Title': 'Forsaken Simulator',
  'User-Agent': 'ForsakenSimulator/1.0',
}
const DEFAULT_TIMEOUT_MS = 4000
const MAX_CONCURRENT = 2
const PAUSE_RATE_LIMIT_MS = 5 * 60_000
const PAUSE_AUTH_MS = 15 * 60_000
const PAUSE_ERROR_MS = 60_000
const PAUSE_NETWORK_MS = 30_000
const OPENROUTER_DAILY_LIMIT = 'free-models-per-day'
const GROQ_DAILY_LIMIT = /(tokens per day|requests per day|\bTPD\b|\bRPD\b)/i

// Chat models first: reasoning and code models are slow or bad at tactics.
const PREFERRED_FREE_MODELS = [
  'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
]
// Groq retires models regularly, so the list is only a preference order; the
// actual model is resolved from GET /models with the account's key.
const PREFERRED_GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
]
const EXCLUDED_MODEL =
  /(embed|whisper|tts|rerank|moderation|guard|safety|image|code|coder|math|reason|deepseek-r1|qwq|compound)/i
const KNOWN_MODEL_HINT =
  /(llama|qwen|deepseek|mistral|gemini|gpt-oss|glm|kimi|minimax|granite|command|phi)/i

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

export type ProviderId = 'openrouter' | 'groq'

type Provider = {
  id: ProviderId
  label: string
  keys: string[]
  baseUrl: string
  model: () => Promise<string | null>
  headers: Record<string, string>
  /** Whether a daily rate-limit message can appear in this provider's 429 body. */
  hasDailyLimit: boolean
}

type RequestResult = {
  decision: BotDecision | null
  failed: boolean
  /** A model-level failure: try another provider instead of another key. */
  providerFailed?: boolean
}

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
let groqDiscoveryBlockedUntil = 0
let cachedGroqModel: string | null = null
let groqResolvePromise: Promise<string | null> | null = null
const failedGroqModels = new Set<string>()
const providerPauses = new Map<ProviderId, number>()
const keyPauses = new Map<string, number>()
const keyRotation = new Map<ProviderId, number>()
const stats = { model: 0, heuristic: 0, invalid: 0 }

export function llmStats(): { model: number; heuristic: number; invalid: number } {
  return { ...stats }
}

/** Called once per automated turn, whether the model or the fallback answered. */
export function noteLlmTurn(usedModel: boolean): void {
  if (usedModel) stats.model += 1
  else stats.heuristic += 1
}

/** Accepts comma-, space- or newline-separated keys and drops duplicates. */
export function parseApiKeys(...values: Array<string | undefined>): string[] {
  const keys = values
    .flatMap(value =>
      (value ?? '')
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .split(/[\s,]+/),
    )
    .map(value => value.trim().replace(/^(['"])(.*)\1$/, '$2'))
    .filter(Boolean)
  return [...new Set(keys)]
}

function openRouterKeys(): string[] {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return key ? [key] : []
}

function groqKeys(): string[] {
  // Support the documented names plus common numbered variants such as
  // GROQ_API_KEY_1 / GROQ_API_KEY_2.
  const numbered = Object.entries(process.env)
    .filter(([name, value]) => /^GROQ_(?:API_)?KEY_?\d*$/.test(name) && value)
    .map(([, value]) => value)
  return parseApiKeys(
    process.env.GROQ_API_KEYS,
    process.env.GROQ_API_KEY,
    process.env.GROQ_KEYS,
    ...numbered,
  )
}

/**
 * Imports LLM settings from the bot's .env file. Bun normally loads .env, but
 * the bot may run with a different cwd on a panel host; the Discord token is
 * already read manually for the same reason. Existing process env wins.
 */
export function importLlmEnv(contents: string | null): void {
  if (!contents) return
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const name = match[1]
    if (!name.startsWith('OPENROUTER_') && !name.startsWith('GROQ_')) continue
    if (process.env[name] !== undefined) continue
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    if (value) process.env[name] = value
  }
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
  const configured = Number(
    process.env.LLM_TIMEOUT_MS ?? process.env.OPENROUTER_TIMEOUT_MS,
  )
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
  hasDailyLimit: boolean,
  now = Date.now(),
): number {
  if (status === 401 || status === 403 || status === 402) return PAUSE_AUTH_MS
  if (status === 429) {
    if (
      hasDailyLimit &&
      (body.includes(OPENROUTER_DAILY_LIMIT) || GROQ_DAILY_LIMIT.test(body))
    ) {
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
    if (provider.id === 'groq') cachedGroqModel = null
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
  const duration = llmPauseMs(status, detail, provider.hasDailyLimit, now)
  const id = keyStateId(provider, keyIndex)
  keyPauses.set(id, Math.max(keyPauses.get(id) ?? 0, now + duration))
  const dailyLimit =
    status === 429 &&
    provider.hasDailyLimit &&
    (detail.includes(OPENROUTER_DAILY_LIMIT) || GROQ_DAILY_LIMIT.test(detail))
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
    const known = freeIds.filter(id => KNOWN_MODEL_HINT.test(id))
    const chattyKnown = chatty.filter(id => KNOWN_MODEL_HINT.test(id))
    const candidates =
      chattyKnown.length > 0
        ? chattyKnown
        : known.length > 0
          ? known
          : chatty.length > 0
            ? chatty
            : freeIds
    const model = candidates.sort()[0] ?? null
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

export function pickGroqModel(ids: string[]): string | null {
  const usable = ids.filter(id => !EXCLUDED_MODEL.test(id))
  for (const preferred of PREFERRED_GROQ_MODELS) {
    if (usable.includes(preferred)) return preferred
  }
  const chatty = usable.filter(id =>
    /(instruct|versatile|instant|chat|gpt-oss|qwen|llama|kimi|mixtral)/i.test(id),
  )
  return (chatty[0] ?? usable.sort()[0]) ?? null
}

async function discoverGroqModel(): Promise<string | null> {
  if (Date.now() < groqDiscoveryBlockedUntil) return null
  const keys = groqKeys()
  if (keys.length === 0) return null
  const baseUrl = apiBase('GROQ_BASE_URL', DEFAULT_GROQ_BASE)
  let failed = false
  for (const key of keys.slice(0, 5)) {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) {
        failed = true
        continue
      }
      const payload = (await response.json()) as {
        data?: Array<{ id?: string }>
      }
      const ids = (payload.data ?? [])
        .map(row => row.id)
        .filter((id): id is string => typeof id === 'string')
        .filter(id => !failedGroqModels.has(id))
      const model = pickGroqModel(ids)
      if (model) return model
      failed = true
    } catch {
      failed = true
    }
  }
  groqDiscoveryBlockedUntil =
    Date.now() + (failed ? PAUSE_NETWORK_MS : PAUSE_ERROR_MS)
  return null
}

async function resolveGroqModel(): Promise<string | null> {
  const configured = process.env.GROQ_MODEL?.trim()
  if (configured) return configured
  if (cachedGroqModel) return cachedGroqModel
  if (groqResolvePromise) return groqResolvePromise
  groqResolvePromise = (async () => {
    const discovered = await discoverGroqModel()
    // If GET /models is temporarily unavailable, still try the known
    // production model instead of skipping the provider entirely.
    const fallbacks = [DEFAULT_GROQ_MODEL, ...PREFERRED_GROQ_MODELS]
    const model =
      discovered ?? fallbacks.find(id => !failedGroqModels.has(id)) ?? null
    if (model) cachedGroqModel = model
    return model
  })()
  try {
    return await groqResolvePromise
  } finally {
    groqResolvePromise = null
  }
}

export function llmProviderOrder(): ProviderId[] {
  const configured = process.env.LLM_PROVIDER_ORDER?.trim()
  const ids = (configured ? configured.split(',') : ['groq', 'openrouter'])
    .map(value => value.trim().toLowerCase())
    .filter((value): value is ProviderId => value === 'groq' || value === 'openrouter')
  return ids.length > 0 ? [...new Set(ids)] : ['groq', 'openrouter']
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
      hasDailyLimit: true,
    })
  }
  if (gqKeys.length > 0) {
    list.push({
      id: 'groq',
      label: 'Groq',
      keys: gqKeys,
      baseUrl: apiBase('GROQ_BASE_URL', DEFAULT_GROQ_BASE),
      model: resolveGroqModel,
      headers: {},
      hasDailyLimit: true,
    })
  }
  const order = llmProviderOrder()
  list.sort((left, right) => {
    const leftIndex = order.indexOf(left.id)
    const rightIndex = order.indexOf(right.id)
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
  })
  return list
}

/** Whether some provider/key can currently be asked for a turn without waiting for a pause. */
export function llmLikelyAvailable(side: Side): boolean {
  if (!side || side.hp <= 0 || side.minion || side.fake || side.stunned) return false
  if (llmScope() === 'boss' && !side.boss) return false
  const now = Date.now()
  return providers().some(provider => {
    if (now < (providerPauses.get(provider.id) ?? 0)) return false
    return provider.keys.some(
      (_, index) => now >= (keyPauses.get(keyStateId(provider, index)) ?? 0),
    )
  })
}

/** Fetches model lists once so the first battle turn is not delayed. */
export async function warmLlmModel(): Promise<void> {
  const list = providers()
  if (list.length === 0) {
    console.warn(
      '[bot] LLM AI: ключи не заданы (OPENROUTER_API_KEY / GROQ_API_KEY или ' +
        'GROQ_API_KEYS), работает эвристика.',
    )
    return
  }
  const ids = new Set(list.map(provider => provider.id))
  if (!ids.has('openrouter')) console.log('[bot] LLM AI: OpenRouter-ключ не задан.')
  if (!ids.has('groq')) console.log('[bot] LLM AI: Groq-ключи не заданы.')
  for (const provider of list) {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replaces Discord display names with side ids so no identities reach the model. */
function recentLogLines(battle: Battle, events: string[]): string[] {
  if (events.length === 0) return []
  const names = new Map<string, string>()
  for (const side of battle.sides) {
    const name = side.name?.trim()
    if (!name || names.has(name)) continue
    names.set(name, `#${side.id} (${side.character.name})`)
  }
  const ordered = [...names.keys()].sort((left, right) => right.length - left.length)
  const pattern =
    ordered.length > 0
      ? new RegExp(
          `(?<![\\p{L}\\p{N}_])(${ordered.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}_])`,
          'gu',
        )
      : null
  return events.slice(-6).map(line => {
    const clean = pattern
      ? line.replace(pattern, match => names.get(match) ?? match)
      : line
    return clean.length > 160 ? `${clean.slice(0, 157)}…` : clean
  })
}

export function buildLlmPrompt(battle: Battle, recentEvents: string[] = []): string {
  const side = battle.sides[battle.turn]
  if (!side) return ''
  const allies = battle.sides.filter(
    member => member.team === side.team && member.id !== side.id && member.hp > 0,
  )
  const enemies = battle.sides.filter(
    member => member.team !== side.team && member.hp > 0,
  )
  const recent = recentLogLines(battle, recentEvents)
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
    ...(recent.length > 0 ? ['', 'RECENT LOG:', ...recent.map(line => `- ${line}`)] : []),
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

export function buildChatBody(
  providerId: ProviderId,
  model: string,
  battle: Battle,
  recentEvents: string[] = [],
): Record<string, unknown> {
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildLlmPrompt(battle, recentEvents) },
    ],
    temperature: 0.2,
    // Reasoning models spend tokens on hidden thinking before the JSON.
    max_tokens: 512,
  }
  if (providerId === 'groq') {
    if (/gpt-oss/i.test(model)) {
      // gpt-oss cannot disable reasoning; low effort plus headroom avoids an
      // empty content response with finish_reason=length.
      requestBody.reasoning_effort = 'low'
      requestBody.include_reasoning = false
    } else if (/qwen3/i.test(model)) {
      requestBody.reasoning_effort = 'none'
    }
  } else if (/(gpt-oss|qwen3|deepseek-r1)/i.test(model)) {
    requestBody.reasoning = { effort: 'low', exclude: true }
  }
  return requestBody
}

async function requestDecision(
  provider: Provider,
  key: string,
  keyIndex: number,
  model: string,
  battle: Battle,
  recentEvents: string[],
): Promise<RequestResult> {
  try {
    const requestBody = buildChatBody(provider.id, model, battle, recentEvents)
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        ...provider.headers,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs()),
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 160)
      if (response.status === 404 && provider.id === 'groq') {
        failedGroqModels.add(model)
        cachedGroqModel = null
      }
      pauseKey(provider, keyIndex, response.status, detail)
      return {
        decision: null,
        failed: true,
        providerFailed: response.status === 404,
      }
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>
    }
    const content = data.choices?.[0]?.message?.content
    const keyLabel = provider.keys.length > 1 ? `, ключ ${keyIndex + 1}` : ''
    if (typeof content !== 'string' || content.trim() === '') {
      stats.invalid += 1
      if (llmDebugEnabled()) {
        console.warn(
          `[bot] LLM AI (${provider.label}${keyLabel}) вернул пустой ответ ` +
            `(${model}); пробую другого провайдера.`,
        )
      }
      // Other keys use the same model, so another provider is the only useful
      // fallback. Remember a Groq model that returns no content so discovery
      // can pick another one.
      if (provider.id === 'groq') {
        failedGroqModels.add(model)
        cachedGroqModel = null
      }
      return { decision: null, failed: true, providerFailed: true }
    }
    const decision = parseLlmDecision(content, battle)
    if (!decision) stats.invalid += 1
    if (!decision && llmDebugEnabled()) {
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

export async function chooseLlmTurn(
  battle: Battle,
  recentEvents: string[] = [],
): Promise<LlmTurn | null> {
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
          recentEvents,
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
        // A dead model is provider-wide; another key will not fix it.
        if (result.providerFailed) break
      } finally {
        inFlight -= 1
      }
    }
  }
  return null
}
