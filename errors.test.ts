import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendErrorLog, formatError } from './errors'

describe('error logging', () => {
  test('formats errors and plain values', () => {
    expect(formatError(new Error('boom'))).toContain('boom')
    expect(formatError('boom')).toBe('boom')
    expect(formatError({ code: 500 })).toContain('500')
  })

  test('appends timestamped errors with context', () => {
    const dir = mkdtempSync(join(tmpdir(), 'c00lkidd-errors-'))
    const path = join(dir, 'errors.log')
    try {
      appendErrorLog(path, new Error('first'), 'interaction')
      appendErrorLog(path, 'second')
      const text = readFileSync(path, 'utf8')
      expect((text.match(/^\[/gm) ?? []).length).toBe(2)
      expect(text).toContain('[interaction]')
      expect(text).toContain('first')
      expect(text).toContain('second')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
