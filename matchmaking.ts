import { createBattle, type Battle, type FighterEntry } from './pvp'

/** Adds a user to the cross-server queue once. */
export function enqueueDm(queue: readonly string[], userId: string): string[] {
  if (!userId || queue.includes(userId)) return [...queue]
  return [...queue, userId]
}

/** Takes the first two queued users, leaving the rest untouched. */
export function takeDmPair(queue: readonly string[]): {
  pair: [string, string] | null
  rest: string[]
} {
  if (queue.length < 2) return { pair: null, rest: [...queue] }
  return { pair: [queue[0], queue[1]], rest: queue.slice(2) }
}

export function removeFromDmQueue(queue: readonly string[], userId: string): string[] {
  return queue.filter(entry => entry !== userId)
}

/** Builds the 1v1 battle used by cross-server DM matches. */
export function createDmBattle(first: FighterEntry, second: FighterEntry): Battle {
  if (first.userId === second.userId) {
    throw new Error('Нельзя искать бой с самим собой.')
  }
  return createBattle(first, second)
}

/** Only the side whose turn it is may act in a DM match. */
export function dmMatchTurnUserId(battle: Battle): string | null {
  if (battle.finished) return null
  return battle.sides[battle.turn]?.userId ?? null
}
