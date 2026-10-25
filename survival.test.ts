import { describe, expect, test } from 'bun:test'
import { defaultUser, type UserData } from './store'
import {
  recordSurvivalBest,
  survivalClearedWaves,
  survivalEnemyStats,
  survivalHeal,
  survivalReward,
  topSurvivalRecords,
} from './survival'

function userWithBest(
  wave: number,
  character = 'Jason',
  at = 1000,
): UserData {
  return { ...defaultUser(), survivalBest: { wave, character, at } }
}

describe('survival', () => {
  test('scales enemy HP and attack with every wave', () => {
    expect(survivalEnemyStats(1)).toEqual({ hp: 80, attack: 8 })
    expect(survivalEnemyStats(2)).toEqual({ hp: 105, attack: 10 })
    expect(survivalEnemyStats(5)).toEqual({ hp: 180, attack: 16 })
  })

  test('rewards deeper waves more and heals a quarter of max HP', () => {
    expect(survivalReward(1)).toBe(90)
    expect(survivalReward(5)).toBe(180)
    expect([1, 2, 3].reduce((sum, wave) => sum + survivalReward(wave), 0)).toBe(338)
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, wave) => sum + survivalReward(wave), 0),
    ).toBe(1352)
    expect(survivalHeal(100)).toBe(25)
    expect(survivalHeal(110)).toBe(28)
  })
})

describe('survival records', () => {
  test('records a new personal best without touching other progress', () => {
    const user: UserData = {
      ...defaultUser(),
      coins: 123,
      wins: 4,
      losses: 2,
      streak: 3,
    }
    const at = Date.UTC(2026, 9, 25, 12)
    const result = recordSurvivalBest(user, 4, 'Jason', at)

    expect(result.improved).toBe(true)
    expect(result.best).toEqual({ wave: 4, character: 'Jason', at })
    expect(result.user.survivalBest).toEqual({ wave: 4, character: 'Jason', at })
    expect(result.user.coins).toBe(user.coins)
    expect(result.user.wins).toBe(user.wins)
    expect(result.user.losses).toBe(user.losses)
    expect(result.user.streak).toBe(user.streak)
    expect(result.user.quests).toBe(user.quests)
    expect(user.survivalBest).toBeNull()
  })

  test('floors fractional clear counts and ignores zero or negative results', () => {
    const best = recordSurvivalBest(defaultUser(), 3.9, 'Jason', 10)
    expect(best.best).toEqual({ wave: 3, character: 'Jason', at: 10 })

    for (const cleared of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = recordSurvivalBest(defaultUser(), cleared, 'Jason', 10)
      expect(result.improved).toBe(false)
      expect(result.best).toBeNull()
      expect(result.user.survivalBest).toBeNull()
    }
  })

  test('raises an existing personal best', () => {
    const user = userWithBest(3, 'Noob', 1000)
    const result = recordSurvivalBest(user, 6, 'Jason', 2000)

    expect(result.improved).toBe(true)
    expect(result.best).toEqual({ wave: 6, character: 'Jason', at: 2000 })
    expect(result.user.survivalBest).toEqual({
      wave: 6,
      character: 'Jason',
      at: 2000,
    })
    expect(result.user).not.toBe(user)
    expect(user.survivalBest).toEqual({ wave: 3, character: 'Noob', at: 1000 })
  })

  test('keeps the earliest record on equal or lower results', () => {
    const user = userWithBest(5, 'Noob', 1000)

    const equal = recordSurvivalBest(user, 5, 'Jason', 2000)
    expect(equal.improved).toBe(false)
    expect(equal.best).toEqual({ wave: 5, character: 'Noob', at: 1000 })
    expect(equal.user).toBe(user)

    const lower = recordSurvivalBest(user, 2, 'Jason', 3000)
    expect(lower.improved).toBe(false)
    expect(lower.best).toEqual({ wave: 5, character: 'Noob', at: 1000 })
    expect(lower.user).toBe(user)
  })

  test('computes cleared waves from the next wave number', () => {
    expect(survivalClearedWaves(1)).toBe(0)
    expect(survivalClearedWaves(2)).toBe(1)
    expect(survivalClearedWaves(4.9)).toBe(3)
    expect(survivalClearedWaves(0)).toBe(0)
    expect(survivalClearedWaves(-3)).toBe(0)
  })

  test('sorts the top records by wave, earliest date and numeric id', () => {
    const users: Record<string, UserData> = {
      '123456789012345671': userWithBest(7, 'Noob', 100),
      '123456789012345672': userWithBest(7, 'Elliot', 100),
      '123456789012345679': userWithBest(7, 'Jason', 500),
      '123456789012345670': userWithBest(4, 'Jason', 200),
      'bot:survival:1': userWithBest(99, 'Jason', 1),
      'boss:2026-W43:1': userWithBest(98, 'Jason', 1),
      '42': userWithBest(97, 'Jason', 1),
      '123456789012345673': defaultUser(),
      '123456789012345674': { ...defaultUser(), survivalBest: null },
    }

    expect(topSurvivalRecords(users).map(entry => [entry.userId, entry.wave])).toEqual([
      ['123456789012345671', 7],
      ['123456789012345672', 7],
      ['123456789012345679', 7],
      ['123456789012345670', 4],
    ])
  })

  test('caps the leaderboard at the requested limit', () => {
    const users: Record<string, UserData> = {
      '123456789012345671': userWithBest(3),
      '123456789012345672': userWithBest(2),
      '123456789012345673': userWithBest(1),
    }
    expect(topSurvivalRecords(users, 2)).toHaveLength(2)
    expect(topSurvivalRecords(users, 0)).toEqual([])
    expect(topSurvivalRecords(users, -5)).toEqual([])
    expect(topSurvivalRecords({}, 10)).toEqual([])
  })
})
