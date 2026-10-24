import { describe, expect, test } from 'bun:test'
import {
  BOSS_FIRST_CLEAR_BONUS,
  BOSS_ROSTER,
  BOSS_WIN_REWARD,
  bossCharacter,
  bossForWeek,
  bossModeOf,
  bossRecordForWeek,
  bossTuning,
  isoWeekKey,
  recordBossResult,
} from './boss'
import { defaultUser } from './store'

describe('boss week', () => {
  test('uses ISO week keys', () => {
    expect(isoWeekKey(Date.UTC(2026, 0, 1))).toBe('2026-W01')
    expect(isoWeekKey(Date.UTC(2026, 0, 5))).toBe('2026-W02')
    expect(isoWeekKey(Date.UTC(2026, 9, 24))).toMatch(/^2026-W\d{2}$/)
  })

  test('picks a deterministic boss from the roster', () => {
    const first = bossForWeek('2026-W01')
    expect(BOSS_ROSTER).toContain(first.name)
    expect(bossForWeek('2026-W01').name).toBe(first.name)
    expect(first.alternates?.length).toBeGreaterThan(0)
  })

  test('scales HP and attack with the battle mode and keeps both abilities', () => {
    const solo = bossCharacter('1x1', '2026-W01')
    const duo = bossCharacter('2x2', '2026-W01')
    const tuning = bossTuning(solo.name)
    expect(solo.hp).toBe(tuning.hp1)
    expect(duo.hp).toBe(tuning.hp2)
    expect(solo.attack).toBe(tuning.attack1)
    expect(duo.attack).toBe(tuning.attack2)
    expect(solo.name).toBe(duo.name)
    expect(solo.special.name).not.toBe(solo.alternates?.[0]?.name)
  })

  test('detects the mode from the number of sides', () => {
    expect(bossModeOf(2)).toBe('1x1')
    expect(bossModeOf(3)).toBe('2x2')
  })
})

describe('boss record', () => {
  test('starts empty for a new week', () => {
    expect(bossRecordForWeek(defaultUser(), '2026-W01')).toEqual({
      week: '2026-W01',
      bestDamage: 0,
      cleared: false,
      wins: 0,
    })
  })

  test('keeps the best damage after a loss and does not pay', () => {
    const result = recordBossResult(defaultUser(), '2026-W01', 70, false)
    expect(result.user.coins).toBe(defaultUser().coins)
    expect(result.user.boss?.bestDamage).toBe(70)
    expect(result.user.boss?.cleared).toBe(false)
    expect(result.firstClear).toBe(false)
  })

  test('pays the weekly first clear bonus only once', () => {
    const first = recordBossResult(defaultUser(), '2026-W01', 120, true)
    expect(first.firstClear).toBe(true)
    expect(first.reward).toBe(BOSS_WIN_REWARD + BOSS_FIRST_CLEAR_BONUS)
    expect(first.user.coins).toBe(defaultUser().coins + first.reward)
    expect(first.user.boss?.wins).toBe(1)

    const second = recordBossResult(first.user, '2026-W01', 80, true)
    expect(second.firstClear).toBe(false)
    expect(second.reward).toBe(BOSS_WIN_REWARD)
    expect(second.user.boss?.bestDamage).toBe(120)
    expect(second.user.boss?.wins).toBe(2)
  })

  test('resets the record in a new week', () => {
    const first = recordBossResult(defaultUser(), '2026-W01', 120, true)
    const next = recordBossResult(first.user, '2026-W02', 30, false)
    expect(next.user.boss?.week).toBe('2026-W02')
    expect(next.user.boss?.bestDamage).toBe(30)
    expect(next.user.boss?.cleared).toBe(false)
  })
})
