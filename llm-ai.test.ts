import { afterEach, describe, expect, test } from 'bun:test'
import { characterByName } from './forsaken'
import {
  chooseLlmTurn,
  buildChatBody,
  buildLlmPrompt,
  buildLocalCandidates,
  buildLocalPrompt,
  importLlmEnv,
  llmAiEnabled,
  llmDebugEnabled,
  llmHybridEnabled,
  llmLikelyAvailable,
  llmPauseMs,
  llmProviderOrder,
  llmStats,
  noteLlmTurn,
  parseApiKeys,
  parseLlmDecision,
  pickGroqModel,
  validateLlmDecision,
} from './llm-ai'
import { createBattle, createTeamBattle } from './pvp'

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

  test('adds a sanitized recent log to the prompt', () => {
    const battle = battleWith('Guest 1337')
    const lines = Array.from(
      { length: 8 },
      (_, index) => `SecretPlayerName наносит ${index + 1} урона: SecretEnemyName.`,
    )
    const prompt = buildLlmPrompt(battle, lines)
    expect(prompt).toContain('RECENT LOG:')
    expect(prompt).toContain('#0 (Guest 1337) наносит 8 урона: #1 (Noob).')
    expect(prompt).not.toContain('SecretPlayerName')
    expect(prompt).not.toContain('SecretEnemyName')
    expect(prompt).not.toContain('наносит 1 урона')
  })

  test('keeps reasoning from eating the whole answer budget', () => {
    const battle = battleWith('Noob')
    const gpt = buildChatBody('groq', 'openai/gpt-oss-20b', battle)
    expect(gpt.max_tokens).toBe(512)
    expect(gpt.reasoning_effort).toBe('low')
    expect(gpt.include_reasoning).toBe(false)
    const qwen = buildChatBody('groq', 'qwen/qwen3.6-27b', battle)
    expect(qwen.reasoning_effort).toBe('none')
    const plain = buildChatBody('groq', 'some-chat-model', battle)
    expect(plain.reasoning_effort).toBeUndefined()
    const openrouter = buildChatBody('openrouter', 'openai/gpt-oss-20b', battle)
    expect(openrouter.reasoning).toEqual({ effort: 'low', exclude: true })
  })

  test('builds legal letter choices for the local model', () => {
    const battle = battleWith('Guest 1337')
    const candidates = buildLocalCandidates(battle)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(8)
    expect(
      candidates.some(
        candidate =>
          candidate.decision.action === 'special' &&
          candidate.decision.specialIndex === 0,
      ),
    ).toBe(true)
    expect(candidates.some(candidate => candidate.decision.action === 'attack')).toBe(
      true,
    )
    expect(candidates.some(candidate => candidate.decision.action === 'rest')).toBe(
      false,
    )
    expect(candidates.at(-1)?.decision.action).toBe('juke')

    const prompt = buildLocalPrompt(battle, candidates)
    expect(prompt).toContain('A)')
    expect(prompt).toContain('#0 Guest 1337')
    expect(prompt).toContain('#1 Noob')
    expect(prompt).toContain('special 0 (Block)')
    expect(prompt).toContain('Answer with one letter only')
    expect(prompt).not.toContain('SecretPlayerName')
    expect(prompt).not.toContain('SecretEnemyName')
  })

  test('offers rest only when it heals or clears Hemorrhage', () => {
    const battle = battleWith('Guest 1337')
    const hasRest = () =>
      buildLocalCandidates(battle).some(
        candidate => candidate.decision.action === 'rest',
      )
    expect(hasRest()).toBe(false)
    battle.sides[0].hp = 40
    expect(hasRest()).toBe(true)
    battle.sides[0].hp = battle.sides[0].maxHp
    battle.sides[0].effects.hemorrhage = 2
    expect(hasRest()).toBe(true)
  })

  test('does not offer a juke while the juke stance is already up', () => {
    const battle = battleWith('Guest 1337')
    battle.sides[0].juking = true
    expect(
      buildLocalCandidates(battle).some(
        candidate => candidate.decision.action === 'juke',
      ),
    ).toBe(false)
  })

  test('marks supports and lists their attack first', () => {
    const battle = createTeamBattle(
      [
        {
          userId: 'a',
          name: 'A',
          character: characterByName('Guest 1337')!,
        },
        { userId: 'a', name: 'A2', character: characterByName('Noob')! },
      ],
      [
        { userId: 'b', name: 'B', character: characterByName('Jason')! },
        { userId: 'b', name: 'B2', character: characterByName('Builderman')! },
      ],
    )
    const candidates = buildLocalCandidates(battle)
    const attacks = candidates.filter(
      candidate => candidate.decision.action === 'attack',
    )
    expect(attacks[0]?.label).toContain('Builderman')
    expect(attacks[0]?.label).toContain('Support')
    expect(buildLocalPrompt(battle, candidates)).toContain('Support')
  })

  test('shows roles and classes to the remote model', () => {
    const battle = battleWith('Guest 1337', 'Builderman')
    const prompt = buildLlmPrompt(battle)
    expect(prompt).toContain('survivor · Support')
    const body = buildChatBody('groq', 'some-chat-model', battle)
    const messages = body.messages as Array<{ content: string }>
    expect(messages[0].content).toContain('Support')
  })

  test('puts the local model first when it is enabled', () => {
    const original = process.env.LOCAL_LLM_ENABLED
    try {
      delete process.env.OPENROUTER_API_KEY
      delete process.env.GROQ_API_KEY
      delete process.env.GROQ_API_KEYS
      process.env.LOCAL_LLM_ENABLED = '1'
      expect(llmProviderOrder()).toEqual(['local', 'groq', 'openrouter'])
      expect(llmAiEnabled()).toBe(true)
    } finally {
      if (original === undefined) delete process.env.LOCAL_LLM_ENABLED
      else process.env.LOCAL_LLM_ENABLED = original
    }
  })

  test('counts model and heuristic turns', () => {
    const before = llmStats()
    noteLlmTurn(true)
    noteLlmTurn(false)
    const after = llmStats()
    expect(after.model).toBe(before.model + 1)
    expect(after.heuristic).toBe(before.heuristic + 1)
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

  test('explains why a special is illegal', () => {
    const battle = battleWith('Guest 1337')
    battle.sides[0].cooldown = 2
    const result = validateLlmDecision(
      '{"action":"special","specialIndex":0,"target":0}',
      battle,
    )
    expect(result.decision).toBeNull()
    expect(result.reason).toContain('Block')
    expect(result.reason).toContain('cooldown 1')
  })

  test('marks unready specials and legal actions in the prompt', () => {
    const battle = battleWith('Guest 1337')
    const ready = buildLlmPrompt(battle)
    expect(ready).toContain('special 0 (Block)')

    battle.sides[0].cooldown = 2
    const cooling = buildLlmPrompt(battle)
    expect(cooling).toContain('NOT READY — cooldown 1')
    expect(cooling).toContain('NOT ALLOWED this turn')
  })

  test('explains missing Oblation charge', () => {
    const battle = battleWith('Two Time')
    const result = validateLlmDecision(
      '{"action":"special","specialIndex":0}',
      battle,
    )
    expect(result.decision).toBeNull()
    expect(result.reason).toContain('Oblation')
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

  test('imports policy settings from .env', () => {
    const originalAi = process.env.POLICY_AI
    const originalWeights = process.env.POLICY_WEIGHTS
    try {
      delete process.env.POLICY_AI
      delete process.env.POLICY_WEIGHTS
      importLlmEnv('POLICY_AI=1\nPOLICY_WEIGHTS=custom.json\n')
      expect(process.env.POLICY_AI).toBe('1')
      expect(process.env.POLICY_WEIGHTS).toBe('custom.json')
    } finally {
      if (originalAi === undefined) delete process.env.POLICY_AI
      else process.env.POLICY_AI = originalAi
      if (originalWeights === undefined) delete process.env.POLICY_WEIGHTS
      else process.env.POLICY_WEIGHTS = originalWeights
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

  test('enables hybrid mode only with an explicit env flag', () => {
    const original = process.env.LLM_HYBRID
    try {
      delete process.env.LLM_HYBRID
      expect(llmHybridEnabled()).toBe(false)
      for (const value of ['1', 'true', 'yes', 'on']) {
        process.env.LLM_HYBRID = value
        expect(llmHybridEnabled()).toBe(true)
      }
      for (const value of ['0', 'false', '']) {
        process.env.LLM_HYBRID = value
        expect(llmHybridEnabled()).toBe(false)
      }
    } finally {
      if (original === undefined) delete process.env.LLM_HYBRID
      else process.env.LLM_HYBRID = original
    }
  })

  test('imports LLM_HYBRID from .env', () => {
    const original = process.env.LLM_HYBRID
    try {
      delete process.env.LLM_HYBRID
      importLlmEnv('LLM_HYBRID=1\n')
      expect(process.env.LLM_HYBRID).toBe('1')
    } finally {
      if (original === undefined) delete process.env.LLM_HYBRID
      else process.env.LLM_HYBRID = original
    }
  })

  test('reports a hybrid correction counter', () => {
    expect(llmStats()).toHaveProperty('hybrid')
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
