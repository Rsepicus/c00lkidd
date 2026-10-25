import {
  JUKE_MODIFIERS,
  type Character,
  type Rng,
  type Special,
  type SpecialKind,
} from './forsaken'
import { synergyFor, type Synergy } from './synergies'

export type Action = 'attack' | 'special' | 'juke' | 'rest'

export type JukeMod = { source: string; amount: number; turns: number }

export type DotKind = 'poison' | 'burn' | 'turret' | 'trap' | 'bleeding'

export type StatusName =
  | 'strength'
  | 'weakness'
  | 'vulnerable'
  | 'resistance'
  | 'creatures'
  | 'regeneration'
  | 'hemorrhage'
  | 'glitch'
  | 'slateskin'
  | 'haste'
  | 'stunImmune'
  | 'oblivious'

const DOT_VERB: Record<DotKind, string> = {
  poison: 'отравлен',
  burn: 'горит',
  turret: 'попал под обстрел турели',
  trap: 'подорвался на минах',
  bleeding: 'истекает кровью',
}

const DOT_SOURCE: Record<DotKind, string> = {
  poison: 'яда',
  burn: 'огня',
  turret: 'турели',
  trap: 'мин',
  bleeding: 'кровотечения',
}

export type BattleMode = '1x1' | '2x2'

export type FighterEntry = {
  userId: string
  name: string
  character: Character
  boss?: boolean
}

export type RottenCorpse = { attack: number; source: string }

export type Side = {
  id: number
  userId: string
  name: string
  character: Character
  synergy: Synergy | null
  boss: boolean
  fake: boolean
  fakeOwnerId: number | null
  copiedFrom: string | null
  team: 0 | 1
  hp: number
  maxHp: number
  healingMultiplier: number
  tempHp: number
  tempHpTurns: number
  lastActed: number
  cooldown: number
  secondCooldown: number
  damageDealt: number
  damageTaken: number
  healingDone: number
  charge: number
  shatterpoint: number
  resonance: number
  resonanceTurns: number
  muteReady: boolean
  hallucinationReady: boolean
  fateRolled: boolean
  tookHeavyHit: boolean
  oblationArmed: boolean
  oblationSpent: boolean
  bloodHuntCharges: number
  shield: number
  dodging: boolean
  evasionChance?: number
  bonusDodge?: number
  extraTurn: boolean
  nextAttackBonus: number
  juking: boolean
  jukingTurns: number
  jukeMods: JukeMod[]
  stunned: boolean
  dotDamage: number
  dotTurns: number
  dotKind: DotKind
  dotSourceId: number | null
  lifesteal: boolean
  abilityUses: number
  turns?: number
  rests?: number
  blocks?: number
  stuns?: number
  revives?: number
  minionsSummoned?: number
  structure?: 'sentry' | 'dispenser'
  blocking: boolean
  blockTargetId: number | null
  purified: boolean
  counterReady: boolean
  shieldSavesLethal: boolean
  empoweredAttack: boolean
  effects: Partial<Record<StatusName, number>>
  linkedEffects: Partial<Record<StatusName, boolean>>
  effectSources: Partial<Record<StatusName, number>>
  atropa: number
  atropaTurns: number
  sword: string | null
  swordTurns: number
  basicAttacks: number
  rottenCorpses?: RottenCorpse[]
  minion?: boolean
  pizzaMinion?: boolean
  minionOwnerId?: string | null
  minionOwnerSideId?: number | null
}

export type Battle = {
  sides: Side[]
  turn: number
  clock: number
  finished: boolean
  winner: 0 | 1 | null
}

export type TurnResult = {
  battle: Battle
  events: string[]
  notices: string[]
  finished: boolean
  winner: 0 | 1 | null
}

export const SPECIAL_COOLDOWN = 2
const REST_HEAL = 10

function makeSide(entry: FighterEntry, team: 0 | 1): Side {
  return {
    id: 0,
    userId: entry.userId,
    name: entry.name,
    character: entry.character,
    synergy: null,
    boss: entry.boss === true,
    fake: false,
    fakeOwnerId: null,
    copiedFrom: null,
    team,
    hp: entry.character.hp,
    maxHp: entry.character.hp,
    healingMultiplier: 1,
    tempHp: 0,
    tempHpTurns: 0,
    lastActed: -1,
    cooldown: 0,
    secondCooldown: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    charge: entry.character.name === 'Veeronica' ? 30 : 0,
    shatterpoint: entry.character.name === 'Jane Doe' ? 25 : 0,
    resonance: 0,
    resonanceTurns: 0,
    muteReady: entry.character.name === 'Jason',
    hallucinationReady: entry.character.name === 'Noli',
    fateRolled: false,
    tookHeavyHit: false,
    oblationArmed: false,
    oblationSpent: false,
    bloodHuntCharges: 0,
    shield: 0,
    dodging: false,
    evasionChance: 0,
    extraTurn: false,
    nextAttackBonus: 0,
    juking: false,
    jukingTurns: 0,
    jukeMods: [],
    stunned: false,
    dotDamage: 0,
    dotTurns: 0,
    dotKind: 'poison',
    dotSourceId: null,
    lifesteal: false,
    abilityUses: 0,
    blocking: false,
    blockTargetId: null,
    purified: false,
    counterReady: false,
    shieldSavesLethal: false,
    empoweredAttack: false,
    effects: {},
    linkedEffects: {},
    effectSources: {},
    atropa: 0,
    atropaTurns: 0,
    sword: null,
    swordTurns: 0,
    basicAttacks: 0,
    rottenCorpses:
      entry.character.name === '1x1x1x1' &&
      !entry.boss &&
      !entry.userId.startsWith('bot:') &&
      !entry.userId.startsWith('boss:')
        ? [{ attack: 2, source: 'fresh' }]
        : [],
    minion: false,
    pizzaMinion: false,
    minionOwnerId: null,
    minionOwnerSideId: null,
  }
}

function applyAtropa(side: Side, stacks: number, events: string[]): void {
  const before = side.atropa
  side.atropa = Math.min(6, side.atropa + stacks)
  if (side.atropaTurns === 0) side.atropaTurns = 3
  if (side.atropa > before) events.push(`${side.name}: Atropa ×${side.atropa}.`)
}

function hasStatus(side: Side, status: StatusName): boolean {
  return (side.effects[status] ?? 0) > 0
}

function synergyAlly(side: Side, battle: Battle): Side | null {
  if (!side.synergy) return null
  return (
    battle.sides.find(
      other =>
        other.id !== side.id &&
        !other.fake &&
        other.hp > 0 &&
        other.team === side.team &&
        other.synergy?.id === side.synergy?.id,
    ) ?? null
  )
}

function addSynergyDodge(side: Side, source: string, amount: number, turns: number): void {
  side.jukeMods = side.jukeMods.filter(mod => mod.source !== source)
  side.jukeMods.push({ source, amount, turns })
}

function triggerPlead(defender: Side, battle: Battle, events: string[]): void {
  if (defender.synergy?.id !== 'plead') return
  const ally = synergyAlly(defender, battle)
  if (!ally) return
  const current = ally.jukeMods.find(mod => mod.source === 'Plead')?.amount ?? 0
  addSynergyDodge(ally, 'Plead', Math.min(0.2, current + 0.1), 1)
  events.push(`Plead: ${ally.name} +10% уворота.`)
}

function hasBleeding(side: Side): boolean {
  return side.dotTurns > 0 && side.dotKind === 'bleeding'
}

function addStatus(side: Side, status: StatusName, turns = 2, source?: Side): void {
  side.effects[status] = Math.max(side.effects[status] ?? 0, turns)
  if (source) side.effectSources[status] = source.id
}

function grantExtraTurn(side: Side, events: string[]): void {
  side.extraTurn = true
  events.push(`${side.name} получает приоритет хода.`)
}

function tryStun(target: Side, events: string[], source?: Side): boolean {
  if (hasStatus(target, 'stunImmune')) {
    events.push(`${target.name} игнорирует оглушение (иммунитет).`)
    return false
  }
  target.stunned = true
  if (source) source.stuns = (source.stuns ?? 0) + 1
  return true
}

function addJukeBuff(side: Side, source: string, amount: number, turns: number, events: string[]): void {
  side.jukeMods = side.jukeMods.filter(mod => mod.source !== source && mod.amount >= 0)
  side.jukeMods.push({ source, amount, turns })
  const total = jukeBonusOf(side)
  const sign = total >= 0 ? '+' : ''
  events.push(
    `Уворот ${side.name}: +${Math.round(amount * 100)}% на ${turns} хода ` +
      `(итого ${sign}${Math.round(total * 100)}%).`,
  )
}

function addSupportStatus(
  source: Side,
  target: Side,
  status: StatusName,
  turns = 2,
): void {
  addStatus(target, status, turns, source)
  if (target === source) delete target.linkedEffects[status]
  else target.linkedEffects[status] = true
}

function canHeal(side: Side): boolean {
  return !hasStatus(side, 'hemorrhage')
}

function healSide(source: Side | null, side: Side, amount: number, cap = side.maxHp): number {
  if (!canHeal(side)) return 0
  if (source && source !== side && hasStatus(side, 'oblivious')) return 0
  if (source && source !== side && side.character.name === 'Veeronica') return 0
  const scaled = Math.floor(amount * (side.healingMultiplier ?? 1))
  const healed = Math.max(0, Math.min(scaled, cap - side.hp))
  side.hp += healed
  if (source && healed > 0) source.healingDone += healed
  return healed
}

function restoreShatterpoint(side: Side, amount: number): number {
  if (side.character.name !== 'Jane Doe') return 0
  const restored = Math.min(25 - side.shatterpoint, Math.max(0, amount))
  side.shatterpoint += restored
  return restored
}

function grantTemporaryHp(side: Side, amount: number, turns = 1): number {
  const before = side.hp
  const baseHp = side.hp - side.tempHp
  side.tempHp = Math.max(side.tempHp, amount)
  side.hp = baseHp + side.tempHp
  side.tempHpTurns = Math.max(side.tempHpTurns, turns)
  return side.hp - before
}

function loseHp(side: Side, amount: number): number {
  let remaining = Math.max(0, amount)
  const shatterLost = Math.min(side.shatterpoint, remaining)
  side.shatterpoint -= shatterLost
  remaining -= shatterLost
  const tempLost = Math.min(side.tempHp, remaining)
  side.tempHp -= tempLost
  remaining -= tempLost
  const hpLost = Math.min(side.hp, remaining)
  side.hp -= hpLost
  return shatterLost + tempLost + hpLost
}

function expireTemporaryHp(side: Side, events: string[]): void {
  if (side.tempHpTurns <= 0) return
  side.tempHpTurns -= 1
  if (side.tempHpTurns > 0) return
  const lost = Math.min(side.tempHp, side.hp)
  side.hp -= lost
  side.tempHp = 0
  if (lost > 0) events.push(`${side.name} теряет ${lost} временных HP (Plasma Beam).`)
}

function makeBattle(teams: [FighterEntry[], FighterEntry[]]): Battle {
  const sides: Side[] = []
  const slots = Math.max(teams[0].length, teams[1].length)
  for (let slot = 0; slot < slots; slot++) {
    const left = teams[0][slot]
    if (left) sides.push(makeSide(left, 0))
    const right = teams[1][slot]
    if (right) sides.push(makeSide(right, 1))
  }
  sides.forEach((side, index) => {
    side.id = index
  })

  for (const team of [0, 1] as const) {
    const members = sides.filter(side => side.team === team && !side.boss)
    if (members.length !== 2) continue
    const synergy = synergyFor(members.map(member => member.character.name))
    if (!synergy) continue
    for (const member of members) member.synergy = synergy
  }

  return {
    sides,
    turn: 0,
    clock: 0,
    finished: false,
    winner: null,
  }
}

export function createBattle(left: FighterEntry, right: FighterEntry): Battle {
  return makeBattle([[left], [right]])
}

export function createTeamBattle(left: FighterEntry[], right: FighterEntry[]): Battle {
  if (left.length === 0 || right.length === 0) throw new Error('В команде должен быть боец.')
  if (left.length > 2 || right.length > 2) {
    throw new Error('В команде не может быть больше двух бойцов.')
  }
  return makeBattle([left, right])
}

export function alliesOf(battle: Battle, side: Side): Side[] {
  return battle.sides.filter(member => member.team === side.team && member.hp > 0)
}

export function enemiesOf(battle: Battle, side: Side): Side[] {
  return battle.sides.filter(member => member.team !== side.team && member.hp > 0)
}

function supportTargetsFor(_side: Side, allies: Side[]): Side[] {
  return allies
}

function pickTarget(enemies: Side[]): Side {
  if (enemies.length === 0) throw new Error('У команды не осталось живых соперников.')
  return enemies.reduce((best, candidate) => (candidate.hp < best.hp ? candidate : best))
}

function pickBossTarget(enemies: Side[]): Side {
  const supports = enemies.filter(enemy => enemy.character.class === 'Support')
  return pickTarget(supports.length > 0 ? supports : enemies)
}

export const CRY_CHARGES = 2
export const OBLATION_FULL = 100
const OBLATION_PER_ATTACK = 25
const BLOOD_HUNT_CHARGES = 3
const BLOOD_HUNT_BONUS = 3
const BLOOD_HUNT_ROAR = 8

const BLOOD_HUNT_SPECIAL: Special = {
  name: 'Blood Hunt',
  kind: 'bloodhunt',
  power: 0,
  description: 'Рёв: 8 урона, +15% уворота на 2 хода и 3 усиленные атаки (+3 урона, лечение за удар).',
  cooldown: 0,
}

export function specialCooldown(special: Special): number {
  return special.cooldown ?? SPECIAL_COOLDOWN
}

function isBloodHuntUser(side: Side): boolean {
  return side.character.name === 'Guest 666' || side.character.special.kind === 'cry'
}

function specialSlot(side: Side, index: number): Special {
  if (index === 1 && side.boss) {
    return side.character.alternates?.[0] ?? side.character.special
  }
  return side.character.special
}

export function specialOf(side: Side, index = 0): Special {
  const base = specialSlot(side, index)
  if (isBloodHuntUser(side) && side.charge >= CRY_CHARGES) {
    return BLOOD_HUNT_SPECIAL
  }
  return base
}

export function specialReady(side: Side, index = 0): boolean {
  if (hasStatus(side, 'glitch')) return false
  const base = specialSlot(side, index)
  if (base.kind === 'revive') {
    return !side.oblationSpent && !side.oblationArmed && side.charge >= OBLATION_FULL
  }
  if (base.kind === 'pray') return side.charge > 0
  if (base.kind === 'battery') return side.charge >= 10
  if (base.kind === 'rejuvenate') return (side.rottenCorpses?.length ?? 0) > 0
  return true
}

const TARGETED_SPECIAL_KINDS: ReadonlySet<SpecialKind> = new Set([
  'heavy',
  'stun',
  'poison',
  'burn',
  'turret',
  'trap',
  'cry',
  'corrupt',
  'weakness',
  'vulnerable',
  'creatures',
  'hemorrhage',
  'glitch',
  'seeker',
  'stigmatize',
  'bleed',
  'gamble',
  'beam',
  'swords',
  'copy',
  'oneshot',
  'crystal',
])

export function specialNeedsEnemyTarget(side: Side, index = 0): boolean {
  const special = specialOf(side, index)
  // Builderman's Sentry builds a turret; the old target pick is meaningless.
  if (special.name === 'Sentry' && side.character.name === 'Builderman') return false
  return TARGETED_SPECIAL_KINDS.has(special.kind)
}

export function specialNeedsAllyTarget(side: Side, index = 0): boolean {
  return specialOf(side, index).kind === 'block'
}

export function specialLabel(side: Side, index = 0): string {
  const base = specialSlot(side, index)
  if (isBloodHuntUser(side)) {
    return side.charge >= CRY_CHARGES ? 'Blood Hunt' : `${base.name} (${side.charge}/${CRY_CHARGES})`
  }
  if (base.kind === 'revive') {
    if (side.oblationSpent) return `${base.name} (потрачена)`
    if (side.oblationArmed) return `${base.name} (готова)`
    return `${base.name} (${Math.round(side.charge)}%)`
  }
  if (base.kind === 'pray') return `${base.name} (${Math.round(side.charge)}%)`
  if (base.kind === 'battery') return `${base.name} (${Math.round(side.charge)}%)`
  if (base.kind === 'rejuvenate') {
    return `${base.name} (${side.rottenCorpses?.length ?? 0})`
  }
  return base.name
}

export function jukeBonusOf(side: Side): number {
  return side.jukeMods.reduce((sum, mod) => sum + mod.amount, 0)
}

export function purifiedReduction(side: Side): number {
  const lost = Math.max(0, side.maxHp - side.hp)
  return Math.min(80, Math.floor(lost / 20) * 20)
}

export function cooldownAfterTick(side: Side, index = 0): number {
  const tick = hasStatus(side, 'haste') ? 2 : 1
  const cooldown = index === 1 ? side.secondCooldown : side.cooldown
  return Math.max(0, cooldown - tick)
}

/**
 * Whether the special can be used on this turn. A cooldown of 1 ticks down to
 * 0 at the start of the turn, so the button stays enabled for that turn.
 */
export function canUseSpecialNow(side: Side, index = 0): boolean {
  return cooldownAfterTick(side, index) <= 0 && specialReady(side, index)
}

export const JUKE_STANCE_BONUS = 0.6

export function batteryDodgeBonusOf(side: Side): number {
  if (side.character.name !== 'Veeronica') return 0
  if (side.charge >= 50) return 0.05
  if (side.charge < 20) return -0.05
  return 0
}

function jukeChance(side: Side): number {
  const stance = side.juking ? JUKE_STANCE_BONUS : 0
  const chance =
    jukeBonusOf(side) + batteryDodgeBonusOf(side) + stance + (side.bonusDodge ?? 0)
  if (!side.juking) return Math.max(0, Math.min(0.9, chance))
  return Math.min(0.9, Math.max(0.05, chance))
}

export function jukeChanceOf(side: Side): number {
  return jukeChance(side)
}

const REVIVE_HP = 50

function maybeRevive(side: Side, events: string[]): void {
  if (side.hp === 0 && side.oblationArmed) {
    side.hp = REVIVE_HP
    side.tempHp = 0
    side.tempHpTurns = 0
    side.oblationArmed = false
    side.oblationSpent = true
    side.revives = (side.revives ?? 0) + 1
    if (side.character.name === 'Two Time') {
      side.jukeMods = side.jukeMods.filter(mod => mod.source !== 'Однажды ещё раз')
      side.jukeMods.push({ source: 'Однажды ещё раз', amount: 0.2, turns: 2 })
    }
    side.extraTurn = true
    events.push(`${side.name} перерождается: вторая жизнь, ${REVIVE_HP} HP.`)
  }
}

function dealDamage(
  attacker: Side,
  defender: Side,
  raw: number,
  events: string[],
  rng: Rng,
  battle: Battle,
): number {
  if (raw <= 0) return 0
  if (defender.fake) {
    defender.hp = 0
    defender.tempHp = 0
    events.push('Фейковый Ноли исчезает.')
    return 0
  }
  if (defender.character.name === 'Noli' && defender.hallucinationReady) {
    defender.hallucinationReady = false
    events.push(`${defender.name}: галлюцинация принимает удар.`)
    return 0
  }
  if ((defender.evasionChance ?? 0) > 0) {
    const chance = defender.evasionChance ?? 0
    defender.evasionChance = 0
    if (rng() < chance) {
      events.push(`${defender.name} уклоняется от атаки.`)
      triggerPlead(defender, battle, events)
      return 0
    }
  }
  if (defender.dodging) {
    defender.dodging = false
    events.push(`${defender.name} уклоняется от атаки.`)
    triggerPlead(defender, battle, events)
    return 0
  }
  if (defender.juking) {
    const chance = jukeChance(defender)
    defender.juking = false
    defender.jukingTurns = 0
    if (rng() < chance) {
      events.push(`${defender.name} уворачивается и уходит от атаки.`)
      triggerPlead(defender, battle, events)
      return 0
    }
  }
  let damage = raw
  if (hasStatus(attacker, 'strength')) damage = Math.ceil(damage * 1.2)
  if (hasStatus(attacker, 'weakness')) damage = Math.ceil(damage * 0.8)
  if (hasStatus(defender, 'vulnerable')) damage = Math.ceil(damage * 1.2)
  if (hasStatus(defender, 'creatures')) damage = Math.ceil(damage * 1.25)
  if (hasStatus(defender, 'resistance')) damage = Math.ceil(damage * 0.8)
  if (defender.character.name === 'Builderman') damage = Math.ceil(damage * 0.9)
  const blocker = battle.sides.find(
    candidate =>
      candidate.blocking &&
      candidate.blockTargetId === defender.id &&
      candidate.hp > 0 &&
      candidate.team !== attacker.team,
  )
  if (blocker) {
    blocker.blocking = false
    blocker.blockTargetId = null
    blocker.counterReady = true
    blocker.blocks = (blocker.blocks ?? 0) + 1
    const gained = grantTemporaryHp(blocker, 5, 2)
    events.push(`Block: ${blocker.name} +${gained} временных HP.`)
    damage = 0
    if (blocker.synergy?.id === 'fittest') {
      const ally = synergyAlly(blocker, battle)
      if (ally) {
        addSynergyDodge(blocker, 'Survival for the Fittest', 0.1, 2)
        addSynergyDodge(ally, 'Survival for the Fittest', 0.1, 2)
        events.push(
          `Survival for the Fittest: ${blocker.name} и ${ally.name} +10% уворота на 2 хода.`,
        )
      }
    }
  }
  if (damage > 0 && defender.purified) {
    const reduction = purifiedReduction(defender)
    defender.purified = false
    if (reduction > 0) {
      damage = Math.max(1, Math.ceil(damage * (1 - reduction / 100)))
      events.push(`${defender.name}: Purified снижает урон на ${reduction}%.`)
    }
  }
  if (damage > 0 && defender.shield > 0) {
    if (defender.shieldSavesLethal && damage >= defender.hp) {
      defender.hp = 1
      defender.tempHp = 0
      defender.tempHpTurns = 0
      defender.shield = 0
      defender.shieldSavesLethal = false
      events.push(`Щит ${defender.name} разбивается и спасает от смертельного удара.`)
      return 0
    }
    damage = Math.ceil(damage * (1 - defender.shield / 100))
    defender.shield = 0
    defender.shieldSavesLethal = false
    events.push(`Щит ${defender.name} снижает урон.`)
  }
  const shatterBefore = defender.shatterpoint
  const lost = loseHp(defender, damage)
  const absorbed = shatterBefore - defender.shatterpoint
  attacker.damageDealt += lost
  defender.damageTaken += lost
  events.push(`${attacker.name} наносит ${damage} урона: ${defender.name}.`)
  if (absorbed > 0) events.push(`Shatterpoint: ${defender.name} поглощает ${absorbed}.`)
  if (damage >= 15) defender.tookHeavyHit = true
  if (defender.character.name === 'John Doe' && damage > 0) {
    attacker.jukeMods = attacker.jukeMods.filter(mod => mod.source !== 'Natural Malevolence')
    attacker.jukeMods.push({ source: 'Natural Malevolence', amount: -0.1, turns: 2 })
    events.push(`${attacker.name}: −10% уворота (Natural Malevolence).`)
  }
  maybeRevive(defender, events)
  if (defender.hp === 0) {
    if (defender.minion && !defender.pizzaMinion) {
      events.push(
        defender.structure
          ? `${defender.name} уничтожен.`
          : `${defender.name} рассыпается.`,
      )
    }
    creditRottenKill(battle, attacker, defender, events)
    clearMinionsOfDeadOwners(battle, events)
  }
  return lost
}

function applyJukeModifier(side: Side, other: Side, special: Special, events: string[]): void {
  const modifier = JUKE_MODIFIERS[special.name]
  if (!modifier) return
  const target = modifier.target === 'self' ? side : other
  target.jukeMods = target.jukeMods.filter(mod => mod.source !== special.name)
  target.jukeMods.push({ source: special.name, amount: modifier.amount, turns: modifier.turns })
  const total = jukeBonusOf(target)
  const sign = modifier.amount >= 0 ? '+' : ''
  events.push(
    `Уворот ${target.name}: ${sign}${Math.round(modifier.amount * 100)}% на ${modifier.turns} хода` +
      ` (итого ${total >= 0 ? '+' : ''}${Math.round(total * 100)}%).`,
  )
}

function spawnDecoy(
  battle: Battle,
  side: Side,
  events: string[],
  cooldown: number,
): void {
  const decoy = structuredClone(side)
  decoy.id = battle.sides.length
  decoy.fake = true
  decoy.fakeOwnerId = side.id
  decoy.cooldown = cooldown
  decoy.lastActed = battle.clock
  decoy.damageDealt = 0
  decoy.damageTaken = 0
  decoy.healingDone = 0
  decoy.abilityUses = 0
  decoy.hallucinationReady = false
  battle.sides.push(decoy)
  events.push(`${side.name} создаёт фейкового Ноли.`)
}

function rottenMinionCharacter(hp: number, attack: number): Character {
  return {
    name: 'Rotten Minion',
    role: 'killer',
    class: 'Minion',
    ability: 'Поднятый труп, управляемый 1x1x1x1.',
    power: 0,
    price: 0,
    hp,
    attack,
    special: {
      name: 'Rotten Claw',
      kind: 'heavy',
      power: attack,
      cooldown: 0,
      description: 'Обычная атака; накладывает глитч на 1 ход.',
    },
  }
}

export function addRottenMinion(
  battle: Battle,
  owner: Side,
  stats: { hp: number; maxHp: number; attack: number; name?: string },
): Side {
  const character = rottenMinionCharacter(stats.maxHp, stats.attack)
  const minion = makeSide(
    {
      userId: `minion:${owner.userId}:${battle.clock}:${battle.sides.length}`,
      name: stats.name ?? 'Rotten Minion',
      character,
    },
    owner.team,
  )
  minion.id = battle.sides.length
  minion.hp = Math.max(1, Math.min(stats.maxHp, stats.hp))
  minion.maxHp = stats.maxHp
  minion.lastActed = battle.clock
  minion.minion = true
  minion.minionOwnerId = owner.userId
  minion.minionOwnerSideId = owner.id
  minion.rottenCorpses = []
  owner.minionsSummoned = (owner.minionsSummoned ?? 0) + 1
  battle.sides.push(minion)
  return minion
}

function pizzaMinionCharacter(): Character {
  return {
    name: 'Pizza Minion',
    role: 'killer',
    class: 'Minion',
    ability: 'Доставляет пиццу и исчезает после попадания.',
    power: 0,
    price: 0,
    hp: 8,
    attack: 0,
    special: {
      name: 'Pizza Delivery',
      kind: 'pizza',
      power: 7,
      cooldown: 0,
      description: 'Доставка: 7 урона в начале хода врага 2 хода и −10% уворота.',
    },
  }
}

function addPizzaMinion(battle: Battle, owner: Side): Side {
  const minion = makeSide(
    {
      userId: `minion:${owner.userId}:${battle.clock}:${battle.sides.length}:pizza`,
      name: 'Pizza Minion',
      character: pizzaMinionCharacter(),
    },
    owner.team,
  )
  minion.id = battle.sides.length
  minion.hp = 8
  minion.maxHp = 8
  minion.lastActed = battle.clock
  minion.minion = true
  minion.pizzaMinion = true
  minion.minionOwnerId = owner.userId
  minion.minionOwnerSideId = owner.id
  minion.rottenCorpses = []
  owner.minionsSummoned = (owner.minionsSummoned ?? 0) + 1
  battle.sides.push(minion)
  return minion
}

function pickPizzaTarget(enemies: Side[]): Side {
  const realEnemies = enemies.filter(enemy => !enemy.minion && !enemy.fake)
  return pickTarget(realEnemies.length > 0 ? realEnemies : enemies)
}

function structureCharacter(kind: 'sentry' | 'dispenser'): Character {
  if (kind === 'sentry') {
    return {
      name: 'Sentry',
      role: 'survivor',
      class: 'Minion',
      ability: 'Турель: 6 урона в свой ход.',
      power: 0,
      price: 0,
      hp: 25,
      attack: 6,
      special: { name: 'Sentry', kind: 'heavy', power: 6, cooldown: 0, description: '' },
    }
  }
  return {
    name: 'Dispenser',
    role: 'survivor',
    class: 'Minion',
    ability: 'Диспенсер: лечит союзников на 10 HP в свой ход.',
    power: 0,
    price: 0,
    hp: 25,
    attack: 0,
    special: { name: 'Dispenser', kind: 'dispenser', power: 10, cooldown: 0, description: '' },
  }
}

/** Builderman's Sentry/Dispenser: a killable unit that acts on its own turn. */
export function addStructure(
  battle: Battle,
  owner: Side,
  kind: 'sentry' | 'dispenser',
): Side {
  const character = structureCharacter(kind)
  const minion = makeSide(
    {
      userId: `structure:${owner.userId}:${battle.clock}:${battle.sides.length}`,
      name: kind === 'sentry' ? 'Sentry' : 'Dispenser',
      character,
    },
    owner.team,
  )
  minion.id = battle.sides.length
  minion.hp = character.hp
  minion.maxHp = character.hp
  minion.lastActed = battle.clock
  minion.minion = true
  minion.structure = kind
  minion.minionOwnerId = owner.userId
  minion.minionOwnerSideId = owner.id
  owner.minionsSummoned = (owner.minionsSummoned ?? 0) + 1
  battle.sides.push(minion)
  return minion
}

function pizzaDeliveryMisses(
  battle: Battle,
  minion: Side,
  target: Side,
  rng: Rng,
  events: string[],
): boolean {
  if (target.fake) {
    target.hp = 0
    target.tempHp = 0
    minion.hp = 0
    minion.tempHp = 0
    events.push('Фейковый Ноли исчезает.')
    events.push(`${minion.name} доставляет пиццу в пустоту и исчезает.`)
    return true
  }
  if (target.character.name === 'Noli' && target.hallucinationReady) {
    target.hallucinationReady = false
    events.push(`${target.name}: галлюцинация принимает удар.`)
    return true
  }
  if ((target.evasionChance ?? 0) > 0) {
    const chance = target.evasionChance ?? 0
    target.evasionChance = 0
    if (rng() < chance) {
      events.push(`${target.name} уворачивается от доставки пиццы.`)
      return true
    }
  }
  if (target.dodging) {
    target.dodging = false
    events.push(`${target.name} уклоняется от доставки пиццы.`)
    return true
  }
  if (target.juking) {
    const chance = jukeChance(target)
    target.juking = false
    target.jukingTurns = 0
    if (rng() < chance) {
      events.push(`${target.name} уворачивается от доставки пиццы.`)
      return true
    }
  }
  const blocker = battle.sides.find(
    candidate =>
      candidate.blocking &&
      candidate.blockTargetId === target.id &&
      candidate.hp > 0 &&
      candidate.team !== minion.team,
  )
  if (blocker) {
    blocker.blocking = false
    blocker.blockTargetId = null
    blocker.counterReady = true
    if (blocker.synergy?.id === 'fittest') {
      const ally = synergyAlly(blocker, battle)
      if (ally) {
        addSynergyDodge(blocker, 'Survival for the Fittest', 0.1, 2)
        addSynergyDodge(ally, 'Survival for the Fittest', 0.1, 2)
        events.push(
          `Survival for the Fittest: ${blocker.name} и ${ally.name} +10% уворота на 2 хода.`,
        )
      }
    }
    events.push(`${minion.name} доставляет пиццу ${target.name}, но эффект не срабатывает.`)
    return true
  }
  return false
}

function deliverPizza(minion: Side, target: Side, events: string[]): void {
  target.dotDamage = 7
  target.dotTurns = 2
  target.dotKind = 'burn'
  target.dotSourceId = minion.minionOwnerSideId ?? minion.id
  target.jukeMods = target.jukeMods.filter(mod => mod.source !== 'Pizza Delivery')
  target.jukeMods.push({ source: 'Pizza Delivery', amount: -0.1, turns: 2 })
  events.push(
    `${minion.name} доставляет пиццу ${target.name}: горение 7×2 и −10% уворота; миньон исчезает.`,
  )
  minion.hp = 0
  minion.tempHp = 0
}

function isRottenOwnerSide(side: Side): boolean {
  return (
    side.character.name === '1x1x1x1' &&
    !side.boss &&
    !side.userId.startsWith('bot:') &&
    !side.userId.startsWith('boss:')
  )
}

function creditRottenKill(
  battle: Battle,
  source: Side | null,
  target: Side,
  events: string[],
): void {
  if (
    !source ||
    source.fake ||
    source.boss ||
    target.hp > 0 ||
    target.fake ||
    target.minion ||
    target.boss
  ) {
    return
  }
  let owner: Side | undefined
  if (source.minion) {
    owner =
      battle.sides.find(
        candidate =>
          candidate.id === source.minionOwnerSideId &&
          candidate.team === source.team &&
          isRottenOwnerSide(candidate),
      ) ??
      battle.sides.find(
        candidate =>
          candidate.userId === source.minionOwnerId &&
          candidate.team === source.team &&
          isRottenOwnerSide(candidate),
      )
  } else if (isRottenOwnerSide(source)) {
    owner = source
  }
  if (!owner) return
  const corpses = owner.rottenCorpses ?? []
  corpses.push({
    attack: Math.max(1, Math.ceil(target.character.attack * 0.5)),
    source: target.character.name,
  })
  owner.rottenCorpses = corpses
  events.push(
    `Rejuvenate the Rotten: ${owner.name} получает заряд (${corpses.length}).`,
  )
}

function clearMinionsOfDeadOwners(battle: Battle, events: string[]): void {
  for (const owner of battle.sides) {
    if (owner.hp > 0 || owner.minion) continue
    const minions = battle.sides.filter(
      side =>
        side.minion &&
        side.hp > 0 &&
        (side.minionOwnerSideId === owner.id ||
          (side.minionOwnerSideId == null &&
            side.minionOwnerId === owner.userId &&
            owner.character.name === '1x1x1x1')),
    )
    if (minions.length === 0) continue
    for (const minion of minions) {
      minion.hp = 0
      minion.tempHp = 0
      minion.tempHpTurns = 0
    }
    events.push(`${owner.name}: миньоны рассыпаются.`)
  }
}

function applySpecial(
  battle: Battle,
  side: Side,
  other: Side,
  allies: Side[],
  rng: Rng,
  events: string[],
  specialIndex = 0,
  blockTarget?: Side,
): void {
  const special = specialOf(side, specialIndex)
  if (other.fake && specialNeedsEnemyTarget(side, specialIndex)) {
    other.hp = 0
    other.tempHp = 0
    events.push('Фейковый Ноли исчезает.')
    return
  }
  let applyJuke = true
  switch (special.kind) {
    case 'decoy':
      spawnDecoy(battle, side, events, specialCooldown(special))
      other.jukeMods = other.jukeMods.filter(mod => mod.source !== 'Hallucination')
      other.jukeMods.push({ source: 'Hallucination', amount: -0.1, turns: 2 })
      addJukeBuff(side, special.name, 0.1, 2, events)
      events.push(`${other.name} получает −10% уворота (Hallucination).`)
      events.push(`${side.name} применяет «${special.name}».`)
      break
    case 'rejuvenate': {
      const corpses = side.rottenCorpses ?? []
      if (corpses.length === 0) {
        events.push(`${side.name} не может призвать миньонов: нет зарядов.`)
        break
      }
      side.rottenCorpses = []
      for (const corpse of corpses) {
        const fresh = corpse.source === 'fresh'
        addRottenMinion(battle, side, {
          hp: fresh ? 20 : 40,
          maxHp: fresh ? 20 : 40,
          attack: fresh ? 2 : Math.max(1, corpse.attack),
        })
      }
      events.push(
        `${side.name} применяет «${special.name}»: поднимает миньонов — ${corpses.length}.`,
      )
      applyJuke = false
      break
    }
    case 'pizza':
      addPizzaMinion(battle, side)
      addPizzaMinion(battle, side)
      events.push(
        `${side.name} применяет «${special.name}»: призывает двух пицца-миньонов.`,
      )
      applyJuke = false
      break
    case 'copy': {
      const copied = other.character.special
      side.character = { ...side.character, special: copied }
      side.copiedFrom = other.copiedFrom ?? other.character.name
      side.charge = 0
      const gained = grantTemporaryHp(side, 12, 2)
      events.push(
        `${side.name} копирует «${copied.name}» у ${other.name}: способность готова к использованию.` +
          (gained > 0 ? ` Временные HP: +${gained}.` : ''),
      )
      break
    }
    case 'heavy': {
      events.push(`${side.name} применяет «${special.name}».`)
      const dealt = dealDamage(side, other, special.power, events, rng, battle)
      if (special.name === 'Gashing Wound' && dealt > 0 && other.hp > 0) {
        other.dotDamage = 4
        other.dotTurns = 2
        other.dotKind = 'bleeding'
        other.dotSourceId = side.id
        events.push(`${other.name} ${DOT_VERB.bleeding}.`)
      }
      break
    }
    case 'heal': {
      const targets =
        side.character.name === 'Elliot' && special.name === 'Pizza Throw' && allies.length > 1
          ? allies.filter(ally => ally !== side)
          : allies
      const heals = targets.map(ally => `${ally.name}: +${healSide(side, ally, special.power)}`)
      events.push(`${side.name} применяет «${special.name}» — ${heals.join(', ')} HP.`)
      break
    }
    case 'shield': {
      for (const ally of allies) {
        ally.shield = special.power
        ally.shieldSavesLethal = special.lethalSave === true
        if (special.name === 'Spawn Protection') {
          addStatus(ally, 'stunImmune', 2, side)
          grantTemporaryHp(ally, 5, 2)
          events.push(
            `${ally.name} получает иммунитет к стану на 2 хода и 5 временных HP.`,
          )
        }
      }
      events.push(
        `${side.name} применяет «${special.name}»: щит (${special.power}%) получают ${allies
          .map(ally => ally.name)
          .join(', ')}.`,
      )
      break
    }
    case 'stun': {
      if (special.name === 'Charge') {
        dealDamage(side, other, 3, events, rng, battle)
      } else if (special.name === 'Subspace Tripmine') {
        dealDamage(side, other, 5, events, rng, battle)
        addStatus(other, 'weakness', 2)
        events.push(`${other.name} получает Weakness на 2 хода.`)
      }
      if (tryStun(other, events, side)) {
        events.push(`${side.name} применяет «${special.name}»: ${other.name} пропустит ход.`)
      } else {
        events.push(`${side.name} применяет «${special.name}».`)
      }
      break
    }
    case 'poison':
    case 'burn':
    case 'turret':
    case 'trap':
      if (special.name === 'Sentry') {
        addStructure(battle, side, 'sentry')
        events.push(
          `${side.name} ставит турель: 25 HP, 6 урона в свой ход.`,
        )
        applyJuke = false
        break
      }
      if (special.name === 'Mass Infection') {
        events.push(`${side.name} применяет «${special.name}».`)
        dealDamage(side, other, 4, events, rng, battle)
      }
      other.dotDamage = special.power
      other.dotTurns = 2
      other.dotKind = special.kind
      other.dotSourceId = side.id
      events.push(`${side.name} применяет «${special.name}»: ${other.name} ${DOT_VERB[special.kind]}.`)
      break
    case 'speed':
      addJukeBuff(side, special.name, 0.25, 2, events)
      addStatus(side, 'strength', 2)
      grantExtraTurn(side, events)
      events.push(`${side.name} применяет «${special.name}».`)
      if (side.synergy?.id === 'dead-ringer') {
        const ally = synergyAlly(side, battle)
        if (ally) {
          addSynergyDodge(ally, 'Dead Ringer', 0.1, 2)
          events.push(`Dead Ringer: ${ally.name} +10% уворота на 2 хода.`)
        }
      }
      applyJuke = false
      break
    case 'rush':
      for (const ally of allies) {
        addJukeBuff(ally, special.name, 0.2, 2, events)
        addStatus(ally, 'strength', 2)
        grantExtraTurn(ally, events)
      }
      events.push(
        `${side.name} применяет «${special.name}»: ` +
          `${allies.length > 1 ? 'оба союзника получают' : 'скорость'} +20% уворота и приоритет хода.`,
      )
      applyJuke = false
      break
    case 'sk8': {
      if (side.charge >= 100) {
        side.charge = 50
        addJukeBuff(side, special.name, 0.35, 2, events)
        events.push(
          `${side.name} применяет «${special.name}»: Overcharge! +35% уворота, батарея разряжена до 50%.`,
        )
      } else {
        const spent = Math.min(15, side.charge)
        side.charge -= spent
        addJukeBuff(side, special.name, 0.25, 2, events)
        events.push(
          `${side.name} применяет «${special.name}»: +25% уворота, −${spent}% батареи (${side.charge}%).`,
        )
      }
      grantExtraTurn(side, events)
      applyJuke = false
      break
    }
    case 'battery': {
      const overcharge = side.charge >= 100
      const spent = overcharge ? 50 : Math.min(40, side.charge)
      const healed = healSide(
        side,
        side,
        overcharge ? 20 : Math.min(15, Math.floor(spent / 2)),
      )
      side.charge -= spent
      events.push(
        `${side.name} применяет «${special.name}»${overcharge ? ': Overcharge!' : ''}: ` +
          `−${spent}% батареи, +${healed} HP (${side.charge}%).`,
      )
      applyJuke = false
      break
    }
    case 'crystal': {
      const dealt = dealDamage(side, other, special.power, events, rng, battle)
      if (dealt > 0 && other.hp > 0) {
        other.resonance = Math.min(3, other.resonance + 2)
        other.resonanceTurns = 2
        const restored = restoreShatterpoint(side, 4)
        events.push(
          `Resonance: ${other.name} ×${other.resonance}.` +
            (restored > 0 ? ` Shatterpoint +${restored}.` : ''),
        )
      }
      break
    }
    case 'purified': {
      for (const ally of allies) {
        ally.purified = true
        addSupportStatus(side, ally, 'resistance', 1)
        healSide(side, ally, 8)
      }
      events.push(
        `${side.name} применяет «${special.name}»: ${allies.map(ally => ally.name).join(', ')} — ` +
          'одноразовое сопротивление (20% за каждые 20 потерянных HP, до 80%), ' +
          '+8 HP и Resistance на 1 ход.',
      )
      applyJuke = false
      break
    }
    case 'revive':
      side.oblationArmed = true
      side.charge = 0
      events.push(`${side.name} готовит вторую жизнь.`)
      break
    case 'pray': {
      const amount = Math.min(special.power, Math.floor(side.charge / 2))
      const healed = healSide(side, side, amount)
      const result =
        healed > 0 ? `+${healed}` : side.hp >= side.maxHp ? 'full HP' : 'Hemorrhage'
      side.charge = 0
      events.push(`${side.name} молится и восстанавливает HP — ${side.name}: ${result}.`)
      break
    }
    case 'corrupt':
      events.push(`${side.name} применяет «${special.name}».`)
      dealDamage(side, other, 10, events, rng, battle)
      if (other.hp > 0) {
        addStatus(other, 'weakness', 2)
        events.push(`${other.name} получает Weakness на 2 хода.`)
      }
      other.jukeMods = other.jukeMods.filter(mod => mod.source !== special.name)
      other.jukeMods.push({ source: special.name, amount: -0.25, turns: 2 })
      events.push(
        `${side.name} применяет «${special.name}»: уворот ${other.name} снижен на 25%.`,
      )
      break
    case 'beam': {
      for (const ally of allies) {
        ally.jukeMods = ally.jukeMods.filter(mod => mod.source !== special.name)
        ally.jukeMods.push({ source: special.name, amount: 0.15, turns: 2 })
        grantTemporaryHp(ally, 10, 1)
      }
      other.jukeMods = other.jukeMods.filter(mod => mod.source !== special.name)
      other.jukeMods.push({ source: special.name, amount: -0.15, turns: 2 })
      events.push(
        `${side.name} направляет плазменный луч: ${other.name} замедлен; +15% уворота ` +
          `и +10 временных HP получают ${allies.map(ally => ally.name).join(', ')}.`,
      )
      break
    }
    case 'bloodhunt':
      side.bloodHuntCharges = BLOOD_HUNT_CHARGES
      events.push(
        `${side.name} активирует Blood Hunt: ${BLOOD_HUNT_CHARGES} атаки усилены и лечат.`,
      )
      dealDamage(side, other, BLOOD_HUNT_ROAR, events, rng, battle)
      break
    case 'cry': {
      events.push(`${side.name} издаёт «${special.name}».`)
      if (special.power > 0) dealDamage(side, other, special.power, events, rng, battle)
      if (special.name === 'Infernal Cry' && other.hp > 0) {
        addStatus(other, 'weakness', 2)
        addStatus(side, 'strength', 2)
        events.push(`${other.name} получает Weakness на 2 хода.`)
      }
      break
    }
    case 'dodge':
      if (special.name === 'Ascension') {
        side.dodging = true
        events.push(
          `${side.name} применяет «${special.name}»: следующий удар врага промахнётся.`,
        )
        applyJuke = false
      } else {
        side.dodging = true
        events.push(`${side.name} применяет «${special.name}»: следующая атака промахнётся.`)
      }
      break
    case 'lifesteal':
      side.lifesteal = true
      events.push(`${side.name} применяет «${special.name}»: следующая атака вылечит.`)
      break
    case 'block':
      side.blocking = true
      side.blockTargetId = (blockTarget ?? side).id
      events.push(`${side.name} проводит обычную атаку.`)
      break
    case 'empower':
      side.empoweredAttack = true
      events.push(`${side.name} меняет меч SFOTH: следующая атака усилена.`)
      break
    case 'strength':
      addStatus(side, 'strength')
      if (special.name === 'Raging Pace') {
        addStatus(side, 'stunImmune', 2)
        grantExtraTurn(side, events)
        events.push(`${side.name} получает иммунитет к стану на 2 хода.`)
      }
      events.push(`${side.name} применяет «${special.name}»: урон повышен на 20% на 2 хода.`)
      break
    case 'weakness':
      if (special.power > 0) {
        events.push(`${side.name} применяет «${special.name}».`)
        dealDamage(side, other, special.power, events, rng, battle)
      }
      addStatus(other, 'weakness', special.name === 'Digital Footprint' ? 3 : 2)
      if (special.name === 'Digital Footprint' && other.hp > 0) {
        other.dotDamage = 2
        other.dotTurns = 2
        other.dotKind = 'poison'
        other.dotSourceId = side.id
        events.push(`${other.name} ${DOT_VERB.poison}.`)
      }
      events.push(`${side.name} применяет «${special.name}»: урон ${other.name} снижен на 20%.`)
      break
    case 'vulnerable':
      if (special.power > 0) {
        events.push(`${side.name} применяет «${special.name}».`)
        dealDamage(side, other, special.power, events, rng, battle)
      }
      addStatus(other, 'vulnerable')
      events.push(`${side.name} применяет «${special.name}»: ${other.name} получает +20% урона.`)
      break
    case 'resistance':
      for (const ally of allies) addSupportStatus(side, ally, 'resistance')
      events.push(
        `${side.name} применяет «${special.name}»: ${
          allies.length > 1
            ? 'получаемый урон обоих союзников снижен на 20%'
            : 'получаемый урон снижен на 20%'
        }.`,
      )
      break
    case 'creatures':
      if (special.name === "Hunter's Feast") {
        events.push(`${side.name} применяет «${special.name}».`)
        dealDamage(side, other, 8, events, rng, battle)
        if (other.hp > 0) {
          addStatus(other, 'oblivious', 2)
          addJukeBuff(side, special.name, 0.15, 2, events)
          events.push(`${other.name} получает Oblivious на 2 хода.`)
        }
      }
      addStatus(other, 'creatures')
      events.push(`${side.name} применяет «${special.name}»: ${other.name} получает +25% урона.`)
      break
    case 'regeneration':
      for (const ally of allies) addSupportStatus(side, ally, 'regeneration')
      events.push(
        `${side.name} применяет «${special.name}»: ${
          allies.length > 1 ? 'оба союзника получают' : ''
        } регенерацию 8 HP на два хода.`,
      )
      break
    case 'hemorrhage':
      if (special.name === 'Eviscerate') {
        events.push(`${side.name} применяет «${special.name}».`)
        dealDamage(side, other, 10, events, rng, battle)
      }
      addStatus(other, 'hemorrhage')
      events.push(`${side.name} применяет «${special.name}»: ${other.name} не может лечиться.`)
      break
    case 'glitch':
      addStatus(other, 'glitch')
      events.push(`${side.name} применяет «${special.name}»: способность ${other.name} заблокирована.`)
      break
    case 'slateskin': {
      addStatus(side, 'slateskin')
      side.dotTurns = 0
      const gained = healSide(side, side, 22, side.maxHp + 22)
      events.push(
        `${side.name} применяет «${special.name}»: +${gained} HP сверх максимума ` +
          'и иммунитет к DoT.',
      )
      break
    }
    case 'haste': {
      const turns = special.name === 'Inspiration' ? 2 : 2
      for (const ally of allies) {
        addSupportStatus(side, ally, 'haste', turns)
        if (special.name === 'Inspiration') {
          addSupportStatus(side, ally, 'regeneration', 1)
          addSupportStatus(side, ally, 'resistance', 1)
          ally.shield = Math.max(ally.shield, 20)
        }
      }
      events.push(
        `${side.name} применяет «${special.name}»: ${
          allies.length > 1 ? 'обоим союзникам' : ''
        } перезарядка ускорена на ${turns} хода, Regeneration и Resistance на 1 ход, щит 20%.`,
      )
      break
    }
    case 'dispenser':
      if (side.structure === 'dispenser') {
        const targets = allies.filter(ally => !ally.minion)
        const heals = targets.map(
          ally => `${ally.name}: +${healSide(side, ally, special.power)}`,
        )
        events.push(`${side.name} раздаёт лечение — ${heals.join(', ')} HP.`)
        applyJuke = false
        break
      }
      addStructure(battle, side, 'dispenser')
      events.push(`${side.name} ставит диспенсер: 25 HP, 10 лечения в свой ход.`)
      applyJuke = false
      break
    case 'pulse':
      for (const ally of allies) {
        addSupportStatus(side, ally, 'regeneration', 1)
        addSupportStatus(side, ally, 'resistance', 1)
        ally.shield = Math.max(ally.shield, 20)
      }
      events.push(
        `${side.name} применяет «${special.name}»: ${
          allies.length > 1 ? 'обоим союзникам' : ''
        } Regeneration и Resistance на 1 ход, щит 20%.`,
      )
      break
    case 'swords': {
      const swords = [
        'SFOTH',
        'Firebrand',
        'Venomshank',
        'Ice Dagger',
        'Darkheart',
        'Illumina',
        'Ghostwalker',
        'Windforce',
      ]
      const sword = swords[Math.floor(rng() * swords.length) % swords.length]
      side.sword = sword
      side.swordTurns = 2
      let effect = ''
      switch (sword) {
        case 'SFOTH':
          addStatus(side, 'strength')
          effect = '+20% урона на 2 хода'
          break
        case 'Firebrand':
          other.dotDamage = 7
          other.dotTurns = 2
          other.dotKind = 'burn'
          other.dotSourceId = side.id
          effect = `${other.name} горит`
          break
        case 'Venomshank':
          other.dotDamage = 7
          other.dotTurns = 2
          other.dotKind = 'poison'
          other.dotSourceId = side.id
          effect = `${other.name} отравлен`
          break
        case 'Ice Dagger':
          if (tryStun(other, events, side)) effect = `${other.name} заморожен и пропустит ход`
          else effect = `${other.name} игнорирует заморозку`
          break
        case 'Darkheart':
          side.lifesteal = true
          effect = 'следующая атака лечит'
          break
        case 'Illumina':
          addStatus(side, 'regeneration', 2, side)
          effect = 'Regeneration на 2 хода'
          break
        case 'Ghostwalker':
          side.dodging = true
          side.jukeMods = side.jukeMods.filter(mod => mod.source !== 'Ghostwalker')
          side.jukeMods.push({ source: 'Ghostwalker', amount: 0.15, turns: 2 })
          effect = 'невидимость: следующая атака промахнётся'
          break
        case 'Windforce':
          addStatus(other, 'weakness')
          effect = `${other.name} сбит с ног: −20% урона`
          break
      }
      side.empoweredAttack = true
      addStatus(side, 'strength', 2)
      events.push(`${side.name} переключается на «${sword}»: ${effect}.`)
      events.push(`${side.name}: следующая атака усилена, +20% урона на 2 хода.`)
      break
    }
    case 'seeker':
      events.push(`${side.name} применяет «${special.name}».`)
      dealDamage(side, other, special.damage ?? 4, events, rng, battle)
      if (other.hp > 0) {
        applyAtropa(other, special.power, events)
        other.dotDamage = 3
        other.dotTurns = 2
        other.dotKind = 'bleeding'
        other.dotSourceId = side.id
        events.push(`${other.name} ${DOT_VERB.bleeding}.`)
      }
      break
    case 'stigmatize': {
      const stunned = tryStun(other, events, side)
      applyAtropa(other, special.power, events)
      events.push(
        `${side.name} применяет «${special.name}»: ${
          stunned ? `${other.name} обездвижен.` : `${other.name} сопротивляется.`
        }`,
      )
      break
    }
    case 'bleed':
      events.push(`${side.name} применяет «${special.name}».`)
      if (special.name === 'Tripwire') {
        dealDamage(side, other, 4, events, rng, battle)
      }
      other.dotDamage = special.power
      other.dotTurns = 2
      other.dotKind = 'bleeding'
      other.dotSourceId = side.id
      events.push(`${side.name} применяет «${special.name}»: ${other.name} ${DOT_VERB.bleeding}.`)
      break
    case 'oneshot':
      if (rng() < 0.5) {
        events.push(`${side.name} стреляет из «${special.name}».`)
        const dealt = dealDamage(side, other, special.power, events, rng, battle)
        if (dealt > 0 && other.hp > 0) {
          addStatus(other, 'vulnerable')
          events.push(`${other.name} получает Vulnerable на 2 хода.`)
        }
      } else {
        addStatus(side, 'weakness')
        events.push(`${side.name} промахивается и получает Weakness на 2 хода.`)
      }
      break
    case 'gamble':
      if (rng() < 0.5) {
        events.push(`${side.name} играет в «${special.name}» и выигрывает!`)
        dealDamage(side, other, side.character.attack * 2, events, rng, battle)
        addJukeBuff(side, special.name, 0.2, 2, events)
      } else {
        dealDamage(side, other, Math.ceil(side.character.attack * 0.75), events, rng, battle)
        addStatus(side, 'weakness', 2)
        events.push(
          `${side.name} играет в «${special.name}», но монетка не в его пользу: Weakness на 2 хода.`,
        )
      }
      applyJuke = false
      break
  }
  if (isBloodHuntUser(side)) {
    if (special.name === 'Blood Hunt') {
      side.charge = 0
    } else {
      side.charge = Math.min(CRY_CHARGES, side.charge + 1)
      events.push(`Blood: ${side.charge}/${CRY_CHARGES}.`)
      if (side.charge >= CRY_CHARGES) events.push('Blood Hunt готов!')
    }
  }
  if (applyJuke) applyJukeModifier(side, other, special, events)
}

function finishIfTeamWiped(battle: Battle): boolean {
  const aliveTeams = new Set(
    battle.sides.filter(side => side.hp > 0 && !side.fake).map(side => side.team),
  )
  if (aliveTeams.size > 1) return false
  battle.finished = true
  battle.winner = aliveTeams.size === 1 ? ([...aliveTeams][0] as 0 | 1) : null
  return true
}

function passTurn(battle: Battle): void {
  const current = battle.sides[battle.turn]
  const currentTeam = current.team
  const enemyTeam = (1 - currentTeam) as 0 | 1
  battle.clock += 1
  current.lastActed = battle.clock

  // Pick the living enemy who has waited the longest, so nobody in a 2v1 is skipped.
  let nextIndex = -1
  let leastRecent = Number.POSITIVE_INFINITY
  for (let step = 1; step <= battle.sides.length; step++) {
    const index = (battle.turn + step) % battle.sides.length
    const candidate = battle.sides[index]
    if (candidate.fake || candidate.team !== enemyTeam || candidate.hp <= 0) continue
    if (candidate.lastActed < leastRecent) {
      leastRecent = candidate.lastActed
      nextIndex = index
    }
  }

  if (nextIndex === -1) {
    battle.finished = true
    battle.winner = currentTeam
    return
  }
  battle.turn = nextIndex
}

function clearLinkedEffectsForDead(battle: Battle): void {
  for (const dead of battle.sides) {
    if (dead.hp > 0 || dead.fake) continue
    for (const ally of battle.sides) {
      if (ally.team !== dead.team || ally === dead) continue
      for (const status of Object.keys(ally.linkedEffects) as StatusName[]) {
        delete ally.effects[status]
        delete ally.linkedEffects[status]
        delete ally.effectSources[status]
      }
    }
    dead.linkedEffects = {}
  }
}

function advanceTurn(battle: Battle, events: string[]): void {
  passTurn(battle)
  let guard = 0
  while (!battle.finished && guard++ < battle.sides.length * 2) {
    const next = battle.sides[battle.turn]
    if (!next.stunned) return
    next.stunned = false
    next.extraTurn = false
    events.push(`${next.name} пропускает ход.`)
    passTurn(battle)
  }
}

export function takeTurn(
  input: Battle,
  action: Action,
  rng: Rng,
  targetIndex?: number,
  specialIndex = 0,
): TurnResult {
  if (input.finished) throw new Error('Бой уже окончен.')
  const battle = structuredClone(input)
  const index = battle.turn
  const side = battle.sides[index]
  if (!side || side.hp <= 0) throw new Error('Сейчас некому ходить.')
  // A queued priority turn is consumed by starting this turn; only a speed
  // ability used during the turn can queue another one.
  side.extraTurn = false
  side.turns = (side.turns ?? 0) + 1
  const initialHp = battle.sides.map(candidate => candidate.hp)

  const events: string[] = []
  const notices: string[] = []
  const result = (): TurnResult => ({
    battle,
    events,
    notices,
    finished: battle.finished,
    winner: battle.winner,
  })

  if (side.fake) throw new Error('Фейковый Ноли не ходит.')

  if (side.blocking) {
    side.blocking = false
    side.blockTargetId = null
    side.jukeMods = side.jukeMods.filter(mod => mod.source !== 'Блок')
    side.jukeMods.push({ source: 'Блок', amount: -0.3, turns: 2 })
    events.push(
      `Блок не сработал: ${side.name} (${side.character.name}) не поймал атаку. ` +
        'Штраф — −30% к увороту.',
    )
  }
  if (side.juking) {
    side.jukingTurns -= 1
    if (side.jukingTurns <= 0) {
      side.juking = false
      events.push(`${side.name}: стойка уворота спала — враг не атаковал.`)
    }
  }
  if (side.shield > 0) {
    side.shield = 0
    side.shieldSavesLethal = false
  }
  expireTemporaryHp(side, events)
  if (side.hp === 0) clearMinionsOfDeadOwners(battle, events)

  if (side.stunned) {
    side.stunned = false
    side.extraTurn = false
    events.push(`${side.name} пропускает ход.`)
    advanceTurn(battle, events)
    return result()
  }

  const fakes = battle.sides.filter(
    candidate => candidate.fake && candidate.fakeOwnerId === side.id && candidate.hp > 0,
  )
  for (const fake of fakes) {
    const enemies = enemiesOf(battle, side)
    if (enemies.length === 0) {
      battle.finished = true
      battle.winner = (1 - side.team) as 0 | 1
      return result()
    }
    const target = pickTarget(enemies)
    const fakeDamage = side.character.special.name === 'Observant' ? 2 : 1
    if (target.fake) {
      target.hp = 0
      target.tempHp = 0
      events.push('Фейковый Ноли исчезает.')
    } else {
      const lost = loseHp(target, fakeDamage)
      target.damageTaken += lost
      fake.damageDealt += lost
    }
    events.push(`${side.name} (фейковый Ноли) наносит ${fakeDamage} урона: ${target.name}.`)
    maybeRevive(target, events)
    if (target.hp === 0) clearMinionsOfDeadOwners(battle, events)
  }
  if (fakes.length > 0) {
    clearLinkedEffectsForDead(battle)
    if (finishIfTeamWiped(battle)) return result()
  }

  if (side.character.name === 'Veeronica') {
    side.charge = Math.min(100, side.charge + 15)
  }
  if (side.character.name === 'Chance' && !side.fateRolled) {
    side.fateRolled = true
    if (rng() < 0.5) {
      side.jukeMods.push({ source: 'Unpredictable Fate', amount: 0.1, turns: 2 })
      events.push('Unpredictable Fate: +10% уворота.')
    } else {
      side.shield = Math.max(side.shield, 10)
      events.push('Unpredictable Fate: 10 щита.')
    }
  }
  if (side.character.name === 'Elliot') {
    for (const ally of alliesOf(battle, side)) {
      if (!ally.tookHeavyHit) continue
      ally.tookHeavyHit = false
      const healed = healSide(side, ally, 4)
      if (healed > 0) events.push(`First Aid: ${ally.name} +${healed} HP.`)
    }
  }
  if (side.character.name === 'Helperbot') {
    const wounded = [...alliesOf(battle, side)].sort((left, right) => left.hp - right.hp)[0]
    if (wounded) {
      const healed = healSide(side, wounded, 2)
      if (healed > 0) events.push(`Support Protocol: ${wounded.name} +${healed} HP.`)
    }
  }
  if (side.character.name === 'Dusekkar') {
    const index = side.jukeMods.findIndex(mod => mod.amount < 0)
    if (index >= 0) {
      const [removed] = side.jukeMods.splice(index, 1)
      events.push(`Levitation: ${side.name} сбрасывает ${removed.source}.`)
    }
  }
  if (side.resonanceTurns > 0) {
    side.resonanceTurns -= 1
    if (side.resonanceTurns === 0) {
      side.resonance = 0
      events.push(`Resonance: ${side.name} сбрасывает стаки.`)
    }
  }

  if (hasStatus(side, 'regeneration')) {
    const sourceId = side.effectSources.regeneration
    const source = sourceId !== undefined ? (battle.sides[sourceId] ?? null) : null
    const amount = source?.character.name === 'Builderman' ? 10 : 8
    const healed = healSide(source && source.hp > 0 ? source : null, side, amount)
    if (healed > 0) {
      events.push(`${side.name} восстанавливает ${healed} HP (Regeneration).`)
    }
  }
  if (hasStatus(side, 'slateskin')) side.dotTurns = 0
  const hastedThisTurn = hasStatus(side, 'haste')
  for (const status of Object.keys(side.effects) as StatusName[]) {
    if (side.linkedEffects[status]) continue
    const turns = side.effects[status] ?? 0
    if (turns <= 1) {
      if (status === 'hemorrhage') events.push(`${side.name}: Hemorrhage спадает.`)
      delete side.effects[status]
      delete side.effectSources[status]
      for (const ally of battle.sides) {
        if (ally.team !== side.team || ally === side || !ally.linkedEffects[status]) continue
        delete ally.effects[status]
        delete ally.linkedEffects[status]
        delete ally.effectSources[status]
      }
    } else {
      side.effects[status] = turns - 1
      for (const ally of battle.sides) {
        if (ally.team !== side.team || ally === side || !ally.linkedEffects[status]) continue
        ally.effects[status] = side.effects[status]
      }
    }
  }
  if (side.atropaTurns > 0) {
    side.atropaTurns -= 1
    if (side.atropaTurns === 0) side.atropa = 0
  }
  if (side.swordTurns > 0) {
    side.swordTurns -= 1
    if (side.swordTurns === 0) side.sword = null
  }

  if (side.dotTurns > 0) {
    const lost = loseHp(side, side.dotDamage)
    const source =
      side.dotSourceId !== null ? (battle.sides[side.dotSourceId] ?? null) : null
    if (source) source.damageDealt += lost
    side.damageTaken += lost
    side.dotTurns -= 1
    events.push(`${side.name} теряет ${side.dotDamage} HP от ${DOT_SOURCE[side.dotKind]}.`)
    maybeRevive(side, events)
    if (side.hp === 0) {
      creditRottenKill(battle, source, side, events)
      clearMinionsOfDeadOwners(battle, events)
    }
    if (side.hp === 0) {
      clearLinkedEffectsForDead(battle)
      if (!finishIfTeamWiped(battle)) advanceTurn(battle, events)
      return result()
    }
  }

  const cooldownTick = hastedThisTurn ? 2 : 1
  if (side.cooldown > 0) {
    side.cooldown = Math.max(0, side.cooldown - cooldownTick)
  }
  if (side.secondCooldown > 0) {
    side.secondCooldown = Math.max(0, side.secondCooldown - cooldownTick)
  }
  if (side.jukeMods.length > 0) {
    side.jukeMods = side.jukeMods
      .map(mod => ({ ...mod, turns: mod.turns - 1 }))
      .filter(mod => mod.turns > 0)
  }

  if (finishIfTeamWiped(battle)) return result()
  const enemies = enemiesOf(battle, side)
  if (enemies.length === 0) {
    battle.finished = true
    battle.winner = (1 - side.team) as 0 | 1
    return result()
  }
  const blockAction =
    action === 'special' && specialOf(side, specialIndex).kind === 'block'
  let blockTarget: Side | undefined = blockAction ? side : undefined
  let target = side.pizzaMinion
    ? pickPizzaTarget(enemies)
    : side.boss
      ? pickBossTarget(enemies)
      : pickTarget(enemies)
  if (targetIndex !== undefined) {
    const candidate = Number.isInteger(targetIndex) ? battle.sides[targetIndex] : undefined
    const wasAlive = (initialHp[targetIndex] ?? 0) > 0
    if (blockAction) {
      if (!candidate || candidate.team !== side.team) {
        throw new Error('Эту цель нельзя защитить.')
      }
      if (candidate.hp <= 0 && !wasAlive) {
        throw new Error('Эту цель нельзя защитить.')
      }
      // Start-of-turn effects can kill the chosen ally; fall back to self.
      if (candidate.hp > 0) blockTarget = candidate
    } else {
      if (!candidate || candidate.team === side.team) {
        throw new Error('Эту цель нельзя атаковать.')
      }
      if (candidate.hp <= 0 && !wasAlive) {
        throw new Error('Эту цель нельзя атаковать.')
      }
      // Fake Noli and other start-of-turn effects can remove the chosen target.
      if (candidate.hp > 0) target = candidate
    }
  }
  const allies = alliesOf(battle, side)

  switch (action) {
    case 'attack': {
      if (side.pizzaMinion) {
        if (!pizzaDeliveryMisses(battle, side, target, rng, events)) {
          deliverPizza(side, target, events)
        }
        break
      }
      side.basicAttacks += 1
      const boosted = side.bloodHuntCharges > 0
      let raw = side.character.attack + Math.floor(rng() * 5) + (boosted ? BLOOD_HUNT_BONUS : 0)
      let hatchetStacks = 0
      if (side.empoweredAttack) {
        side.empoweredAttack = false
        raw = Math.ceil(raw * 1.5)
        events.push(`${side.name} бьёт усиленным мечом SFOTH.`)
      }
      if (side.counterReady) {
        side.counterReady = false
        raw = Math.ceil(raw * 1.5)
        events.push(`${side.name} наносит усиленный контрудар.`)
      }
      const atropaBonus = side.character.name === 'Azure' ? target.atropa : 0
      if (atropaBonus > 0) raw += atropaBonus
      if (side.character.name === 'Guest 666' && (hasBleeding(target) || hasStatus(target, 'hemorrhage'))) {
        raw += 3
        events.push('Bloodthirst: +3 урона.')
      }
      if (
        side.character.name === '007n7' &&
        (target.cooldown > 0 || target.secondCooldown > 0)
      ) {
        raw += 3
        events.push('Exploit: +3 урона.')
      }
      if (side.character.name === 'Jane Doe' && target.resonance > 0) {
        hatchetStacks = target.resonance
        raw += hatchetStacks * 4
      }
      if (side.character.name === 'c00lkidd' && side.basicAttacks % 3 === 0) {
        raw += 4
        events.push('c00lkidd: третья атака +4 урона.')
      }
      if (side.character.name === 'Shedletsky' && side.sword) {
        raw += 2
        events.push('Swordmaster: +2 урона мечом.')
      }
      if (side.synergy?.id === 'hatred') {
        const ally = synergyAlly(side, battle)
        const swordActive = ally
          ? side.character.name === 'Shedletsky'
            ? Boolean(side.sword)
            : Boolean(ally.sword)
          : false
        if (swordActive) {
          raw += 2
          events.push('Creation of Hatred: +2 урона.')
        }
      }
      if (side.character.name === 'Jason' && side.muteReady) {
        side.muteReady = false
        target.dodging = false
        target.evasionChance = 0
        target.juking = false
        events.push(`Mute: первая атака ${side.name} не уворотована.`)
      }
      if (side.nextAttackBonus > 0) {
        const bonus = side.nextAttackBonus
        side.nextAttackBonus = 0
        raw += bonus
        events.push(`${side.name}: +${bonus} урона (dive).`)
      }
      const dealt = dealDamage(side, target, raw, events, rng, battle)
      // Rotten minions glitch on a basic hit; turrets and pizza minions do not.
      const rottenMinion = side.minion && !side.pizzaMinion && !side.structure
      if (dealt > 0 && target.hp > 0 && rottenMinion) {
        // Two ticks: the status is decremented at the start of the target's turn,
        // leaving one active tick to block their next ability.
        addStatus(target, 'glitch', 2, side)
        events.push(`${target.name} получает Glitch на 1 ход.`)
      }
      if (dealt > 0 && side.synergy?.id === 'you-and-i') {
        const ally = synergyAlly(side, battle)
        if (ally) {
          const healed = healSide(side, ally, 2)
          if (healed > 0) events.push(`You and I: ${ally.name} +${healed} HP.`)
        }
      }
      if (dealt > 0 && hatchetStacks > 0) {
        target.resonance = 0
        target.resonanceTurns = 0
        if (hatchetStacks >= 3) tryStun(target, events, side)
        restoreShatterpoint(side, 8)
        events.push(`Hatchet: ${hatchetStacks} Resonance, +${hatchetStacks * 4} урона.`)
      }
      if (atropaBonus > 0 && dealt > 0) {
        target.atropa = 0
        target.atropaTurns = 0
        events.push(`Atropa: Azure наносит +${atropaBonus} урона.`)
        const healed = healSide(side, side, Math.floor(atropaBonus / 2))
        if (healed > 0) events.push(`Atropic: Azure восстанавливает ${healed} HP.`)
        if (side.synergy?.id === 'seraphim') {
          const ally = synergyAlly(side, battle)
          if (ally && !ally.oblationSpent && !ally.oblationArmed) {
            const before = ally.charge
            ally.charge = Math.min(OBLATION_FULL, ally.charge + 10)
            if (ally.charge > before) {
              events.push(`And the Seraphim Wept: Oblation ${ally.charge}%.`)
            }
          }
        }
      }
      if (
        dealt > 0 &&
        side.character.name === '1x1x1x1' &&
        target.hp > 0 &&
        (target.dotTurns === 0 || target.dotDamage < 2)
      ) {
        target.dotDamage = 2
        target.dotTurns = 1
        target.dotKind = 'poison'
        target.dotSourceId = side.id
        events.push(`Unstable Toxin: ${target.name} отравлен.`)
      }
      if (dealt > 0 && side.character.name === 'Nosferatu') {
        const healed = healSide(side, side, Math.ceil(dealt * 0.2))
        if (healed > 0) events.push(`Vampirism: +${healed} HP.`)
      }
      if (dealt > 0 && side.character.name === 'Taph') {
        target.jukeMods = target.jukeMods.filter(mod => mod.source !== 'Tripwire')
        target.jukeMods.push({ source: 'Tripwire', amount: -0.1, turns: 2 })
        events.push(`Tripwire: ${target.name} −10% уворота.`)
      }
      if (
        (side.character.special.kind === 'revive' || side.character.special.kind === 'pray') &&
        dealt > 0 &&
        !side.oblationSpent
      ) {
        side.charge = Math.min(OBLATION_FULL, side.charge + OBLATION_PER_ATTACK)
        events.push(`Oblation: ${side.charge}%.`)
      }
      if (boosted && dealt > 0) {
        side.bloodHuntCharges -= 1
        const healed = healSide(side, side, Math.ceil(dealt / 2))
        events.push(
          `Blood Hunt: ${side.name} восстанавливает ${healed} HP (осталось атак: ${side.bloodHuntCharges}).`,
        )
      }
      if (side.lifesteal && dealt > 0) {
        side.lifesteal = false
        const healed = healSide(side, side, Math.ceil(dealt / 2))
        events.push(`${side.name} восстанавливает ${healed} HP.`)
      }
      break
    }
    case 'special':
      if (specialIndex === 1 && !side.boss) throw new Error('У этого бойца нет второй способности.')
      if ((specialIndex === 1 ? side.secondCooldown : side.cooldown) > 0) {
        throw new Error('Способность ещё не готова.')
      }
      if (!specialReady(side, specialIndex)) throw new Error('Oblation ещё не накоплен.')
      {
        const usedSpecial = specialOf(side, specialIndex)
        applySpecial(
          battle,
          side,
          target,
          supportTargetsFor(side, allies),
          rng,
          events,
          specialIndex,
          blockTarget,
        )
        side.abilityUses += 1
        const bloodHuntReady =
          isBloodHuntUser(side) &&
          side.charge >= CRY_CHARGES &&
          usedSpecial.name !== 'Blood Hunt'
        const cooldown =
          usedSpecial.name === 'Blood Hunt' || bloodHuntReady || usedSpecial.kind === 'copy'
            ? 0
            : specialCooldown(usedSpecial)
        if (specialIndex === 1) side.secondCooldown = cooldown
        else side.cooldown = cooldown
      }
      break
    case 'juke': {
      side.juking = true
      side.jukingTurns = 2
      events.push(`${side.name} готовит уворот: шанс ${Math.round(jukeChance(side) * 100)}%.`)
      break
    }
    case 'rest': {
      side.rests = (side.rests ?? 0) + 1
      if (hasStatus(side, 'hemorrhage')) {
        delete side.effects.hemorrhage
        events.push(
          `${side.name} переводит дыхание и сбрасывает Hemorrhage, но не восстанавливает HP.`,
        )
      } else {
        const healed = healSide(null, side, REST_HEAL)
        events.push(`${side.name} переводит дыхание и восстанавливает ${healed} HP.`)
      }
      if (side.character.name === 'Veeronica') {
        const before = side.charge
        side.charge = Math.min(100, side.charge + 15)
        events.push(
          `${side.name} заряжает батарею на передышке: +${side.charge - before}% (${side.charge}%).`,
        )
      }
      break
    }
  }

  clearLinkedEffectsForDead(battle)
  if (!finishIfTeamWiped(battle)) {
    if (side.extraTurn && side.hp > 0) {
      side.extraTurn = false
      battle.clock += 1
      side.lastActed = battle.clock
      events.push(`${side.name} действует ещё раз (приоритет хода).`)
    } else {
      side.extraTurn = false
      advanceTurn(battle, events)
    }
  }
  return result()
}

export function surrender(input: Battle, userId: string): { battle: Battle; winner: 0 | 1 } {
  if (input.finished) throw new Error('Бой уже окончен.')
  const loser = input.sides.find(side => side.userId === userId)
  if (!loser) throw new Error('Ты не участник этого боя.')
  const winner = (1 - loser.team) as 0 | 1
  const battle = structuredClone(input)
  battle.finished = true
  battle.winner = winner
  return { battle, winner }
}
