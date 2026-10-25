import { describe, expect, test } from 'bun:test'
import { survivalEnemyStats, survivalHeal, survivalReward } from './survival'

describe('survival', () => {
  test('scales enemy HP and attack with every wave', () => {
    expect(survivalEnemyStats(1)).toEqual({ hp: 80, attack: 8 })
    expect(survivalEnemyStats(2)).toEqual({ hp: 105, attack: 10 })
    expect(survivalEnemyStats(5)).toEqual({ hp: 180, attack: 16 })
  })

  test('rewards deeper waves more and heals a quarter of max HP', () => {
    expect(survivalReward(1)).toBe(30)
    expect(survivalReward(5)).toBe(50)
    expect([1, 2, 3].reduce((sum, wave) => sum + survivalReward(wave), 0)).toBe(105)
    expect(survivalHeal(100)).toBe(25)
    expect(survivalHeal(110)).toBe(28)
  })
})
