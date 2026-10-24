import { describe, expect, test } from 'bun:test'
import { chooseBossAction, chooseBotAction } from './ai'
import { characterByName, type Character } from './forsaken'
import { createBattle, type Battle } from './pvp'

function character(overrides: Partial<Character> = {}): Character {
  return {
    name: 'BotChar',
    role: 'killer',
    ability: 'test',
    power: 5,
    price: 0,
    hp: 100,
    attack: 10,
    special: { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    ...overrides,
  }
}

function battleWith(characterOverrides: Partial<Character> = {}): Battle {
  return createBattle(
    { userId: 'player', name: 'Player', character: character() },
    { userId: 'bot:1', name: 'Bot', character: character(characterOverrides) },
  )
}

function sequence(...values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

describe('chooseBotAction', () => {
  test('uses a ready special most of the time', () => {
    const battle = battleWith()
    battle.turn = 1
    expect(chooseBotAction(battle, () => 0)).toBe('special')
  })

  test('falls back to an attack when the special roll fails', () => {
    const battle = battleWith()
    battle.turn = 1
    expect(chooseBotAction(battle, sequence(0.9, 0.5))).toBe('attack')
  })

  test('rests when hurt and the special is on cooldown', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    battle.sides[1].hp = 20
    expect(chooseBotAction(battle, () => 0)).toBe('rest')
  })

  test('sometimes jukes instead of attacking', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    expect(chooseBotAction(battle, sequence(0.1))).toBe('juke')
  })

  test('heals when the healing special is ready and HP is missing', () => {
    const battle = battleWith({
      special: { name: 'Heal', kind: 'heal', power: 20, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 60
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')
  })

  test('does not waste a heal at full HP', () => {
    const battle = battleWith({
      special: { name: 'Heal', kind: 'heal', power: 20, description: '' },
    })
    battle.turn = 1
    expect(chooseBotAction(battle, () => 0.9)).toBe('attack')
  })

  test('uses Purified when an ally is wounded', () => {
    const battle = battleWith({
      special: { name: 'Purified', kind: 'purified', power: 0, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 60
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')
  })

  test('does not use Purified when nobody is wounded', () => {
    const battle = battleWith({
      special: { name: 'Purified', kind: 'purified', power: 0, description: '' },
    })
    battle.turn = 1
    expect(chooseBotAction(battle, () => 0)).toBe('attack')
  })

  test('uses Activate Battery only when hurt', () => {
    const battle = battleWith({
      special: { name: 'Activate Battery', kind: 'battery', power: 20, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 50
    battle.sides[1].charge = 40
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')
    battle.sides[1].hp = 100
    expect(chooseBotAction(battle, () => 0.9)).toBe('attack')
  })

  test('prays only when hurt', () => {
    const battle = battleWith({
      special: { name: 'Pray', kind: 'pray', power: 50, description: '' },
    })
    battle.turn = 1
    battle.sides[1].charge = 100
    battle.sides[1].hp = 50
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')

    battle.sides[1].hp = 100
    expect(chooseBotAction(battle, () => 0.9)).toBe('attack')
  })
})

describe('chooseBossAction', () => {
  function bossBattle(): Battle {
    const boss = character({
      name: 'Boss',
      alternates: [{ name: 'Rage', kind: 'strength', power: 0, description: '' }],
    })
    const battle = createBattle(
      { userId: 'player', name: 'Player', character: character() },
      { userId: 'boss:1', name: 'Boss', character: boss, boss: true },
    )
    battle.turn = 1
    return battle
  }

  test('alternates between both specials', () => {
    const battle = bossBattle()
    expect(chooseBossAction(battle, () => 0)).toEqual({ action: 'special', specialIndex: 0 })
    battle.sides[1].abilityUses = 1
    expect(chooseBossAction(battle, () => 0)).toEqual({ action: 'special', specialIndex: 1 })
  })

  test('uses the second special when the first is on cooldown', () => {
    const battle = bossBattle()
    battle.sides[1].cooldown = 2
    expect(chooseBossAction(battle, () => 0)).toEqual({ action: 'special', specialIndex: 1 })
  })
})
