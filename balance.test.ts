import { describe, expect, test } from 'bun:test'
import { simulateBalance } from './balance'
import { CHARACTERS } from './forsaken'

describe('balance simulation', () => {
  test('simulates one character against the whole roster deterministically', async () => {
    const simulation = await simulateBalance({
      character: 'Noob',
      battlesPerPair: 2,
      maxTurns: 40,
      seed: 12345,
    })
    expect(simulation.battles).toBe((CHARACTERS.length - 1) * 2)
    expect(simulation.rows).toHaveLength(CHARACTERS.length)
    expect(simulation.rows.find(row => row.name === 'Noob')?.games).toBe(
      (CHARACTERS.length - 1) * 2,
    )
    expect(simulation.rows.every(row => row.winrate >= 0 && row.winrate <= 100)).toBe(true)
    expect(simulation.seed).toBe(12345)
    expect(simulation.battlesPerPair).toBe(2)
    expect(simulation.mode).toBe('1x1')
  })

  test('simulates 2v2 with random partners', async () => {
    const simulation = await simulateBalance({
      character: 'Noob',
      mode: '2x2',
      battlesPerPair: 2,
      maxTurns: 40,
      seed: 12345,
    })
    expect(simulation.mode).toBe('2x2')
    expect(simulation.battles).toBe((CHARACTERS.length - 1) * 2)
    expect(simulation.rows).toHaveLength(CHARACTERS.length)
    expect(simulation.rows.find(row => row.name === 'Noob')?.games).toBe(
      (CHARACTERS.length - 1) * 2,
    )
  })

  test('uses a fixed ability for the selected character', async () => {
    const simulation = await simulateBalance({
      character: 'Noob',
      special: 'Slateskin Potion',
      battlesPerPair: 1,
      maxTurns: 30,
      seed: 99,
    })
    expect(simulation.special).toBe('Slateskin Potion')
    await expect(
      simulateBalance({
        character: 'Noob',
        special: 'Nova',
        battlesPerPair: 1,
        maxTurns: 20,
        seed: 99,
      }),
    ).rejects.toThrow()
    await expect(
      simulateBalance({ special: 'Slateskin Potion', battlesPerPair: 1, maxTurns: 20 }),
    ).rejects.toThrow()
  })

  test('produces the same result for the same seed', async () => {
    const first = await simulateBalance({
      character: 'Noli',
      battlesPerPair: 1,
      maxTurns: 30,
      seed: 777,
    })
    const second = await simulateBalance({
      character: 'Noli',
      battlesPerPair: 1,
      maxTurns: 30,
      seed: 777,
    })
    expect(second.rows).toEqual(first.rows)
  })
})
