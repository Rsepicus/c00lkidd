import { describe, expect, test } from 'bun:test'
import { characterByName, characterWithSpecial, type Character } from './forsaken'
import {
  cooldownAfterTick,
  createBattle,
  createTeamBattle,
  JUKE_STANCE_BONUS,
  jukeBonusOf,
  jukeChanceOf,
  specialCooldown,
  specialLabel,
  specialNeedsAllyTarget,
  specialNeedsEnemyTarget,
  specialOf,
  specialReady,
  surrender,
  takeTurn,
  type Battle,
  type FighterEntry,
} from './pvp'

function character(overrides: Partial<Character>): Character {
  return {
    name: 'Test',
    role: 'killer',
    ability: 'test',
    power: 5,
    price: 0,
    hp: 100,
    attack: 10,
    special: { name: 'Test', kind: 'heavy', power: 20, description: 'test' },
    ...overrides,
  }
}

const heavy = character({ name: 'Heavy' })
const healer = character({ name: 'Healer', special: { name: 'Heal', kind: 'heal', power: 30, description: '' } })
const shielder = character({
  name: 'Shielder',
  special: { name: 'Shield', kind: 'shield', power: 60, description: '', lethalSave: true },
})
const potion = character({
  name: 'Potion',
  role: 'survivor',
  special: { name: 'Slateskin Potion', kind: 'shield', power: 50, description: '' },
})
const dodger = character({ name: 'Dodger', special: { name: 'Dodge', kind: 'dodge', power: 0, description: '' } })
const stunner = character({ name: 'Stunner', special: { name: 'Stun', kind: 'stun', power: 0, description: '' } })
const poisoner = character({ name: 'Poisoner', special: { name: 'Poison', kind: 'poison', power: 8, description: '' } })
const lifestealer = character({ name: 'Lifestealer', special: { name: 'Drain', kind: 'lifesteal', power: 0, description: '' } })
const gambler = character({ name: 'Gambler', special: { name: 'Coin', kind: 'gamble', power: 0, description: '' } })
const cola = character({
  name: 'Cola',
  role: 'survivor',
  special: { name: 'Bloxy Cola', kind: 'speed', power: 0, description: '' },
})
const noli = character({
  name: 'Noli',
  role: 'killer',
  special: { name: 'Void Rush', kind: 'heavy', power: 10, description: '' },
})
const turret = character({
  name: 'Builderman',
  role: 'survivor',
  special: { name: 'Sentry', kind: 'turret', power: 7, description: '' },
})
const trap = character({
  name: 'Taph',
  role: 'survivor',
  special: { name: 'Мины', kind: 'trap', power: 8, description: '' },
})
const chicken = character({
  name: 'Chicken',
  role: 'survivor',
  special: { name: 'Fried Chicken', kind: 'heal', power: 25, description: '' },
})
const pizzaDelivery = character({
  name: 'Pizza',
  role: 'killer',
  special: { name: 'Pizza Delivery', kind: 'burn', power: 8, description: '' },
})
const crier = character({
  name: 'Crier',
  role: 'killer',
  special: { name: 'Infernal Cry', kind: 'cry', power: 6, description: '' },
})
const twoTime = character({
  name: 'Two Time',
  role: 'survivor',
  special: { name: 'Oblation', kind: 'revive', power: 0, description: '' },
})
const hunter = character({
  name: 'Hunter',
  role: 'killer',
  special: { name: 'Blood Hunt', kind: 'bloodhunt', power: 0, description: '' },
})

function battleWith(left: Character, right: Character): Battle {
  return createBattle(
    { userId: 'a', name: 'A', character: left },
    { userId: 'b', name: 'B', character: right },
  )
}

function sequence(...values: number[]): () => number {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

const survivor = character({ name: 'Survivor', role: 'survivor' })

describe('createBattle', () => {
  test('starts both sides at full HP with the first side to act', () => {
    const battle = battleWith(heavy, healer)
    expect(battle.sides[0].hp).toBe(100)
    expect(battle.sides[1].hp).toBe(100)
    expect(battle.turn).toBe(0)
    expect(battle.finished).toBe(false)
  })
})

describe('2 на 2', () => {
  const team = (first: Character = heavy, second: Character = heavy): FighterEntry[] => [
    { userId: 'a', name: 'A', character: first },
    { userId: 'a', name: 'A (напарник)', character: second },
  ]
  const opponents = (): FighterEntry[] => [
    { userId: 'b', name: 'B', character: heavy },
    { userId: 'b', name: 'B (напарник)', character: heavy },
  ]

  test('support heals both teammates', () => {
    const battle = createTeamBattle(team(healer, heavy), opponents())
    battle.sides[0].hp = 50
    battle.sides[2].hp = 50

    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].hp).toBe(80)
    expect(result.sides[2].hp).toBe(80)
    expect(result.sides[1].hp).toBe(100)
  })

  test('solo support heals only the caster', () => {
    const battle = battleWith(healer, heavy)
    battle.sides[0].hp = 50

    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].hp).toBe(80)
    expect(result.sides[1].hp).toBe(100)
  })

  test('Helperbot buffs the teammate with Pulse and Inspiration', () => {
    const helperbot = characterByName('Helperbot')!
    const pulse = takeTurn(
      createTeamBattle(team(helperbot, heavy), opponents()),
      'special',
      () => 0,
    ).battle
    expect(pulse.sides[0].effects.regeneration).toBe(2)
    expect(pulse.sides[2].effects.regeneration).toBe(2)
    expect(pulse.sides[0].effects.resistance).toBe(2)
    expect(pulse.sides[2].effects.resistance).toBe(2)

    const inspiration = characterWithSpecial(helperbot, 'Inspiration')
    const haste = takeTurn(
      createTeamBattle(team(inspiration, heavy), opponents()),
      'special',
      () => 0,
    ).battle
    expect(haste.sides[0].effects.haste).toBe(2)
    expect(haste.sides[2].effects.haste).toBe(2)
  })

  test('Dispenser heals the ally and slows Builderman', () => {
    const builderman = characterWithSpecial(characterByName('Builderman')!, 'Dispenser')
    let battle = createTeamBattle(team(builderman, heavy), opponents())
    battle.sides[0].hp = 50
    battle.sides[2].hp = 50

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].effects.regeneration).toBe(2)
    expect(battle.sides[2].effects.regeneration).toBe(2)
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(-0.1)

    battle = takeTurn(battle, 'rest', () => 0).battle
    const allyTurn = takeTurn(battle, 'rest', () => 0).battle
    expect(allyTurn.sides[2].hp).toBe(68)
    expect(allyTurn.sides[2].effects.regeneration).toBe(2)
  })

  test('Dispenser in solo heals only Builderman', () => {
    const builderman = characterWithSpecial(characterByName('Builderman')!, 'Dispenser')
    let battle = createBattle(
      { userId: 'a', name: 'A', character: builderman },
      { userId: 'b', name: 'B', character: heavy },
    )
    battle.sides[0].hp = 50

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].effects.regeneration).toBe(2)
    expect(battle.sides[1].effects.regeneration).toBeUndefined()
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(-0.1)
  })

  test('a team keeps fighting after one fighter goes down', () => {
    const battle = createTeamBattle(team(), opponents())
    battle.sides[1].hp = 0
    battle.sides[3].hp = 5

    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.finished).toBe(true)
    expect(result.winner).toBe(0)
  })

  test('turns alternate between teams when one fighter is down', () => {
    const battle = createTeamBattle(team(), opponents())
    battle.sides[1].hp = 0

    const result = takeTurn(battle, 'rest', () => 0).battle
    expect(result.turn).toBe(3)
    expect(result.sides[result.turn].team).toBe(1)
  })

  test('shared support buffs expire together with the caster', () => {
    const helperbot = characterByName('Helperbot')!
    let battle = createTeamBattle(team(helperbot, heavy), opponents())
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].effects.regeneration).toBe(2)
    expect(battle.sides[2].effects.regeneration).toBe(2)

    for (let turn = 0; turn < 8; turn++) {
      battle = takeTurn(battle, 'rest', () => 0).battle
    }

    expect(battle.sides[0].effects.regeneration).toBeUndefined()
    expect(battle.sides[2].effects.regeneration).toBeUndefined()
    expect(battle.sides[0].effects.resistance).toBeUndefined()
    expect(battle.sides[2].effects.resistance).toBeUndefined()
  })

  test('Elliot pizza heals only the teammate in 2v2', () => {
    const elliot = characterByName('Elliot')!
    const battle = createTeamBattle(team(elliot, heavy), opponents())
    battle.sides[0].hp = 50
    battle.sides[2].hp = 50

    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].hp).toBe(50)
    expect(result.sides[2].hp).toBe(70)
    expect(result.sides[1].hp).toBe(100)
  })

  test('Elliot pizza heals himself in solo', () => {
    const battle = battleWith(characterByName('Elliot')!, heavy)
    battle.sides[0].hp = 50

    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].hp).toBe(70)
  })

  test('Rush Hour gives speed to both allies and does not heal', () => {
    const elliot = characterWithSpecial(characterByName('Elliot')!, 'Rush Hour')
    const battle = createTeamBattle(team(elliot, heavy), opponents())
    battle.sides[0].hp = 50
    battle.sides[2].hp = 50

    const turn = takeTurn(battle, 'special', () => 0)
    const result = turn.battle
    expect(result.sides[0].hp).toBe(50)
    expect(result.sides[2].hp).toBe(50)
    expect(result.sides[0].effects.regeneration).toBeUndefined()
    expect(jukeBonusOf(result.sides[0])).toBeCloseTo(0.2)
    expect(jukeBonusOf(result.sides[2])).toBeCloseTo(0.2)
    expect(turn.events.join(' ')).toContain('+20% уворота')
  })

  test('a stunned enemy is skipped before anyone can act for them', () => {
    const azure = characterWithSpecial(characterByName('Azure')!, 'Stigmatize')
    const result = takeTurn(
      createTeamBattle(team(azure, heavy), opponents()),
      'special',
      () => 0,
    )
    expect(result.events.join(' ')).toContain('пропускает')
    expect(result.battle.sides[1].stunned).toBe(false)
    expect(result.battle.turn).toBe(2)
  })

  test('all three survivors get turns in a 2v1', () => {
    let battle = createTeamBattle(team(), opponents())
    battle.sides[1].hp = 0

    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.turn).toBe(3)

    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.turn).toBe(2)

    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.turn).toBe(3)
  })

  test('an explicit target overrides the default lowest-HP enemy', () => {
    const battle = createTeamBattle(team(), opponents())
    battle.sides[1].hp = 100
    battle.sides[3].hp = 50

    const result = takeTurn(battle, 'attack', () => 0, 1)
    expect(result.battle.sides[1].hp).toBeLessThan(100)
    expect(result.battle.sides[3].hp).toBe(50)
    expect(result.events.join(' ')).toContain('B')
  })

  test('rejects an ally or a dead fighter as a target', () => {
    const battle = createTeamBattle(team(), opponents())
    expect(() => takeTurn(battle, 'attack', () => 0, 2)).toThrow('цель')
    battle.sides[3].hp = 0
    expect(() => takeTurn(battle, 'attack', () => 0, 3)).toThrow('цель')
  })

  test('only offensive specials ask for an enemy target', () => {
    expect(specialNeedsEnemyTarget(battleWith(heavy, heavy).sides[0])).toBe(true)
    expect(specialNeedsEnemyTarget(battleWith(healer, heavy).sides[0])).toBe(false)
  })

  test('Dusekkar buffs himself and the teammate in 2v2', () => {
    const shielded = characterWithSpecial(characterByName('Dusekkar')!, 'Spawn Protection')
    const shieldBattle = takeTurn(
      createTeamBattle(team(shielded, heavy), opponents()),
      'special',
      () => 0,
    ).battle
    expect(shieldBattle.sides[0].shield).toBe(60)
    expect(shieldBattle.sides[2].shield).toBe(60)
    expect(jukeBonusOf(shieldBattle.sides[0])).toBeCloseTo(0.1)
    expect(jukeBonusOf(shieldBattle.sides[2])).toBeCloseTo(0.1)

    const beamer = characterWithSpecial(characterByName('Dusekkar')!, 'Plasma Beam')
    const beamBattle = takeTurn(
      createTeamBattle(team(beamer, heavy), opponents()),
      'special',
      () => 0,
    ).battle
    expect(beamBattle.sides[0].hp).toBe(110)
    expect(beamBattle.sides[2].hp).toBe(110)
    expect(jukeBonusOf(beamBattle.sides[0])).toBeCloseTo(0.15)
    expect(jukeBonusOf(beamBattle.sides[2])).toBeCloseTo(0.15)
    expect(jukeBonusOf(beamBattle.sides[1])).toBeCloseTo(-0.15)
  })

  test('Blood Hunt is a self-buff and does not ask for a target', () => {
    const battle = battleWith(characterByName('Guest 666')!, heavy)
    battle.sides[0].charge = 2
    expect(specialOf(battle.sides[0]).name).toBe('Blood Hunt')
    expect(specialNeedsEnemyTarget(battle.sides[0])).toBe(false)
  })
})

describe('ability uses', () => {
  test('counts a successful ability use', () => {
    const battle = battleWith(heavy, healer)
    expect(battle.sides[0].abilityUses).toBe(0)

    const result = takeTurn(battle, 'special', () => 0)
    expect(result.battle.sides[0].abilityUses).toBe(1)
  })

  test('does not count an ability that is on cooldown', () => {
    const battle = battleWith(heavy, healer)
    battle.sides[0].cooldown = 2

    expect(() => takeTurn(battle, 'special', () => 0)).toThrow('не готова')
    expect(battle.sides[0].abilityUses).toBe(0)
  })
})

describe('Guest 1337 block', () => {
  test('blocks the next hit and empowers the next attack', () => {
    const guest = characterByName('Guest 1337')!
    let battle = createBattle(
      { userId: 'a', name: 'Guest', character: guest },
      { userId: 'b', name: 'B', character: heavy },
    )

    const blockResult = takeTurn(battle, 'special', () => 0)
    expect(blockResult.battle.sides[0].blocking).toBe(true)
    expect(blockResult.events.join(' ')).not.toContain('блок')
    expect(blockResult.events.join(' ')).toContain('обычную атаку')

    battle = takeTurn(blockResult.battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(110)
    expect(battle.sides[0].blocking).toBe(false)
    expect(battle.sides[0].counterReady).toBe(true)

    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(82)
    expect(result.events.join(' ')).toContain('контрудар')
    expect(result.events.join(' ')).not.toContain('блок')
  })

  test('the block expires after one turn if the opponent does not hit', () => {
    const guest = characterByName('Guest 1337')!
    let battle = createBattle(
      { userId: 'a', name: 'Guest', character: guest },
      { userId: 'b', name: 'B', character: heavy },
    )

    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    const result = takeTurn(battle, 'rest', () => 0)
    expect(result.battle.sides[0].blocking).toBe(false)
    expect(result.battle.sides[0].blockTargetId).toBeNull()
    expect(jukeBonusOf(result.battle.sides[0])).toBeCloseTo(-0.3)
    expect(result.notices.join(' ')).not.toContain('Блок не сработал')
    expect(result.events.join(' ')).toContain('Блок не сработал')
    expect(result.events.join(' ')).toContain('−30%')
  })

  test('in 2v2 Block can protect a teammate and triggers on a hit', () => {
    const guest = characterByName('Guest 1337')!
    const ally = characterByName('Noob')!
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'Guest', character: guest },
        { userId: 'c', name: 'Ally', character: ally },
      ],
      [
        { userId: 'b', name: 'Enemy', character: heavy },
        { userId: 'd', name: 'Enemy 2', character: heavy },
      ],
    )

    expect(specialNeedsAllyTarget(battle.sides[0])).toBe(true)
    expect(specialNeedsEnemyTarget(battle.sides[0])).toBe(false)

    const blocked = takeTurn(battle, 'special', () => 0, 2)
    expect(blocked.battle.sides[0].blocking).toBe(true)
    expect(blocked.battle.sides[0].blockTargetId).toBe(2)

    const hit = takeTurn(blocked.battle, 'attack', () => 0, 2)
    expect(hit.battle.sides[2].hp).toBe(ally.hp)
    expect(hit.battle.sides[0].blocking).toBe(false)
    expect(hit.battle.sides[0].blockTargetId).toBeNull()
    expect(hit.battle.sides[0].counterReady).toBe(true)
  })

  test('in 2v2 a missed Block gives Guest −30% dodge', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'Guest', character: characterByName('Guest 1337')! },
        { userId: 'c', name: 'Ally', character: characterByName('Noob')! },
      ],
      [
        { userId: 'b', name: 'Enemy', character: heavy },
        { userId: 'd', name: 'Enemy 2', character: heavy },
      ],
    )

    let current = takeTurn(battle, 'special', () => 0, 2).battle
    current = takeTurn(current, 'rest', () => 0).battle
    current = takeTurn(current, 'rest', () => 0).battle
    current = takeTurn(current, 'rest', () => 0).battle
    const result = takeTurn(current, 'rest', () => 0)
    expect(result.battle.sides[0].blocking).toBe(false)
    expect(result.battle.sides[0].blockTargetId).toBeNull()
    expect(jukeBonusOf(result.battle.sides[0])).toBeCloseTo(-0.3)
  })

  test('Block rejects an enemy as its target', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'Guest', character: characterByName('Guest 1337')! },
        { userId: 'c', name: 'Ally', character: characterByName('Noob')! },
      ],
      [
        { userId: 'b', name: 'Enemy', character: heavy },
        { userId: 'd', name: 'Enemy 2', character: heavy },
      ],
    )
    expect(() => takeTurn(battle, 'special', () => 0, 1)).toThrow('защитить')
  })
})

describe('Two Time prayer', () => {
  const prayer = () => characterWithSpecial(characterByName('Two Time')!, 'Pray')

  test('turns a full Oblation bar into 50 HP without arming the second life', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Two Time', character: prayer() },
      { userId: 'b', name: 'B', character: heavy },
    )
    battle.sides[0].hp = 40
    battle.sides[0].charge = 100

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].hp).toBe(90)
    expect(battle.sides[0].charge).toBe(0)
    expect(battle.sides[0].oblationArmed).toBe(false)
    expect(battle.sides[0].oblationSpent).toBe(false)
  })

  test('heals only Two Time in 2v2', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'Two Time', character: prayer() },
        { userId: 'a2', name: 'Ally', character: heavy },
      ],
      [
        { userId: 'b', name: 'Enemy', character: heavy },
        { userId: 'b2', name: 'Enemy 2', character: heavy },
      ],
    )
    battle.sides[0].hp = 40
    battle.sides[0].charge = 100
    battle.sides[2].hp = 50
    const result = takeTurn(battle, 'special', () => 0)
    expect(result.battle.sides[0].hp).toBe(90)
    expect(result.battle.sides[2].hp).toBe(50)
    expect(result.events.join(' ')).toContain('Two Time: +50')
    expect(result.events.join(' ')).not.toContain('Ally: +50')
  })

  test('heals proportionally at partial charge', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Two Time', character: prayer() },
      { userId: 'b', name: 'B', character: heavy },
    )
    battle.sides[0].hp = 50
    battle.sides[0].charge = 60

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].hp).toBe(80)
    expect(battle.sides[0].charge).toBe(0)
  })

  test('is unavailable without Oblation charge', () => {
    const battle = createBattle(
      { userId: 'a', name: 'Two Time', character: prayer() },
      { userId: 'b', name: 'B', character: heavy },
    )
    expect(specialReady(battle.sides[0])).toBe(false)
    battle.sides[0].charge = 25
    expect(specialReady(battle.sides[0])).toBe(true)
  })

  test('lands attacks build Oblation while prayer is equipped', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Two Time', character: prayer() },
      { userId: 'b', name: 'B', character: heavy },
    )
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].charge).toBe(25)
  })
})

describe('c00lkidd Corrupt Nature', () => {
  test('applies -60% dodge for two turns without dealing damage', () => {
    const c00lkidd = characterWithSpecial(characterByName('c00lkidd')!, 'Corrupt Nature')
    let battle = createBattle(
      { userId: 'a', name: 'c00lkidd', character: c00lkidd },
      { userId: 'b', name: 'B', character: heavy },
    )
    const opponentHp = battle.sides[1].hp

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[1].hp).toBe(opponentHp)
    expect(jukeBonusOf(battle.sides[1])).toBeCloseTo(-0.6)
  })
})

describe('Dusekkar plasma beam', () => {
  test('deals no damage but speeds Dusekkar and slows the opponent', () => {
    const dusekkar = characterWithSpecial(characterByName('Dusekkar')!, 'Plasma Beam')
    let battle = createBattle(
      { userId: 'a', name: 'Dusekkar', character: dusekkar },
      { userId: 'b', name: 'B', character: heavy },
    )
    const opponentHp = battle.sides[1].hp

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[1].hp).toBe(opponentHp)
    expect(battle.sides[0].hp).toBe(110)
    expect(battle.sides[0].tempHp).toBe(10)
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(0.15)
    expect(jukeBonusOf(battle.sides[1])).toBeCloseTo(-0.15)
  })

  test('temporary HP disappears at the start of the next turn', () => {
    const dusekkar = characterWithSpecial(characterByName('Dusekkar')!, 'Plasma Beam')
    let battle = createBattle(
      { userId: 'a', name: 'Dusekkar', character: dusekkar },
      { userId: 'b', name: 'B', character: heavy },
    )

    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    const result = takeTurn(battle, 'rest', () => 0)
    expect(result.battle.sides[0].hp).toBe(100)
    expect(result.battle.sides[0].tempHp).toBe(0)
    expect(result.events.join(' ')).toContain('временных HP')
  })
})

describe('Shedletsky sword switch', () => {
  test('switches to a random SFOTH sword and applies its effect', () => {
    const cases: Array<{
      roll: number
      name: string
      check: (battle: Battle, events: string[]) => void
    }> = [
      {
        roll: 0.01,
        name: 'SFOTH',
        check: battle => expect(battle.sides[0].effects.strength).toBe(2),
      },
      {
        roll: 0.14,
        name: 'Firebrand',
        check: battle => {
          expect(battle.sides[1].dotKind).toBe('burn')
          expect(battle.sides[1].dotTurns).toBe(2)
        },
      },
      {
        roll: 0.27,
        name: 'Venomshank',
        check: battle => expect(battle.sides[1].dotKind).toBe('poison'),
      },
      {
        roll: 0.39,
        name: 'Ice Dagger',
        check: (battle, events) => {
          expect(battle.sides[1].stunned).toBe(false)
          expect(events.join(' ')).toContain('пропускает')
        },
      },
      {
        roll: 0.52,
        name: 'Darkheart',
        check: battle => expect(battle.sides[0].lifesteal).toBe(true),
      },
      {
        roll: 0.64,
        name: 'Illumina',
        check: battle => expect(battle.sides[0].effects.regeneration).toBe(2),
      },
      {
        roll: 0.77,
        name: 'Ghostwalker',
        check: battle => {
          expect(battle.sides[0].dodging).toBe(true)
          expect(jukeBonusOf(battle.sides[0])).toBeGreaterThan(0)
        },
      },
      {
        roll: 0.9,
        name: 'Windforce',
        check: battle => expect(battle.sides[1].effects.weakness).toBe(2),
      },
    ]

    for (const entry of cases) {
      const shedletsky = characterWithSpecial(characterByName('Shedletsky')!, 'Sword Switch')
      const result = takeTurn(battleWith(shedletsky, heavy), 'special', () => entry.roll)
      expect(result.battle.sides[0].sword).toBe(entry.name)
      entry.check(result.battle, result.events)
    }
  })
})

describe('wiki status effects', () => {
  const statusFighter = (name: string, kind: Character['special']['kind'], power = 0) =>
    character({
      name: 'Status',
      role: 'survivor',
      attack: 10,
      special: { name, kind, power, description: '' },
    })

  test('Strength increases damage dealt by 20%', () => {
    let battle = battleWith(statusFighter('Raging Pace', 'strength'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[1].hp).toBe(88)
  })

  test('Weakness reduces damage dealt by 20%', () => {
    let battle = battleWith(statusFighter('Digital Footprint', 'weakness'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(92)
  })

  test('Vulnerable increases damage taken by 20%', () => {
    let battle = battleWith(statusFighter('Nova', 'vulnerable'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[1].hp).toBe(88)
  })

  test('Resistance reduces damage taken by 20%', () => {
    let battle = battleWith(statusFighter('Dispenser', 'resistance'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(92)
  })

  test('Creatures increases damage taken by 25%', () => {
    let battle = battleWith(statusFighter('Lacerate', 'creatures'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[1].hp).toBe(87)
  })

  test('Regeneration heals at the start of the turn', () => {
    let battle = battleWith(statusFighter('Regeneration', 'regeneration'), heavy)
    battle.sides[0].hp = 50
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(58)
  })

  test('Hemorrhage blocks healing', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Status', character: statusFighter('Eviscerate', 'hemorrhage') },
      { userId: 'b', name: 'B', character: healer },
    )
    battle.sides[1].hp = 50
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[1].hp).toBe(50)
  })

  test('Rest clears Hemorrhage without restoring HP', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Status', character: statusFighter('Eviscerate', 'hemorrhage') },
      { userId: 'b', name: 'B', character: heavy },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    battle.sides[1].hp = 50

    const cured = takeTurn(battle, 'rest', () => 0)
    expect(cured.battle.sides[1].hp).toBe(50)
    expect(cured.battle.sides[1].effects.hemorrhage).toBeUndefined()
    expect(cured.events.join(' ')).toContain('Hemorrhage')

    battle = takeTurn(cured.battle, 'rest', () => 0).battle
    const healed = takeTurn(battle, 'rest', () => 0)
    expect(healed.battle.sides[1].hp).toBe(60)
  })

  test('Glitch blocks the opponent special', () => {
    let battle = battleWith(statusFighter('Mass Infection', 'glitch'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(specialReady(battle.sides[1])).toBe(false)
  })

  test('Slateskin grants overheal, DoT immunity and a dodge penalty', () => {
    let battle = battleWith(statusFighter('Slateskin Potion', 'slateskin'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].hp).toBe(125)
    expect(battle.sides[0].effects.slateskin).toBe(2)
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(-0.1)
  })

  test('Haste speeds up cooldowns', () => {
    let battle = battleWith(statusFighter('c00lgui', 'haste'), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].cooldown).toBe(2)
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.sides[0].cooldown).toBe(0)
  })

  test('Haste accelerates cooldowns on both of its turns', () => {
    let battle = battleWith(heavy, healer)
    battle.sides[0].cooldown = 4
    battle.sides[0].effects.haste = 2
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.sides[0].cooldown).toBe(0)
  })

  test('cooldownAfterTick makes Haste save a turn on the button', () => {
    const battle = battleWith(heavy, healer)
    battle.sides[0].cooldown = 2
    expect(cooldownAfterTick(battle.sides[0])).toBe(1)
    battle.sides[0].effects.haste = 2
    expect(cooldownAfterTick(battle.sides[0])).toBe(0)
  })

  test('Bleeding is a damage-over-time status', () => {
    let battle = battleWith(statusFighter('Tripwire', 'bleed', 7), heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(93)
    expect(result.events.join(' ')).toContain('кровотечения')
  })
})

describe('Azure and Helperbot kits', () => {
  test('Seeker Bulb applies Atropa and the next attack consumes it for bonus damage', () => {
    const azure = characterByName('Azure')!
    let battle = battleWith(azure, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[1].hp).toBe(92)
    expect(battle.sides[1].atropa).toBe(3)

    battle = takeTurn(battle, 'attack', () => 0).battle
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(77)
    expect(result.battle.sides[1].atropa).toBe(0)
    expect(result.battle.sides[0].hp).toBe(91)
    expect(result.events.join(' ')).toContain('Atropa')
    expect(result.events.join(' ')).toContain('Atropic')
  })

  test('Stigmatize stuns and applies three Atropa stacks', () => {
    const azure = characterWithSpecial(characterByName('Azure')!, 'Stigmatize')
    const result = takeTurn(battleWith(azure, heavy), 'special', () => 0)
    expect(result.battle.sides[1].stunned).toBe(false)
    expect(result.battle.sides[1].atropa).toBe(3)
    expect(result.events.join(' ')).toContain('пропускает')
    expect(result.battle.turn).toBe(0)
  })

  test('Pulse applies Regeneration and Resistance', () => {
    const helperbot = characterByName('Helperbot')!
    let battle = battleWith(helperbot, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].effects.regeneration).toBe(2)
    expect(battle.sides[0].effects.resistance).toBe(2)
  })

  test('Inspiration applies Haste', () => {
    const helperbot = characterWithSpecial(characterByName('Helperbot')!, 'Inspiration')
    let battle = battleWith(helperbot, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].effects.haste).toBe(2)
  })
})

describe('surrender', () => {
  test('makes the opponent of the surrendering side the winner', () => {
    const result = surrender(battleWith(heavy, healer), 'a')
    expect(result.winner).toBe(1)
    expect(result.battle.finished).toBe(true)
    expect(result.battle.winner).toBe(1)
  })

  test('rejects a user who is not part of the battle', () => {
    expect(() => surrender(battleWith(heavy, healer), 'c')).toThrow('не участник')
  })
})

describe('c00lgui copy', () => {
  test('copies the enemy special and makes it ready immediately', () => {
    const n7 = characterWithSpecial(characterByName('007n7')!, 'c00lgui')
    let battle = createBattle(
      { userId: 'a', name: 'N7', character: n7 },
      { userId: 'b', name: 'Jason', character: characterByName('Jason')! },
    )

    const result = takeTurn(battle, 'special', () => 0)
    expect(specialOf(result.battle.sides[0]).name).toBe('Gashing Wound')
    expect(result.battle.sides[0].copiedFrom).toBe('Jason')
    expect(result.battle.sides[0].cooldown).toBe(0)
    expect(result.events.join(' ')).toContain('готова к использованию')

    battle = result.battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    const copiedTurn = takeTurn(battle, 'special', () => 0).battle
    expect(copiedTurn.sides[1].hp).toBe(82)
    expect(copiedTurn.sides[1].dotKind).toBe('bleeding')
    expect(copiedTurn.sides[0].cooldown).toBe(3)
  })

  test('copies the chosen enemy in 2v2', () => {
    const n7 = characterWithSpecial(characterByName('007n7')!, 'c00lgui')
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'N7', character: n7 },
        { userId: 'a', name: 'Mate', character: heavy },
      ],
      [
        { userId: 'b', name: 'Jason', character: characterByName('Jason')! },
        { userId: 'b', name: 'Noob', character: characterByName('Noob')! },
      ],
    )

    const result = takeTurn(battle, 'special', () => 0, 3).battle
    expect(specialOf(result.sides[0]).name).toBe('Bloxy Cola')
    expect(result.sides[0].copiedFrom).toBe('Noob')
  })

  test('does not copy the temporary Blood Hunt form', () => {
    const n7 = characterWithSpecial(characterByName('007n7')!, 'c00lgui')
    const guest = characterWithSpecial(characterByName('Guest 666')!, 'Infernal Cry')
    const battle = createBattle(
      { userId: 'a', name: 'N7', character: n7 },
      { userId: 'b', name: 'Guest', character: guest },
    )
    battle.sides[1].charge = 2
    expect(specialOf(battle.sides[1]).name).toBe('Blood Hunt')

    const result = takeTurn(battle, 'special', () => 0).battle
    expect(specialOf(result.sides[0]).name).toBe('Infernal Cry')
  })

  test('c00lgui asks for an enemy target', () => {
    const n7 = characterWithSpecial(characterByName('007n7')!, 'c00lgui')
    expect(specialNeedsEnemyTarget(battleWith(n7, heavy).sides[0])).toBe(true)
  })
})

describe('One Shot', () => {
  const chance = () => characterWithSpecial(characterByName('Chance')!, 'One Shot')

  test('fires for 24 and applies Vulnerable on a good roll', () => {
    const result = takeTurn(battleWith(chance(), heavy), 'special', () => 0).battle
    expect(result.sides[1].hp).toBe(76)
    expect(result.sides[1].effects.vulnerable).toBe(2)
    expect(result.sides[0].effects.weakness).toBeUndefined()
  })

  test('gives Chance Weakness on a bad roll', () => {
    const result = takeTurn(battleWith(chance(), heavy), 'special', () => 0.9).battle
    expect(result.sides[1].hp).toBe(100)
    expect(result.sides[0].effects.weakness).toBe(2)
    expect(result.sides[1].effects.vulnerable).toBeUndefined()
  })

  test('asks for an enemy target', () => {
    expect(specialNeedsEnemyTarget(battleWith(chance(), heavy).sides[0])).toBe(true)
  })
})

describe('balance cooldowns', () => {
  test('the tuned specials have a three-turn cooldown', () => {
    const tuned = [
      ['Azure', 'Stigmatize'],
      ['Jason', 'Gashing Wound'],
      ['c00lkidd', 'Corrupt Nature'],
      ['Noob', 'Slateskin Potion'],
      ['Builderman', 'Dispenser'],
      ['Taph', 'Subspace Tripmine'],
      ['Noli', 'Observant'],
    ] as const

    for (const [characterName, specialName] of tuned) {
      const character = characterWithSpecial(characterByName(characterName)!, specialName)
      expect(specialCooldown(character.special)).toBe(3)
    }
    expect(specialCooldown(characterWithSpecial(characterByName('Azure')!, 'Seeker Bulb'))).toBe(2)
    expect(specialCooldown(characterWithSpecial(characterByName('Noli')!, 'Nova'))).toBe(2)
  })

  test('Gashing Wound hits for 18 and applies bleeding', () => {
    const jason = characterWithSpecial(characterByName('Jason')!, 'Gashing Wound')
    let battle = createBattle(
      { userId: 'a', name: 'Jason', character: jason },
      { userId: 'b', name: 'B', character: heavy },
    )

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].cooldown).toBe(3)
    expect(battle.sides[1].hp).toBe(82)
    expect(battle.sides[1].dotKind).toBe('bleeding')
    expect(battle.sides[1].dotTurns).toBe(2)
    expect(battle.sides[1].dotDamage).toBe(6)

    const tick = takeTurn(battle, 'attack', () => 0).battle
    expect(tick.sides[1].hp).toBe(76)
    expect(tick.sides[1].dotTurns).toBe(1)
  })
})

describe('special states', () => {
  test('Infernal Cry upgrades to Blood Hunt after two cries and is immediately usable', () => {
    let battle = battleWith(crier, healer)
    expect(specialLabel(battle.sides[0])).toBe('Infernal Cry (0/2)')

    for (let use = 0; use < 2; use++) {
      battle = takeTurn(battle, 'special', () => 0).battle
      if (use < 1) {
        battle.sides[0].cooldown = 0
        battle = takeTurn(battle, 'rest', () => 0).battle
      }
    }
    expect(specialLabel(battle.sides[0])).toBe('Blood Hunt')
    expect(battle.sides[0].cooldown).toBe(0)

    battle = takeTurn(battle, 'rest', () => 0).battle
    const result = takeTurn(battle, 'special', () => 0)
    expect(result.battle.sides[1].hp).toBe(92)
    expect(result.battle.sides[0].bloodHuntCharges).toBe(3)
    expect(specialLabel(result.battle.sides[0])).toBe('Infernal Cry (0/2)')
  })

  test('Eviscerate also charges Blood Hunt', () => {
    const eviscerate = characterWithSpecial(characterByName('Guest 666')!, 'Eviscerate')
    let battle = createBattle(
      { userId: 'a', name: 'A', character: eviscerate },
      { userId: 'b', name: 'B', character: healer },
    )
    expect(specialLabel(battle.sides[0])).toBe('Eviscerate (0/2)')

    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].charge).toBe(1)
    expect(battle.sides[1].effects.hemorrhage).toBe(2)
    expect(specialLabel(battle.sides[0])).toBe('Eviscerate (1/2)')

    battle.sides[0].cooldown = 0
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].charge).toBe(2)
    expect(specialLabel(battle.sides[0])).toBe('Blood Hunt')
    expect(battle.sides[0].cooldown).toBe(0)

    battle = takeTurn(battle, 'rest', () => 0).battle
    const blood = takeTurn(battle, 'special', () => 0).battle
    expect(blood.sides[1].hp).toBe(92)
    expect(blood.sides[0].bloodHuntCharges).toBe(3)
    expect(blood.sides[0].charge).toBe(0)
    expect(specialLabel(blood.sides[0])).toBe('Eviscerate (0/2)')
  })

  test('Blood Hunt empowers the next three attacks and heals', () => {
    const battle = battleWith(hunter, healer)
    battle.sides[0].hp = 90

    const activation = takeTurn(battle, 'special', () => 0)
    expect(activation.battle.sides[1].hp).toBe(92)
    expect(activation.battle.sides[0].bloodHuntCharges).toBe(3)
    expect(jukeBonusOf(activation.battle.sides[0])).toBeCloseTo(0.15)

    let state = takeTurn(activation.battle, 'rest', () => 0).battle
    const hit1 = takeTurn(state, 'attack', () => 0)
    expect(hit1.battle.sides[1].hp).toBe(87)
    expect(hit1.battle.sides[0].hp).toBe(97)
    expect(hit1.battle.sides[0].bloodHuntCharges).toBe(2)

    state = takeTurn(hit1.battle, 'rest', () => 0).battle
    const hit2 = takeTurn(state, 'attack', () => 0)
    expect(hit2.battle.sides[1].hp).toBe(84)
    expect(hit2.battle.sides[0].hp).toBe(100)
    expect(hit2.battle.sides[0].bloodHuntCharges).toBe(1)

    state = takeTurn(hit2.battle, 'rest', () => 0).battle
    const hit3 = takeTurn(state, 'attack', () => 0)
    expect(hit3.battle.sides[1].hp).toBe(81)
    expect(hit3.battle.sides[0].bloodHuntCharges).toBe(0)

    state = takeTurn(hit3.battle, 'rest', () => 0).battle
    const hit4 = takeTurn(state, 'attack', () => 0)
    expect(hit4.battle.sides[1].hp).toBe(81)
  })

  test('Oblation cannot be used until attacks charge it', () => {
    let battle = battleWith(twoTime, healer)
    expect(specialLabel(battle.sides[0])).toBe('Oblation (0%)')
    expect(() => takeTurn(battle, 'special', () => 0)).toThrow('Oblation')

    for (let attack = 0; attack < 4; attack++) {
      battle = takeTurn(battle, 'attack', () => 0).battle
      battle = takeTurn(battle, 'rest', () => 0).battle
    }
    expect(battle.sides[0].charge).toBe(100)
    expect(specialLabel(battle.sides[0])).toBe('Oblation (100%)')

    battle.sides[0].hp = 40
    const result = takeTurn(battle, 'special', () => 0)
    expect(result.battle.sides[0].hp).toBe(40)
    expect(result.battle.sides[0].charge).toBe(0)
    expect(result.battle.sides[0].oblationArmed).toBe(true)
    expect(jukeBonusOf(result.battle.sides[0])).toBe(0)
  })

  test('Oblation grants a single second life at 40 HP', () => {
    let battle = battleWith(twoTime, heavy)
    for (let attack = 0; attack < 4; attack++) {
      battle = takeTurn(battle, 'attack', () => 0).battle
      battle = takeTurn(battle, 'rest', () => 0).battle
    }
    battle = takeTurn(battle, 'special', () => 0).battle
    battle.sides[0].hp = 5

    const revived = takeTurn(battle, 'attack', () => 0)
    expect(revived.battle.sides[0].hp).toBe(40)
    expect(revived.finished).toBe(false)
    expect(specialLabel(revived.battle.sides[0])).toBe('Oblation (потрачена)')

    const afterAttack = takeTurn(revived.battle, 'attack', () => 0)
    afterAttack.battle.sides[0].hp = 5
    const final = takeTurn(afterAttack.battle, 'attack', () => 0)
    expect(final.finished).toBe(true)
    expect(final.winner).toBe(1)
  })
})

describe('takeTurn', () => {
  test('attack damages the opponent and passes the turn', () => {
    const result = takeTurn(battleWith(heavy, healer), 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(90)
    expect(result.battle.turn).toBe(1)
    expect(result.events.length).toBeGreaterThan(0)
  })

  test('rest heals the active side', () => {
    const battle = battleWith(heavy, healer)
    battle.sides[0].hp = 80
    const result = takeTurn(battle, 'rest', () => 0)
    expect(result.battle.sides[0].hp).toBe(90)
  })

  test('heal special restores HP without exceeding the maximum', () => {
    const damaged = battleWith(healer, heavy)
    damaged.sides[0].hp = 50
    expect(takeTurn(damaged, 'special', () => 0).battle.sides[0].hp).toBe(80)

    const full = battleWith(healer, heavy)
    expect(takeTurn(full, 'special', () => 0).battle.sides[0].hp).toBe(100)
  })

  test('shield special reduces incoming damage once', () => {
    let battle = battleWith(shielder, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(96)
  })

  test('shield expires after one turn if it is not hit', () => {
    let battle = battleWith(shielder, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].shield).toBe(60)

    battle = takeTurn(battle, 'rest', () => 0).battle
    const result = takeTurn(battle, 'rest', () => 0)
    expect(result.battle.sides[0].shield).toBe(0)
  })

  test('shield breaks and saves the fighter from a lethal hit', () => {
    let battle = battleWith(shielder, heavy)
    battle.sides[0].hp = 5
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle

    expect(battle.sides[0].hp).toBe(1)
    expect(battle.sides[0].shield).toBe(0)
    expect(battle.finished).toBe(false)
    expect(battle.sides[0].counterReady).toBe(false)
  })

  test('a normal shield does not save from a lethal hit', () => {
    let battle = battleWith(potion, heavy)
    battle.sides[0].hp = 5
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle

    expect(battle.sides[0].hp).toBe(0)
    expect(battle.finished).toBe(true)
  })

  test('dodge special avoids the next attack', () => {
    let battle = battleWith(dodger, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(100)
  })

  test('stun special makes the opponent skip a turn', () => {
    const result = takeTurn(battleWith(stunner, heavy), 'special', () => 0)
    expect(result.battle.sides[0].hp).toBe(100)
    expect(result.battle.turn).toBe(0)
    expect(result.events.join(' ')).toContain('пропускает')
  })

  test('poison special damages the opponent at the start of their turn', () => {
    let battle = battleWith(poisoner, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(92)
  })

  test('lifesteal special heals on the next attack', () => {
    let battle = battleWith(lifestealer, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[0].hp).toBe(95)
  })

  test('gamble special doubles damage on a lucky roll and does nothing otherwise', () => {
    const hit = takeTurn(battleWith(gambler, healer), 'special', () => 0)
    expect(hit.battle.sides[1].hp).toBe(80)

    const miss = takeTurn(battleWith(gambler, healer), 'special', () => 0.9)
    expect(miss.battle.sides[1].hp).toBe(100)
  })

  test('finishes the battle when a side reaches zero HP', () => {
    const battle = battleWith(heavy, healer)
    battle.sides[1].hp = 5
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.finished).toBe(true)
    expect(result.winner).toBe(0)
  })

  test('juke lets a survivor evade the next attack', () => {
    let battle = battleWith(survivor, heavy)
    battle = takeTurn(battle, 'juke', () => 0).battle
    const result = takeTurn(battle, 'attack', sequence(0, 0))
    expect(result.battle.sides[0].hp).toBe(100)
  })

  test('juke survives non-attacks for up to two of the juker turns', () => {
    let battle = battleWith(survivor, heavy)
    battle = takeTurn(battle, 'juke', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.sides[0].juking).toBe(true)
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.sides[0].juking).toBe(true)
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(battle.sides[0].juking).toBe(false)
  })

  test('a stored juke still evades the next real attack', () => {
    let battle = battleWith(survivor, heavy)
    battle = takeTurn(battle, 'juke', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[0].hp).toBe(100)
    expect(result.battle.sides[0].juking).toBe(false)
  })

  test('a failed juke still takes damage', () => {
    let battle = battleWith(survivor, heavy)
    battle = takeTurn(battle, 'juke', () => 0).battle
    const result = takeTurn(battle, 'attack', sequence(0, 0.99))
    expect(result.battle.sides[0].hp).toBe(90)
  })

  test('everyone has 0% base dodge regardless of role', () => {
    const battle = battleWith(heavy, survivor)
    expect(jukeChanceOf(battle.sides[0])).toBe(0)
    expect(jukeChanceOf(battle.sides[1])).toBe(0)
  })

  test('the Dodge button gives everyone the same stance bonus', () => {
    const survivorBattle = battleWith(survivor, heavy)
    const killerBattle = battleWith(heavy, survivor)
    const dodgingSurvivor = takeTurn(survivorBattle, 'juke', () => 0).battle
    const dodgingKiller = takeTurn(killerBattle, 'juke', () => 0).battle
    expect(jukeChanceOf(dodgingSurvivor.sides[0])).toBeCloseTo(0.6)
    expect(jukeChanceOf(dodgingKiller.sides[0])).toBeCloseTo(0.6)
    expect(JUKE_STANCE_BONUS).toBeCloseTo(0.6)
  })

  test('Bloxy Cola adds evasion chance for two turns', () => {
    const result = takeTurn(battleWith(cola, heavy), 'special', () => 0)
    expect(jukeBonusOf(result.battle.sides[0])).toBeCloseTo(0.2)
    expect(result.battle.sides[0].jukeMods[0].turns).toBe(2)
  })

  test('the Bloxy Cola bonus raises the effective juke chance', () => {
    let battle = battleWith(cola, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    battle = takeTurn(battle, 'juke', () => 0).battle
    const result = takeTurn(battle, 'attack', sequence(0, 0.95))
    expect(result.battle.sides[0].hp).toBe(80)
  })

  test('Void Rush hits and lowers the opponent evasion chance', () => {
    let battle = battleWith(noli, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'juke', () => 0).battle
    const result = takeTurn(battle, 'attack', sequence(0, 0.85))
    expect(result.battle.sides[1].hp).toBe(80)
  })

  test('specials show a 2-turn cooldown while Blood Hunt has none', () => {
    const battle = battleWith(characterByName('Guest 666')!, heavy)
    expect(specialCooldown(battle.sides[0].character.special)).toBe(2)
    battle.sides[0].charge = 2
    expect(specialCooldown(specialOf(battle.sides[0]))).toBe(0)
  })

  test('Bloxy Cola speeds up instead of healing', () => {
    const battle = battleWith(cola, heavy)
    battle.sides[0].hp = 50
    const result = takeTurn(battle, 'special', () => 0)
    expect(result.battle.sides[0].hp).toBe(50)
    expect(jukeBonusOf(result.battle.sides[0])).toBeCloseTo(0.2)
  })

  test('turret and mines use their own damage wording', () => {
    let turretBattle = battleWith(turret, heavy)
    turretBattle = takeTurn(turretBattle, 'special', () => 0).battle
    const turretTick = takeTurn(turretBattle, 'attack', () => 0)
    expect(turretTick.events.join(' ')).toContain('турели')

    let trapBattle = battleWith(trap, heavy)
    trapBattle = takeTurn(trapBattle, 'special', () => 0).battle
    const trapTick = takeTurn(trapBattle, 'attack', () => 0)
    expect(trapTick.events.join(' ')).toContain('мин')
  })

  test('fried chicken lowers the evasion chance while eating', () => {
    const result = takeTurn(battleWith(chicken, heavy), 'special', () => 0)
    expect(jukeBonusOf(result.battle.sides[0])).toBeCloseTo(-0.1)
  })

  test('Pizza Delivery slows the opponent', () => {
    const result = takeTurn(battleWith(pizzaDelivery, heavy), 'special', () => 0)
    expect(jukeBonusOf(result.battle.sides[1])).toBeCloseTo(-0.1)
  })

  test('Pizza Delivery burns the opponent instead of poisoning them', () => {
    const application = takeTurn(battleWith(pizzaDelivery, heavy), 'special', () => 0)
    expect(application.events.join(' ')).toContain('горит')
    const result = takeTurn(application.battle, 'attack', () => 0)
    expect(result.events.join(' ')).toContain('от огня')
    expect(result.battle.sides[1].hp).toBe(92)
  })

  test('a debuff stacks with an existing buff instead of replacing it', () => {
    let battle = battleWith(cola, noli)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(0)
  })

  test('juke bonuses expire when their turns run out', () => {
    let battle = battleWith(cola, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle
    expect(jukeBonusOf(battle.sides[0])).toBe(0)
  })

  test('rejects a special while it is on cooldown', () => {
    let battle = battleWith(heavy, healer)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(() => takeTurn(battle, 'special', () => 0)).toThrow('не готова')
  })
})

describe('battle stats', () => {
  test('tracks damage dealt and taken', () => {
    const battle = takeTurn(battleWith(heavy, heavy), 'attack', () => 0).battle
    expect(battle.sides[0].damageDealt).toBe(10)
    expect(battle.sides[1].damageTaken).toBe(10)
  })

  test('tracks healing from specials', () => {
    let battle = battleWith(healer, heavy)
    battle.sides[0].hp = 50
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[0].hp).toBe(80)
    expect(battle.sides[0].healingDone).toBe(30)
  })

  test('credits damage over time to the caster', () => {
    let battle = battleWith(pizzaDelivery, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    const afterBurn = takeTurn(battle, 'juke', () => 0).battle
    expect(afterBurn.sides[1].hp).toBe(92)
    expect(afterBurn.sides[0].damageDealt).toBe(8)
  })

  test('a boss can use a second special with its own cooldown', () => {
    const boss = character({
      name: 'Boss',
      alternates: [{ name: 'Rage', kind: 'strength', power: 0, description: '' }],
    })
    const battle = createBattle(
      { userId: 'a', name: 'A', character: heavy },
      { userId: 'boss:1', name: 'Boss', character: boss, boss: true },
    )
    battle.turn = 1
    expect(specialOf(battle.sides[1], 1).name).toBe('Rage')
    const result = takeTurn(battle, 'special', () => 0, undefined, 1).battle
    expect(result.sides[1].effects.strength).toBe(2)
    expect(result.sides[1].secondCooldown).toBe(2)
    expect(result.sides[1].cooldown).toBe(0)
  })

  test('a boss prioritizes living Support characters over weaker targets', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'Support', character: characterByName('Elliot')! },
        { userId: 'a2', name: 'DPS', character: characterByName('Noob')! },
      ],
      [{ userId: 'boss:1', name: 'Boss', character: characterByName('Jason')!, boss: true }],
    )
    battle.turn = 1
    battle.sides[2].hp = 20
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[0].hp).toBeLessThan(100)
    expect(result.sides[2].hp).toBe(20)
  })
})

describe('character passives and new survivors', () => {
  const duel = (left: Character, right: Character): Battle =>
    createBattle(
      { userId: 'a', name: 'A', character: left },
      { userId: 'b', name: 'B', character: right },
    )
  const allies = (...characters: Character[]): FighterEntry[] =>
    characters.map((character, index) => ({
      userId: 'a',
      name: `A${index}`,
      character,
    }))
  const enemies = (): FighterEntry[] => [
    { userId: 'b', name: 'B0', character: heavy },
    { userId: 'b', name: 'B1', character: heavy },
  ]

  test('Jason Mute makes his first attack unavoidable', () => {
    const battle = duel(characterByName('Jason')!, heavy)
    battle.sides[1].dodging = true
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[1].hp).toBe(86)
  })

  test('1x1x1x1 Rejuvenate the Rotten raises a starting minion', () => {
    const battle = duel(characterByName('1x1x1x1')!, heavy)
    expect(battle.sides[0].rottenCorpses).toHaveLength(1)
    expect(specialLabel(battle.sides[0])).toContain('(1)')

    const summoned = takeTurn(battle, 'special', () => 0).battle
    const minion = summoned.sides.find(side => side.minion)
    expect(minion).toBeDefined()
    expect(minion?.maxHp).toBe(25)
    expect(minion?.character.attack).toBe(3)
    expect(summoned.sides[0].rottenCorpses).toHaveLength(0)
    expect(specialReady(summoned.sides[0])).toBe(false)
  })

  test('a bot 1x1x1x1 does not get a starting minion charge', () => {
    const battle = createBattle(
      { userId: 'bot:x', name: 'Bot', character: characterByName('1x1x1x1')! },
      { userId: 'a', name: 'A', character: heavy },
    )
    expect(battle.sides[0].rottenCorpses).toHaveLength(0)
    expect(specialReady(battle.sides[0])).toBe(false)
  })

  test('1x1x1x1 raises a 50 HP minion with half the killed enemy attack', () => {
    const battle = duel(characterByName('1x1x1x1')!, heavy)
    battle.sides[0].rottenCorpses = [{ attack: 7, source: 'Jason' }]
    const summoned = takeTurn(battle, 'special', () => 0).battle
    const minion = summoned.sides.find(side => side.minion)
    expect(minion?.maxHp).toBe(50)
    expect(minion?.hp).toBe(50)
    expect(minion?.character.attack).toBe(7)
  })

  test('1x1x1x1 gains a charge for every killed enemy', () => {
    const battle = duel(characterByName('1x1x1x1')!, heavy)
    battle.sides[1].hp = 1
    const result = takeTurn(battle, 'attack', () => 0.5).battle
    expect(result.sides[0].rottenCorpses).toHaveLength(2)
    expect(result.finished).toBe(true)
  })

  test('rotten minions apply Glitch on a basic hit', () => {
    let battle = duel(characterByName('1x1x1x1')!, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    const minionIndex = battle.sides.findIndex(side => side.minion)
    expect(minionIndex).toBeGreaterThan(0)
    battle.turn = minionIndex
    const result = takeTurn(battle, 'attack', () => 0.5).battle
    expect(result.sides[1].effects.glitch).toBeGreaterThan(0)
  })

  test('Rejuvenate spends every charge and raises every corpse at once', () => {
    const battle = duel(characterByName('1x1x1x1')!, heavy)
    expect(specialCooldown(specialOf(battle.sides[0]))).toBe(0)
    battle.sides[0].rottenCorpses = [
      { attack: 3, source: 'fresh' },
      { attack: 6, source: 'Jason' },
      { attack: 5, source: 'Noob' },
    ]
    const summoned = takeTurn(battle, 'special', () => 0).battle
    const minions = summoned.sides.filter(side => side.minion)
    expect(minions).toHaveLength(3)
    expect(minions.map(minion => minion.maxHp)).toEqual([25, 50, 50])
    expect(minions.map(minion => minion.character.attack)).toEqual([3, 6, 5])
    expect(summoned.sides[0].rottenCorpses).toHaveLength(0)
  })

  test('a minion kill also grants a charge to 1x1x1x1', () => {
    let battle = duel(characterByName('1x1x1x1')!, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    const minionIndex = battle.sides.findIndex(side => side.minion)
    battle.turn = minionIndex
    battle.sides[1].hp = 1
    const result = takeTurn(battle, 'attack', () => 0.5).battle
    expect(result.sides[0].rottenCorpses).toHaveLength(1)
  })

  test('minions crumble when their 1x1x1x1 owner dies', () => {
    let battle = duel(characterByName('1x1x1x1')!, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle.sides[0].hp = 1
    battle.turn = 1
    const result = takeTurn(battle, 'attack', () => 0.5).battle
    expect(result.sides.filter(side => side.minion).every(side => side.hp === 0)).toBe(true)
  })

  test('a dead 2v2 partner does not kill 1x1x1x1 minions', () => {
    let battle = createTeamBattle(
      [
        { userId: 'a', name: 'A', character: characterByName('1x1x1x1')! },
        { userId: 'a', name: 'A2', character: characterByName('Noob')! },
      ],
      [
        { userId: 'b', name: 'B', character: heavy },
        { userId: 'b', name: 'B2', character: heavy },
      ],
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    const minion = battle.sides.find(side => side.minion)!
    const partnerIndex = battle.sides.findIndex(
      side => side.userId === 'a' && side.character.name === 'Noob' && !side.minion,
    )
    battle.sides[partnerIndex].hp = 1
    battle.turn = battle.sides.findIndex(side => side.team === 1)
    const result = takeTurn(battle, 'attack', () => 0.5, partnerIndex).battle
    const survivor = result.sides.find(side => side.id === minion.id)
    expect(survivor?.hp).toBeGreaterThan(0)
  })

  test('Mass Infection is still Poison', () => {
    const infection = characterWithSpecial(characterByName('1x1x1x1')!, 'Mass Infection')
    const infected = takeTurn(duel(infection, heavy), 'special', () => 0).battle
    expect(infected.sides[1].dotKind).toBe('poison')
    expect(jukeBonusOf(infected.sides[1])).toBeCloseTo(-0.15)
  })

  test('Noli Nova deals 8 damage and lowers dodge by 25%', () => {
    const noli = characterWithSpecial(characterByName('Noli')!, 'Nova')
    let battle = duel(noli, heavy)
    const nova = takeTurn(battle, 'special', () => 0)
    expect(nova.battle.sides[1].hp).toBe(92)
    expect(jukeBonusOf(nova.battle.sides[1])).toBeCloseTo(-0.25)
    expect(nova.battle.sides[1].effects.vulnerable).toBeUndefined()

    battle = takeTurn(nova.battle, 'attack', () => 0).battle
    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(79)
    expect(result.events.join(' ')).not.toContain('Hallucinations: +2')
  })

  test('Noli Observant creates a fake Noli that pops when hit', () => {
    const noli = characterWithSpecial(characterByName('Noli')!, 'Observant')
    let battle = duel(noli, heavy)
    battle.sides[0].hp = 70
    battle.sides[0].effects.strength = 2
    const spawned = takeTurn(battle, 'special', () => 0)
    expect(spawned.battle.sides).toHaveLength(3)
    const fake = spawned.battle.sides[2]
    expect(fake.fake).toBe(true)
    expect(fake.hp).toBe(70)
    expect(fake.effects.strength).toBe(spawned.battle.sides[0].effects.strength)
    expect(fake.effects.strength).toBeGreaterThan(0)
    expect(spawned.battle.turn).toBe(1)

    const rest = takeTurn(spawned.battle, 'rest', () => 0).battle
    expect(rest.turn).toBe(0)
    const noliTurn = takeTurn(rest, 'rest', () => 0)
    expect(noliTurn.battle.sides[1].hp).toBe(99)

    const hit = takeTurn(spawned.battle, 'attack', () => 0, 2)
    expect(hit.battle.sides[2].hp).toBe(0)
    expect(hit.battle.sides[0].hp).toBe(70)
    expect(hit.events.join(' ')).toContain('Фейковый Ноли исчезает')
  })

  test('a fake Noli stays when the real Noli is hit', () => {
    const noli = characterWithSpecial(characterByName('Noli')!, 'Observant')
    let battle = duel(noli, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    battle.sides[0].hallucinationReady = false
    const hit = takeTurn(battle, 'attack', () => 0, 0)
    expect(hit.battle.sides[0].hp).toBeLessThan(100)
    expect(hit.battle.sides[2].hp).toBe(100)
    expect(hit.events.join(' ')).not.toContain('Фейковый Ноли исчезает')
  })

  test('a fake Noli does not keep the battle alive', () => {
    const noli = characterWithSpecial(characterByName('Noli')!, 'Observant')
    let battle = duel(noli, heavy)
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides[2].fake).toBe(true)
    battle.sides[0].hp = 0
    const result = takeTurn(battle, 'rest', () => 0)
    expect(result.finished).toBe(true)
    expect(result.winner).toBe(1)
  })

  test('Noli Hallucinations absorbs the first hit', () => {
    let battle = duel(heavy, characterByName('Noli')!)
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[1].hp).toBe(100)
    battle = takeTurn(battle, 'rest', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    expect(battle.sides[1].hp).toBe(90)
  })

  test('John Doe Digital Footprint deals damage and applies Weakness', () => {
    const john = characterWithSpecial(characterByName('John Doe')!, 'Digital Footprint')
    const result = takeTurn(duel(john, heavy), 'special', () => 0)
    expect(result.battle.sides[1].hp).toBe(94)
    expect(result.battle.sides[1].effects.weakness).toBe(2)
  })

  test('John Doe punishes the attacker with a dodge penalty', () => {
    const battle = takeTurn(duel(heavy, characterByName('John Doe')!), 'attack', () => 0).battle
    expect(jukeBonusOf(battle.sides[0])).toBeCloseTo(-0.1)
  })

  test('1x1x1x1 applies poison with basic attacks', () => {
    const battle = takeTurn(duel(characterByName('1x1x1x1')!, heavy), 'attack', () => 0).battle
    expect(battle.sides[1].dotKind).toBe('poison')
    expect(battle.sides[1].dotTurns).toBe(1)
    expect(battle.sides[1].dotDamage).toBe(2)
  })

  test('Guest 666 gets bonus damage against bleeding targets', () => {
    const battle = duel(characterByName('Guest 666')!, heavy)
    battle.sides[1].dotKind = 'bleeding'
    battle.sides[1].dotTurns = 2
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[1].hp).toBe(83)
  })

  test('Nosferatu heals from basic attacks', () => {
    const battle = duel(characterByName('Nosferatu')!, heavy)
    battle.sides[0].hp = 50
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[0].hp).toBe(53)
  })

  test('Azure Atropic adds Atropa damage and heals per two stacks', () => {
    const battle = duel(characterByName('Azure')!, heavy)
    battle.sides[0].hp = 50
    battle.sides[1].atropa = 2
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[1].hp).toBe(86)
    expect(result.sides[0].hp).toBe(51)
  })

  test('007n7 exploits a target whose ability is on cooldown', () => {
    const battle = duel(characterByName('007n7')!, heavy)
    battle.sides[1].cooldown = 2
    const result = takeTurn(battle, 'attack', () => 0).battle
    expect(result.sides[1].hp).toBe(86)
  })

  test('Elliot First Aid heals a heavily hit ally', () => {
    const elliot = characterByName('Elliot')!
    const battle = createTeamBattle(allies(elliot, heavy), enemies())
    battle.sides[2].hp = 50
    battle.sides[2].tookHeavyHit = true
    const result = takeTurn(battle, 'juke', () => 0).battle
    expect(result.sides[2].hp).toBe(54)
  })

  test('Taph Tripwire lowers the target dodge', () => {
    const battle = takeTurn(duel(characterByName('Taph')!, heavy), 'attack', () => 0).battle
    expect(jukeBonusOf(battle.sides[1])).toBeCloseTo(-0.1)
  })

  test('Chance rolls a battle-start fate once', () => {
    const lucky = takeTurn(duel(characterByName('Chance')!, heavy), 'juke', () => 0).battle
    expect(jukeBonusOf(lucky.sides[0])).toBeCloseTo(0.1)
    const shielded = takeTurn(duel(characterByName('Chance')!, heavy), 'juke', () => 0.9).battle
    expect(shielded.sides[0].shield).toBe(10)
    expect(shielded.sides[0].fateRolled).toBe(true)
  })

  test('Dusekkar Levitation removes one negative dodge modifier', () => {
    const battle = duel(characterByName('Dusekkar')!, heavy)
    battle.sides[0].jukeMods.push({ source: 'Slow', amount: -0.1, turns: 2 })
    battle.sides[0].jukeMods.push({ source: 'Buff', amount: 0.1, turns: 2 })
    const result = takeTurn(battle, 'juke', () => 0).battle
    expect(result.sides[0].jukeMods.some(mod => mod.source === 'Slow')).toBe(false)
    expect(result.sides[0].jukeMods.some(mod => mod.source === 'Buff')).toBe(true)
  })

  test('Helperbot passive heals the most wounded ally', () => {
    const battle = duel(characterByName('Helperbot')!, heavy)
    battle.sides[0].hp = 50
    const result = takeTurn(battle, 'juke', () => 0).battle
    expect(result.sides[0].hp).toBe(52)
  })

  test('Veeronica spends battery to ride Sk8', () => {
    const veeronica = characterByName('Veeronica')!
    const battle = createTeamBattle(allies(veeronica, heavy), enemies())
    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].charge).toBe(30)
    expect(jukeBonusOf(result.sides[0])).toBeCloseTo(0.25)
    expect(jukeBonusOf(result.sides[2])).toBeCloseTo(0)
  })

  test('Veeronica overcharges Sk8 at full battery', () => {
    const battle = duel(characterByName('Veeronica')!, heavy)
    battle.sides[0].charge = 100
    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].charge).toBe(50)
    expect(jukeBonusOf(result.sides[0])).toBeCloseTo(0.35)
    expect(result.sides[0].jukeMods.find(mod => mod.source === 'Sk8')?.turns).toBe(2)
  })

  test('Veeronica overcharges Activate Battery at full battery', () => {
    const veeronica = characterWithSpecial(characterByName('Veeronica')!, 'Activate Battery')
    const battle = duel(veeronica, heavy)
    battle.sides[0].charge = 100
    battle.sides[0].hp = 50
    const result = takeTurn(battle, 'special', () => 0).battle
    expect(result.sides[0].charge).toBe(50)
    expect(result.sides[0].hp).toBe(75)
  })

  test('Veeronica battery thresholds change dodge chance', () => {
    const battle = duel(characterByName('Veeronica')!, heavy)
    battle.sides[0].charge = 100
    expect(jukeChanceOf(battle.sides[0])).toBeCloseTo(0.05)
    const high = takeTurn(battle, 'juke', () => 0).battle
    expect(jukeChanceOf(high.sides[0])).toBeCloseTo(0.65)

    battle.sides[0].charge = 0
    expect(jukeChanceOf(battle.sides[0])).toBe(0)
    const low = takeTurn(battle, 'juke', () => 0).battle
    expect(jukeChanceOf(low.sides[0])).toBeCloseTo(0.55)
  })

  test('Veeronica gains extra battery when resting', () => {
    const battle = duel(characterByName('Veeronica')!, heavy)
    battle.sides[0].hp = 50
    battle.sides[0].charge = 30
    const result = takeTurn(battle, 'rest', () => 0).battle
    expect(result.sides[0].hp).toBe(60)
    expect(result.sides[0].charge).toBe(60)
  })

  test('Veeronica Activate Battery heals but cannot be healed by allies', () => {
    const veeronica = characterWithSpecial(characterByName('Veeronica')!, 'Activate Battery')
    const batteryBattle = duel(veeronica, heavy)
    batteryBattle.sides[0].hp = 50
    const batteryResult = takeTurn(batteryBattle, 'special', () => 0).battle
    expect(batteryResult.sides[0].hp).toBe(70)
    expect(batteryResult.sides[0].charge).toBe(5)

    const healerBattle = createTeamBattle(allies(healer, characterByName('Veeronica')!), enemies())
    healerBattle.sides[0].hp = 50
    healerBattle.sides[2].hp = 50
    const healed = takeTurn(healerBattle, 'special', () => 0).battle
    expect(healed.sides[0].hp).toBe(80)
    expect(healed.sides[2].hp).toBe(50)
  })

  test('Jane Doe Hatchet consumes Resonance and stuns at three stacks', () => {
    const jane = characterByName('Jane Doe')!
    const battle = duel(jane, heavy)
    battle.sides[0].shatterpoint = 10
    battle.sides[1].resonance = 3
    battle.sides[1].resonanceTurns = 2
    const turn = takeTurn(battle, 'attack', () => 0)
    const result = turn.battle
    expect(result.sides[1].hp).toBe(78)
    expect(turn.events.join(' ')).toContain('пропускает ход')
    expect(result.sides[1].resonance).toBe(0)
    expect(result.sides[0].shatterpoint).toBe(18)
  })

  test('Jane Doe Crystal Pitch applies Resonance and Purified grants resistance', () => {
    const jane = characterByName('Jane Doe')!
    const crystal = takeTurn(duel(jane, heavy), 'special', () => 0).battle
    expect(crystal.sides[1].resonance).toBe(2)
    expect(crystal.sides[1].hp).toBe(91)

    const purified = characterWithSpecial(jane, 'Purified')
    const support = createTeamBattle(allies(purified, heavy), enemies())
    support.sides[2].hp = 50
    const buffed = takeTurn(support, 'special', () => 0).battle
    expect(buffed.sides[0].purified).toBe(true)
    expect(buffed.sides[2].purified).toBe(true)
    expect(buffed.sides[2].hp).toBe(50)
    expect(jukeBonusOf(buffed.sides[2])).toBe(0)

    const hit = takeTurn(buffed, 'attack', () => 0, 2)
    expect(hit.battle.sides[2].hp).toBe(44)
    expect(hit.battle.sides[2].purified).toBe(false)
    expect(hit.events.join(' ')).toContain('Purified снижает урон на 40%')
  })

  test('Purified scales with lost HP, caps at 80% and is consumed by one hit', () => {
    const purified = characterWithSpecial(characterByName('Jane Doe')!, 'Purified')
    let battle = duel(purified, heavy)
    battle.sides[0].hp = 20
    battle.sides[0].shatterpoint = 0
    battle = takeTurn(battle, 'special', () => 0).battle

    const first = takeTurn(battle, 'attack', () => 0).battle
    expect(first.sides[0].hp).toBe(18)
    expect(first.sides[0].purified).toBe(false)

    const second = takeTurn(takeTurn(first, 'attack', () => 0).battle, 'attack', () => 0).battle
    expect(second.sides[0].hp).toBe(8)
  })
})

describe('survival healing balance', () => {
  test('healingMultiplier scales passive and rest healing', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Helperbot')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    battle.sides[0].hp = 50
    battle.sides[0].healingMultiplier = 0.5
    expect(takeTurn(battle, 'rest', () => 0).battle.sides[0].hp).toBe(56)
  })
})

describe('LMS synergies in 2v2', () => {
  const pairTeam = (first: string, second: string): FighterEntry[] => [
    { userId: 'a', name: 'A', character: characterByName(first)! },
    { userId: 'a', name: 'A2', character: characterByName(second)! },
  ]
  const enemyTeam = (): FighterEntry[] => [
    { userId: 'b', name: 'B', character: characterByName('Noob')! },
    { userId: 'b', name: 'B2', character: characterByName('Jason')! },
  ]

  test('assigns the LMS pair to both members of the same team', () => {
    const battle = createTeamBattle(pairTeam('007n7', 'c00lkidd'), enemyTeam())
    expect(battle.sides[0].synergy?.id).toBe('plead')
    expect(battle.sides[2].synergy?.id).toBe('plead')
    expect(battle.sides[1].synergy).toBeNull()
  })

  test('Plead grants dodge to the partner when one of them dodges', () => {
    const battle = createTeamBattle(pairTeam('007n7', 'c00lkidd'), enemyTeam())
    battle.sides[0].juking = true
    battle.sides[0].jukingTurns = 2
    battle.turn = 1

    const result = takeTurn(battle, 'attack', () => 0)
    const mod = result.battle.sides[2].jukeMods.find(entry => entry.source === 'Plead')
    expect(mod?.amount).toBeCloseTo(0.1)
    expect(result.events.join(' ')).toContain('Plead')
  })

  test('Survival for the Fittest buffs both partners after a successful Block', () => {
    const battle = createTeamBattle(pairTeam('Guest 1337', 'Jason'), enemyTeam())
    battle.sides[0].blocking = true
    battle.sides[0].blockTargetId = 0
    battle.turn = 1

    const result = takeTurn(battle, 'attack', () => 0, 0)
    for (const index of [0, 2]) {
      const mod = result.battle.sides[index].jukeMods.find(
        entry => entry.source === 'Survival for the Fittest',
      )
      expect(mod?.amount).toBeCloseTo(0.1)
    }
    expect(result.events.join(' ')).toContain('Survival for the Fittest')
  })

  test('You and I heals the partner after a basic attack', () => {
    const battle = createTeamBattle(pairTeam('John Doe', 'Jane Doe'), enemyTeam())
    battle.sides[2].hp = 50
    battle.turn = 0

    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[2].hp).toBe(52)
    expect(result.events.join(' ')).toContain('You and I')
  })

  test('Creation of Hatred adds damage while the Shedletsky sword is active', () => {
    const battle = createTeamBattle(pairTeam('Shedletsky', '1x1x1x1'), enemyTeam())
    battle.sides[0].sword = 'SFOTH'
    battle.sides[0].swordTurns = 2
    battle.turn = 2

    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[1].hp).toBe(81)
    expect(result.events.join(' ')).toContain('Creation of Hatred')
  })

  test('Dead Ringer gives Guest 666 dodge from Bloxy Cola', () => {
    const battle = createTeamBattle(pairTeam('Noob', 'Guest 666'), enemyTeam())
    const result = takeTurn(battle, 'special', () => 0)
    const mod = result.battle.sides[2].jukeMods.find(entry => entry.source === 'Dead Ringer')
    expect(mod?.amount).toBeCloseTo(0.1)
    expect(result.events.join(' ')).toContain('Dead Ringer')
  })

  test('And the Seraphim Wept charges Oblation when Azure consumes Atropa', () => {
    const battle = createTeamBattle(pairTeam('Azure', 'Two Time'), enemyTeam())
    battle.sides[1].atropa = 3
    battle.sides[1].atropaTurns = 3
    battle.sides[2].charge = 20
    battle.turn = 0

    const result = takeTurn(battle, 'attack', () => 0)
    expect(result.battle.sides[2].charge).toBe(30)
    expect(result.events.join(' ')).toContain('And the Seraphim Wept')
  })
})
