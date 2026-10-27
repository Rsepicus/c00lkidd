import { describe, expect, test } from 'bun:test'
import {
  decisionQuality,
  mulberry32,
  runArena,
  type ArenaLlmChooser,
} from './arena'
import { characterByName } from './forsaken'
import { createBattle } from './pvp'

const fallbackChooser: ArenaLlmChooser = async () => null

const restChooser: ArenaLlmChooser = async () => ({
  decision: { action: 'rest', specialIndex: 0 },
  provider: 'test',
  model: 'rest',
  keyIndex: 0,
  keyCount: 1,
})

function battleWith(left: string, right = 'Noob') {
  return createBattle(
    { userId: 'a', name: 'A', character: characterByName(left)! },
    { userId: 'b', name: 'B', character: characterByName(right)! },
  )
}

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

describe('arena decision quality', () => {
  const rest = { action: 'rest', specialIndex: 0 } as const
  const juke = { action: 'juke', specialIndex: 0 } as const

  test('flags a rest at full HP as wasted', () => {
    const battle = battleWith('Jason')
    expect(decisionQuality(battle, battle.sides[0], rest)).toEqual({
      wasted: true,
      missedFinish: false,
    })
  })

  test('does not flag a rest that heals or clears Hemorrhage', () => {
    const battle = battleWith('Jason')
    battle.sides[0].hp = 40
    expect(decisionQuality(battle, battle.sides[0], rest).wasted).toBe(false)
    battle.sides[0].hp = battle.sides[0].maxHp
    battle.sides[0].effects.hemorrhage = 2
    expect(decisionQuality(battle, battle.sides[0], rest).wasted).toBe(false)
  })

  test('flags a redundant juke as wasted', () => {
    const battle = battleWith('Jason')
    battle.sides[0].juking = true
    expect(decisionQuality(battle, battle.sides[0], juke).wasted).toBe(true)
    battle.sides[0].juking = false
    expect(decisionQuality(battle, battle.sides[0], juke).wasted).toBe(false)
  })

  test('flags resting instead of finishing a killable enemy', () => {
    const battle = battleWith('Jason')
    battle.sides[1].hp = Math.max(1, battle.sides[0].character.attack - 1)
    expect(decisionQuality(battle, battle.sides[0], rest).missedFinish).toBe(true)
    expect(decisionQuality(battle, battle.sides[0], juke).missedFinish).toBe(true)
    expect(
      decisionQuality(battle, battle.sides[0], { action: 'attack', specialIndex: 0 })
        .missedFinish,
    ).toBe(false)
    battle.sides[1].hp = 500
    expect(decisionQuality(battle, battle.sides[0], rest).missedFinish).toBe(false)
  })

  test('respects temporary HP when checking a finisher', () => {
    const battle = battleWith('Jason')
    battle.sides[1].hp = 1
    battle.sides[1].tempHp = 100
    expect(decisionQuality(battle, battle.sides[0], rest).missedFinish).toBe(false)
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

  test('reports action, damage taken, healing and wasted turn stats', async () => {
    const result = await runArena(restChooser, {
      characters: ['Jason'],
      seeds: [5],
      maxTurns: 30,
    })
    expect(result.llmActions).toBeGreaterThan(0)
    expect(result.heuristicActions).toBeGreaterThan(0)
    expect(result.llmDamageTaken).toBeGreaterThan(0)
    expect(result.llmHealing).toBeGreaterThan(0)
    expect(result.llmWasted).toBeGreaterThan(0)
    expect(result.llmMissedFinishes).toBeGreaterThanOrEqual(0)
    for (const battle of result.battles) {
      expect(battle.llmActions + battle.heuristicActions).toBeGreaterThan(0)
      expect(battle.llmDamageTaken).toBeGreaterThanOrEqual(0)
      expect(battle.llmHealing).toBeGreaterThanOrEqual(0)
    }
  })

  test('counts a mirrored attacker for both teams', async () => {
    const result = await runArena(attackerChooser, {
      characters: ['Guest 1337'],
      seeds: [11],
      maxTurns: 12,
    })
    expect(result.llmActions).toBeGreaterThan(0)
    expect(result.heuristicActions).toBeGreaterThan(0)
    expect(result.llmWasted).toBe(0)
    expect(result.heuristicWasted).toBe(0)
    expect(result.llmDamageTaken + result.heuristicDamageTaken).toBeGreaterThan(0)
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
