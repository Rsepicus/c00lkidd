import { describe, expect, test } from 'bun:test'
import { chooseBossAction, chooseBotAction, chooseBotTurn } from './ai'
import type { Character } from './forsaken'
import { createBattle, createTeamBattle, type Battle } from './pvp'

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

  test('does not rest at high HP', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    expect(chooseBotAction(battle, () => 0)).toBe('attack')
  })

  test('jukes at low HP when it cannot use a special', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    battle.sides[1].hp = 30
    expect(chooseBotAction(battle, sequence(0.9, 0.1))).toBe('juke')
  })

  test('does not juke at full HP', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    expect(chooseBotAction(battle, () => 0)).toBe('attack')
  })

  test('prefers a lethal special even on an otherwise bad roll', () => {
    const battle = battleWith({
      special: { name: 'Heavy', kind: 'heavy', power: 60, description: '' },
    })
    battle.turn = 1
    battle.sides[0].hp = 40
    // A non-lethal 20-damage special attacks on this roll; a lethal one does not.
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')
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

  test('does not waste a heal on a Hemorrhaged target', () => {
    const battle = battleWith({
      special: { name: 'Heal', kind: 'heal', power: 20, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 50
    battle.sides[1].effects.hemorrhage = 2
    expect(chooseBotAction(battle, sequence(0.9, 0.9))).toBe('attack')
  })

  test('rests to clear Hemorrhage even at high HP', () => {
    const battle = battleWith()
    battle.turn = 1
    battle.sides[1].cooldown = 2
    battle.sides[1].effects.hemorrhage = 2
    expect(chooseBotAction(battle, () => 0)).toBe('rest')
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

  test('does not use a shield at full HP', () => {
    const battle = battleWith({
      special: { name: 'Guard', kind: 'shield', power: 30, description: '' },
    })
    battle.turn = 1
    expect(chooseBotAction(battle, () => 0.9)).toBe('attack')
  })

  test('uses a shield when an ally is wounded and unprotected', () => {
    const battle = battleWith({
      special: { name: 'Guard', kind: 'shield', power: 30, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 60
    expect(chooseBotAction(battle, () => 0.9)).toBe('special')
  })

  test('does not overwrite an existing shield with a weaker one', () => {
    const battle = battleWith({
      special: { name: 'Guard', kind: 'shield', power: 30, description: '' },
    })
    battle.turn = 1
    battle.sides[1].hp = 80
    battle.sides[1].shield = 30
    expect(chooseBotAction(battle, () => 0.9)).toBe('attack')
  })

  test('places Sentry and Dispenser even at full HP', () => {
    const specials = [
      { name: 'Sentry', kind: 'turret' as const, power: 6, description: '' },
      { name: 'Dispenser', kind: 'dispenser' as const, power: 0, description: '' },
    ]
    for (const special of specials) {
      const battle = battleWith({ special })
      battle.turn = 1
      expect(chooseBotAction(battle, () => 0.5)).toBe('special')
    }
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
  function bossBattleWith(
    overrides: Partial<Character> = {},
    alternate: NonNullable<Character['alternates']>[number] = {
      name: 'Rage',
      kind: 'strength',
      power: 0,
      description: '',
    },
  ): Battle {
    const boss = character({
      name: 'Boss',
      alternates: [alternate],
      ...overrides,
    })
    const battle = createBattle(
      { userId: 'player', name: 'Player', character: character() },
      { userId: 'boss:1', name: 'Boss', character: boss, boss: true },
    )
    battle.turn = 1
    return battle
  }

  test('alternates between both specials', () => {
    const battle = bossBattleWith()
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 0 })
    battle.sides[1].abilityUses = 1
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('uses the second special when the first is on cooldown', () => {
    const battle = bossBattleWith()
    battle.sides[1].cooldown = 2
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('heals when wounded instead of wasting the turn on damage', () => {
    const battle = bossBattleWith(
      { special: { name: 'Heal', kind: 'heal', power: 20, description: '' } },
      { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    )
    battle.sides[1].hp = 30
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 0 })
  })

  test('does not waste a heal at full HP and uses the damaging special', () => {
    const battle = bossBattleWith(
      { special: { name: 'Heal', kind: 'heal', power: 20, description: '' } },
      { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    )
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('prefers damage when a player side is nearly dead', () => {
    const battle = bossBattleWith(
      { special: { name: 'Heal', kind: 'heal', power: 20, description: '' } },
      { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    )
    battle.sides[1].hp = 30
    battle.sides[0].hp = 15
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('does not reuse a dodge special while already dodging', () => {
    const battle = bossBattleWith(
      { special: { name: 'Ascension', kind: 'dodge', power: 0, description: '' } },
      { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    )
    battle.sides[1].dodging = true
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('does not re-apply a debuff the player already has', () => {
    const battle = bossBattleWith(
      { special: { name: 'Glitch', kind: 'glitch', power: 0, description: '' } },
      { name: 'Heavy', kind: 'heavy', power: 20, description: '' },
    )
    battle.sides[0].effects.glitch = 2
    expect(chooseBossAction(battle, () => 0)).toMatchObject({ action: 'special', specialIndex: 1 })
  })

  test('rests to clear Hemorrhage even at high HP', () => {
    const battle = bossBattleWith()
    battle.sides[1].cooldown = 2
    battle.sides[1].secondCooldown = 2
    battle.sides[1].effects.hemorrhage = 2
    expect(chooseBossAction(battle, () => 0)).toEqual({ action: 'rest', specialIndex: 0 })
  })

  test('rests at low HP when the player is healthy', () => {
    const battle = bossBattleWith()
    battle.sides[1].hp = 15
    battle.sides[1].cooldown = 2
    battle.sides[1].secondCooldown = 2
    expect(chooseBossAction(battle, () => 0).action).toBe('rest')
  })

  test('stays aggressive when a player side is nearly dead', () => {
    const battle = bossBattleWith()
    battle.sides[1].hp = 15
    battle.sides[1].cooldown = 2
    battle.sides[1].secondCooldown = 2
    battle.sides[0].hp = 10
    expect(chooseBossAction(battle, () => 0).action).toBe('attack')
  })
})

describe('target selection', () => {
  function teamBattle(
    actor: Character = character(),
    ally: Character = character(),
    enemy1: Character = character(),
    enemy2: Character = character(),
  ): Battle {
    return createTeamBattle(
      [
        { userId: 'p', name: 'P', character: actor },
        { userId: 'p', name: 'P', character: ally },
      ],
      [
        { userId: 'bot:1', name: 'E1', character: enemy1 },
        { userId: 'bot:2', name: 'E2', character: enemy2 },
      ],
    )
  }

  test('attacks focus the enemy with the lowest effective HP', () => {
    const battle = teamBattle()
    battle.sides[0].cooldown = 3
    battle.sides[1].hp = 60
    battle.sides[3].hp = 20
    expect(chooseBotTurn(battle, () => 0.99).targetIndex).toBe(3)
  })

  test('a strong shield makes an enemy a worse focus target', () => {
    const battle = teamBattle()
    battle.sides[0].cooldown = 3
    battle.sides[1].hp = 5
    battle.sides[1].shield = 80
    battle.sides[3].hp = 15
    expect(chooseBotTurn(battle, () => 0.99).targetIndex).toBe(3)
  })

  test('control specials target the most dangerous enemy', () => {
    const battle = teamBattle(
      character({ special: { name: 'Glitch', kind: 'glitch', power: 0, description: '' } }),
      character(),
      character({ attack: 30 }),
      character({ attack: 5 }),
    )
    const decision = chooseBotTurn(battle, () => 0)
    expect(decision.action).toBe('special')
    expect(decision.targetIndex).toBe(1)
  })

  test('block protects the most wounded ally', () => {
    const battle = teamBattle(
      character({ special: { name: 'Block', kind: 'block', power: 0, description: '' } }),
    )
    battle.sides[2].hp = 20
    expect(chooseBotTurn(battle, () => 0).targetIndex).toBe(2)
  })

  test('attacks ignore decoys while a real enemy is alive', () => {
    const battle = teamBattle()
    battle.sides[0].cooldown = 3
    battle.sides[1].fake = true
    battle.sides[1].hp = 1
    battle.sides[3].hp = 90
    expect(chooseBotTurn(battle, () => 0.99).targetIndex).toBe(3)
  })

  test('block does not protect a minion over a real ally', () => {
    const battle = teamBattle(
      character({ special: { name: 'Block', kind: 'block', power: 0, description: '' } }),
    )
    battle.sides[2].minion = true
    battle.sides[2].hp = 5
    expect(chooseBotTurn(battle, () => 0).targetIndex).toBe(0)
  })

  test('self-only specials carry no target', () => {
    const battle = teamBattle(
      character({ special: { name: 'Dodge', kind: 'dodge', power: 0, description: '' } }),
    )
    expect(chooseBotTurn(battle, () => 0).targetIndex).toBeUndefined()
  })

  test('bosses carry a target for targeted specials', () => {
    const battle = battleWith()
    battle.turn = 1
    expect(chooseBossAction(battle, () => 0).targetIndex).toBe(0)
  })
})
