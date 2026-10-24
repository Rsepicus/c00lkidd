import { characterByName, type Character } from './forsaken'
import type { BossRecord, UserData } from './store'

export const BOSS_ROSTER = [
  'Jason',
  'c00lkidd',
  'John Doe',
  '1x1x1x1',
  'Azure',
] as const

export const BOSS_HP_1V1 = 160
export const BOSS_HP_2V2 = 220
export const BOSS_ATTACK = 15
export const BOSS_WIN_REWARD = 150
export const BOSS_FIRST_CLEAR_BONUS = 250

export type BossMode = '1x1' | '2x2'

type BossTuning = {
  hp1: number
  attack1: number
  hp2: number
  attack2: number
}

const BOSS_TUNING: Record<string, BossTuning> = {
  Azure: { hp1: 110, attack1: 10, hp2: 175, attack2: 15 },
  Jason: { hp1: 90, attack1: 12, hp2: 155, attack2: 17 },
  c00lkidd: { hp1: 160, attack1: 11, hp2: 260, attack2: 17 },
  'John Doe': { hp1: 120, attack1: 9, hp2: 220, attack2: 13 },
  '1x1x1x1': { hp1: 200, attack1: 14, hp2: 390, attack2: 19 },
}

export function bossTuning(name: string): BossTuning {
  return (
    BOSS_TUNING[name] ?? {
      hp1: BOSS_HP_1V1,
      attack1: BOSS_ATTACK,
      hp2: BOSS_HP_2V2,
      attack2: BOSS_ATTACK,
    }
  )
}

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index++) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

export function isoWeekKey(now = Date.now()): string {
  const date = new Date(now)
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  )
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function bossForWeek(week = isoWeekKey()): Character {
  const name = BOSS_ROSTER[hash(week) % BOSS_ROSTER.length]
  return characterByName(name) ?? characterByName('Jason')!
}

export function bossCharacter(mode: BossMode, week = isoWeekKey()): Character {
  const base = bossForWeek(week)
  const tuning = bossTuning(base.name)
  return {
    ...base,
    hp: mode === '2x2' ? tuning.hp2 : tuning.hp1,
    attack: mode === '2x2' ? tuning.attack2 : tuning.attack1,
  }
}

export function bossModeOf(sides: number): BossMode {
  return sides > 2 ? '2x2' : '1x1'
}

export function bossRecordForWeek(user: UserData, week = isoWeekKey()): BossRecord {
  if (user.boss && user.boss.week === week) return user.boss
  return { week, bestDamage: 0, cleared: false, wins: 0 }
}

export function recordBossResult(
  user: UserData,
  week: string,
  damage: number,
  won: boolean,
): { user: UserData; firstClear: boolean; reward: number; record: BossRecord } {
  const current = bossRecordForWeek(user, week)
  const firstClear = won && !current.cleared
  const reward = won
    ? BOSS_WIN_REWARD + (firstClear ? BOSS_FIRST_CLEAR_BONUS : 0)
    : 0
  const record: BossRecord = {
    week,
    bestDamage: Math.max(current.bestDamage, Math.max(0, Math.floor(damage))),
    cleared: current.cleared || won,
    wins: current.wins + (won ? 1 : 0),
  }

  return {
    user: { ...user, coins: user.coins + reward, boss: record },
    firstClear,
    reward,
    record,
  }
}
