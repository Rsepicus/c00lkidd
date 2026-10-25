import { describe, expect, test } from 'bun:test'
import { characterByName } from './forsaken'
import {
  createDmBattle,
  dmMatchTurnUserId,
  enqueueDm,
  removeFromDmQueue,
  takeDmPair,
} from './matchmaking'

const entry = (userId: string, characterName = 'Noob') => ({
  userId,
  name: userId,
  character: characterByName(characterName)!,
})

describe('DM matchmaking', () => {
  test('queues a user once and keeps order', () => {
    let queue: string[] = []
    queue = enqueueDm(queue, 'a')
    queue = enqueueDm(queue, 'b')
    queue = enqueueDm(queue, 'a')
    expect(queue).toEqual(['a', 'b'])
  })

  test('takes the first pair and leaves the rest', () => {
    expect(takeDmPair(['a', 'b', 'c'])).toEqual({ pair: ['a', 'b'], rest: ['c'] })
    expect(takeDmPair(['a'])).toEqual({ pair: null, rest: ['a'] })
    expect(takeDmPair([])).toEqual({ pair: null, rest: [] })
  })

  test('removes a user from the queue', () => {
    expect(removeFromDmQueue(['a', 'b'], 'a')).toEqual(['b'])
  })

  test('builds a 1v1 battle and reports whose turn it is', () => {
    const battle = createDmBattle(entry('a'), entry('b', 'Jason'))
    expect(battle.sides).toHaveLength(2)
    expect(battle.sides[0].userId).toBe('a')
    expect(dmMatchTurnUserId(battle)).toBe('a')

    battle.turn = 1
    expect(dmMatchTurnUserId(battle)).toBe('b')
    battle.finished = true
    expect(dmMatchTurnUserId(battle)).toBeNull()
  })

  test('rejects a match with yourself', () => {
    expect(() => createDmBattle(entry('a'), entry('a'))).toThrow()
  })
})
