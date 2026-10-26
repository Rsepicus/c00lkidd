import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * Optional tiny local model hosted next to the bot.
 *
 * Downloads a CPU-only llama.cpp server and SmolLM2-135M (pinned by size and
 * SHA-256), then keeps it on 127.0.0.1. The model is intentionally tiny: it
 * fits the free host's RAM, but its tactics are worse than the heuristic and
 * much worse than Groq. Everything falls back safely.
 */

const LLAMA_SERVER_URL =
  'https://github.com/ggml-org/llama.cpp/releases/download/b11906/llama-b11906-bin-ubuntu-x64.tar.gz'
const LLAMA_SERVER_SHA =
  '064ade6220799fd9e7b1804b574f5f92c38dde358cc987c6b8283cfaeb1eeef3'
const MODEL_URL =
  'https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf'
const MODEL_SHA =
  '2e8040ceae7815abe0dcb3540b9995eaa1fa0d2ca9e797d0a635ae4433c68c2d'
const MODEL_FILE = 'SmolLM2-135M-Instruct-Q4_K_M.gguf'
const DOWNLOAD_TIMEOUT_MS = 15 * 60_000

let serverProcess: ChildProcess | null = null
let ready = false
let starting = false
let stopping = false
let restarts = 0
let restartTimer: ReturnType<typeof setTimeout> | null = null
let handlersRegistered = false

type Settings = {
  enabled: boolean
  autoSetup: boolean
  dir: string
  port: number
  context: number
  timeoutMs: number
  modelPath: string
  configuredBin: string
  baseUrl: string
}

function getSettings(): Settings {
  const dir = resolve(process.env.LOCAL_LLM_DIR?.trim() || 'local-llm')
  const port = Number(process.env.LOCAL_LLM_PORT) || 8080
  const context = Number(process.env.LOCAL_LLM_CONTEXT) || 1024
  return {
    enabled: /^(1|true|yes)$/i.test(process.env.LOCAL_LLM_ENABLED ?? ''),
    autoSetup: process.env.LOCAL_LLM_AUTO_SETUP !== '0',
    dir,
    port,
    context: Math.max(512, context),
    timeoutMs: Number(process.env.LOCAL_LLM_TIMEOUT_MS) || 20_000,
    modelPath:
      process.env.LOCAL_LLM_MODEL_PATH?.trim() || join(dir, MODEL_FILE),
    configuredBin: process.env.LOCAL_LLM_BIN?.trim() || '',
    baseUrl:
      process.env.LOCAL_LLM_BASE_URL?.trim() ||
      `http://127.0.0.1:${port}/v1`,
  }
}

export function isLocalLlmEnabled(): boolean {
  return getSettings().enabled
}

export function isLocalLlmReady(): boolean {
  return ready
}

export function localLlmBaseUrl(): string {
  return getSettings().baseUrl
}

export function localLlmTimeoutMs(): number {
  return getSettings().timeoutMs
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolveHash(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', chunk => {
      stderr = `${stderr}${chunk.toString()}`.slice(-600)
    })
    child.on('error', reject)
    child.on('exit', code => {
      if (code === 0) resolveRun()
      else reject(new Error(`${command} exited with ${code}: ${stderr}`))
    })
  })
}

async function download(
  url: string,
  destination: string,
  expectedSha: string | undefined,
  label: string,
): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true })
  const part = `${destination}.part`
  console.log(`[bot] Local LLM: скачиваю ${label}…`)
  const response = await fetch(url, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  })
  if (!response.ok || !response.body) {
    throw new Error(`${label}: HTTP ${response.status}`)
  }
  const stream = createWriteStream(part)
  const reader = response.body.getReader()
  let received = 0
  let nextLog = 25 * 1024 * 1024
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = Buffer.from(value)
      if (!stream.write(chunk)) {
        await new Promise<void>(resolveDrain => stream.once('drain', resolveDrain))
      }
      received += value.byteLength
      if (received >= nextLog) {
        console.log(
          `[bot] Local LLM: ${label} — ${Math.round(received / 1024 / 1024)} МБ`,
        )
        nextLog += 25 * 1024 * 1024
      }
    }
    await new Promise<void>((resolveStream, rejectStream) => {
      stream.on('finish', resolveStream)
      stream.on('error', rejectStream)
      stream.end()
    })
  } catch (error) {
    stream.destroy()
    try {
      unlinkSync(part)
    } catch {}
    throw error
  }
  if (expectedSha) {
    const actual = await sha256File(part)
    if (actual !== expectedSha) {
      try {
        unlinkSync(part)
      } catch {}
      throw new Error(`${label}: SHA-256 не совпал`)
    }
  }
  renameSync(part, destination)
  console.log(
    `[bot] Local LLM: ${label} готов (${Math.round(received / 1024 / 1024)} МБ)`,
  )
}

function findLlamaServer(root: string): string | null {
  const stack = [root]
  while (stack.length > 0) {
    const directory = stack.pop()!
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(directory, entry.name)
      if (entry.isFile() && entry.name === 'llama-server') return full
      if (entry.isDirectory()) stack.push(full)
    }
  }
  return null
}

async function ensureFiles(
  settings: Settings,
): Promise<{ bin: string; model: string } | null> {
  mkdirSync(settings.dir, { recursive: true })

  if (!existsSync(settings.modelPath)) {
    if (!settings.autoSetup) {
      console.warn(
        `[bot] Local LLM: нет модели ${settings.modelPath}. ` +
          'Положи GGUF вручную или включи LOCAL_LLM_AUTO_SETUP=1.',
      )
      return null
    }
    const url = process.env.LOCAL_LLM_MODEL_URL?.trim() || MODEL_URL
    const sha = process.env.LOCAL_LLM_MODEL_URL ? undefined : MODEL_SHA
    await download(url, settings.modelPath, sha, 'модель SmolLM2-135M')
  }

  let bin = settings.configuredBin
  if (bin && !existsSync(bin)) {
    console.warn(`[bot] Local LLM: LOCAL_LLM_BIN не найден: ${bin}`)
    bin = ''
  }
  if (!bin) bin = findLlamaServer(settings.dir) ?? ''
  if (!bin) {
    if (!settings.autoSetup) {
      console.warn(
        `[bot] Local LLM: нет llama-server в ${settings.dir}. ` +
          'Положи бинарник вручную или включи LOCAL_LLM_AUTO_SETUP=1.',
      )
      return null
    }
    const tarPath = join(settings.dir, 'llama-server.tar.gz')
    if (!existsSync(tarPath)) {
      const url = process.env.LOCAL_LLM_BIN_URL?.trim() || LLAMA_SERVER_URL
      const sha = process.env.LOCAL_LLM_BIN_URL ? undefined : LLAMA_SERVER_SHA
      await download(url, tarPath, sha, 'llama.cpp (CPU)')
    }
    console.log('[bot] Local LLM: распаковываю llama.cpp…')
    await runCommand('tar', ['-xzf', tarPath, '-C', settings.dir])
    try {
      unlinkSync(tarPath)
    } catch {}
    bin = findLlamaServer(settings.dir) ?? ''
    if (!bin) throw new Error('llama-server не найден после распаковки')
  }

  try {
    statSync(bin)
  } catch {
    return null
  }
  return { bin, model: settings.modelPath }
}

async function isHealthy(settings: Settings): Promise<boolean> {
  try {
    const root = settings.baseUrl.replace(/\/v1\/?$/, '')
    const response = await fetch(`${root}/health`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

function logChild(stream: NodeJS.ReadableStream | null): void {
  stream?.on('data', chunk => {
    const text = chunk.toString()
    if (/error|fatal|fail|listen|model|load|warn/i.test(text)) {
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) console.log(`[local-llm] ${line.trim()}`)
      }
    }
  })
}

function scheduleRestart(): void {
  if (stopping || restarts >= 3 || restartTimer) return
  restarts += 1
  restartTimer = setTimeout(() => {
    restartTimer = null
    void startLocalLlm()
  }, 5000)
  restartTimer.unref?.()
}

function registerHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true
  const stop = () => stopLocalLlm()
  process.on('exit', stop)
  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    stop()
    process.exit(0)
  })
}

function spawnServer(
  settings: Settings,
  files: { bin: string; model: string },
): void {
  const binDir = dirname(files.bin)
  const args = [
    '-m',
    files.model,
    '--host',
    '127.0.0.1',
    '--port',
    String(settings.port),
    '-c',
    String(settings.context),
    '-t',
    '1',
    '--parallel',
    '1',
  ]
  console.log(
    `[bot] Local LLM: запускаю llama-server (контекст ${settings.context})…`,
  )
  const child = spawn(files.bin, args, {
    cwd: binDir,
    env: { ...process.env, LD_LIBRARY_PATH: binDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess = child
  logChild(child.stdout)
  logChild(child.stderr)
  child.on('error', error => {
    console.warn('[bot] Local LLM: не удалось запустить:', error.message)
    ready = false
    serverProcess = null
  })
  child.on('exit', (code, signal) => {
    ready = false
    serverProcess = null
    if (!stopping) {
      console.warn(
        `[bot] Local LLM: сервер остановился (code=${code}, signal=${signal}).`,
      )
      scheduleRestart()
    }
  })
}

async function waitForHealth(settings: Settings): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (!serverProcess) return
    if (await isHealthy(settings)) {
      ready = true
      restarts = 0
      console.log(`[bot] Local LLM: сервер готов — ${settings.baseUrl}`)
      return
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 500))
  }
  console.warn('[bot] Local LLM: сервер не ответил за 120 секунд.')
}

export async function startLocalLlm(): Promise<void> {
  const settings = getSettings()
  if (!settings.enabled || starting || stopping) return
  starting = true
  registerHandlers()
  try {
    if (await isHealthy(settings)) {
      ready = true
      console.log(`[bot] Local LLM: уже запущен — ${settings.baseUrl}`)
      return
    }
    const files = await ensureFiles(settings)
    if (!files) return
    spawnServer(settings, files)
    await waitForHealth(settings)
  } catch (error) {
    console.warn(
      '[bot] Local LLM:',
      error instanceof Error ? error.message : error,
    )
  } finally {
    starting = false
  }
}

export function stopLocalLlm(): void {
  stopping = true
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  serverProcess?.kill('SIGTERM')
  serverProcess = null
  ready = false
}
