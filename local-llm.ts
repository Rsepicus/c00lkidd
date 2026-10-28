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
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'

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
let startRetryTimer: ReturnType<typeof setTimeout> | null = null
let startFailures = 0
let handlersRegistered = false

export type LocalLlmPhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'extracting'
  | 'starting'
  | 'ready'
  | 'error'

let phase: LocalLlmPhase = 'idle'
let phaseDetail = ''
let receivedBytes = 0
let totalBytes = 0
let lastError = ''

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

export type LocalLlmStatus = {
  enabled: boolean
  ready: boolean
  starting: boolean
  phase: LocalLlmPhase
  detail: string
  received: number
  total: number
  error: string
  dir: string
  baseUrl: string
}

export function localLlmStatus(): LocalLlmStatus {
  const settings = getSettings()
  return {
    enabled: settings.enabled,
    ready,
    starting,
    phase: settings.enabled ? phase : 'disabled',
    detail: phaseDetail,
    received: receivedBytes,
    total: totalBytes,
    error: lastError,
    dir: settings.dir,
    baseUrl: settings.baseUrl,
  }
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

const MAX_DOWNLOAD_ATTEMPTS = 4
const PROGRESS_STEP = 25 * 1024 * 1024

function sleep(ms: number): Promise<void> {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms))
}

async function download(
  url: string,
  destination: string,
  expectedSha: string | undefined,
  label: string,
): Promise<void> {
  mkdirSync(dirname(destination), { recursive: true })
  const part = `${destination}.part`
  phase = 'downloading'
  phaseDetail = label
  receivedBytes = 0
  totalBytes = 0
  lastError = ''
  console.log(`[bot] Local LLM: скачиваю ${label}…`)

  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt++) {
    let stream: ReturnType<typeof createWriteStream> | null = null
    try {
      const start = existsSync(part) ? statSync(part).size : 0
      const headers: Record<string, string> = {}
      if (start > 0) headers.Range = `bytes=${start}-`
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      })
      if (response.status === 416) {
        try {
          unlinkSync(part)
        } catch {}
        throw new Error('HTTP 416, начинаю заново')
      }
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }
      const append = start > 0 && response.status === 206
      const remaining = Number(response.headers.get('content-length')) || 0
      totalBytes = append ? start + remaining : remaining
      receivedBytes = append ? start : 0
      if (attempt === 1 && totalBytes > 0) {
        console.log(
          `[bot] Local LLM: ${label} — размер ${Math.round(totalBytes / 1024 / 1024)} МБ`,
        )
      }
      if (append) {
        console.log(
          `[bot] Local LLM: ${label} — продолжаю с ${Math.round(start / 1024 / 1024)} МБ`,
        )
      }
      stream = createWriteStream(part, { flags: append ? 'a' : 'w' })
      const reader = response.body.getReader()
      let received = receivedBytes
      let nextLog = Math.floor(received / PROGRESS_STEP) * PROGRESS_STEP + PROGRESS_STEP
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = Buffer.from(value)
        if (!stream.write(chunk)) {
          await new Promise<void>(resolveDrain => stream!.once('drain', resolveDrain))
        }
        received += chunk.length
        receivedBytes = received
        if (received >= nextLog) {
          const total =
            totalBytes > 0 ? `/${Math.round(totalBytes / 1024 / 1024)}` : ''
          const percent =
            totalBytes > 0
              ? ` (${Math.round((received / totalBytes) * 100)}%)`
              : ''
          console.log(
            `[bot] Local LLM: ${label} — ${Math.round(received / 1024 / 1024)}${total} МБ${percent}`,
          )
          nextLog += PROGRESS_STEP
        }
      }
      await new Promise<void>((resolveStream, rejectStream) => {
        stream!.on('finish', resolveStream)
        stream!.on('error', rejectStream)
        stream!.end()
      })
      if (expectedSha) {
        const actual = await sha256File(part)
        if (actual !== expectedSha) {
          try {
            unlinkSync(part)
          } catch {}
          throw new Error('SHA-256 не совпал')
        }
      }
      renameSync(part, destination)
      phase = 'idle'
      phaseDetail = label
      console.log(
        `[bot] Local LLM: ${label} готов (${Math.round(received / 1024 / 1024)} МБ)`,
      )
      return
    } catch (error) {
      stream?.destroy()
      lastError = error instanceof Error ? error.message : String(error)
      if (attempt >= MAX_DOWNLOAD_ATTEMPTS) {
        phase = 'error'
        console.warn(
          `[bot] Local LLM: ${label} не скачалась после ${attempt} попыток: ${lastError}`,
        )
        throw error
      }
      const delay = 2000 * attempt
      phase = 'downloading'
      phaseDetail = `${label} — повтор ${attempt + 1}/${MAX_DOWNLOAD_ATTEMPTS}`
      console.warn(
        `[bot] Local LLM: ${label} — ${lastError}; повтор ${attempt + 1}/${MAX_DOWNLOAD_ATTEMPTS} через ${Math.round(delay / 1000)} с…`,
      )
      await sleep(delay)
    }
  }
}

function findLlamaServer(root: string, requireLibs = false): string | null {
  const servers: string[] = []
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
      if (entry.isFile() && entry.name === 'llama-server') servers.push(full)
      if (entry.isDirectory()) stack.push(full)
    }
  }
  if (!requireLibs) return servers[0] ?? null

  const libs = findLibraryDirs(root)
  repairSonameLinks(libs)
  if (!hasLlamaCommon(libs)) return null
  // Prefer a binary whose own directory contains libraries; all dirs still go
  // into LD_LIBRARY_PATH.
  return servers.find(server => hasLlamaCommon(findLibraryDirs(dirname(server)))) ??
    servers[0] ??
    null
}

/** Finds every directory with a shared library, not just the binary folder. */
function findLibraryDirs(root: string): string[] {
  const dirs = new Set<string>()
  const stack = [root]
  while (stack.length > 0) {
    const directory = stack.pop()!
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      continue
    }
    let hasLibrary = false
    for (const entry of entries) {
      if (entry.isDirectory()) {
        stack.push(join(directory, entry.name))
        continue
      }
      if (/\.so(\.|$)/.test(entry.name)) hasLibrary = true
    }
    if (hasLibrary) dirs.add(directory)
  }
  return [...dirs]
}

function hasLlamaCommon(dirs: string[]): boolean {
  return dirs.some(directory => {
    try {
      return readdirSync(directory).some(name => /^libllama-common\.so/.test(name))
    } catch {
      return false
    }
  })
}

/**
 * The release archive normally contains soname symlinks. Some panel file
 * managers lose them while migrating a server, leaving only libfoo.so.0.0.0.
 * Recreate the libfoo.so.0 links the loader asks for.
 */
function repairSonameLinks(dirs: string[]): void {
  for (const directory of dirs) {
    let names: string[]
    try {
      names = readdirSync(directory)
    } catch {
      continue
    }
    const present = new Set(names)
    for (const name of names) {
      const match = name.match(/^(lib.+)\.so\.(\d+)(?:\.\d+)*$/)
      if (!match) continue
      const soname = `${match[1]}.so.${match[2]}`
      if (present.has(soname)) continue
      try {
        symlinkSync(name, join(directory, soname))
        console.log(`[bot] Local LLM: восстановил библиотеку ${soname} → ${name}`)
        present.add(soname)
      } catch (error) {
        console.warn(
          `[bot] Local LLM: не удалось создать ${soname}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }
}

function libraryPathFor(bin: string, root: string): string {
  const dirs = [dirname(bin), ...findLibraryDirs(root)]
  return [
    ...new Set(
      [...dirs, process.env.LD_LIBRARY_PATH ?? '']
        .map(value => value.trim())
        .filter(Boolean),
    ),
  ].join(delimiter)
}

async function ensureFiles(
  settings: Settings,
): Promise<{ bin: string; model: string } | null> {
  mkdirSync(settings.dir, { recursive: true })

  if (!existsSync(settings.modelPath)) {
    if (!settings.autoSetup) {
      phase = 'error'
      lastError = `нет модели ${settings.modelPath}`
      console.warn(
        `[bot] Local LLM: нет модели ${settings.modelPath}. ` +
          'Положи GGUF вручную или включи LOCAL_LLM_AUTO_SETUP=1.',
      )
      return null
    }
    const url = process.env.LOCAL_LLM_MODEL_URL?.trim() || MODEL_URL
    const sha = process.env.LOCAL_LLM_MODEL_URL ? undefined : MODEL_SHA
    await download(url, settings.modelPath, sha, 'модель SmolLM2-135M')
  } else {
    console.log('[bot] Local LLM: модель уже есть:', settings.modelPath)
  }

  let bin = settings.configuredBin
  if (bin && !existsSync(bin)) {
    console.warn(`[bot] Local LLM: LOCAL_LLM_BIN не найден: ${bin}`)
    bin = ''
  }
  if (!bin) bin = findLlamaServer(settings.dir, true) ?? ''
  if (bin) {
    const libs = [
      ...new Set([
        ...findLibraryDirs(settings.dir),
        ...findLibraryDirs(dirname(bin)),
      ]),
    ]
    repairSonameLinks(libs)
    if (hasLlamaCommon(libs)) {
      console.log('[bot] Local LLM: llama-server и библиотеки на месте:', bin)
      return { bin, model: settings.modelPath }
    }
  } else {
    const found = findLlamaServer(settings.dir)
    if (found) {
      console.warn(
        '[bot] Local LLM: llama-server есть, но libllama-common.so не найден — ' +
          'переустанавливаю llama.cpp.',
      )
      bin = found
    }
  }

  if (!settings.autoSetup) {
    phase = 'error'
    lastError = bin
      ? 'llama-server найден, но его библиотеки отсутствуют'
      : `нет llama-server в ${settings.dir}`
    console.warn(
      `[bot] Local LLM: ${lastError}. ` +
        'Положи бинарник с библиотеками вручную или включи LOCAL_LLM_AUTO_SETUP=1.',
    )
    return null
  }

  const tarPath = join(settings.dir, 'llama-server.tar.gz')
  if (!existsSync(tarPath)) {
    const url = process.env.LOCAL_LLM_BIN_URL?.trim() || LLAMA_SERVER_URL
    const sha = process.env.LOCAL_LLM_BIN_URL ? undefined : LLAMA_SERVER_SHA
    await download(url, tarPath, sha, 'llama.cpp (CPU)')
  } else {
    console.log('[bot] Local LLM: архив llama.cpp уже есть, распаковываю…')
  }
  phase = 'extracting'
  phaseDetail = 'llama.cpp'
  console.log('[bot] Local LLM: распаковываю llama.cpp…')
  try {
    await runCommand('tar', ['-xzf', tarPath, '-C', settings.dir])
    try {
      unlinkSync(tarPath)
    } catch {}
  } catch (error) {
    // A corrupt archive must not poison every retry.
    try {
      unlinkSync(tarPath)
    } catch {}
    throw error
  }
  const libs = findLibraryDirs(settings.dir)
  repairSonameLinks(libs)
  bin = findLlamaServer(settings.dir, true) ?? ''
  if (!bin) {
    throw new Error(
      hasLlamaCommon(libs)
        ? 'llama-server не найден после распаковки'
        : 'libllama-common.so не найден после распаковки',
    )
  }
  console.log('[bot] Local LLM: llama-server:', bin)
  console.log('[bot] Local LLM: библиотеки:', libs.join(', ') || 'в папке бинарника')

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

function scheduleStartRetry(): void {
  if (stopping || startRetryTimer || startFailures >= 3) return
  startFailures += 1
  const delay = 30_000 * startFailures
  console.warn(
    `[bot] Local LLM: повторная попытка через ${Math.round(delay / 1000)} с.`,
  )
  startRetryTimer = setTimeout(() => {
    startRetryTimer = null
    void startLocalLlm()
  }, delay)
  startRetryTimer.unref?.()
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
  const libPath = libraryPathFor(files.bin, settings.dir)
  if (libPath) console.log(`[bot] Local LLM: LD_LIBRARY_PATH=${libPath}`)
  console.log(
    `[bot] Local LLM: запускаю llama-server (контекст ${settings.context})…`,
  )
  const child = spawn(files.bin, args, {
    cwd: binDir,
    env: { ...process.env, LD_LIBRARY_PATH: libPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  serverProcess = child
  logChild(child.stdout)
  logChild(child.stderr)
  child.on('error', error => {
    console.warn('[bot] Local LLM: не удалось запустить:', error.message)
    phase = 'error'
    lastError = error.message
    ready = false
    serverProcess = null
  })
  child.on('exit', (code, signal) => {
    ready = false
    serverProcess = null
    if (!stopping) {
      phase = 'error'
      lastError = `llama-server остановился (code=${code}, signal=${signal})`
      console.warn(`[bot] Local LLM: ${lastError}.`)
      scheduleRestart()
    }
  })
}

async function waitForHealth(settings: Settings): Promise<void> {
  for (let attempt = 0; attempt < 240; attempt++) {
    if (!serverProcess) return
    if (await isHealthy(settings)) {
      ready = true
      phase = 'ready'
      restarts = 0
      console.log(`[bot] Local LLM: сервер готов — ${settings.baseUrl}`)
      return
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 500))
  }
  phase = 'error'
  lastError = 'llama-server не ответил за 120 секунд'
  console.warn(`[bot] Local LLM: ${lastError}.`)
}

export async function startLocalLlm(): Promise<void> {
  const settings = getSettings()
  if (!settings.enabled || starting || stopping) return
  starting = true
  phase = 'checking'
  phaseDetail = ''
  lastError = ''
  console.log(`[bot] Local LLM: включён, папка ${settings.dir}`)
  registerHandlers()
  try {
    if (await isHealthy(settings)) {
      ready = true
      phase = 'ready'
      startFailures = 0
      console.log(`[bot] Local LLM: уже запущен — ${settings.baseUrl}`)
      return
    }
    const files = await ensureFiles(settings)
    if (!files) {
      if (phase !== 'error') {
        phase = 'error'
        lastError = 'файлы модели не найдены'
      }
      if (settings.autoSetup) scheduleStartRetry()
      return
    }
    phase = 'starting'
    phaseDetail = 'llama-server'
    spawnServer(settings, files)
    await waitForHealth(settings)
    if (ready) startFailures = 0
  } catch (error) {
    phase = 'error'
    lastError = error instanceof Error ? error.message : String(error)
    console.warn('[bot] Local LLM:', lastError)
    scheduleStartRetry()
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
  if (startRetryTimer) {
    clearTimeout(startRetryTimer)
    startRetryTimer = null
  }
  serverProcess?.kill('SIGTERM')
  serverProcess = null
  ready = false
  phase = 'idle'
  phaseDetail = ''
}
