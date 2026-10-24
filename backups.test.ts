import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupFile, pruneBackups } from './backups'

describe('backups', () => {
  test('copies a file into the backup directory with a date suffix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-backups-'))
    try {
      const source = join(dir, 'data.json')
      const backupDir = join(dir, 'backups')
      writeFileSync(source, '{"ok":true}', 'utf8')
      const path = backupFile(source, backupDir, 'data', Date.UTC(2026, 9, 25))
      expect(path).toContain('data-2026-10-25.json')
      expect(readFileSync(path!, 'utf8')).toBe('{"ok":true}')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('returns null when the source is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-backups-'))
    try {
      expect(backupFile(join(dir, 'missing.json'), join(dir, 'backups'), 'data')).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('prunes backups older than the retention window', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-backups-'))
    try {
      const now = Date.UTC(2026, 9, 25)
      writeFileSync(join(dir, 'data-2026-10-10.json'), 'old', 'utf8')
      writeFileSync(join(dir, 'data-2026-10-24.json'), 'new', 'utf8')
      writeFileSync(join(dir, 'other-2026-10-10.json'), 'other', 'utf8')
      pruneBackups(dir, 'data', 7, now)
      expect(readFileSync(join(dir, 'data-2026-10-24.json'), 'utf8')).toBe('new')
      expect(() => readFileSync(join(dir, 'data-2026-10-10.json'), 'utf8')).toThrow()
      expect(readFileSync(join(dir, 'other-2026-10-10.json'), 'utf8')).toBe('other')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
