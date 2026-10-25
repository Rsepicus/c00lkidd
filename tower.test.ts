import { describe, expect, test } from 'bun:test'
import {
  CHARACTERS,
  availableSpecials,
  characterByName,
  type Character,
} from './forsaken'
import type { FighterEntry } from './pvp'
import {
  TOWER_FLOORS,
  advanceTowerRun,
  createTowerBattle,
  createTowerRun,
  towerFloor,
  towerReward,
  towerRunSummary,
  towerSummary,
} from './tower'

const SEED = 20261025

function charactersOf(floor: ReturnType<typeof towerFloor>): Character[] {
  return floor.enemies.map(enemy => enemy.character)
}

function playerEntries(): FighterEntry[] {
  return [
    {
      userId: 'player:one',
      name: 'Player One',
      character: characterByName('Jason')!,
    },
    {
      userId: 'player:one',
      name: 'Player One (partner)',
      character: characterByName('Elliot')!,
    },
  ]
}

describe('tower floor composition', () => {
  test('builds ten floors with two AI opponents each', () => {
    expect(TOWER_FLOORS).toBe(10)
    expect(characterByName('Jason')).toBeDefined()

    for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
      const floor = towerFloor(floorNumber, SEED)
      expect(floor.floor).toBe(floorNumber)
      expect(floor.enemies).toHaveLength(2)
      expect(floor.reward).toBe(towerReward(floorNumber))
      expect(floor.hpMultiplier).toBeGreaterThan(0)
      expect(floor.attackMultiplier).toBeGreaterThan(0)

      for (const enemy of floor.enemies) {
        expect(enemy.userId.startsWith('bot:tower:')).toBe(true)
        expect(enemy.name.length).toBeGreaterThan(0)
        expect(CHARACTERS.some(character => character.name === enemy.character.name)).toBe(
          true,
        )
        expect(
          availableSpecials(enemy.character).some(
            special => special.name === enemy.character.special.name,
          ),
        ).toBe(true)
      }
    }
  })

  test('never repeats a character within one enemy team', () => {
    for (let seed = 0; seed < 40; seed++) {
      for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
        const names = charactersOf(towerFloor(floorNumber, seed)).map(
          character => character.name,
        )
        expect(new Set(names).size).toBe(names.length)
      }
    }
  })

  test('produces the same floor and ordering for the same seed', () => {
    for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
      const first = towerFloor(floorNumber, SEED)
      const second = towerFloor(floorNumber, SEED)
      expect(second).toEqual(first)
      expect(second.enemies).not.toBe(first.enemies)
    }

    const otherSeed = towerFloor(1, SEED + 1)
    expect(otherSeed).not.toEqual(towerFloor(1, SEED))
    expect(towerFloor(2, SEED)).not.toEqual(towerFloor(1, SEED))
  })

  test('rejects invalid floors and seeds', () => {
    for (const floorNumber of [0, -1, 1.5, TOWER_FLOORS + 1]) {
      expect(() => towerFloor(floorNumber, SEED)).toThrow()
    }
    for (const seed of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => towerFloor(1, seed)).toThrow()
      expect(() => createTowerRun(seed)).toThrow()
    }
  })
})

describe('tower difficulty curve', () => {
  test('escalates HP and attack multipliers on every floor', () => {
    const hpMultipliers: number[] = []
    const attackMultipliers: number[] = []

    for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
      const floor = towerFloor(floorNumber, SEED)
      hpMultipliers.push(floor.hpMultiplier)
      attackMultipliers.push(floor.attackMultiplier)
    }

    expect(hpMultipliers).toEqual([1, 1.15, 1.3, 1.45, 1.6, 1.8, 2, 2.25, 2.5, 2.8])
    expect(attackMultipliers).toEqual([
      1, 1.12, 1.24, 1.38, 1.52, 1.68, 1.86, 2.04, 2.22, 2.4,
    ])

    for (let index = 1; index < TOWER_FLOORS; index++) {
      expect(hpMultipliers[index]).toBeGreaterThan(hpMultipliers[index - 1])
      expect(attackMultipliers[index]).toBeGreaterThan(attackMultipliers[index - 1])
    }
  })

  test('applies the documented multipliers to the selected characters', () => {
    for (let seed = 0; seed < 5; seed++) {
      for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
        const floor = towerFloor(floorNumber, seed)
        for (const enemy of floor.enemies) {
          const base = characterByName(enemy.character.name)!
          expect(enemy.character.hp).toBe(
            Math.max(1, Math.round(base.hp * floor.hpMultiplier)),
          )
          expect(enemy.character.attack).toBe(
            Math.max(1, Math.round(base.attack * floor.attackMultiplier)),
          )
        }
      }
    }

    const first = towerFloor(1, SEED)
    const last = towerFloor(TOWER_FLOORS, SEED)
    expect(first.enemies[0].character.hp).toBe(
      characterByName(first.enemies[0].character.name)!.hp,
    )
    expect(last.enemies[0].character.hp).toBeGreaterThan(
      first.enemies[0].character.hp,
    )
    expect(last.enemies[0].character.attack).toBeGreaterThan(
      first.enemies[0].character.attack,
    )
  })
})

describe('tower battles', () => {
  test('creates a 2v2 battle with the player on team 0 and AI on team 1', () => {
    const floor = towerFloor(4, SEED)
    const players = playerEntries()
    const battle = createTowerBattle(floor, players)

    expect(battle.finished).toBe(false)
    expect(battle.winner).toBeNull()
    expect(battle.sides).toHaveLength(4)
    expect(battle.sides.map(side => side.team)).toEqual([0, 1, 0, 1])
    expect(battle.sides[0].character.name).toBe('Jason')
    expect(battle.sides[1].character.name).toBe(floor.enemies[0].character.name)
    expect(battle.sides[2].character.name).toBe('Elliot')
    expect(battle.sides[3].character.name).toBe(floor.enemies[1].character.name)
    expect(battle.sides[1].maxHp).toBe(floor.enemies[0].character.hp)
    expect(battle.sides[3].character.attack).toBe(floor.enemies[1].character.attack)
    expect(battle.sides[3].character.special.name).toBe(
      floor.enemies[1].character.special.name,
    )
  })

  test('does not mutate the floor plan or player entries', () => {
    const floor = towerFloor(2, SEED)
    const players = playerEntries()
    const beforeFloor = structuredClone(floor)
    const beforePlayers = structuredClone(players)

    createTowerBattle(floor, players)

    expect(floor).toEqual(beforeFloor)
    expect(players).toEqual(beforePlayers)
  })

  test('requires exactly two player fighters', () => {
    const floor = towerFloor(1, SEED)
    expect(() => createTowerBattle(floor, playerEntries().slice(0, 1))).toThrow()
    expect(() =>
      createTowerBattle(floor, [
        ...playerEntries(),
        {
          userId: 'player:one',
          name: 'Third',
          character: characterByName('Noob')!,
        },
      ]),
    ).toThrow()
  })
})

describe('tower runs', () => {
  test('creates a deterministic active run at floor one', () => {
    const run = createTowerRun(SEED)
    expect(run).toEqual({
      seed: SEED,
      floor: 1,
      cleared: 0,
      status: 'active',
    })
    expect(createTowerRun(SEED)).toEqual(run)
    expect(createTowerRun(SEED).floor).toBe(1)
  })

  test('advances through wins without mutating the previous run', () => {
    let run = createTowerRun(SEED)
    for (let floorNumber = 1; floorNumber < TOWER_FLOORS; floorNumber++) {
      const previous = run
      run = advanceTowerRun(run, true)
      expect(run.floor).toBe(floorNumber + 1)
      expect(run.cleared).toBe(floorNumber)
      expect(run.status).toBe('active')
      expect(previous.floor).toBe(floorNumber)
      expect(previous.cleared).toBe(floorNumber - 1)
      expect(previous.status).toBe('active')
    }

    const completed = advanceTowerRun(run, true)
    expect(completed.status).toBe('completed')
    expect(completed.floor).toBe(TOWER_FLOORS)
    expect(completed.cleared).toBe(TOWER_FLOORS)
    expect(advanceTowerRun(completed, true)).toEqual(completed)
    expect(advanceTowerRun(completed, false)).toEqual(completed)
  })

  test('marks a loss as failed and stops at the attempted floor', () => {
    let run = createTowerRun(SEED)
    run = advanceTowerRun(run, true)
    run = advanceTowerRun(run, true)
    expect(run.floor).toBe(3)

    const failed = advanceTowerRun(run, false)
    expect(failed.status).toBe('failed')
    expect(failed.floor).toBe(3)
    expect(failed.cleared).toBe(2)
    expect(advanceTowerRun(failed, true)).toEqual(failed)
  })
})

describe('tower rewards and summary', () => {
  test('rewards every deeper floor more than the last', () => {
    const rewards = Array.from({ length: TOWER_FLOORS }, (_, index) =>
      towerReward(index + 1),
    )
    expect(rewards).toEqual([50, 80, 115, 155, 200, 255, 320, 395, 480, 600])
    for (let index = 1; index < rewards.length; index++) {
      expect(rewards[index]).toBeGreaterThan(rewards[index - 1])
    }

    for (const floorNumber of [0, -1, 1.5, TOWER_FLOORS + 1]) {
      expect(() => towerReward(floorNumber)).toThrow()
    }
  })

  test('summarizes active, failed, and completed runs', () => {
    let run = createTowerRun(SEED)
    const initial = towerRunSummary(run)
    expect(initial).toEqual({
      seed: SEED,
      status: 'active',
      floor: 1,
      totalFloors: TOWER_FLOORS,
      floorsCleared: 0,
      nextFloor: 2,
      rewardEarned: 0,
    })

    run = advanceTowerRun(run, true)
    expect(towerRunSummary(run)).toMatchObject({
      status: 'active',
      floor: 2,
      floorsCleared: 1,
      nextFloor: 3,
      rewardEarned: towerReward(1),
    })

    const failed = advanceTowerRun(run, false)
    expect(towerSummary(failed)).toEqual({
      seed: SEED,
      status: 'failed',
      floor: 2,
      totalFloors: TOWER_FLOORS,
      floorsCleared: 1,
      nextFloor: null,
      rewardEarned: towerReward(1),
    })

    let current = createTowerRun(SEED)
    for (let floorNumber = 1; floorNumber <= TOWER_FLOORS; floorNumber++) {
      current = advanceTowerRun(current, true)
    }
    expect(towerRunSummary(current)).toEqual({
      seed: SEED,
      status: 'completed',
      floor: TOWER_FLOORS,
      totalFloors: TOWER_FLOORS,
      floorsCleared: TOWER_FLOORS,
      nextFloor: null,
      rewardEarned: 2650,
    })
    expect(towerSummary).toBe(towerRunSummary)
  })
})
