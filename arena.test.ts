import { describe, expect, test } from 'bun:test'
import { mulberry32, runArena, type ArenaLlmChooser } from './arena'

const fallbackChooser: ArenaLlmChooser = async () => null

const attackerChooser: ArenaLlmChooser = async battle => {
  const side = battle.sides[battle.turn]
  const target = battle.sides.find(
    candidate => candidate.team !== side.team && candidate.hp > 0,
  )
  return {
    decision: {
      action: 'attack',
      specialIndex: 0,
      targetIndex: target?.id,
    },
    provider: 'test',
    model: 'fake',
    keyIndex: 0,
    keyCount: 1,
  }
}

describe('mulberry32', () => {
  test('is deterministic for the same seed', () => {
    const first = mulberry32(123)
    const second = mulberry32(123)
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
    expect(mulberry32(123)()).not.toBe(mulberry32(124)())
  })
})

describe('LLM arena', () => {
  test('runs mirror battles and counts fallbacks', async () => {
    const progress: number[] = []
    const result = await runArena(fallbackChooser, {
      characters: ['Jason'],
      seeds: [7],
      onProgress: done => progress.push(done),
    })
    expect(result.battles).toHaveLength(2)
    expect(result.battles[0].seed).toBe(result.battles[1].seed)
    expect(result.llmWins + result.heuristicWins + result.draws).toBe(2)
    expect(result.fallbacks).toBeGreaterThan(0)
    expect(result.llmDecisions).toBe(0)
    expect(progress).toEqual([1, 2])
  })

  test('uses legal LLM decisions and records the model', async () => {
    const result = await runArena(attackerChooser, {
      characters: ['Guest 1337'],
      seeds: [11],
      maxTurns: 30,
    })
    expect(result.battles).toHaveLength(2)
    expect(result.llmDecisions).toBeGreaterThan(0)
    expect(result.fallbacks).toBe(0)
    expect(result.models).toContain('test fake')
    expect(result.llmWins + result.heuristicWins + result.draws).toBe(2)
  })

  test('repeats the same outcome for the same seed', async () => {
    const options = {
      characters: ['Jason'] as const,
      seeds: [3] as const,
      maxTurns: 30,
    }
    const first = await runArena(attackerChooser, options)
    const second = await runArena(attackerChooser, options)
    expect(first.battles.map(battle => battle.winner)).toEqual(
      second.battles.map(battle => battle.winner),
    )
    expect(first.llmDamage).toBe(second.llmDamage)
    expect(first.heuristicDamage).toBe(second.heuristicDamage)
  })
})
