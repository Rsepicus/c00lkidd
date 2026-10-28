import { describe, expect, test } from 'bun:test'
import { collectLlmExamples } from './policy-collect'
import { POLICY_FEATURE_COUNT } from './policy'

describe('policy data collection', () => {
  test('collects legal candidate labels in mock mode', async () => {
    const result = await collectLlmExamples({
      mock: true,
      battles: 3,
      maxCalls: 6,
      maxTurns: 12,
      seed: 7,
    })
    expect(result.attempts).toBeLessThanOrEqual(6)
    expect(result.examples.length).toBeGreaterThan(0)
    expect(result.examples.length).toBeLessThanOrEqual(6)
    expect(result.models['Mock hybrid'] ?? 0).toBeGreaterThan(0)
    for (const example of result.examples) {
      expect(example.y).toBeGreaterThanOrEqual(0)
      expect(example.y).toBeLessThan(example.xs.length)
      for (const row of example.xs) {
        expect(row).toHaveLength(POLICY_FEATURE_COUNT)
        expect(row.every(value => Number.isFinite(value))).toBe(true)
      }
    }
  })
})
