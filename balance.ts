import { chooseBotAction } from './ai'
import {
  availableSpecials,
  CHARACTERS,
  characterWithSpecial,
  type Character,
  type Rng,
} from './forsaken'
import {
  createBattle,
  createTeamBattle,
  takeTurn,
  type Battle,
  type BattleMode,
} from './pvp'

export type BalanceRow = {
  name: string
  wins: number
  losses: number
  draws: number
  games: number
  winrate: number
}

export type BalanceSimulation = {
  rows: BalanceRow[]
  battles: number
  draws: number
  seed: number
  battlesPerPair: number
  mode: BattleMode
  character?: string
  special?: string
}

export type BalanceOptions = {
  battlesPerPair?: number
  mode?: BattleMode
  character?: string
  special?: string
  seed?: number
  maxTurns?: number
}

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
  const choices = [character.special.name, ...(character.alternates ?? []).map(entry => entry.name)]
  return characterWithSpecial(character, choices[Math.floor(rng() * choices.length)])
}

export async function simulateBalance(
  options: BalanceOptions = {},
): Promise<BalanceSimulation> {
  const battlesPerPair = Math.max(1, Math.min(200, Math.floor(options.battlesPerPair ?? 30)))
  const maxTurns = Math.max(20, Math.min(300, Math.floor(options.maxTurns ?? 160)))
  const seed = (options.seed ?? Date.now()) >>> 0
  const mode: BattleMode = options.mode === '2x2' ? '2x2' : '1x1'
  const rng = mulberry32(seed)
  const selected = options.character
    ? CHARACTERS.find(character => character.name === options.character)
    : undefined
  if (options.character && !selected) throw new Error('Такого персонажа нет.')
  if (options.special) {
    if (!selected) throw new Error('Способность можно выбрать только вместе с персонажем.')
    if (!availableSpecials(selected).some(special => special.name === options.special)) {
      throw new Error('У этого персонажа нет такой способности.')
    }
  }

  const rows = new Map<string, BalanceRow>()
  const rowFor = (name: string): BalanceRow => {
    const existing = rows.get(name)
    if (existing) return existing
    const created = { name, wins: 0, losses: 0, draws: 0, games: 0, winrate: 0 }
    rows.set(name, created)
    return created
  }

  const pairs: Array<[Character, Character]> = []
  if (selected) {
    for (const opponent of CHARACTERS) {
      if (opponent.name !== selected.name) pairs.push([selected, opponent])
    }
  } else {
    for (let left = 0; left < CHARACTERS.length; left++) {
      for (let right = left + 1; right < CHARACTERS.length; right++) {
        pairs.push([CHARACTERS[left], CHARACTERS[right]])
      }
    }
  }

  let battles = 0
  let draws = 0
  const loadoutFor = (character: Character): Character =>
    selected && character.name === selected.name && options.special
      ? characterWithSpecial(selected, options.special)
      : randomLoadout(character, rng)

  const runBattle = async (
    battle: Battle,
    participants: Character[],
    firstTeamSize: number,
  ): Promise<void> => {
    let current = battle
    let turns = 0
    while (!current.finished && turns++ < maxTurns) {
      const side = current.sides[current.turn]
      const action = side.minion ? 'attack' : chooseBotAction(current, rng)
      current = takeTurn(current, action, rng).battle
    }
    battles += 1
    const firstTeam = participants.slice(0, firstTeamSize)
    const secondTeam = participants.slice(firstTeamSize)
    for (const character of participants) rowFor(character.name).games += 1
    if (!current.finished || current.winner === null) {
      for (const character of participants) rowFor(character.name).draws += 1
      draws += 1
    } else {
      const winners = current.winner === 0 ? firstTeam : secondTeam
      const losers = current.winner === 0 ? secondTeam : firstTeam
      for (const character of winners) rowFor(character.name).wins += 1
      for (const character of losers) rowFor(character.name).losses += 1
    }
    if (battles % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  if (mode === '2x2') {
    for (const character of CHARACTERS) rowFor(character.name)
    if (selected) {
      for (const opponent of CHARACTERS) {
        if (opponent.name === selected.name) continue
        for (let index = 0; index < battlesPerPair; index++) {
          const pool = CHARACTERS.filter(
            character =>
              character.name !== selected.name && character.name !== opponent.name,
          )
          const partnerA = pool.splice(Math.floor(rng() * pool.length), 1)[0]
          const partnerB = pool.splice(Math.floor(rng() * pool.length), 1)[0]
          const teamA = [selected, partnerA]
          const teamB = [opponent, partnerB]
          const left = index % 2 === 0 ? teamA : teamB
          const right = index % 2 === 0 ? teamB : teamA
          const battle = createTeamBattle(
            left.map(character => ({
              userId: 'sim:left',
              name: character.name,
              character: loadoutFor(character),
            })),
            right.map(character => ({
              userId: 'sim:right',
              name: character.name,
              character: loadoutFor(character),
            })),
          )
          await runBattle(battle, [...left, ...right], 2)
        }
      }
    } else {
      for (let index = 0; index < CHARACTERS.length * battlesPerPair; index++) {
        const pool = [...CHARACTERS]
        const chosen: Character[] = []
        while (chosen.length < 4 && pool.length > 0) {
          chosen.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
        }
        const left = index % 2 === 0 ? chosen.slice(0, 2) : chosen.slice(2)
        const right = index % 2 === 0 ? chosen.slice(2) : chosen.slice(0, 2)
        const battle = createTeamBattle(
          left.map(character => ({
            userId: 'sim:left',
            name: character.name,
            character: loadoutFor(character),
          })),
          right.map(character => ({
            userId: 'sim:right',
            name: character.name,
            character: loadoutFor(character),
          })),
        )
        await runBattle(battle, [...left, ...right], 2)
      }
    }
  } else {
    for (const [left, right] of pairs) {
      for (let index = 0; index < battlesPerPair; index++) {
        const first = index % 2 === 0 ? left : right
        const second = index % 2 === 0 ? right : left
        const battle = createBattle(
          { userId: 'sim:left', name: first.name, character: loadoutFor(first) },
          { userId: 'sim:right', name: second.name, character: loadoutFor(second) },
        )
        await runBattle(battle, [first, second], 1)
      }
    }
  }

  const result = [...rows.values()]
    .map(row => ({
      ...row,
      winrate:
        row.wins + row.losses > 0
          ? Math.round((row.wins / (row.wins + row.losses)) * 100)
          : 0,
    }))
    .sort((left, right) => left.winrate - right.winrate || left.name.localeCompare(right.name))

  return {
    rows: result,
    battles,
    draws,
    seed,
    battlesPerPair,
    mode,
    ...(selected ? { character: selected.name } : {}),
    ...(options.special ? { special: options.special } : {}),
  }
}
