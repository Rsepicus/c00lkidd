import { describe, expect, test } from 'bun:test'
import {
  advanceSurvival,
  availableSpecials,
  CHARACTERS,
  characterByName,
  characterCardText,
  characterPassive,
  characterWithSpecial,
  CHALLENGES,
  duelText,
  KILLERS,
  pickTwo,
  randomCharacter,
  randomRound,
  selectedSpecial,
  startSurvival,
  SURVIVORS,
} from './forsaken'

const first = () => 0
const last = () => 0.999

describe('balance', () => {
  test('every character has at least 100 HP, and Guest 1337 has 110', () => {
    for (const character of CHARACTERS) {
      expect(character.hp).toBeGreaterThanOrEqual(100)
    }
    expect(characterByName('Guest 1337')?.hp).toBe(110)
  })

  test('healers stay within the healing budget', () => {
    expect(characterByName('Elliot')?.special.power).toBe(16)
    expect(characterByName('Elliot')?.special.cooldown).toBe(3)
    expect(characterByName('Shedletsky')?.special.power).toBe(18)
    expect(characterByName('Two Time')?.special.kind).toBe('revive')
  })

  test('damage-over-time specials stay within the damage budget', () => {
    expect(
      characterByName('1x1x1x1')?.alternates?.find(special => special.kind === 'poison')?.power,
    ).toBe(6)
    expect(characterByName('Builderman')?.special.power).toBe(6)
    expect(characterByName('c00lkidd')?.special.power).toBe(7)
  })

  test('Dusekkar shield is capped at 60%', () => {
    expect(characterByName('Dusekkar')?.special.power).toBe(60)
  })

  test('Pizza Delivery describes the implemented burn and slow', () => {
    const description = characterByName('c00lkidd')?.special.description ?? ''
    expect(description).toContain('7 урона')
    expect(description).toContain('−10%')
    expect(description).not.toContain('кусают')
  })

  test('adds Veeronica and Jane Doe with their passives', () => {
    const veeronica = characterByName('Veeronica')!
    const jane = characterByName('Jane Doe')!
    expect(veeronica.price).toBe(750)
    expect(jane.price).toBe(600)
    expect(characterPassive(veeronica)?.name).toBe('Metal Frame')
    expect(characterPassive(jane)?.name).toBe('Shatterpoint')
    expect(availableSpecials(veeronica).map(special => special.name)).toEqual([
      'Sk8',
      'Activate Battery',
    ])
    expect(availableSpecials(jane).map(special => special.name)).toContain('Crystal Pitch')
  })

  test('Azure uses the Atropic passive', () => {
    expect(characterPassive(characterByName('Azure')!)?.name).toBe('Atropic')
  })

  test('Rush Hour is a speed buff, not healing', () => {
    const rush = characterByName('Elliot')?.alternates?.find(
      special => special.name === 'Rush Hour',
    )
    expect(rush?.kind).toBe('rush')
    expect(rush?.description).toContain('+20%')
    expect(rush?.description).not.toContain('HP')
  })

  test('Taph uses the subspace mine stun kit', () => {
    const taph = characterByName('Taph')
    expect(taph?.special.name).toBe('Subspace Tripmine')
    expect(taph?.special.kind).toBe('stun')
  })
})

describe('ability loadouts', () => {
  test('every character offers at least two ability choices', () => {
    for (const character of CHARACTERS) {
      expect(availableSpecials(character).length).toBeGreaterThanOrEqual(2)
    }
  })

  test('every character has a wiki class', () => {
    for (const character of CHARACTERS) {
      expect(character.class?.length).toBeGreaterThan(0)
    }
  })

  test('John Doe uses Digital Footprint and 007n7 uses Teleport', () => {
    expect(availableSpecials(characterByName('John Doe')!).map(special => special.name)).toContain(
      'Digital Footprint',
    )
    expect(availableSpecials(characterByName('007n7')!).map(special => special.name)).toContain(
      'c00lgui',
    )
  })

  test('Guest 1337 can choose Block or Charge', () => {
    const guest = characterByName('Guest 1337')!
    expect(availableSpecials(guest).map(special => special.name)).toEqual(['Block', 'Charge'])
    expect(selectedSpecial(guest).name).toBe('Block')
    expect(selectedSpecial(guest, 'Charge').name).toBe('Charge')
    expect(characterWithSpecial(guest, 'Charge').special.name).toBe('Charge')
  })

  test('Dusekkar can choose Shield or Plasma Beam', () => {
    const dusekkar = characterByName('Dusekkar')!
    expect(availableSpecials(dusekkar).map(special => special.name)).toEqual([
      'Spawn Protection',
      'Plasma Beam',
    ])
  })

  test('an unknown loadout falls back to the default ability', () => {
    const guest = characterByName('Guest 1337')!
    expect(selectedSpecial(guest, 'Не существует').name).toBe('Block')
  })
})

describe('randomRound', () => {
  test('picks one killer, four unique survivors and a challenge', () => {
    const round = randomRound(first)
    expect(round.killer.role).toBe('killer')
    expect(round.survivors).toHaveLength(4)
    expect(new Set(round.survivors.map(survivor => survivor.name)).size).toBe(4)
    expect(round.survivors.every(survivor => survivor.role === 'survivor')).toBe(true)
    expect(CHALLENGES).toContain(round.challenge)
  })
})

describe('randomCharacter', () => {
  test('returns a known Forsaken character', () => {
    const character = randomCharacter(first)
    expect(character).toBe(KILLERS[0])
    expect(randomCharacter(last)).toBe([...KILLERS, ...SURVIVORS].at(-1))
  })
})

describe('pickTwo', () => {
  test('returns two different characters', () => {
    const [left, right] = pickTwo(first)
    expect(left).not.toBe(right)
  })
})

describe('characterCardText', () => {
  test('includes the name, ability and price without a role label', () => {
    const card = characterCardText(KILLERS[0])
    expect(card).toContain(KILLERS[0].name)
    expect(card).toContain(KILLERS[0].ability)
    expect(card).toContain('Цена:')
    expect(card).not.toContain('Киллер')
  })
})

describe('duelText', () => {
  test('names both characters and declares a winner', () => {
    const text = duelText('Rsepicus', KILLERS[0], 'Друг', SURVIVORS[0], first)
    expect(text).toContain(KILLERS[0].name)
    expect(text).toContain(SURVIVORS[0].name)
    expect(text).toMatch(/Победил/)
  })
})

describe('survival', () => {
  test('starts at step 0 against a random killer', () => {
    const state = startSurvival(first)
    expect(state.killer).toBe(KILLERS[0])
    expect(state.stepIndex).toBe(0)
    expect(state.score).toBe(0)
  })

  test('rejects a choice that does not belong to the current step', () => {
    const state = startSurvival(first)
    expect(() => advanceSurvival(state, 'timer', first)).toThrow()
  })

  test('advances without resolving before the last step', () => {
    const result = advanceSurvival(startSurvival(first), 'fix', first)
    expect(result.done).toBe(false)
    expect(result.state.stepIndex).toBe(1)
    expect(result.state.score).toBe(2)
  })

  test('wins when score plus luck reaches the threshold', () => {
    let state = startSurvival(first)
    state = advanceSurvival(state, 'fix', first).state
    state = advanceSurvival(state, 'distract', first).state
    const result = advanceSurvival(state, 'timer', first)
    expect(result.done).toBe(true)
    expect(result.won).toBe(true)
  })

  test('loses when the score is too low', () => {
    let state = startSurvival(first)
    state = advanceSurvival(state, 'hide', first).state
    state = advanceSurvival(state, 'sneak', first).state
    const result = advanceSurvival(state, 'sprint', first)
    expect(result.done).toBe(true)
    expect(result.won).toBe(false)
  })

  test('luck can push a borderline score over the threshold', () => {
    let state = startSurvival(first)
    state = advanceSurvival(state, 'fix', first).state
    state = advanceSurvival(state, 'distract', first).state
    const result = advanceSurvival(state, 'sprint', last)
    expect(result.done).toBe(true)
    expect(result.won).toBe(true)
  })
})
