import type { BotDecision } from './ai'
import { CHARACTERS, type Character } from './forsaken'
import {
  createBattle,
  createTeamBattle,
  type Battle,
  type FighterEntry,
} from './pvp'

/** Shared random-battle helpers for the policy trainer and LLM collector. */

export function makeRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function pick<T>(values: readonly T[], rng: () => number): T {
  return values[Math.floor(rng() * values.length)]!
}

export function randomCharacter(rng: () => number): Character {
  return pick(CHARACTERS, rng)
}

function entry(
  userId: string,
  name: string,
  character: Character,
  boss = false,
): FighterEntry {
  return { userId, name, character, boss }
}

export function randomBattle(
  rng: () => number,
  options: { bossChance?: number; twoVTwoChance?: number } = {},
): Battle {
  const teamSize = rng() < (options.twoVTwoChance ?? 0.3) ? 2 : 1
  const bossFight = rng() < (options.bossChance ?? 0.18)
  const makeTeam = (userId: string, name: string): FighterEntry[] =>
    Array.from({ length: teamSize }, (_, index) =>
      entry(
        userId,
        name,
        randomCharacter(rng),
        bossFight && userId === 'b' && index === 0,
      ),
    )
  const left = makeTeam('a', 'A')
  const right = makeTeam('b', 'B')
  return teamSize === 2
    ? createTeamBattle(left, right)
    : createBattle(left[0]!, right[0]!)
}

export function sameDecision(left: BotDecision, right: BotDecision): boolean {
  return (
    left.action === right.action &&
    (left.specialIndex ?? 0) === (right.specialIndex ?? 0) &&
    (left.targetIndex ?? -1) === (right.targetIndex ?? -1)
  )
}
