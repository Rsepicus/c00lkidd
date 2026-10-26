import { afterEach, describe, expect, test } from 'bun:test'
import { characterByName } from './forsaken'
import {
  chooseLlmTurn,
  buildLlmPrompt,
  importLlmEnv,
  llmAiEnabled,
  llmDebugEnabled,
  llmLikelyAvailable,
  llmPauseMs,
  llmProviderOrder,
  parseApiKeys,
  parseLlmDecision,
  pickGroqModel,
} from './llm-ai'
import { createBattle } from './pvp'

function battleWith(left: string, right = 'Noob') {
  return createBattle(
    {
      userId: 'discord-user-1',
      name: 'SecretPlayerName',
      character: characterByName(left)!,
    },
    {
      userId: 'discord-user-2',
      name: 'SecretEnemyName',
      character: characterByName(right)!,
    },
  )
}

const originalKey = process.env.OPENROUTER_API_KEY
const originalGroqKey = process.env.GROQ_API_KEY
const originalGroqKeys = process.env.GROQ_API_KEYS
afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
  if (originalGroqKey === undefined) delete process.env.GROQ_API_KEY
  else process.env.GROQ_API_KEY = originalGroqKey
  if (originalGroqKeys === undefined) delete process.env.GROQ_API_KEYS
  else process.env.GROQ_API_KEYS = originalGroqKeys
})

describe('LLM battle prompt', () => {
  test('describes both sides without leaking Discord identities', () => {
    const battle = battleWith('Guest 1337')
    const prompt = buildLlmPrompt(battle)
    expect(prompt).toContain('#0 Guest 1337')
    expect(prompt).toContain('#1 Noob')
    expect(prompt).toContain('special 0: Block')
    expect(prompt).toContain('attack')
    expect(prompt).not.toContain('discord-user-1')
    expect(prompt).not.toContain('SecretPlayerName')
    expect(prompt).not.toContain('SecretEnemyName')
  })

  test('shows own cooldowns but hides enemy cooldowns', () => {
    const battle = battleWith('Guest 1337')
    battle.sides[0].cooldown = 2
    battle.sides[1].cooldown = 3
    const prompt = buildLlmPrompt(battle)
    expect(prompt).toContain('ability cd 2')
    expect(prompt).not.toContain('ability cd 3')
  })

  test('lists both boss abilities', () => {
    const battle = battleWith('Builderman')
    battle.sides[0].boss = true
    const prompt = buildLlmPrompt(battle)
    expect(prompt).toContain('special 0: Sentry')
    expect(prompt).toContain('special 1: Dispenser')
  })
})

describe('LLM decision parsing', () => {
  test('accepts a legal attack and skips markdown fences', () => {
    const battle = battleWith('Guest 1337')
    expect(
      parseLlmDecision('```json\n{"action":"attack","target":1}\n```', battle),
    ).toEqual({ action: 'attack', specialIndex: 0, targetIndex: 1 })
    expect(parseLlmDecision('{"action":"attack","target":"1"}', battle)).toEqual({
      action: 'attack',
      specialIndex: 0,
      targetIndex: 1,
    })
  })

  test('accepts juke and rest without a target', () => {
    const battle = battleWith('Guest 1337')
    expect(parseLlmDecision('{"action":"juke"}', battle)).toEqual({
      action: 'juke',
      specialIndex: 0,
    })
    expect(parseLlmDecision('{"action":"rest"}', battle)).toEqual({
      action: 'rest',
      specialIndex: 0,
    })
  })

  test('rejects garbage and unknown actions', () => {
    const battle = battleWith('Guest 1337')
    expect(parseLlmDecision('I attack the enemy!', battle)).toBeNull()
    expect(parseLlmDecision('{"action":"dance"}', battle)).toBeNull()
    expect(parseLlmDecision('{"action":', battle)).toBeNull()
  })

  test('rejects attacks on allies and dead enemies', () => {
    const battle = battleWith('Guest 1337')
    expect(parseLlmDecision('{"action":"attack","target":0}', battle)).toBeNull()
    battle.sides[1].hp = 0
    expect(parseLlmDecision('{"action":"attack","target":1}', battle)).toBeNull()
  })

  test('validates Block targets and cooldown', () => {
    const battle = battleWith('Guest 1337')
    expect(
      parseLlmDecision('{"action":"special","specialIndex":0,"target":0}', battle),
    ).toEqual({ action: 'special', specialIndex: 0, targetIndex: 0 })
    expect(
      parseLlmDecision('{"action":"special","specialIndex":0,"target":1}', battle),
    ).toBeNull()
    battle.sides[0].cooldown = 2
    expect(
      parseLlmDecision('{"action":"special","specialIndex":0,"target":0}', battle),
    ).toBeNull()
  })

  test('only bosses may pick the second ability', () => {
    const battle = battleWith('Builderman')
    expect(parseLlmDecision('{"action":"special","specialIndex":1}', battle)).toBeNull()
    battle.sides[0].boss = true
    expect(parseLlmDecision('{"action":"special","specialIndex":1}', battle)).toEqual({
      action: 'special',
      specialIndex: 1,
    })
  })

  test('does nothing without an API key', async () => {
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEYS
    const battle = battleWith('Noob')
    expect(await chooseLlmTurn(battle)).toBeNull()
  })

  test('Groq alone is enough to enable the LLM', () => {
    delete process.env.OPENROUTER_API_KEY
    process.env.GROQ_API_KEY = 'groq-key'
    expect(llmAiEnabled()).toBe(true)
    delete process.env.GROQ_API_KEY
    expect(llmAiEnabled()).toBe(false)
  })

  test('parses several Groq keys and drops duplicates', () => {
    expect(parseApiKeys('a,b c\nd', undefined)).toEqual(['a', 'b', 'c', 'd'])
    expect(parseApiKeys('a, a', 'b')).toEqual(['a', 'b'])
    expect(parseApiKeys('"a,b"')).toEqual(['a', 'b'])
    expect(parseApiKeys(undefined, '')).toEqual([])
    process.env.GROQ_API_KEYS = 'k1,k2'
    expect(llmAiEnabled()).toBe(true)
  })

  test('accepts numbered Groq key variables', () => {
    const original1 = process.env.GROQ_API_KEY_1
    const original2 = process.env.GROQ_API_KEY_2
    try {
      delete process.env.OPENROUTER_API_KEY
      delete process.env.GROQ_API_KEY
      delete process.env.GROQ_API_KEYS
      process.env.GROQ_API_KEY_1 = 'one'
      process.env.GROQ_API_KEY_2 = 'two'
      expect(llmAiEnabled()).toBe(true)
    } finally {
      if (original1 === undefined) delete process.env.GROQ_API_KEY_1
      else process.env.GROQ_API_KEY_1 = original1
      if (original2 === undefined) delete process.env.GROQ_API_KEY_2
      else process.env.GROQ_API_KEY_2 = original2
    }
  })

  test('imports LLM keys from .env without overriding process env', () => {
    const originalModel = process.env.OPENROUTER_MODEL
    try {
      delete process.env.OPENROUTER_MODEL
      delete process.env.GROQ_API_KEYS
      importLlmEnv(
        'export OPENROUTER_MODEL="from-file"\n' +
          'GROQ_API_KEYS="g1,g2"\n' +
          'DISCORD_BOT_TOKEN=ignored\n',
      )
      expect(process.env.OPENROUTER_MODEL).toBe('from-file')
      expect(process.env.GROQ_API_KEYS).toBe('g1,g2')
      process.env.OPENROUTER_MODEL = 'from-env'
      importLlmEnv('OPENROUTER_MODEL=ignored')
      expect(process.env.OPENROUTER_MODEL).toBe('from-env')
    } finally {
      if (originalModel === undefined) delete process.env.OPENROUTER_MODEL
      else process.env.OPENROUTER_MODEL = originalModel
    }
  })

  test('daily free-model limit pauses until UTC midnight', () => {
    const noon = Date.UTC(2026, 9, 26, 12, 0, 0)
    const daily = llmPauseMs(
      429,
      '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}',
      true,
      noon,
    )
    expect(daily).toBeGreaterThan(11 * 60 * 60_000)
    expect(daily).toBeLessThanOrEqual(13 * 60 * 60_000)
    expect(llmPauseMs(429, 'free-models-per-day', false, noon)).toBe(5 * 60_000)
    expect(llmPauseMs(429, 'rate limited', true, noon)).toBe(5 * 60_000)
    expect(llmPauseMs(401, 'bad key', true, noon)).toBe(15 * 60_000)
    expect(
      llmPauseMs(
        429,
        'Rate limit reached on tokens per day (TPD): Limit 100000',
        true,
        noon,
      ),
    ).toBeGreaterThan(11 * 60 * 60_000)
  })

  test('picks gpt-oss-20b first among available Groq models', () => {
    expect(
      pickGroqModel([
        'whisper-large-v3',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
      ]),
    ).toBe('openai/gpt-oss-20b')
    expect(pickGroqModel(['whisper-large-v3', 'openai/gpt-oss-120b'])).toBe(
      'openai/gpt-oss-120b',
    )
    expect(pickGroqModel(['whisper-large-v3', 'some-new-chat-model'])).toBe(
      'some-new-chat-model',
    )
    expect(pickGroqModel(['whisper-large-v3'])).toBeNull()
  })

  test('reports when a provider is ready to answer', () => {
    const battle = battleWith('Noob')
    delete process.env.OPENROUTER_API_KEY
    delete process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEYS
    expect(llmLikelyAvailable(battle.sides[0])).toBe(false)
    process.env.GROQ_API_KEY = 'groq-key'
    expect(llmLikelyAvailable(battle.sides[0])).toBe(true)
    battle.sides[0].minion = true
    expect(llmLikelyAvailable(battle.sides[0])).toBe(false)
  })

  test('prefers Groq over OpenRouter but allows reordering', () => {
    const original = process.env.LLM_PROVIDER_ORDER
    try {
      delete process.env.LLM_PROVIDER_ORDER
      expect(llmProviderOrder()).toEqual(['groq', 'openrouter'])
      process.env.LLM_PROVIDER_ORDER = 'openrouter, groq'
      expect(llmProviderOrder()).toEqual(['openrouter', 'groq'])
    } finally {
      if (original === undefined) delete process.env.LLM_PROVIDER_ORDER
      else process.env.LLM_PROVIDER_ORDER = original
    }
  })

  test('turns on per-turn logging only for explicit debug values', () => {
    const original = process.env.OPENROUTER_DEBUG
    try {
      delete process.env.OPENROUTER_DEBUG
      expect(llmDebugEnabled()).toBe(false)
      process.env.OPENROUTER_DEBUG = '0'
      expect(llmDebugEnabled()).toBe(false)
      process.env.OPENROUTER_DEBUG = '1'
      expect(llmDebugEnabled()).toBe(true)
      process.env.OPENROUTER_DEBUG = 'true'
      expect(llmDebugEnabled()).toBe(true)
    } finally {
      if (original === undefined) delete process.env.OPENROUTER_DEBUG
      else process.env.OPENROUTER_DEBUG = original
    }
  })
})
