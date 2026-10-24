import type { Rng } from './forsaken'
import {
  cooldownAfterTick,
  specialReady,
  type Action,
  type Battle,
} from './pvp'

export type BotDecision = { action: Action; specialIndex: number }

export function chooseBossAction(battle: Battle, rng: Rng): BotDecision {
  const side = battle.sides[battle.turn]
  const ready = [0, 1].filter(
    index => cooldownAfterTick(side, index) === 0 && specialReady(side, index),
  )

  if (ready.length > 0 && rng() < 0.8) {
    return {
      action: 'special',
      specialIndex: ready[side.abilityUses % ready.length],
    }
  }

  if (side.hp / side.maxHp < 0.3 && rng() < 0.4) {
    return { action: 'rest', specialIndex: 0 }
  }
  return { action: rng() < 0.12 ? 'juke' : 'attack', specialIndex: 0 }
}

export function chooseBotAction(battle: Battle, rng: Rng): Action {
  const side = battle.sides[battle.turn]
  const woundedAlly = battle.sides.some(
    ally => ally.team === side.team && ally.hp > 0 && ally.maxHp - ally.hp >= 20,
  )

  if (cooldownAfterTick(side) === 0 && specialReady(side)) {
    if (side.character.special.kind === 'heal') {
      return woundedAlly ? 'special' : 'attack'
    }
    if (side.character.special.kind === 'purified') {
      return woundedAlly ? 'special' : 'attack'
    }
    if (side.character.special.kind === 'pray') {
      return woundedAlly ? 'special' : 'attack'
    }
    if (side.character.special.kind === 'battery') {
      return side.hp < side.maxHp ? 'special' : 'attack'
    }
    return rng() < 0.7 ? 'special' : 'attack'
  }

  if (side.hp / side.maxHp < 0.35 && rng() < 0.5) return 'rest'
  return rng() < 0.15 ? 'juke' : 'attack'
}
