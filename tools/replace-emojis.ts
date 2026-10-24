import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

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

const [sourceDir, outputPathArg] = process.argv.slice(2)
if (!sourceDir) {
  throw new Error('usage: bun replace-emojis.ts <sourceDir> [outputJson]')
}
const outputPath = outputPathArg ?? join(root, 'emojis.json')
const token = readToken()
const headers = { Authorization: `Bot ${token}` }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const existingResponse = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
  headers,
})
if (!existingResponse.ok) {
  throw new Error(`cannot list emojis: ${existingResponse.status} ${await existingResponse.text()}`)
}
const existing = ((await existingResponse.json()) as {
  items: Array<{ id: string; name: string }>
}).items
const map = JSON.parse(readFileSync(outputPath, 'utf8')) as Record<string, string>

for (const file of readdirSync(sourceDir)
  .filter(name => name.endsWith('.png'))
  .sort()) {
  const name = basename(file, '.png').toLowerCase()
  const old = existing.filter(item => item.name === name)
  for (const item of old) {
    const response = await fetch(
      `https://discord.com/api/v10/applications/${APP_ID}/emojis/${item.id}`,
      { method: 'DELETE', headers },
    )
    if (!response.ok && response.status !== 404) {
      throw new Error(`cannot delete ${name}: ${response.status} ${await response.text()}`)
    }
    console.log(`${name}: deleted old ${item.id}`)
    await sleep(300)
  }

  const image = await sharp(join(sourceDir, file))
    .resize(128, 128, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer()

  let uploaded: { id?: string; message?: string } | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        image: `data:image/png;base64,${image.toString('base64')}`,
      }),
    })
    uploaded = (await response.json()) as { id?: string; message?: string }
    if (response.ok && uploaded.id) break
    console.error(`${name}: attempt ${attempt}/3 failed (${response.status})`, uploaded)
    await sleep(1000 * attempt)
  }
  if (!uploaded?.id) {
    throw new Error(`${name}: upload failed after deleting the old emoji`)
  }

  map[name] = uploaded.id
  console.log(`${name}: ${uploaded.id}`)
  await sleep(300)
}

writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`)
console.log(`saved ${Object.keys(map).length} emoji ids to ${outputPath}`)
