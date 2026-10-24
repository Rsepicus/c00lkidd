export type SynergyId =
  | 'plead'
  | 'fittest'
  | 'you-and-i'
  | 'hatred'
  | 'dead-ringer'
  | 'seraphim'

export type Synergy = {
  id: SynergyId
  name: string
  description: string
  members: readonly [string, string]
}

export const SYNERGIES: readonly Synergy[] = [
  {
    id: 'plead',
    name: 'Plead',
    description: 'Когда один уворачивается, второй получает +10% уворота на 1 ход (до +20%).',
    members: ['007n7', 'c00lkidd'],
  },
  {
    id: 'fittest',
    name: 'Survival for the Fittest',
    description: 'Успешный блок Guest 1337 даёт обоим +10% уворота на 2 хода.',
    members: ['Guest 1337', 'Jason'],
  },
  {
    id: 'you-and-i',
    name: 'You and I',
    description: 'Когда один попадает обычной атакой, второй лечится на 2 HP.',
    members: ['John Doe', 'Jane Doe'],
  },
  {
    id: 'hatred',
    name: 'Creation of Hatred',
    description: 'Пока у Shedletsky активен меч, оба наносят +2 урона обычными атаками.',
    members: ['Shedletsky', '1x1x1x1'],
  },
  {
    id: 'dead-ringer',
    name: 'Dead Ringer',
    description: 'Bloxy Cola Noob также даёт Guest 666 +10% уворота на 2 хода.',
    members: ['Noob', 'Guest 666'],
  },
  {
    id: 'seraphim',
    name: 'And the Seraphim Wept',
    description: 'Когда Azure тратит Atropa на атаку, Two Time получает +10% заряда Oblation.',
    members: ['Azure', 'Two Time'],
  },
]

export function synergyFor(names: readonly string[]): Synergy | undefined {
  return SYNERGIES.find(synergy => synergy.members.every(name => names.includes(name)))
}
