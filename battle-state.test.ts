import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBattleState, saveBattleState } from './battle-state'

describe('battle state file', () => {
  test('round-trips a battle snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-battles-'))
    const path = join(dir, 'battles.json')
    try {
      const snapshot = { version: 1, battles: [['m1', { turn: 0 }]], logs: [] }
      saveBattleState(path, snapshot)
      expect(loadBattleState(path)).toEqual(snapshot)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('returns null for a missing or broken snapshot', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-battles-'))
    const path = join(dir, 'battles.json')
    try {
      expect(loadBattleState(path)).toBeNull()
      writeFileSync(path, '{broken', 'utf8')
      expect(loadBattleState(path)).toBeNull()
      expect(readFileSync(path, 'utf8')).toBe('{broken')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
