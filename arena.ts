import { chooseBotTurn, decisionQuality, type BotDecision } from './ai'
import { characterByName, type Character } from './forsaken'
import { chooseLlmTurn, type LlmTurn } from './llm-ai'
import { choosePolicyTurn, policyAiEnabled, policyAvailable } from './policy'
import {
  createBattle,
  takeTurn,
  type Battle,
  type FighterEntry,
} from './pvp'

export { decisionQuality } from './ai'

/**
 * Debug arena: mirror 1v1 battles where one side is driven by the LLM and the
 * other by the heuristic. The same seed is used for both side assignments so
 * first-turn advantage and random rolls cancel out.
 */

export const ARENA_CHARACTERS = ['Jason', 'Guest 1337', 'Two Time'] as const
export const ARENA_BATTLES = ARENA_CHARACTERS.length * 2
const DEFAULT_MAX_TURNS = 50

export type ArenaLlmChooser = (
  battle: Battle,
  recentEvents: string[],
) => Promise<LlmTurn | null>

export type ArenaBattleResult = {
  seed: number
  character: string
  llmTeam: 0 | 1
  winner: 0 | 1 | null
  turns: number
  llmDamage: number
  heuristicDamage: number
  llmActions: number
  heuristicActions: number
  llmDamageTaken: number
  heuristicDamageTaken: number
  llmHealing: number
  heuristicHealing: number
  llmWasted: number
  heuristicWasted: number
  llmMissedFinishes: number
  heuristicMissedFinishes: number
  llmDecisions: number
  fallbacks: number
  models: string[]
}

export type ArenaResult = {
  battles: ArenaBattleResult[]
  llmWins: number
  heuristicWins: number
  draws: number
  llmDecisions: number
  fallbacks: number
  avgTurns: number
  llmDamage: number
  heuristicDamage: number
  llmActions: number
  heuristicActions: number
  llmDamageTaken: number
  heuristicDamageTaken: number
  llmHealing: number
  heuristicHealing: number
  llmWasted: number
  heuristicWasted: number
  llmMissedFinishes: number
  heuristicMissedFinishes: number
  models: string[]
}

export type ArenaOptions = {
  characters?: readonly string[]
  seeds?: readonly number[]
  maxTurns?: number
  onProgress?: (done: number, total: number) => void | Promise<void>
}

/** Small deterministic PRNG so both side assignments see the same rolls. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFor(name: string, index: number): number {
  let hash = 2166136261
  for (const char of name) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash ^ (index + 1)) >>> 0
}

function entriesFor(
  character: Character,
  llmTeam: 0 | 1,
): [FighterEntry, FighterEntry] {
  const llm: FighterEntry = {
    userId: 'arena:llm',
    name: 'Нейросеть',
    character,
  }
  const heuristic: FighterEntry = {
    userId: 'arena:heuristic',
    name: 'Эвристика',
    character,
  }
  return llmTeam === 0 ? [llm, heuristic] : [heuristic, llm]
}

function damageOf(battle: Battle, team: 0 | 1): number {
  return battle.sides
    .filter(side => side.team === team)
    .reduce((sum, side) => sum + side.damageDealt, 0)
}

function damageTakenOf(battle: Battle, team: 0 | 1): number {
  return battle.sides
    .filter(side => side.team === team)
    .reduce((sum, side) => sum + side.damageTaken, 0)
}

function healingOf(battle: Battle, team: 0 | 1): number {
  return battle.sides
    .filter(side => side.team === team)
    .reduce((sum, side) => sum + side.healingDone, 0)
}

async function runBattle(
  chooser: ArenaLlmChooser,
  character: Character,
  seed: number,
  llmTeam: 0 | 1,
  maxTurns: number,
): Promise<ArenaBattleResult> {
  const rng = mulberry32(seed)
  let battle = createBattle(...entriesFor(character, llmTeam))
  const events: string[] = []
  const models = new Set<string>()
  const heuristicTeam: 0 | 1 = llmTeam === 0 ? 1 : 0
  let llmDecisions = 0
  let fallbacks = 0
  let llmActions = 0
  let heuristicActions = 0
  let llmWasted = 0
  let heuristicWasted = 0
  let llmMissedFinishes = 0
  let heuristicMissedFinishes = 0

  while (!battle.finished && battle.clock < maxTurns) {
    const side = battle.sides[battle.turn]
    let decision: BotDecision
    if (side.team === llmTeam && side.stunned) {
      // takeTurn skips a stunned side anyway; do not count this as a fallback.
      decision = { action: 'attack', specialIndex: 0 }
    } else if (side.team === llmTeam) {
      const llmTurn = await chooser(battle, events.slice(-6))
      if (llmTurn) {
        decision = llmTurn.decision
        llmDecisions += 1
        models.add(`${llmTurn.provider} ${llmTurn.model}`)
      } else {
        decision = chooseBotTurn(battle, rng)
        fallbacks += 1
      }
    } else {
      decision = chooseBotTurn(battle, rng)
    }
    if (!side.stunned) {
      const quality = decisionQuality(battle, side, decision)
      if (side.team === llmTeam) {
        llmActions += 1
        if (quality.wasted) llmWasted += 1
        if (quality.missedFinish) llmMissedFinishes += 1
      } else {
        heuristicActions += 1
        if (quality.wasted) heuristicWasted += 1
        if (quality.missedFinish) heuristicMissedFinishes += 1
      }
    }
    const result = takeTurn(
      battle,
      decision.action,
      rng,
      decision.targetIndex,
      decision.specialIndex,
    )
    battle = result.battle
    events.push(...result.events)
    if (events.length > 40) events.splice(0, events.length - 40)
  }

  return {
    seed,
    character: character.name,
    llmTeam,
    winner: battle.finished ? battle.winner : null,
    turns: battle.clock,
    llmDamage: damageOf(battle, llmTeam),
    heuristicDamage: damageOf(battle, heuristicTeam),
    llmActions,
    heuristicActions,
    llmDamageTaken: damageTakenOf(battle, llmTeam),
    heuristicDamageTaken: damageTakenOf(battle, heuristicTeam),
    llmHealing: healingOf(battle, llmTeam),
    heuristicHealing: healingOf(battle, heuristicTeam),
    llmWasted,
    heuristicWasted,
    llmMissedFinishes,
    heuristicMissedFinishes,
    llmDecisions,
    fallbacks,
    models: [...models],
  }
}

export async function runArena(
  chooser: ArenaLlmChooser,
  options: ArenaOptions = {},
): Promise<ArenaResult> {
  const names = options.characters ?? ARENA_CHARACTERS
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS
  const battles: ArenaBattleResult[] = []
  const planned = names.flatMap((name, index) => [
    { name, index, llmTeam: 0 as const, seed: options.seeds?.[index] ?? seedFor(name, index) },
    { name, index, llmTeam: 1 as const, seed: options.seeds?.[index] ?? seedFor(name, index) },
  ])

  for (let index = 0; index < planned.length; index++) {
    const plan = planned[index]
    const character = characterByName(plan.name)
    if (!character) continue
    battles.push(await runBattle(chooser, character, plan.seed, plan.llmTeam, maxTurns))
    await options.onProgress?.(battles.length, planned.length)
  }

  const llmWins = battles.filter(battle => battle.winner === battle.llmTeam).length
  const heuristicWins = battles.filter(
    battle => battle.winner !== null && battle.winner !== battle.llmTeam,
  ).length
  const draws = battles.length - llmWins - heuristicWins
  const models = new Set<string>()
  for (const battle of battles) {
    for (const model of battle.models) models.add(model)
  }
  return {
    battles,
    llmWins,
    heuristicWins,
    draws,
    llmDecisions: battles.reduce((sum, battle) => sum + battle.llmDecisions, 0),
    fallbacks: battles.reduce((sum, battle) => sum + battle.fallbacks, 0),
    avgTurns:
      battles.length > 0
        ? battles.reduce((sum, battle) => sum + battle.turns, 0) / battles.length
        : 0,
    llmDamage: battles.reduce((sum, battle) => sum + battle.llmDamage, 0),
    heuristicDamage: battles.reduce((sum, battle) => sum + battle.heuristicDamage, 0),
    llmActions: battles.reduce((sum, battle) => sum + battle.llmActions, 0),
    heuristicActions: battles.reduce((sum, battle) => sum + battle.heuristicActions, 0),
    llmDamageTaken: battles.reduce((sum, battle) => sum + battle.llmDamageTaken, 0),
    heuristicDamageTaken: battles.reduce(
      (sum, battle) => sum + battle.heuristicDamageTaken,
      0,
    ),
    llmHealing: battles.reduce((sum, battle) => sum + battle.llmHealing, 0),
    heuristicHealing: battles.reduce((sum, battle) => sum + battle.heuristicHealing, 0),
    llmWasted: battles.reduce((sum, battle) => sum + battle.llmWasted, 0),
    heuristicWasted: battles.reduce((sum, battle) => sum + battle.heuristicWasted, 0),
    llmMissedFinishes: battles.reduce(
      (sum, battle) => sum + battle.llmMissedFinishes,
      0,
    ),
    heuristicMissedFinishes: battles.reduce(
      (sum, battle) => sum + battle.heuristicMissedFinishes,
      0,
    ),
    models: [...models],
  }
}

export function runPolicyArena(options: ArenaOptions = {}): Promise<ArenaResult> {
  return runArena(async battle => {
    const turn = choosePolicyTurn(battle)
    if (!turn) return null
    return {
      decision: turn.decision,
      provider: turn.provider,
      model: turn.model,
      keyIndex: turn.keyIndex,
      keyCount: turn.keyCount,
    }
  }, options)
}

export function runLlmArena(options: ArenaOptions = {}): Promise<ArenaResult> {
  if (policyAiEnabled() && policyAvailable()) {
    return runPolicyArena(options)
  }
  return runArena(
    (battle, recentEvents) =>
      chooseLlmTurn(battle, recentEvents, { ignoreScope: true }),
    options,
  )
}
