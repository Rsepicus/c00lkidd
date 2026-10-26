import { afterEach, describe, expect, test } from 'bun:test'
import { characterByName } from './forsaken'
import { chooseLlmTurn, buildLlmPrompt, parseLlmDecision } from './llm-ai'
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
afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
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
    const battle = battleWith('Noob')
    expect(await chooseLlmTurn(battle)).toBeNull()
  })
})
