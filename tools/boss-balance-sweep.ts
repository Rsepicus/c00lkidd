import { chooseBossAction, chooseBotAction } from '../ai'
import { bossCharacter, bossForWeek, BOSS_ROSTER } from '../boss'
import {
  availableSpecials,
  characterWithSpecial,
  CHARACTERS,
  type Character,
  type Rng,
} from '../forsaken'
import { createBattle, createTeamBattle, takeTurn, type Battle } from '../pvp'

function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function loadout(character: Character, rng: Rng): Character {
  const specials = availableSpecials(character)
  return characterWithSpecial(character, specials[Math.floor(rng() * specials.length)].name)
}

function play(battle: Battle, rng: Rng): Battle {
  let current = battle
  let turns = 0
  while (!current.finished && turns++ < 200) {
    const side = current.sides[current.turn]
    if (side.boss) {
      const decision = chooseBossAction(current, rng)
      current = takeTurn(
        current,
        decision.action,
        rng,
        undefined,
        decision.specialIndex,
      ).battle
    } else {
      current = takeTurn(current, chooseBotAction(current, rng), rng).battle
    }
  }
  return current
}

function winrate(
  boss: Character,
  mode: '1v1' | '2v1',
  games: number,
  seed: number,
): number {
  const rng = mulberry32(seed)
  let wins = 0
  let total = 0
  if (mode === '1v1') {
    for (const character of CHARACTERS) {
      for (let index = 0; index < games; index++) {
        total += 1
        const battle = createBattle(
          { userId: 'player', name: 'Player', character: loadout(character, rng) },
          { userId: 'boss', name: 'Boss', character: boss, boss: true },
        )
        const result = play(battle, rng)
        if (result.finished && result.winner === 0) wins += 1
      }
    }
  } else {
    for (let left = 0; left < CHARACTERS.length; left++) {
      for (let right = left + 1; right < CHARACTERS.length; right++) {
        for (let index = 0; index < games; index++) {
          total += 1
          const battle = createTeamBattle(
            [
              { userId: 'a', name: 'A', character: loadout(CHARACTERS[left], rng) },
              { userId: 'b', name: 'B', character: loadout(CHARACTERS[right], rng) },
            ],
            [{ userId: 'boss', name: 'Boss', character: boss, boss: true }],
          )
          const result = play(battle, rng)
          if (result.finished && result.winner === 0) wins += 1
        }
      }
    }
  }
  return (wins / total) * 100
}

const weeks = new Map<string, string>()
for (let week = 1; week <= 52 && weeks.size < BOSS_ROSTER.length; week++) {
  const key = `2026-W${String(week).padStart(2, '0')}`
  const name = bossForWeek(key).name
  if (!weeks.has(name)) weeks.set(name, key)
}

const SOLO: Record<string, Array<[number, number]>> = {
  Jason: [[80, 11], [85, 11], [90, 11], [90, 12], [95, 12]],
  c00lkidd: [[150, 10], [155, 10], [160, 11], [165, 11], [170, 11]],
  'John Doe': [[80, 8], [90, 8], [100, 8], [110, 9], [120, 9]],
  '1x1x1x1': [[190, 14], [195, 14], [200, 14], [205, 15], [210, 15]],
  Azure: [[100, 9], [105, 10], [110, 10], [115, 10], [120, 10]],
}

const DUO: Record<string, Array<[number, number]>> = {
  Jason: [[140, 15], [145, 16], [150, 16], [155, 17], [160, 17]],
  c00lkidd: [[220, 14], [240, 16], [250, 16], [260, 17], [270, 17]],
  'John Doe': [[220, 13], [230, 13], [240, 13], [250, 14], [260, 14]],
  '1x1x1x1': [[340, 15], [370, 18], [390, 19], [400, 19], [410, 20]],
  Azure: [[160, 13], [165, 14], [170, 14], [175, 15], [180, 15]],
}

for (const bossName of BOSS_ROSTER) {
  const week = weeks.get(bossName)
  if (!week) continue
  const base = bossForWeek(week)
  console.log(`\n${bossName} (${week})`)
  for (const [label, mode, values] of [
    ['1v1', '1v1', SOLO[bossName]],
    ['2v1', '2v1', DUO[bossName]],
  ] as const) {
    const lines = values.map(([hp, attack], index) => {
      const boss: Character = { ...base, hp, attack }
      const rate = winrate(boss, mode, mode === '1v1' ? 8 : 1, 1000 + index)
      return `HP ${hp} / ATK ${attack}: ${rate.toFixed(1)}%`
    })
    console.log(`  ${label}: ${lines.join(' | ')}`)
  }
}
