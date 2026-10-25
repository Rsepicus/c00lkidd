import type { Rng, Special } from './forsaken'
import {
  alliesOf,
  cooldownAfterTick,
  enemiesOf,
  specialNeedsEnemyTarget,
  specialOf,
  specialReady,
  type Action,
  type Battle,
  type Side,
} from './pvp'

export type BotDecision = { action: Action; specialIndex: number }

const LOW_HP = 0.4
const DANGER_HP = 0.55
const BOSS_LOW_HP = 0.3
const LOW_ENEMY_HP = 0.3
const REST_CHANCE = 0.65
const HEMORRHAGE_REST_CHANCE = 0.85
const MID_HP_JUKE_CHANCE = 0.4
const JUKE_CHANCE = 0.5

type StatusKey = keyof Side['effects']

function hasStatus(side: Side, status: StatusKey): boolean {
  return (side.effects[status] ?? 0) > 0
}

function missingHp(side: Side): number {
  return Math.max(0, side.maxHp - side.hp)
}

function hpRatio(side: Side): number {
  return side.maxHp > 0 ? side.hp / side.maxHp : 0
}

/** HP that a heal from `healer` would actually restore on `target` right now. */
function healableMissing(target: Side, healer: Side): number {
  if (target.hp <= 0 || target.fake) return 0
  if (hasStatus(target, 'hemorrhage')) return 0
  if (
    target !== healer &&
    (hasStatus(target, 'oblivious') || target.character.name === 'Veeronica')
  ) {
    return 0
  }
  return missingHp(target)
}

/** How badly an ally needs healing: 0 for nearly full, ~30 for nearly dead. */
function healUrgency(allies: Side[], healer: Side): number {
  let lowest = 1
  let wounded = false
  for (const ally of allies) {
    if (healableMissing(ally, healer) <= 0) continue
    wounded = true
    lowest = Math.min(lowest, hpRatio(ally))
  }
  if (!wounded) return -1
  return Math.round(30 * (1 - lowest))
}

/** Approximate immediate damage, ignoring modifiers, for lethal checks. */
function immediateDamage(special: Special, side: Side): number {
  switch (special.kind) {
    case 'heavy':
    case 'weakness':
    case 'vulnerable':
    case 'cry':
    case 'oneshot':
    case 'crystal':
      return special.power
    case 'corrupt':
      return 10
    case 'seeker':
      return special.damage ?? 4
    case 'bloodhunt':
      return 8
    case 'stun':
      if (special.name === 'Charge') return 3
      if (special.name === 'Subspace Tripmine') return 5
      return 0
    case 'hemorrhage':
      return special.name === 'Eviscerate' ? 10 : 0
    case 'poison':
    case 'burn':
    case 'turret':
    case 'trap':
      if (special.name === 'Mass Infection') return 4
      if (special.name === 'Sentry') return 5
      return 0
    case 'bleed':
      return special.name === 'Tripwire' ? 4 : 0
    case 'creatures':
      return special.name === "Hunter's Feast" ? 8 : 0
    case 'gamble':
      return Math.ceil(side.character.attack * 0.75)
    default:
      return 0
  }
}

function isLethal(special: Special, side: Side, enemies: Side[]): boolean {
  const damage = immediateDamage(special, side)
  if (damage <= 0) return false
  return enemies.some(enemy => !enemy.fake && damage >= enemy.hp)
}

/**
 * How much a special is worth using right now. 0 means the engine would get no
 * value out of it (e.g. a heal at full HP), so the AI should not spend a turn.
 */
function scoreSpecial(battle: Battle, side: Side, index = 0): number {
  const special = specialOf(side, index)
  const enemies = enemiesOf(battle, side)
  if (enemies.length === 0) return 0

  const livingAllies = alliesOf(battle, side)
  const allies = livingAllies.filter(ally => !ally.fake)
  const livingEnemies = enemies.filter(enemy => !enemy.fake)
  const urgency = healUrgency(allies, side)
  const selfRatio = hpRatio(side)
  const enemyLow = livingEnemies.some(enemy => hpRatio(enemy) <= LOW_ENEMY_HP)

  switch (special.kind) {
    case 'heal': {
      // Elliot's Pizza Throw skips himself in team fights; mirror that when
      // deciding whether the special would heal anyone.
      const targets =
        special.name === 'Pizza Throw' &&
        side.character.name === 'Elliot' &&
        livingAllies.length > 1
          ? allies.filter(ally => ally !== side)
          : allies
      const targetUrgency = healUrgency(targets, side)
      if (targetUrgency < 0) return 0
      return 60 + targetUrgency
    }
    case 'purified': {
      if (urgency < 0) return 0
      return 60 + urgency
    }
    case 'pray': {
      if (hasStatus(side, 'hemorrhage') || side.hp >= side.maxHp) return 0
      const amount = Math.min(special.power, Math.floor(side.charge / 2))
      if (amount <= 0) return 0
      return 60 + Math.round(30 * (1 - selfRatio))
    }
    case 'battery': {
      if (hasStatus(side, 'hemorrhage') || side.charge < 10 || side.hp >= side.maxHp) {
        return 0
      }
      return 60 + Math.round(30 * (1 - selfRatio))
    }
    case 'shield': {
      // The shield overwrites the old one, so only spend it on a real upgrade.
      if (!allies.some(ally => ally.shield < special.power)) return 0
      // Do not pre-shield at full HP: there is nothing to protect yet.
      if (urgency < 0) return 0
      return 62 + urgency
    }
    case 'regeneration':
    case 'dispenser': {
      if (urgency < 0) return 0
      return 58 + urgency
    }
    case 'dodge':
      if (side.dodging) return 0
      return selfRatio <= LOW_HP ? 62 : 55
    case 'lifesteal':
      if (side.lifesteal) return 0
      return selfRatio <= LOW_HP ? 58 : 52
    case 'empower':
      if (side.empoweredAttack) return 0
      return 52
    case 'block':
      if (side.blocking) return 0
      return 60
    case 'revive':
      return 70
    case 'rejuvenate':
      return (side.rottenCorpses?.length ?? 0) > 0 ? 65 : 0
    default:
      break
  }

  const targeted = specialNeedsEnemyTarget(side, index)
  if (targeted && livingEnemies.length === 0) return 0

  const damage = immediateDamage(special, side)
  // Re-applying a pure debuff that every living enemy already has burns a cooldown.
  if (damage <= 0 && livingEnemies.length > 0) {
    const redundant =
      (special.kind === 'glitch' && livingEnemies.every(enemy => hasStatus(enemy, 'glitch'))) ||
      (special.kind === 'hemorrhage' &&
        livingEnemies.every(enemy => hasStatus(enemy, 'hemorrhage'))) ||
      (special.kind === 'weakness' &&
        livingEnemies.every(enemy => hasStatus(enemy, 'weakness'))) ||
      (special.kind === 'vulnerable' &&
        livingEnemies.every(enemy => hasStatus(enemy, 'vulnerable'))) ||
      (special.kind === 'creatures' &&
        livingEnemies.every(enemy => hasStatus(enemy, 'creatures')))
    if (redundant) return 0
  }

  let score = 60
  if (damage > 0 && livingEnemies.some(enemy => damage >= enemy.hp)) score += 40
  if (enemyLow && (damage > 0 || targeted)) score += 15
  return score
}

function specialChance(score: number, lethal: boolean, aggressive: boolean): number {
  if (lethal) return 0.95
  if (aggressive) return 0.93
  if (score >= 70) return 0.92
  return 0.85
}

function shouldJuke(side: Side): boolean {
  // Juking is only worth a turn when the incoming hit could actually hurt.
  return hpRatio(side) <= DANGER_HP
}

export function chooseBossAction(battle: Battle, rng: Rng): BotDecision {
  const side = battle.sides[battle.turn]
  const enemies = enemiesOf(battle, side)
  const ready = [0, 1].filter(
    index => cooldownAfterTick(side, index) === 0 && specialReady(side, index),
  )
  const scored = ready.map(index => ({ index, score: scoreSpecial(battle, side, index) }))
  const bestScore = scored.reduce((best, option) => Math.max(best, option.score), 0)
  const lowEnemy = enemies.some(enemy => !enemy.fake && hpRatio(enemy) <= LOW_ENEMY_HP)

  if (bestScore > 0) {
    // Equal-scored options rotate, so bosses with two good specials still vary.
    const best = scored.filter(option => option.score === bestScore)
    const chosen = best[side.abilityUses % best.length]
    const special = specialOf(side, chosen.index)
    const lethal = isLethal(special, side, enemies)
    const aggressive = lowEnemy && immediateDamage(special, side) > 0
    if (rng() < specialChance(bestScore, lethal, aggressive)) {
      return { action: 'special', specialIndex: chosen.index }
    }
  }

  // Hemorrhage is worth clearing even at high HP: resting removes it.
  if (hasStatus(side, 'hemorrhage')) {
    if (rng() < HEMORRHAGE_REST_CHANCE) return { action: 'rest', specialIndex: 0 }
    return { action: 'attack', specialIndex: 0 }
  }

  // Never give a nearly-dead player a free turn just to heal chip damage.
  if (lowEnemy) return { action: 'attack', specialIndex: 0 }

  if (hpRatio(side) <= BOSS_LOW_HP) {
    if (rng() < 0.5) return { action: 'rest', specialIndex: 0 }
    if (rng() < JUKE_CHANCE) return { action: 'juke', specialIndex: 0 }
    return { action: 'attack', specialIndex: 0 }
  }

  if (shouldJuke(side) && rng() < 0.25) {
    return { action: 'juke', specialIndex: 0 }
  }
  return { action: 'attack', specialIndex: 0 }
}

export function chooseBotAction(battle: Battle, rng: Rng): Action {
  const side = battle.sides[battle.turn]
  const enemies = enemiesOf(battle, side)
  const specialOnCooldown = cooldownAfterTick(side) !== 0 || !specialReady(side)
  const score = specialOnCooldown ? 0 : scoreSpecial(battle, side)
  const special = specialOf(side)
  const enemyLow = enemies.some(enemy => !enemy.fake && hpRatio(enemy) <= LOW_ENEMY_HP)

  if (score > 0) {
    const lethal = isLethal(special, side, enemies)
    const aggressive = enemyLow && immediateDamage(special, side) > 0
    if (rng() < specialChance(score, lethal, aggressive)) return 'special'
  }

  if (hasStatus(side, 'hemorrhage')) {
    if (rng() < HEMORRHAGE_REST_CHANCE) return 'rest'
    if (shouldJuke(side) && rng() < JUKE_CHANCE) return 'juke'
    return 'attack'
  }

  if (hpRatio(side) <= LOW_HP) {
    if (rng() < REST_CHANCE) return 'rest'
    if (rng() < JUKE_CHANCE) return 'juke'
    return 'attack'
  }

  if (shouldJuke(side) && rng() < MID_HP_JUKE_CHANCE) return 'juke'
  return 'attack'
}
