import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const bun = process.execPath

async function run(): Promise<void> {
  while (true) {
    const child = spawn(bun, [join(root, 'bot.ts')], {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true,
    })
    const code = await new Promise<number | null>(resolve => {
      child.once('exit', exitCode => resolve(exitCode))
      child.once('error', () => resolve(null))
    })
    console.log(`[watchdog] бот завершился (${code ?? 'error'}), перезапуск через 5 секунд`)
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
}

if (import.meta.main) {
  run().catch(error => {
    console.error('[watchdog] не запустился:', error)
    process.exit(1)
  })
}
