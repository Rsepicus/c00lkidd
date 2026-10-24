import { chooseBossAction, chooseBotAction } from '../ai'
import { bossCharacter, bossForWeek, BOSS_ROSTER } from '../boss'
import {
  availableSpecials,
  characterByName,
  CHARACTERS,
  characterWithSpecial,
  type Character,
  type Rng,
} from '../forsaken'
import { createBattle, createTeamBattle, takeTurn, type Battle } from '../pvp'

const BATTLES = Number(process.argv[2] ?? 20)
const PAIR_BATTLES = Number(process.argv[3] ?? 5)

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

function randomLoadout(character: Character, rng: Rng): Character {
  const specials = availableSpecials(character)
  return characterWithSpecial(character, specials[Math.floor(rng() * specials.length)].name)
}

function play(battle: Battle, rng: Rng, maxTurns = 200): Battle {
  let current = battle
  let turns = 0
  while (!current.finished && turns++ < maxTurns) {
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

const weeks = new Map<string, string>()
for (let week = 1; week <= 52 && weeks.size < BOSS_ROSTER.length; week++) {
  const key = `2026-W${String(week).padStart(2, '0')}`
  const name = bossForWeek(key).name
  if (!weeks.has(name)) weeks.set(name, key)
}

const rng = mulberry32(20261024)
console.log(`1v1: ${BATTLES} battles per boss/character; 2v1: ${PAIR_BATTLES} per boss/pair`)

let soloWins = 0
let soloGames = 0
let duoWins = 0
let duoGames = 0

for (const bossName of BOSS_ROSTER) {
  const week = weeks.get(bossName)
  if (!week) continue
  const bossSolo = bossCharacter('1x1', week)
  const bossDuo = bossCharacter('2x2', week)
  let soloBossWins = 0
  for (const playerCharacter of CHARACTERS) {
    for (let index = 0; index < BATTLES; index++) {
      const player = randomLoadout(playerCharacter, rng)
      const battle = createBattle(
        { userId: 'player', name: 'Player', character: player },
        { userId: `boss:${bossName}`, name: `BOSS ${bossName}`, character: bossSolo, boss: true },
      )
      const result = play(battle, rng)
      soloGames += 1
      if (result.finished && result.winner === 0) {
        soloWins += 1
        soloBossWins += 1
      }
    }
  }

  let duoBossWins = 0
  for (let left = 0; left < CHARACTERS.length; left++) {
    for (let right = left + 1; right < CHARACTERS.length; right++) {
      for (let index = 0; index < PAIR_BATTLES; index++) {
        const battle = createTeamBattle(
          [
            {
              userId: 'a',
              name: 'A',
              character: randomLoadout(CHARACTERS[left], rng),
            },
            {
              userId: 'b',
              name: 'B',
              character: randomLoadout(CHARACTERS[right], rng),
            },
          ],
          [
            {
              userId: `boss:${bossName}:duo`,
              name: `BOSS ${bossName}`,
              character: bossDuo,
              boss: true,
            },
          ],
        )
        const result = play(battle, rng)
        duoGames += 1
        if (result.finished && result.winner === 0) {
          duoWins += 1
          duoBossWins += 1
        }
      }
    }
  }

  const soloRate = ((soloBossWins / (CHARACTERS.length * BATTLES)) * 100).toFixed(1)
  const duoRate = (
    (duoBossWins / (((CHARACTERS.length * (CHARACTERS.length - 1)) / 2) * PAIR_BATTLES)) *
    100
  ).toFixed(1)
  console.log(
    `${bossName.padEnd(10)} 1v1 ${soloRate}%  |  2v1 ${duoRate}%  ` +
      `(HP ${bossSolo.hp}/${bossDuo.hp}, ATK ${bossSolo.attack}/${bossDuo.attack})`,
  )
}

console.log(
  `overall 1v1 ${((soloWins / soloGames) * 100).toFixed(1)}% ` +
    `(${soloWins}/${soloGames}), 2v1 ${((duoWins / duoGames) * 100).toFixed(1)}% ` +
    `(${duoWins}/${duoGames})`,
)
