import { describe, expect, test } from 'bun:test'
import { availableSpecials, CHARACTERS, characterByName } from './forsaken'
import { MASTERY_MAX_XP, MASTERY_WIN_XP } from './progress'
import { defaultUser, type UserData } from './store'
import {
  checkTrialResult,
  claimTrialResult,
  createTrialBattle,
  TRIALS,
  trialClaimKey,
  trialForCharacter,
  trialResultFromBattle,
  trialReward,
  type Trial,
  type TrialObjective,
  type TrialResult,
} from './trials'

const OBJECTIVES: readonly TrialObjective[] = [
  'win',
  'survive',
  'special',
  'win_without_rest',
  'heal',
  'damage',
  'summon',
  'block',
  'stun',
  'revive',
]

function characterFor(trial: Trial) {
  const character = characterByName(trial.characterName)
  if (!character) throw new Error(`Missing character: ${trial.characterName}`)
  return character
}

function resultFor(trial: Trial): TrialResult {
  switch (trial.objective) {
    case 'win':
      return { won: true, turns: 1, abilityUses: 0, rests: 0 }
    case 'survive':
      return { won: false, turns: trial.target, abilityUses: 0, rests: 0 }
    case 'special':
      return { won: false, turns: 1, abilityUses: trial.target, rests: 0 }
    case 'win_without_rest':
      return { won: true, turns: 1, abilityUses: 0, rests: 0 }
    case 'heal':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, healingDone: trial.target }
    case 'damage':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, damageDealt: trial.target }
    case 'summon':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, summoned: trial.target }
    case 'block':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, blocks: trial.target }
    case 'stun':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, stuns: trial.target }
    case 'revive':
      return { won: false, turns: 1, abilityUses: 0, rests: 0, revives: trial.target }
  }
}

function failingResultFor(trial: Trial): TrialResult {
  switch (trial.objective) {
    case 'win':
      return { won: false, turns: 99, abilityUses: 99, rests: 0 }
    case 'survive':
      return { won: true, turns: trial.target - 1, abilityUses: 99, rests: 0 }
    case 'special':
      return { won: true, turns: 99, abilityUses: trial.target - 1, rests: 0 }
    case 'win_without_rest':
      return { won: true, turns: 99, abilityUses: 99, rests: 1 }
    case 'heal':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, healingDone: trial.target - 1 }
    case 'damage':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, damageDealt: trial.target - 1 }
    case 'summon':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, summoned: trial.target - 1 }
    case 'block':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, blocks: trial.target - 1 }
    case 'stun':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, stuns: trial.target - 1 }
    case 'revive':
      return { won: true, turns: 99, abilityUses: 99, rests: 0, revives: trial.target - 1 }
  }
}

function progressUser(): UserData {
  return {
    ...defaultUser(),
    wins: 7,
    losses: 3,
    streak: 4,
    bestStreak: 9,
    history: [
      { opponent: 'Noob', result: 'win', coins: 100, at: 1234 },
      { opponent: 'Jason', result: 'loss', coins: -50, at: 5678 },
    ],
    quests: {
      date: '2026-10-25',
      rerollUsed: false,
      quests: [
        {
          id: 'play',
          kind: 'play',
          target: 3,
          progress: 1,
          reward: 150,
          claimed: false,
        },
      ],
    },
    weeklyQuest: {
      week: '2026-W43',
      kind: 'wins',
      target: 15,
      progress: 4,
      reward: 700,
      claimed: false,
    },
    characterStats: {
      Jason: { wins: 0, losses: 0, xp: 0 },
      Noob: { wins: 5, losses: 2, xp: 40 },
    },
    trialClaimed: { Jason: 2, 'pve:already-claimed': 1 },
  }
}

describe('trial roster', () => {
  test('defines one serializable trial for every character', () => {
    expect(TRIALS).toHaveLength(CHARACTERS.length)
    expect(TRIALS).toHaveLength(21)

    const ids = new Set<string>()
    const names = new Set<string>()
    for (const trial of TRIALS) {
      expect(trial.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(trial.id)).toBe(false)
      ids.add(trial.id)

      expect(characterByName(trial.characterName)).toBeDefined()
      expect(names.has(trial.characterName)).toBe(false)
      names.add(trial.characterName)

      expect(trial.mode === '1x1' || trial.mode === '2x2').toBe(true)
      expect(OBJECTIVES).toContain(trial.objective)
      expect(Number.isInteger(trial.target)).toBe(true)
      expect(trial.target).toBeGreaterThan(0)
      expect(Number.isInteger(trial.bonusXp)).toBe(true)
      expect(trial.bonusXp).toBeGreaterThan(0)
      expect(JSON.parse(JSON.stringify(trial))).toEqual(trial)
    }

    expect(names).toEqual(new Set(CHARACTERS.map(character => character.name)))
  })

  test('uses the kit objective kinds and both battle modes', () => {
    const used = new Set(TRIALS.map(trial => trial.objective))
    expect([...used].every(objective => OBJECTIVES.includes(objective))).toBe(true)
    expect(used.size).toBeGreaterThanOrEqual(8)
    expect(used).toContain('heal')
    expect(used).toContain('summon')
    expect(new Set(TRIALS.map(trial => trial.mode))).toEqual(new Set(['1x1', '2x2']))
  })

  test('looks up a trial by exact character name', () => {
    for (const character of CHARACTERS) {
      const trial = trialForCharacter(character.name)
      expect(trial).toBeDefined()
      expect(trial?.characterName).toBe(character.name)
    }
    expect(trialForCharacter('Unknown')).toBeUndefined()
    expect(trialForCharacter('')).toBeUndefined()
  })

  test('reports the mastery XP bonus as the reward', () => {
    for (const trial of TRIALS) {
      expect(trialReward(trial)).toBe(trial.bonusXp)
    }
  })
})

describe('trial objectives', () => {
  test('passes every trial at its target boundary', () => {
    for (const trial of TRIALS) {
      expect(checkTrialResult(trial, resultFor(trial))).toBe(true)
    }
  })

  test('fails every trial just short of its target', () => {
    for (const trial of TRIALS) {
      expect(checkTrialResult(trial, failingResultFor(trial))).toBe(false)
    }
  })

  test('win objectives require a win', () => {
    const trial: Trial = {
      id: 'test-win',
      characterName: 'Jason',
      mode: '1x1',
      objective: 'win',
      target: 1,
      bonusXp: 10,
    }
    expect(checkTrialResult(trial, { won: false, turns: 99, abilityUses: 99, rests: 0 })).toBe(false)
    expect(checkTrialResult(trial, { won: true, turns: 1, abilityUses: 0, rests: 5 })).toBe(true)
  })

  test('survive objectives check turns without requiring a win', () => {
    const trial: Trial = {
      id: 'test-survive',
      characterName: 'Noob',
      mode: '2x2',
      objective: 'survive',
      target: 7,
      bonusXp: 10,
    }
    expect(checkTrialResult(trial, { won: false, turns: 6, abilityUses: 0, rests: 0 })).toBe(false)
    expect(checkTrialResult(trial, { won: false, turns: 7, abilityUses: 0, rests: 0 })).toBe(true)
  })

  test('special objectives count ability uses without requiring a win', () => {
    const trial: Trial = {
      id: 'test-special',
      characterName: 'c00lkidd',
      mode: '1x1',
      objective: 'special',
      target: 3,
      bonusXp: 10,
    }
    expect(checkTrialResult(trial, { won: false, turns: 9, abilityUses: 2, rests: 0 })).toBe(false)
    expect(checkTrialResult(trial, { won: false, turns: 9, abilityUses: 3, rests: 2 })).toBe(true)
  })

  test('no-rest objectives require both a win and zero rests', () => {
    const trial: Trial = {
      id: 'test-no-rest',
      characterName: 'Elliot',
      mode: '2x2',
      objective: 'win_without_rest',
      target: 1,
      bonusXp: 10,
    }
    expect(checkTrialResult(trial, { won: false, turns: 9, abilityUses: 2, rests: 0 })).toBe(false)
    expect(checkTrialResult(trial, { won: true, turns: 9, abilityUses: 2, rests: 1 })).toBe(false)
    expect(checkTrialResult(trial, { won: true, turns: 9, abilityUses: 2, rests: 0 })).toBe(true)
  })

  test('kit objectives read the new counters', () => {
    const trial = (objective: TrialObjective): Trial => ({
      id: `test-${objective}`,
      characterName: 'Noob',
      mode: '2x2',
      objective,
      target: 2,
      bonusXp: 10,
    })
    const base = { won: false, turns: 1, abilityUses: 0, rests: 0 }
    expect(checkTrialResult(trial('heal'), { ...base, healingDone: 2 })).toBe(true)
    expect(checkTrialResult(trial('heal'), { ...base, healingDone: 1 })).toBe(false)
    expect(checkTrialResult(trial('damage'), { ...base, damageDealt: 2 })).toBe(true)
    expect(checkTrialResult(trial('summon'), { ...base, summoned: 2 })).toBe(true)
    expect(checkTrialResult(trial('block'), { ...base, blocks: 2 })).toBe(true)
    expect(checkTrialResult(trial('stun'), { ...base, stuns: 2 })).toBe(true)
    expect(checkTrialResult(trial('revive'), { ...base, revives: 2 })).toBe(true)
    expect(checkTrialResult(trial('revive'), base)).toBe(false)
  })

  test('every trial signature ability exists on its character', () => {
    for (const trial of TRIALS) {
      if (!trial.specialName) continue
      const character = characterByName(trial.characterName)
      if (!character) throw new Error(`Missing character: ${trial.characterName}`)
      const names = availableSpecials(character).map(special => special.name)
      expect(names).toContain(trial.specialName)
    }
  })

  test('trialResultFromBattle copies the player side counters', () => {
    const trial = TRIALS.find(candidate => candidate.id === 'jason')!
    const battle = createTrialBattle(
      trial,
      characterByName('Jason')!,
      7,
    )
    const side = battle.sides.find(candidate => candidate.userId === 'trial:player')!
    side.userId = 'owner'
    side.turns = 3
    side.abilityUses = 2
    side.damageDealt = 50
    side.healingDone = 12
    side.minionsSummoned = 4
    side.blocks = 1
    side.stuns = 1
    side.revives = 1
    battle.winner = 0
    expect(trialResultFromBattle(battle, 'owner')).toMatchObject({
      won: true,
      turns: 3,
      abilityUses: 2,
      damageDealt: 50,
      healingDone: 12,
      summoned: 4,
      blocks: 1,
      stuns: 1,
      revives: 1,
    })
  })
})

describe('trial battles', () => {
  test('creates the right team sizes and puts the trial character on the player team', () => {
    for (const trial of TRIALS) {
      const character = characterFor(trial)
      const battle = createTrialBattle(trial, character, 12345)
      const expectedSideCount = trial.mode === '2x2' ? 4 : 2

      expect(battle.sides).toHaveLength(expectedSideCount)
      expect(battle.turn).toBe(0)
      expect(battle.finished).toBe(false)
      expect(battle.winner).toBeNull()

      const playerSides = battle.sides.filter(side => side.team === 0)
      const opponentSides = battle.sides.filter(side => side.team === 1)
      expect(playerSides).toHaveLength(trial.mode === '2x2' ? 2 : 1)
      expect(opponentSides).toHaveLength(trial.mode === '2x2' ? 2 : 1)
      expect(battle.sides[0].character.name).toBe(trial.characterName)

      for (const opponent of opponentSides) {
        expect(opponent.userId.startsWith('bot:')).toBe(true)
      }
    }
  })

  test('is deterministic for a seed and serializable', () => {
    for (const trial of TRIALS) {
      const character = characterFor(trial)
      const first = createTrialBattle(trial, character, 987654321)
      const second = createTrialBattle(trial, character, 987654321)

      expect(first).toEqual(second)
      expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    }
  })

  test('uses the seed to choose the opposing lineup', () => {
    const trial = trialForCharacter('Jason')!
    const character = characterFor(trial)
    const a = createTrialBattle(trial, character, 1)
    const b = createTrialBattle(trial, character, 2)
    const lineup = (battle: ReturnType<typeof createTrialBattle>) =>
      battle.sides
        .filter(side => side.team === 1)
        .map(side => side.character.name)
        .join(',')

    expect(lineup(a)).not.toBe(lineup(b))
  })

  test('rejects a character that does not match the trial', () => {
    const trial = trialForCharacter('Jason')!
    const noob = characterByName('Noob')!
    expect(() => createTrialBattle(trial, noob, 1)).toThrow()
  })
})

describe('claiming trial results', () => {
  test('claims once with mastery-only progress and preserves all other state', () => {
    const trial = trialForCharacter('Jason')!
    const user = progressUser()
    const beforeXp = user.characterStats.Jason.xp
    const result = claimTrialResult(user, trial, true)

    expect(result.claimed).toBe(true)
    expect(result.user).not.toBe(user)
    expect(result.user.wins).toBe(user.wins)
    expect(result.user.losses).toBe(user.losses)
    expect(result.user.streak).toBe(user.streak)
    expect(result.user.bestStreak).toBe(user.bestStreak)
    expect(result.user.quests).toEqual(user.quests)
    expect(result.user.weeklyQuest).toEqual(user.weeklyQuest)
    expect(result.user.history).toEqual(user.history)
    expect(result.user.lastPvp).toEqual(user.lastPvp)
    expect(result.user.characterStats.Noob).toEqual(user.characterStats.Noob)
    expect(result.user.characterStats.Jason.wins).toBe(0)
    expect(result.user.characterStats.Jason.losses).toBe(0)
    expect(result.user.characterStats.Jason.xp).toBe(
      Math.min(MASTERY_MAX_XP, beforeXp + MASTERY_WIN_XP + trial.bonusXp),
    )
    expect(result.xpGained).toBe(result.user.characterStats.Jason.xp - beforeXp)
    expect(result.user.trialClaimed).toEqual({
      ...user.trialClaimed,
      [trialClaimKey(trial)]: 1,
    })
    expect(result.user.trialClaimed.Jason).toBe(2)
    expect(result.user.trialClaimed['pve:already-claimed']).toBe(1)
  })

  test('does nothing for a failed trial', () => {
    const trial = trialForCharacter('Jason')!
    const user = progressUser()
    const result = claimTrialResult(user, trial, false)

    expect(result.claimed).toBe(false)
    expect(result.user).toBe(user)
    expect(result.xpGained).toBe(0)
    expect(result.reward).toBe(0)
    expect(result.milestones).toEqual([])
    expect(result.skinsUnlocked).toEqual([])
  })

  test('a second claim is a no-op and keeps the first reward', () => {
    const trial = trialForCharacter('Jason')!
    const first = claimTrialResult(progressUser(), trial, true)
    const second = claimTrialResult(first.user, trial, true)

    expect(second.claimed).toBe(false)
    expect(second.user).toEqual(first.user)
    expect(second.xpGained).toBe(0)
    expect(second.reward).toBe(0)
    expect(second.milestoneReward).toBe(0)
    expect(second.leveledUp).toBe(false)
  })

  test('does not confuse the numeric character tier with the namespaced trial key', () => {
    const trial = trialForCharacter('Jason')!
    const user = progressUser()
    expect(user.trialClaimed.Jason).toBe(2)

    const result = claimTrialResult(user, trial, true)
    expect(result.claimed).toBe(true)
    expect(result.user.trialClaimed.Jason).toBe(2)
  })

  test('does not spend a claim on a different character trial', () => {
    const jason = trialForCharacter('Jason')!
    const noob = trialForCharacter('Noob')!
    const user = progressUser()
    const jasonClaim = claimTrialResult(user, jason, true)
    const noobClaim = claimTrialResult(jasonClaim.user, noob, true)

    expect(noobClaim.claimed).toBe(true)
    expect(noobClaim.user.trialClaimed[trialClaimKey(jason)]).toBe(1)
    expect(noobClaim.user.trialClaimed[trialClaimKey(noob)]).toBe(1)
  })
})
