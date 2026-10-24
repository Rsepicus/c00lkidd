import { appendFileSync } from 'node:fs'

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export function appendErrorLog(
  path: string,
  error: unknown,
  context?: string,
): void {
  const prefix = `[${new Date().toISOString()}]${context ? ` [${context}]` : ''} `
  try {
    appendFileSync(path, `${prefix}${formatError(error)}\n`, 'utf8')
  } catch {
    // Logging must never take down the bot.
  }
}
