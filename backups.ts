import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const DAY_MS = 24 * 60 * 60 * 1000

function dateKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function backupFile(
  source: string,
  backupDir: string,
  prefix: string,
  now = Date.now(),
): string | null {
  if (!existsSync(source)) return null
  mkdirSync(backupDir, { recursive: true })
  const destination = join(backupDir, `${prefix}-${dateKey(now)}.json`)
  copyFileSync(source, destination)
  return destination
}

export function pruneBackups(
  backupDir: string,
  prefix: string,
  keepDays = 7,
  now = Date.now(),
): void {
  if (!existsSync(backupDir)) return
  const cutoff = now - keepDays * DAY_MS
  for (const name of readdirSync(backupDir)) {
    if (!name.startsWith(`${prefix}-`) || !name.endsWith('.json')) continue
    const match = /^(.+)-(\d{4}-\d{2}-\d{2})\.json$/.exec(name)
    if (!match) continue
    const date = Date.parse(`${match[2]}T00:00:00Z`)
    if (Number.isFinite(date) && date < cutoff) {
      try {
        unlinkSync(join(backupDir, name))
      } catch {
        // A backup that cannot be removed should not break the bot.
      }
    }
  }
}

export function backupDataFiles(root: string, now = Date.now()): string[] {
  const backupDir = join(root, 'backups')
  const paths = [
    backupFile(join(root, 'data.json'), backupDir, 'data', now),
    backupFile(join(root, 'battles.json'), backupDir, 'battles', now),
  ].filter((path): path is string => Boolean(path))
  pruneBackups(backupDir, 'data', 7, now)
  pruneBackups(backupDir, 'battles', 7, now)
  return paths
}
