import { isRealUserId, type SurvivalBest, type UserData } from './store'

export type SurvivalStats = { hp: number; attack: number }

export type SurvivalBestResult = {
  user: UserData
  best: SurvivalBest | null
  improved: boolean
}

export type SurvivalLeaderboardEntry = {
  userId: string
  wave: number
  character: string
  at: number
}

export function survivalEnemyStats(wave: number): SurvivalStats {
  const index = Math.max(0, wave - 1)
  return {
    hp: 80 + index * 25,
    attack: 8 + index * 2,
  }
}

export function survivalReward(wave: number): number {
  return Math.round((20 + survivalEnemyStats(wave).hp) * 0.9)
}

export function survivalHeal(maxHp: number): number {
  return Math.ceil(maxHp * 0.25)
}

export function survivalClearedWaves(nextWave: number): number {
  return Math.max(0, Math.floor(nextWave) - 1)
}

export function recordSurvivalBest(
  user: UserData,
  clearedWaves: number,
  characterName: string,
  at = Date.now(),
): SurvivalBestResult {
  if (!Number.isFinite(clearedWaves)) return { user, best: user.survivalBest, improved: false }

  const wave = Math.max(0, Math.floor(clearedWaves))
  const current = user.survivalBest
  if (wave <= 0 || wave <= (current?.wave ?? 0)) {
    return { user, best: current, improved: false }
  }

  const best: SurvivalBest = { wave, character: characterName, at }
  return { user: { ...user, survivalBest: best }, best, improved: true }
}

function compareUserIds(left: string, right: string): number {
  try {
    const leftId = BigInt(left)
    const rightId = BigInt(right)
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
  } catch {
    return left.localeCompare(right)
  }
}

export function topSurvivalRecords(
  users: Record<string, UserData>,
  limit = 10,
): SurvivalLeaderboardEntry[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0
  const entries: SurvivalLeaderboardEntry[] = []
  for (const [userId, user] of Object.entries(users)) {
    const best = user.survivalBest
    if (!isRealUserId(userId) || !best || best.wave < 1) continue
    entries.push({
      userId,
      wave: best.wave,
      character: best.character,
      at: best.at,
    })
  }
  return entries
    .sort(
      (left, right) =>
        right.wave - left.wave ||
        left.at - right.at ||
        compareUserIds(left.userId, right.userId),
    )
    .slice(0, cap)
}
