import { describe, expect, test } from 'bun:test'
import { CHARACTERS, characterByName, type Character } from './forsaken'
import { createBattle, createTeamBattle } from './pvp'
import { defaultUser, type UserData } from './store'
import {
  GHOST_MIN_PVP_BATTLES,
  TRAINING_BOT_ID_PREFIX,
  createGhostBattle,
  eligibleGhosts,
  ghostBattleEntries,
  ghostEligible,
  ghostSnapshot,
  pickGhostOpponents,
  recordGhostResult,
  shadowName,
  type GhostSnapshot,
} from './training'

const SELF_ID = '123456789012345671'
const FIRST_ID = '123456789012345672'
const SECOND_ID = '123456789012345673'
const THIRD_ID = '123456789012345674'
const FOURTH_ID = '123456789012345675'

function makeUser(overrides: Partial<UserData> = {}): UserData {
  return { ...defaultUser(), ...overrides }
}

function pvpUser(overrides: Partial<UserData> = {}): UserData {
  return makeUser({
    wins: GHOST_MIN_PVP_BATTLES,
    losses: 0,
    ...overrides,
  })
}

function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

function character(name: string): Character {
  const result = characterByName(name)
  if (!result) throw new Error(`Unknown character in test: ${name}`)
  return result
}

function snap(
  userId: string,
  characterName: string,
  partnerName?: string,
): GhostSnapshot {
  return {
    userId,
    name: shadowName(userId),
    character: character(characterName),
    ...(partnerName ? { partner: character(partnerName) } : {}),
  }
}

describe('ghostEligible', () => {
  test('rejects stock, inactive and unknown active accounts', () => {
    expect(ghostEligible(defaultUser())).toBe(false)
    expect(ghostEligible(null)).toBe(false)
    expect(ghostEligible(undefined)).toBe(false)
    expect(
      ghostEligible(
        makeUser({ active: null, wins: 10, loadouts: { Noob: 'Slateskin Potion' } }),
      ),
    ).toBe(false)
    expect(ghostEligible(makeUser({ active: 'MissingNo', wins: 10 }))).toBe(false)
  })

  test('accepts exactly three PvP battles from either column', () => {
    expect(GHOST_MIN_PVP_BATTLES).toBe(3)
    expect(ghostEligible(makeUser({ wins: 2, losses: 0 }))).toBe(false)
    expect(ghostEligible(makeUser({ wins: 1, losses: 2 }))).toBe(true)
    expect(ghostEligible(makeUser({ wins: 0, losses: 3 }))).toBe(true)
  })

  test('accepts a custom build only when the active character has a loadout entry', () => {
    const customNoob = makeUser({
      owned: ['Noob'],
      active: 'Noob',
      loadouts: { Noob: 'Slateskin Potion' },
    })
    expect(ghostEligible(customNoob)).toBe(true)

    const inactiveBuild = makeUser({
      wins: 2,
      active: 'Noob',
      loadouts: { Jason: 'Raging Pace' },
    })
    expect(ghostEligible(inactiveBuild)).toBe(false)

    const otherFreeHero = makeUser({ active: 'Jason', loadouts: {} })
    expect(ghostEligible(otherFreeHero)).toBe(false)
  })

  test('does not count malformed or negative battle totals', () => {
    expect(ghostEligible(makeUser({ wins: -10, losses: 2 }))).toBe(false)
    expect(ghostEligible(makeUser({ wins: Number.NaN, losses: 3 }))).toBe(false)
  })
})

describe('ghostSnapshot', () => {
  test('resolves active/partner characters, selected specials and a deterministic name', () => {
    const user = makeUser({
      active: 'Noob',
      partner: 'Jason',
      wins: 3,
      loadouts: {
        Noob: 'Slateskin Potion',
        Jason: 'Raging Pace',
      },
    })

    const snapshot = ghostSnapshot(user, FIRST_ID)
    expect(snapshot.userId).toBe(FIRST_ID)
    expect(snapshot.name).toBe(shadowName(FIRST_ID))
    expect(snapshot.name).not.toContain('discord')
    expect(snapshot.character.name).toBe('Noob')
    expect(snapshot.character.special.name).toBe('Slateskin Potion')
    expect(snapshot.partner?.name).toBe('Jason')
    expect(snapshot.partner?.special.name).toBe('Raging Pace')
    expect(ghostSnapshot(user, FIRST_ID)).toEqual(snapshot)
    expect(shadowName(FIRST_ID)).toBe(shadowName(FIRST_ID))
    expect(shadowName(FIRST_ID)).not.toBe(shadowName(SECOND_ID))
  })

  test('falls back to the primary special and omits invalid partners', () => {
    const user = makeUser({
      active: 'Noob',
      partner: 'Noob',
      wins: 3,
      loadouts: { Noob: 'Not a real special' },
    })
    const snapshot = ghostSnapshot(user, SECOND_ID)

    expect(snapshot.character.special.name).toBe('Bloxy Cola')
    expect(snapshot.partner).toBeUndefined()

    const unknownPartner = makeUser({ active: 'Noob', partner: 'MissingNo', wins: 3 })
    expect(ghostSnapshot(unknownPartner, SECOND_ID).partner).toBeUndefined()
  })

  test('refuses to snapshot an account without a resolvable active character', () => {
    expect(() => ghostSnapshot(makeUser({ active: null, wins: 3 }), FIRST_ID)).toThrow()
    expect(() => ghostSnapshot(makeUser({ active: 'MissingNo', wins: 3 }), FIRST_ID)).toThrow()
  })
})

describe('eligibleGhosts', () => {
  test('keeps only eligible real users, excludes self and sorts by id', () => {
    const users: Record<string, UserData> = {
      [FOURTH_ID]: makeUser({ active: null, wins: 9 }),
      [THIRD_ID]: makeUser({
        active: 'Jason',
        loadouts: { Jason: 'Raging Pace' },
      }),
      [SELF_ID]: pvpUser(),
      'bot:legacy': pvpUser(),
      [FIRST_ID]: pvpUser({ active: 'Noob', partner: 'Elliot' }),
      [SECOND_ID]: makeUser(),
    }

    const ghosts = eligibleGhosts(users, SELF_ID)
    expect(ghosts.map(ghost => ghost.userId)).toEqual([FIRST_ID, THIRD_ID])
    expect(ghosts[0].name).toBe(shadowName(FIRST_ID))
    expect(ghosts[0].partner?.name).toBe('Elliot')
    expect(ghosts[1].character.special.name).toBe('Raging Pace')
  })

  test('resolves partner loadouts for shadows', () => {
    const users: Record<string, UserData> = {
      [FIRST_ID]: pvpUser({
        active: 'Noob',
        partner: 'Elliot',
        loadouts: { Elliot: 'Rush Hour' },
      }),
    }

    expect(eligibleGhosts(users, SELF_ID)[0].partner?.special.name).toBe('Rush Hour')
  })
})

describe('pickGhostOpponents', () => {
  test('returns exactly count: deterministic real shadows first, bots as fill', () => {
    const users: Record<string, UserData> = {
      [THIRD_ID]: pvpUser({ active: 'Jason' }),
      [SELF_ID]: pvpUser(),
      [FIRST_ID]: pvpUser({ active: 'Noob' }),
      [SECOND_ID]: makeUser(),
      'bot:legacy': pvpUser(),
      [FOURTH_ID]: pvpUser({ active: null, wins: 20 }),
    }

    const first = pickGhostOpponents(users, SELF_ID, 4, seededRng(7), '1x1')
    const again = pickGhostOpponents(users, SELF_ID, 4, seededRng(7), '1x1')
    const reversed = pickGhostOpponents(
      Object.fromEntries(Object.entries(users).reverse()),
      SELF_ID,
      4,
      seededRng(7),
      '1x1',
    )

    expect(first).toHaveLength(4)
    expect(again).toEqual(first)
    expect(reversed).toEqual(first)
    expect(first.slice(0, 2).map(ghost => ghost.userId).sort()).toEqual(
      [FIRST_ID, THIRD_ID].sort(),
    )

    const bots = first.slice(2)
    expect(bots.every(ghost => ghost.userId.startsWith(TRAINING_BOT_ID_PREFIX))).toBe(true)
    expect(new Set(first.map(ghost => ghost.userId)).size).toBe(4)
    expect(bots.every(ghost => ghost.partner === undefined)).toBe(true)
    expect(bots.every(ghost => CHARACTERS.includes(ghost.character))).toBe(true)
    expect(new Set(bots.map(ghost => ghost.name)).size).toBe(2)
  })

  test('gives fallback 2x2 teams a deterministic distinct partner', () => {
    const teams = pickGhostOpponents({}, SELF_ID, 3, seededRng(11), '2x2')
    const repeat = pickGhostOpponents({}, SELF_ID, 3, seededRng(99), '2x2')

    expect(teams).toHaveLength(3)
    expect(repeat).toEqual(teams)
    for (const ghost of teams) {
      expect(ghost.userId.startsWith(TRAINING_BOT_ID_PREFIX)).toBe(true)
      expect(ghost.partner).toBeDefined()
      expect(ghost.partner?.name).not.toBe(ghost.character.name)
      expect(CHARACTERS).toContain(ghost.partner!)
    }
  })

  test('normalizes non-positive and fractional counts', () => {
    expect(pickGhostOpponents({}, SELF_ID, 0, seededRng(1), '1x1')).toEqual([])
    expect(pickGhostOpponents({}, SELF_ID, -2, seededRng(1), '1x1')).toEqual([])
    expect(pickGhostOpponents({}, SELF_ID, Number.NaN, seededRng(1), '1x1')).toEqual([])
    expect(pickGhostOpponents({}, SELF_ID, 2.9, seededRng(1), '1x1')).toHaveLength(2)
  })

  test('always fills the requested amount when no real shadows exist', () => {
    const ghosts = pickGhostOpponents({ [SELF_ID]: pvpUser() }, SELF_ID, 5, seededRng(3), '1x1')
    expect(ghosts).toHaveLength(5)
    expect(ghosts.every(ghost => ghost.userId.startsWith(TRAINING_BOT_ID_PREFIX))).toBe(true)
    expect(ghosts.every(ghost => ghost.userId !== SELF_ID)).toBe(true)
  })
})

describe('ghostBattleEntries and createGhostBattle', () => {
  const player = snap(SELF_ID, 'Noob', 'Elliot')

  test('builds a 1x1 battle from a single real shadow', () => {
    const ghost = snap(FIRST_ID, 'Jason', 'Shedletsky')
    const entries = ghostBattleEntries(player, [ghost], '1x1')

    expect(entries.player).toHaveLength(1)
    expect(entries.opponents).toHaveLength(1)
    expect(entries.player[0]).toMatchObject({
      userId: SELF_ID,
      name: player.name,
      character: player.character,
    })
    expect(entries.opponents[0]).toMatchObject({
      userId: FIRST_ID,
      name: ghost.name,
      character: ghost.character,
    })

    const battle = createGhostBattle(player, [ghost], '1x1')
    expect(battle.sides).toHaveLength(2)
    expect(battle.sides.map(side => side.userId)).toEqual([SELF_ID, FIRST_ID])
    expect(battle.sides.map(side => side.character.name)).toEqual(['Noob', 'Jason'])
    expect(battle).toEqual(createBattle(entries.player[0], entries.opponents[0]))
  })

  test('builds a 2x2 battle with both player and ghost partners', () => {
    const ghost = snap(FIRST_ID, 'Jason', 'Shedletsky')
    const entries = ghostBattleEntries(player, [ghost], '2x2')

    expect(entries.player.map(entry => entry.character.name)).toEqual(['Noob', 'Elliot'])
    expect(entries.opponents.map(entry => entry.character.name)).toEqual([
      'Jason',
      'Shedletsky',
    ])
    expect(entries.player.every(entry => entry.userId === SELF_ID)).toBe(true)
    expect(entries.opponents.every(entry => entry.userId === FIRST_ID)).toBe(true)

    const battle = createGhostBattle(player, [ghost], '2x2')
    expect(battle.sides).toHaveLength(4)
    expect(
      battle.sides.filter(side => side.team === 0).map(side => side.character.name),
    ).toEqual(['Noob', 'Elliot'])
    expect(
      battle.sides.filter(side => side.team === 1).map(side => side.character.name),
    ).toEqual(['Jason', 'Shedletsky'])
    expect(battle).toEqual(createTeamBattle(entries.player, entries.opponents))
  })

  test('can pair two separate shadows and duplicates when no partner exists', () => {
    const first = snap(FIRST_ID, 'Jason')
    const second = snap(SECOND_ID, 'c00lkidd')
    const pair = ghostBattleEntries(player, [first, second], '2x2')
    expect(pair.opponents.map(entry => entry.character.name)).toEqual(['Jason', 'c00lkidd'])

    const solo = ghostBattleEntries(player, [first], '2x2')
    expect(solo.opponents.map(entry => entry.character.name)).toEqual(['Jason', 'Jason'])

    const noPlayerPartner = ghostBattleEntries(
      snap(SELF_ID, 'Noob'),
      [first],
      '2x2',
    )
    expect(noPlayerPartner.player.map(entry => entry.character.name)).toEqual([
      'Noob',
      'Noob',
    ])
  })

  test('requires at least one opponent', () => {
    expect(() => ghostBattleEntries(player, [], '1x1')).toThrow()
    expect(() => createGhostBattle(player, [], '2x2')).toThrow()
  })
})

describe('recordGhostResult', () => {
  const quests: NonNullable<UserData['quests']> = {
    date: '2026-10-25',
    rerollUsed: false,
    quests: [
      {
        id: 'play',
        kind: 'play',
        target: 3,
        progress: 0,
        reward: 150,
        claimed: false,
      },
    ],
  }
  const weeklyQuest: NonNullable<UserData['weeklyQuest']> = {
    week: '2026-W43',
    kind: 'wins',
    target: 15,
    progress: 0,
    reward: 700,
    claimed: false,
  }
  const history = [{ opponent: 'Тень 5672', result: 'win' as const, coins: 100, at: 10 }]

  function baseUser(overrides: Partial<UserData> = {}): UserData {
    return makeUser({
      coins: 40,
      wins: 4,
      losses: 2,
      streak: 2,
      bestStreak: 5,
      characterStats: {
        Noob: { wins: 3, losses: 1, xp: 0 },
        Jason: { wins: 1, losses: 2, xp: 50 },
      },
      quests,
      weeklyQuest,
      history,
      ...overrides,
    })
  }

  test('only grants mastery XP and leaves profile, streaks, quests and history alone', () => {
    const user = baseUser()
    const result = recordGhostResult(user, 'Noob', true, 5)

    expect(result.xpGained).toBe(25)
    expect(result.user.characterStats.Noob).toEqual({ wins: 3, losses: 1, xp: 25 })
    expect(result.user.wins).toBe(user.wins)
    expect(result.user.losses).toBe(user.losses)
    expect(result.user.streak).toBe(user.streak)
    expect(result.user.bestStreak).toBe(user.bestStreak)
    expect(result.user.quests).toBe(user.quests)
    expect(result.user.weeklyQuest).toBe(user.weeklyQuest)
    expect(result.user.history).toBe(user.history)
    expect(result.user.achievements).toBe(user.achievements)
    expect(result.user.characterStats.Jason).toBe(user.characterStats.Jason)
    expect(result.user.coins).toBe(user.coins)
    expect(result.leveledUp).toBe(false)

    expect(user.characterStats.Noob).toEqual({ wins: 3, losses: 1, xp: 0 })
    expect(user.coins).toBe(40)
    expect(user.wins).toBe(4)
    expect(user.losses).toBe(2)
    expect(user.streak).toBe(2)
  })

  test('uses loss XP, countBattle=false, and still allows mastery level rewards', () => {
    const user = baseUser({
      characterStats: { Noob: { wins: 3, losses: 1, xp: 90 } },
    })
    const result = recordGhostResult(user, 'Noob', false)

    expect(result.xpGained).toBe(10)
    expect(result.level).toBe(2)
    expect(result.leveledUp).toBe(true)
    expect(result.reward).toBe(50)
    expect(result.user.characterStats.Noob).toEqual({ wins: 3, losses: 1, xp: 100 })
    expect(result.user.coins).toBe(90)
    expect(result.user.wins).toBe(user.wins)
    expect(result.user.losses).toBe(user.losses)
    expect(result.user.streak).toBe(user.streak)
    expect(result.user.bestStreak).toBe(user.bestStreak)
    expect(result.user.quests).toBe(user.quests)
    expect(result.user.weeklyQuest).toBe(user.weeklyQuest)
    expect(result.user.history).toBe(user.history)
  })

  test('does not modify the input user object', () => {
    const user = baseUser()
    const before = structuredClone(user)
    recordGhostResult(user, 'Noob', true)
    expect(user).toEqual(before)
  })
})
