import { describe, expect, test } from 'bun:test'
import { BOSS_ROSTER, bossTuning, type BossMode } from './boss'
import {
  BOSS_RUSH_STAGE_HEAL,
  BOSS_RUSH_STAGES,
  advanceBossRush,
  bossRushBoss,
  bossRushReward,
  bossRushSummary,
  createBossRush,
} from './boss-rush'

const MODES: readonly BossMode[] = ['1x1', '2x2']

function expectedStats(bossName: string, mode: BossMode, stage: number) {
  const tuning = bossTuning(bossName)
  const multiplier = Number((0.9 + 0.15 * stage).toFixed(2))
  return {
    multiplier,
    hp: Math.max(
      1,
      Math.round((mode === '2x2' ? tuning.hp2 : tuning.hp1) * multiplier),
    ),
    attack: Math.max(
      1,
      Math.round((mode === '2x2' ? tuning.attack2 : tuning.attack1) * multiplier),
    ),
  }
}

describe('boss rush creation', () => {
  test('creates five unique stages in a deterministic seeded order', () => {
    const first = createBossRush('1x1', 2026)
    const second = createBossRush('1x1', 2026)

    expect(first.status).toBe('active')
    expect(first.stage).toBe(1)
    expect(first.seed).toBe(2026)
    expect(first.mode).toBe('1x1')
    expect(first.hpRatio).toBe(1)
    expect(first.bossOrder).toHaveLength(BOSS_RUSH_STAGES)
    expect(new Set(first.bossOrder).size).toBe(BOSS_RUSH_STAGES)
    for (const boss of first.bossOrder) {
      expect(BOSS_ROSTER).toContain(boss)
    }
    expect(second).toEqual(first)

    expect(createBossRush('1x1', 2027).bossOrder).not.toEqual(first.bossOrder)
  })

  test('keeps the boss order across modes but changes mode-specific stats', () => {
    const solo = createBossRush('1x1', 404)
    const duo = createBossRush('2x2', 404)

    expect(duo.bossOrder).toEqual(solo.bossOrder)
    expect(duo.stages.map(stage => stage.bossName)).toEqual(
      solo.stages.map(stage => stage.bossName),
    )
    expect(duo.mode).toBe('2x2')
    expect(duo.stages[0].hp).not.toBe(solo.stages[0].hp)
  })

  test('rejects invalid modes and seeds', () => {
    expect(() => createBossRush('3x3' as BossMode, 1)).toThrow()
    expect(() => createBossRush('1x1', Number.NaN)).toThrow()
    expect(() => createBossRush('1x1', Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('boss rush escalation', () => {
  test('applies the documented stage multiplier to every stage', () => {
    for (const mode of MODES) {
      const run = createBossRush(mode, 77)
      for (let stage = 1; stage <= BOSS_RUSH_STAGES; stage++) {
        const plan = run.stages[stage - 1]
        const expected = expectedStats(plan.bossName, mode, stage)
        expect(plan.stage).toBe(stage)
        expect(plan.multiplier).toBe(expected.multiplier)
        expect(plan.hp).toBe(expected.hp)
        expect(plan.attack).toBe(expected.attack)
      }
      expect(run.stages.map(stage => stage.multiplier)).toEqual([
        1.05, 1.2, 1.35, 1.5, 1.65,
      ])
    }
  })

  test('returns an escalated, playable character for the current boss', () => {
    const run = createBossRush('2x2', 88)
    const boss = bossRushBoss(run)
    const plan = run.stages[0]
    const tuning = bossTuning(plan.bossName)

    expect(boss.stage).toBe(1)
    expect(boss.bossName).toBe(run.bossOrder[0])
    expect(boss.character.name).toBe(plan.bossName)
    expect(boss.character.hp).toBe(Math.round(tuning.hp2 * plan.multiplier))
    expect(boss.character.attack).toBe(Math.round(tuning.attack2 * plan.multiplier))
    expect(boss.character.special).toBeDefined()
  })
})

describe('boss rush advancement', () => {
  test('carries the remaining HP ratio and heals between stages', () => {
    const run = createBossRush('1x1', 99)
    const next = advanceBossRush(run, true, 0.2)

    expect(next.stage).toBe(2)
    expect(next.status).toBe('active')
    expect(next.hpRatio).toBeCloseTo(0.2 + BOSS_RUSH_STAGE_HEAL)
    expect(next.bossOrder).toEqual(run.bossOrder)
    expect(bossRushBoss(next).bossName).toBe(run.bossOrder[1])
    // The input run is not mutated.
    expect(run.stage).toBe(1)
    expect(run.hpRatio).toBe(1)

    const capped = advanceBossRush(run, true, 0.95)
    expect(capped.hpRatio).toBe(1)

    const omitted = advanceBossRush(next, true)
    expect(omitted.hpRatio).toBeCloseTo(0.2 + BOSS_RUSH_STAGE_HEAL * 2)
  })

  test('marks the run completed only after winning the last stage', () => {
    let run = createBossRush('2x2', 1234)
    for (let stage = 1; stage < BOSS_RUSH_STAGES; stage++) {
      run = advanceBossRush(run, true, 0.5)
      expect(run.status).toBe('active')
      expect(run.stage).toBe(stage + 1)
    }

    const completed = advanceBossRush(run, true, 0.4)
    expect(completed.status).toBe('completed')
    expect(completed.stage).toBe(BOSS_RUSH_STAGES)
    expect(completed.hpRatio).toBe(0.4)

    expect(advanceBossRush(completed, true, 1)).toEqual(completed)
    expect(advanceBossRush(completed, false)).toEqual(completed)
  })

  test('marks a loss as failed and stops the run', () => {
    let run = createBossRush('1x1', 55)
    run = advanceBossRush(run, true, 0.5)
    run = advanceBossRush(run, true, 0.5)
    expect(run.stage).toBe(3)

    const failed = advanceBossRush(run, false, 0.9)
    expect(failed.status).toBe('failed')
    expect(failed.stage).toBe(3)
    expect(failed.hpRatio).toBe(0)
    expect(advanceBossRush(failed, true, 1)).toEqual(failed)
  })
})

describe('boss rush rewards and summary', () => {
  test('rewards grow deterministically with the stage', () => {
    const rewards = Array.from({ length: BOSS_RUSH_STAGES }, (_, index) =>
      bossRushReward(index + 1),
    )
    expect(rewards).toEqual([100, 175, 250, 325, 400])
    for (let index = 1; index < rewards.length; index++) {
      expect(rewards[index]).toBeGreaterThan(rewards[index - 1])
    }
    expect(bossRushReward(3)).toBe(250)
    expect(() => bossRushReward(0)).toThrow()
    expect(() => bossRushReward(BOSS_RUSH_STAGES + 1)).toThrow()
    expect(() => bossRushReward(1.5)).toThrow()
  })

  test('summarizes progress, rewards, and the next boss without UI strings', () => {
    let run = createBossRush('1x1', 4321)
    expect(bossRushSummary(run)).toEqual({
      mode: '1x1',
      seed: 4321,
      status: 'active',
      stage: 1,
      totalStages: BOSS_RUSH_STAGES,
      bossesDefeated: 0,
      currentBoss: run.bossOrder[0],
      nextBoss: run.bossOrder[1],
      hpRatio: 1,
      rewardEarned: 0,
    })

    run = advanceBossRush(run, true, 0.5)
    expect(bossRushSummary(run)).toMatchObject({
      stage: 2,
      bossesDefeated: 1,
      currentBoss: run.bossOrder[1],
      nextBoss: run.bossOrder[2],
      rewardEarned: bossRushReward(1),
    })

    const failed = advanceBossRush(run, false)
    expect(bossRushSummary(failed)).toMatchObject({
      status: 'failed',
      stage: 2,
      bossesDefeated: 1,
      nextBoss: null,
      rewardEarned: bossRushReward(1),
    })

    let current = createBossRush('1x1', 4321)
    for (let stage = 1; stage <= BOSS_RUSH_STAGES; stage++) {
      current = advanceBossRush(current, true, 0.5)
    }
    const completed = bossRushSummary(current)
    expect(completed).toMatchObject({
      status: 'completed',
      stage: BOSS_RUSH_STAGES,
      bossesDefeated: BOSS_RUSH_STAGES,
      currentBoss: current.bossOrder[BOSS_RUSH_STAGES - 1],
      nextBoss: null,
      rewardEarned: 1250,
    })
  })
})
