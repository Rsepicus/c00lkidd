import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const APP_ID = '872554207574654978'

function readToken(): string {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const match = line.match(/^DISCORD_BOT_TOKEN=(.*)$/)
    if (match && match[1].trim()) return match[1].trim()
  }
  throw new Error('DISCORD_BOT_TOKEN is missing in .env')
}

const [sourceDir, outputPath] = process.argv.slice(2)
if (!sourceDir || !outputPath) {
  throw new Error('usage: bun upload-emojis.ts <sourceDir> <outputJson>')
}

const token = readToken()
const headers = { Authorization: `Bot ${token}` }

const existingResponse = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
  headers,
})
const existing = existingResponse.ok
  ? ((await existingResponse.json()).items as Array<{ id: string; name: string }>)
  : []
const map: Record<string, string> = Object.fromEntries(existing.map(item => [item.name, item.id]))

for (const file of readdirSync(sourceDir).filter(name => name.endsWith('.png')).sort()) {
  const name = basename(file, '.png').toLowerCase()
  if (map[name]) {
    console.log(`${name}: already uploaded (${map[name]})`)
    continue
  }

  const image = readFileSync(join(sourceDir, file)).toString('base64')
  const response = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, image: `data:image/png;base64,${image}` }),
  })
  const payload = (await response.json()) as { id?: string; message?: string }
  if (!response.ok || !payload.id) {
    console.error(`${name}: ${response.status}`, payload)
    continue
  }

  map[name] = payload.id
  console.log(`${name}: ${payload.id}`)
  await new Promise(resolve => setTimeout(resolve, 250))
}

writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`)
console.log(`saved ${Object.keys(map).length} emojis to ${outputPath}`)
