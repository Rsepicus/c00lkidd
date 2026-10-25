export type SurvivalStats = { hp: number; attack: number }

export function survivalEnemyStats(wave: number): SurvivalStats {
  const index = Math.max(0, wave - 1)
  return {
    hp: 80 + index * 25,
    attack: 8 + index * 2,
  }
}

export function survivalReward(wave: number): number {
  return 20 + survivalEnemyStats(wave).hp
}

export function survivalHeal(maxHp: number): number {
  return Math.ceil(maxHp * 0.25)
}
