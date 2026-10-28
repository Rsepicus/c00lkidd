import { afterEach, describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runLlmArena } from './arena'
import { characterByName } from './forsaken'
import { buildLocalCandidates } from './llm-ai'
import {
  candidateFeatures,
  choosePolicyTurn,
  POLICY_FEATURE_COUNT,
  policyAiEnabled,
  policyAvailable,
  resetPolicyWeightsCache,
} from './policy'
import { createBattle } from './pvp'

function battleWith(left = 'Guest 1337', right = 'Noob') {
  return createBattle(
    { userId: 'a', name: 'A', character: characterByName(left)! },
    { userId: 'b', name: 'B', character: characterByName(right)! },
  )
}

const originalPolicyAi = process.env.POLICY_AI
const originalWeights = process.env.POLICY_WEIGHTS
const temporaryWeights = join(tmpdir(), 'c00lkidd-policy-test-weights.json')

afterEach(() => {
  if (originalPolicyAi === undefined) delete process.env.POLICY_AI
  else process.env.POLICY_AI = originalPolicyAi
  if (originalWeights === undefined) delete process.env.POLICY_WEIGHTS
  else process.env.POLICY_WEIGHTS = originalWeights
  resetPolicyWeightsCache()
  try {
    unlinkSync(temporaryWeights)
  } catch {}
})

describe('policy AI', () => {
  test('enables only with an explicit POLICY_AI flag', () => {
    delete process.env.POLICY_AI
    expect(policyAiEnabled()).toBe(false)
    for (const value of ['1', 'true', 'yes', 'on']) {
      process.env.POLICY_AI = value
      expect(policyAiEnabled()).toBe(true)
    }
    for (const value of ['0', 'false', '']) {
      process.env.POLICY_AI = value
      expect(policyAiEnabled()).toBe(false)
    }
  })

  test('builds a finite feature vector for every legal candidate', () => {
    const battle = battleWith()
    const side = battle.sides[battle.turn]
    const candidates = buildLocalCandidates(battle, 100)
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      const features = candidateFeatures(battle, side, candidate)
      expect(features).toHaveLength(POLICY_FEATURE_COUNT)
      expect(features.every(value => Number.isFinite(value))).toBe(true)
    }
  })

  test('all legal candidates remain available to the policy', () => {
    const battle = battleWith()
    const limited = buildLocalCandidates(battle)
    const all = buildLocalCandidates(battle, 100)
    expect(all.length).toBeGreaterThanOrEqual(limited.length)
  })

  test('returns null when the weights file is missing', () => {
    process.env.POLICY_WEIGHTS = join(tmpdir(), 'c00lkidd-missing-policy.json')
    resetPolicyWeightsCache()
    expect(policyAvailable()).toBe(false)
    expect(choosePolicyTurn(battleWith())).toBeNull()
  })

  test('the debug arena switches to the policy when POLICY_AI is on', async () => {
    process.env.POLICY_AI = '1'
    const result = await runLlmArena({
      characters: ['Jason'],
      seeds: [7],
      maxTurns: 5,
    })
    expect(result.models.some(model => model.startsWith('Policy '))).toBe(true)
  })

  test('scores legal candidates when weights are present', () => {
    writeFileSync(
      temporaryWeights,
      JSON.stringify({
        version: 1,
        features: POLICY_FEATURE_COUNT,
        hidden: 1,
        w1: Array.from({ length: POLICY_FEATURE_COUNT }, () => 0),
        b1: [0],
        w2: [0],
        b2: 0,
      }),
    )
    process.env.POLICY_WEIGHTS = temporaryWeights
    resetPolicyWeightsCache()
    const battle = battleWith()
    const candidates = buildLocalCandidates(battle, 100)
    const turn = choosePolicyTurn(battle, () => 0)
    expect(turn).not.toBeNull()
    expect(turn?.provider).toBe('Policy')
    expect(turn?.model).toBe('mlp-1')
    expect(turn?.decision).toEqual(candidates[0]!.decision)
  })
})
