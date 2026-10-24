import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'

export type BattleSnapshot = Record<string, unknown>

export function saveBattleState(path: string, snapshot: BattleSnapshot): void {
  const temp = `${path}.tmp`
  writeFileSync(temp, `${JSON.stringify(snapshot)}\n`, 'utf8')
  renameSync(temp, path)
}

export function loadBattleState(path: string): BattleSnapshot | null {
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as BattleSnapshot) : null
  } catch {
    return null
  }
}
