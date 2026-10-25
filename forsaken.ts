export type Rng = () => number

export type SpecialKind =
  | 'heavy'
  | 'heal'
  | 'shield'
  | 'stun'
  | 'poison'
  | 'burn'
  | 'turret'
  | 'trap'
  | 'speed'
  | 'rush'
  | 'battery'
  | 'sk8'
  | 'crystal'
  | 'purified'
  | 'cry'
  | 'bloodhunt'
  | 'revive'
  | 'dodge'
  | 'lifesteal'
  | 'gamble'
  | 'block'
  | 'empower'
  | 'pray'
  | 'beam'
  | 'corrupt'
  | 'strength'
  | 'weakness'
  | 'vulnerable'
  | 'resistance'
  | 'dispenser'
  | 'creatures'
  | 'regeneration'
  | 'hemorrhage'
  | 'glitch'
  | 'slateskin'
  | 'haste'
  | 'bleed'
  | 'seeker'
  | 'stigmatize'
  | 'pulse'
  | 'swords'
  | 'copy'
  | 'oneshot'
  | 'decoy'
  | 'rejuvenate'
  | 'pizza'

export type Special = {
  name: string
  kind: SpecialKind
  power: number
  description: string
  damage?: number
  lethalSave?: boolean
  cooldown?: number
}

export type Character = {
  name: string
  role: 'killer' | 'survivor'
  class?: string
  ability: string
  power: number
  price: number
  hp: number
  attack: number
  special: Special
  alternates?: readonly Special[]
}

export type Passive = { name: string; description: string }

export const PASSIVES: Record<string, Passive> = {
  Jason: { name: 'Mute', description: 'От первой атаки Джейсона нельзя увернуться.' },
  'John Doe': {
    name: 'Natural Malevolence',
    description: 'Ударивший Джона получает −10% уворота на 2 хода.',
  },
  Noli: {
    name: 'Hallucinations',
    description: 'Первая атака по Ноли промахивается.',
  },
  '1x1x1x1': {
    name: 'Unstable Toxin',
    description: 'Обычные атаки добавляют 2 урона ядом на 1 ход.',
  },
  'Guest 666': {
    name: 'Bloodthirst',
    description: 'Наносит +3 урона целям с Bleeding или Hemorrhage.',
  },
  Nosferatu: { name: 'Vampirism', description: 'Обычные атаки лечат на 20% нанесённого урона.' },
  Azure: {
    name: 'Atropic',
    description: 'Атака Azure лечит его на 1 HP за каждые 2 стака Atropa; стаки тратятся.',
  },
  '007n7': {
    name: 'Exploit',
    description: 'Наносит +3 урона, если способность цели на кулдауне.',
  },
  'Guest 1337': { name: 'Made to Last', description: 'Начинает бой с 110 HP.' },
  Elliot: {
    name: 'First Aid',
    description: 'Когда союзник получает 15+ урона, лечит его на 4 HP раз за ход.',
  },
  Taph: {
    name: 'Tripwire',
    description: 'Попадания снижают уворот цели на 10% на 2 хода.',
  },
  Chance: {
    name: 'Unpredictable Fate',
    description: 'В начале боя получает +10% уворота или 10 щита.',
  },
  Dusekkar: {
    name: 'Levitation',
    description: 'В начале своего хода снимает с себя отрицательное изменение уворота.',
  },
  Helperbot: {
    name: 'Support Protocol',
    description: 'В начале хода лечит самого раненого союзника на 2 HP.',
  },
  Veeronica: {
    name: 'Metal Frame',
    description: 'Чужие лечения не действуют; восстанавливает HP батареей и передышкой. При ≥50% батареи +5% уворота, при <20% — −5%.',
  },
  c00lkidd: {
    name: 'Pizza Fury',
    description: 'Каждая третья обычная атака наносит +4 урона.',
  },
  Shedletsky: {
    name: 'Swordmaster',
    description: 'Пока действует эффект меча, обычные атаки наносят +2 урона.',
  },
  Builderman: {
    name: 'Sturdy Build',
    description: 'Получает на 10% меньше урона.',
  },
  'Two Time': {
    name: 'Once More',
    description: 'После перерождения получает +20% уворота на 2 хода.',
  },
  'Jane Doe': {
    name: 'Shatterpoint',
    description:
      '25 отдельного запаса прочности, который принимает урон раньше HP; восстанавливается Crystal Pitch и Hatchet.',
  },
}

export function characterPassive(character: Character): Passive | undefined {
  return PASSIVES[character.name]
}

export function characterClass(character: Character): string {
  return character.class ?? (character.role === 'killer' ? 'Киллер' : 'Выживший')
}

export function availableSpecials(character: Character): Special[] {
  return [character.special, ...(character.alternates ?? [])]
}

export function selectedSpecial(character: Character, chosenName?: string): Special {
  return availableSpecials(character).find(special => special.name === chosenName) ?? character.special
}

export function characterWithSpecial(character: Character, chosenName?: string): Character {
  const special = selectedSpecial(character, chosenName)
  return special.name === character.special.name ? character : { ...character, special }
}

export const KILLERS: readonly Character[] = [
  {
    name: 'Jason',
    role: 'killer',
    class: 'Ambusher',
    ability: 'Ближний бой без дальних атак. Прощает ошибки новичкам.',
    power: 3,
    price: 0,
    hp: 100,
    attack: 14,
    special: { name: 'Gashing Wound', kind: 'heavy', power: 8, description: 'Серия ударов мачете: 8 урона и кровотечение 3 урона два хода.', cooldown: 3 },
    alternates: [
      { name: 'Raging Pace', kind: 'strength', power: 0, description: 'Ярость: +20% урона на 2 хода.' },
    ],
  },
  {
    name: 'c00lkidd',
    role: 'killer',
    class: 'Versatile',
    ability: 'Быстрая погоня, кулаки и pizza delivery.',
    power: 6,
    price: 900,
    hp: 100,
    attack: 14,
    special: {
      name: 'Pizza Delivery',
      kind: 'pizza',
      power: 7,
      cooldown: 3,
      description:
        'Призывает двух пицца-миньонов по 5 HP. При попадании миньон поджигает врага: ' +
        '7 урона в начале хода врага 2 хода и −10% уворота, после чего исчезает.',
    },
    alternates: [
      { name: 'Corrupt Nature', kind: 'corrupt', power: 0, description: 'Порча: снижает уворот соперника на 60% на 2 хода.', cooldown: 3 },
    ],
  },
  {
    name: 'John Doe',
    role: 'killer',
    class: 'Trapper',
    ability: 'Corrupt energy, цифровой след и 404-ошибка.',
    power: 5,
    price: 1000,
    hp: 100,
    attack: 13,
    special: { name: 'Corrupt Energy', kind: 'heavy', power: 14, description: '14 урона и −10% уворота соперника на 2 хода.' },
    alternates: [
      { name: 'Digital Footprint', kind: 'weakness', power: 6, description: '6 урона и Weakness: −20% урона и −15% уворота соперника на 2 хода.' },
    ],
  },
  {
    name: 'Noli',
    role: 'killer',
    class: 'Rushdown',
    ability: 'Галлюцинации: фейковые генераторы и диспенсеры.',
    power: 5,
    price: 1100,
    hp: 100,
    attack: 13,
    special: { name: 'Nova', kind: 'heavy', power: 8, cooldown: 2, description: 'Галлюцинации: 8 урона и −25% уворота соперника на 2 хода.' },
    alternates: [
      {
        name: 'Observant',
        kind: 'decoy',
        power: 0,
        cooldown: 3,
        description: 'Фейковый Ноли с теми же HP и эффектами; исчезает от удара. КД: 3 хода.',
      },
    ],
  },
  {
    name: '1x1x1x1',
    role: 'killer',
    class: 'Ranged',
    ability: 'Яд, глитчи и воскрешение выживших в миньонов.',
    power: 8,
    price: 1250,
    hp: 100,
    attack: 11,
    special: {
      name: 'Rejuvenate the Rotten',
      kind: 'rejuvenate',
      power: 0,
      cooldown: 3,
      description:
        'Некромантия: поднимает всех убитых врагов как гнилых миньонов. ' +
        'Стартовый миньон: 20 HP и 2 атаки; миньон из трупа: 40 HP и половина атаки убитого. ' +
        'Удары миньонов вешают глитч на 1 ход. КД: 3 хода.',
    },
    alternates: [
      { name: 'Mass Infection', kind: 'poison', power: 6, description: 'Яд: 6 урона в начале хода соперника 2 хода и −15% уворота.' },
    ],
  },
  {
    name: 'Guest 666',
    role: 'killer',
    class: 'Burst',
    ability: 'Infernal Cry и Eviscerate накапливают Blood; после 2 применений способность заменяется на Blood Hunt.',
    power: 7,
    price: 1666,
    hp: 100,
    attack: 14,
    special: { name: 'Infernal Cry', kind: 'cry', power: 6, description: 'Крик: 6 урона, −10% уворота врагу, +1 Blood. 2 Blood заменяют способность на Blood Hunt.' },
    alternates: [
      { name: 'Eviscerate', kind: 'hemorrhage', power: 0, description: 'Потрошение: соперник не может лечиться 2 хода; передышка снимает эффект, но не лечит HP. Накапливает Blood (2 заряда → Blood Hunt).' },
    ],
  },
  {
    name: 'Nosferatu',
    role: 'killer',
    class: 'Ambush',
    ability: 'Скрытность, левитация, Ascension и Hunter\'s Feast.',
    power: 7,
    price: 1922,
    hp: 100,
    attack: 13,
    special: { name: 'Ascension', kind: 'dodge', power: 0, cooldown: 2, description: 'Следующая атака с 75% шансом промахнётся; +10% уворота на 2 хода.' },
    alternates: [
      { name: "Hunter's Feast", kind: 'creatures', power: 0, description: 'Creatures: соперник получает +25% урона 2 хода.' },
    ],
  },
  {
    name: 'Azure',
    role: 'killer',
    class: 'Trapper',
    ability: 'Растения, метки Atropa и ловушки.',
    power: 8,
    price: 2000,
    hp: 100,
    attack: 12,
    special: { name: 'Seeker Bulb', kind: 'seeker', power: 3, damage: 8, description: 'Стреляет (8 урона) и накладывает 3 стака Atropa.' },
    alternates: [
      { name: 'Stigmatize', kind: 'stigmatize', power: 3, description: 'Опутывает: соперник пропускает ход и получает 3 стака Atropa.', cooldown: 3 },
    ],
  },
]

export const SURVIVORS: readonly Character[] = [
  {
    name: 'Noob',
    role: 'survivor',
    class: 'Survivalist',
    ability: 'Bloxy Cola, Slateskin Potion и Ghostburger.',
    power: 4,
    price: 0,
    hp: 100,
    attack: 11,
    special: { name: 'Bloxy Cola', kind: 'speed', power: 0, description: '+20% уворота на 2 хода.' },
    alternates: [
      { name: 'Slateskin Potion', kind: 'slateskin', power: 0, description: 'Слейтскин: +18 HP сверх максимума, иммунитет к DoT и −10% уворота на 2 хода.', cooldown: 4 },
    ],
  },
  {
    name: 'Shedletsky',
    role: 'survivor',
    class: 'Sentinel',
    ability: 'Смена меча SFOTH и жареная курица на лечение.',
    power: 6,
    price: 0,
    hp: 100,
    attack: 11,
    special: { name: 'Fried Chicken', kind: 'heal', power: 18, description: 'Лечит 18 HP себе и напарнику; Shedletsky получает −10% уворота на 2 хода.' },
    alternates: [
      { name: 'Sword Switch', kind: 'swords', power: 0, description: 'Случайный меч SFOTH: SFOTH — Strength, Firebrand — Burning, Venomshank — Poison, Ice Dagger — Stun, Darkheart — Lifesteal, Illumina — Regeneration, Ghostwalker — уворот, Windforce — Weakness.' },
    ],
  },
  {
    name: 'Elliot',
    role: 'survivor',
    class: 'Support',
    ability: 'Медик: пицца лечит, аура видит раненых.',
    power: 6,
    price: 0,
    hp: 100,
    attack: 11,
    special: { name: 'Pizza Throw', kind: 'heal', power: 20, description: 'Восстанавливает 20 HP напарнику; в соло — себе.', cooldown: 3 },
    alternates: [
      { name: 'Rush Hour', kind: 'rush', power: 0, description: 'Скорость: +20% уворота обоим союзникам на 2 хода.' },
    ],
  },
  {
    name: '007n7',
    role: 'survivor',
    class: 'Survivalist',
    ability: 'Клоны и копирование чужой способности через c00lgui.',
    power: 7,
    price: 500,
    hp: 100,
    attack: 11,
    special: { name: 'Clone', kind: 'dodge', power: 0, description: 'Следующая атака промахнётся; +15% уворота на 2 хода.' },
    alternates: [
      { name: 'c00lgui', kind: 'copy', power: 0, description: 'Копирует способность выбранного врага до конца боя. Скопированная способность готова сразу.' },
    ],
  },
  {
    name: 'Guest 1337',
    role: 'survivor',
    class: 'Sentinel',
    ability: 'Блок, рывок, панч и парирование.',
    power: 8,
    price: 500,
    hp: 110,
    attack: 12,
    special: { name: 'Block', kind: 'block', power: 0, description: 'Защищает выбранного союзника или себя от следующего удара; после блока следующая атака +50%. При промахе — −30% уворота на 2 хода.' },
    alternates: [
      { name: 'Charge', kind: 'stun', power: 0, description: 'Рывок: соперник пропускает ход.' },
    ],
  },
  {
    name: 'Two Time',
    role: 'survivor',
    class: 'Sentinel',
    ability: 'Стелс, мольба и вторая жизнь через Oblation, которая копится ударами кинжала.',
    power: 7,
    price: 500,
    hp: 100,
    attack: 11,
    special: { name: 'Oblation', kind: 'revive', power: 0, description: 'Копится на 25% за каждый удар; при 100% даёт вторую жизнь с 40 HP (один раз).' },
    alternates: [
      { name: 'Pray', kind: 'pray', power: 50, description: 'Тратит заряд Oblation на лечение только самого Two Time: 1 HP за 2% (до 50). Вторую жизнь не даёт.' },
    ],
  },
  {
    name: 'Builderman',
    role: 'survivor',
    class: 'Support',
    ability: 'Турели-сентри и лечащие диспенсеры.',
    power: 6,
    price: 500,
    hp: 100,
    attack: 10,
    special: { name: 'Sentry', kind: 'turret', power: 6, description: 'Турель: 6 урона в начале хода соперника 2 хода; Builderman получает −10% уворота на 2 хода.' },
    alternates: [
      { name: 'Dispenser', kind: 'dispenser', power: 0, description: 'Диспенсер: оба союзника лечатся на 8 HP в начале своего хода 2 хода. Builderman получает −10% уворота.', cooldown: 3 },
    ],
  },
  {
    name: 'Dusekkar',
    role: 'survivor',
    class: 'Support',
    ability: 'Левитация, щиты и плазменный луч.',
    power: 7,
    price: 600,
    hp: 100,
    attack: 14,
    special: { name: 'Spawn Protection', kind: 'shield', power: 60, description: 'Щит себе и напарнику: следующий урон −60%, смертельный удар оставляет 1 HP; +10% уворота на 2 хода.', lethalSave: true },
    alternates: [
      { name: 'Plasma Beam', kind: 'beam', power: 0, description: 'Луч: замедляет соперника (−15% уворота), ускоряет себя и напарника (+15%) на 2 хода и даёт им 10 временных HP на 1 ход. Урона не наносит.' },
    ],
  },
  {
    name: 'Taph',
    role: 'survivor',
    class: 'Support',
    ability: 'Растяжки и субпространственные мины.',
    power: 6,
    price: 600,
    hp: 100,
    attack: 11,
    special: { name: 'Subspace Tripmine', kind: 'stun', power: 0, description: 'Пропуск хода соперника и −15% его уворота на 2 хода.', cooldown: 3 },
    alternates: [
      { name: 'Tripwire', kind: 'bleed', power: 7, description: 'Кровотечение: 7 урона в начале хода соперника 2 хода и −10% уворота.' },
    ],
  },
  {
    name: 'Chance',
    role: 'survivor',
    class: 'Sentinel',
    ability: 'Монетка, флинтлок и реролл HP.',
    power: 5,
    price: 777,
    hp: 100,
    attack: 12,
    special: { name: 'Coin Flip', kind: 'gamble', power: 0, description: '50%: двойной урон и +20% уворота на 2 хода; 50%: ничего.' },
    alternates: [
      { name: 'One Shot', kind: 'oneshot', power: 24, description: '50%: выстрел на 24 урона и Vulnerable на 2 хода; иначе Chance получает Weakness на 2 хода.' },
    ],
  },
  {
    name: 'Veeronica',
    role: 'survivor',
    class: 'Survivalist',
    ability: 'Metal Frame, Sk8 и Activate Battery.',
    power: 5,
    price: 750,
    hp: 100,
    attack: 13,
    special: {
      name: 'Sk8',
      kind: 'sk8',
      power: 0,
      description: 'Скейт: +25% уворота на 2 хода, тратит до 15% батареи. При 100% — Overcharge: +35% уворота и разряд до 50%. Батарея: старт 30%, +15% в начале хода и +15% за передышку.',
    },
    alternates: [
      {
        name: 'Activate Battery',
        kind: 'battery',
        power: 20,
        description: 'Тратит до 40% батареи и лечит 1 HP за каждые 2% (до 20 HP). При 100% — Overcharge: 25 HP и разряд до 50%. Батарея: старт 30%, +15% в начале хода и +15% за передышку.',
      },
    ],
  },
  {
    name: 'Jane Doe',
    role: 'survivor',
    class: 'Sentinel',
    ability: 'Crystal Pitch, Purified, Shatterpoint и обычная атака Hatchet.',
    power: 6,
    price: 600,
    hp: 100,
    attack: 10,
    special: {
      name: 'Crystal Pitch',
      kind: 'crystal',
      power: 5,
      cooldown: 4,
      description: '5 урона, 2 стака Resonance и +4 Shatterpoint. Resonance: Hatchet тратит стаки, +4 урона за стак; 3 стака оглушают.',
    },
    alternates: [
      {
        name: 'Purified',
        kind: 'purified',
        power: 0,
        description: 'Даёт себе и напарнику одноразовое сопротивление: следующий удар ослабляется на 20% за каждые 20 потерянных HP (до 80%).',
      },
    ],
  },
  {
    name: 'Helperbot',
    role: 'survivor',
    class: 'Support',
    ability: 'Pulse и Inspiration: поддержка через Regeneration, Resistance и Haste.',
    power: 4,
    price: 650,
    hp: 100,
    attack: 12,
    special: { name: 'Pulse', kind: 'pulse', power: 0, cooldown: 3, description: 'Regeneration (+8 HP в начале хода на 1 ход) и Resistance (−20% получаемого урона на 1 ход) обоим союзникам.' },
    alternates: [
      { name: 'Inspiration', kind: 'haste', power: 0, description: 'Haste: КД способностей тикает вдвое быстрее у обоих союзников 2 хода.' },
    ],
  },
]

export const CHARACTERS: readonly Character[] = [...KILLERS, ...SURVIVORS]

export function characterByName(name: string): Character | undefined {
  return CHARACTERS.find(character => character.name === name)
}

export type JukeModifier = { amount: number; turns: number; target: 'self' | 'opponent' }

export const JUKE_MODIFIERS: Record<string, JukeModifier> = {
  'Bloxy Cola': { amount: 0.2, turns: 2, target: 'self' },
  'Fried Chicken': { amount: -0.1, turns: 2, target: 'self' },
  Clone: { amount: 0.15, turns: 2, target: 'self' },
  Sentry: { amount: -0.1, turns: 2, target: 'self' },
  Dispenser: { amount: -0.1, turns: 2, target: 'self' },
  'Coin Flip': { amount: 0.2, turns: 2, target: 'self' },
  'Pizza Delivery': { amount: -0.1, turns: 2, target: 'opponent' },
  'Infernal Cry': { amount: -0.1, turns: 2, target: 'opponent' },
  'Corrupt Energy': { amount: -0.1, turns: 2, target: 'opponent' },
  'Void Rush': { amount: -0.2, turns: 2, target: 'opponent' },
  Nova: { amount: -0.25, turns: 2, target: 'opponent' },
  'Mass Infection': { amount: -0.15, turns: 2, target: 'opponent' },
  'Blood Hunt': { amount: 0.15, turns: 2, target: 'self' },
  Ascension: { amount: 0.1, turns: 2, target: 'self' },
  'Subspace Tripmine': { amount: -0.15, turns: 2, target: 'opponent' },
  'Slateskin Potion': { amount: -0.1, turns: 2, target: 'self' },
  Tripwire: { amount: -0.1, turns: 2, target: 'opponent' },
  'Digital Footprint': { amount: -0.15, turns: 2, target: 'opponent' },
}

export const CHALLENGES: readonly string[] = [
  'Проживи 60 секунд без бега.',
  'Почини два генератора, не попавшись киллеру.',
  'Спаси союзника под камерой киллера.',
  'Выживи, не используя ни одного предмета.',
  'Спрячься и не двигайся 30 секунд после погони.',
  'Отвлеки киллера, чтобы союзник ушёл.',
  'Дойди до конца таймера последним.',
  'Сыграй раунд без единого урона.',
  'Сделай фейнт у генератора и уйди.',
  'Выживи после Blood Hunt, не покидая локацию.',
]

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]
}

export function pickTwo(rng: Rng): [Character, Character] {
  const firstIndex = Math.floor(rng() * CHARACTERS.length)
  const left = CHARACTERS[firstIndex]
  const rest = CHARACTERS.filter((_, index) => index !== firstIndex)
  return [left, pick(rest, rng)]
}

export function randomCharacter(rng: Rng): Character {
  return pick(CHARACTERS, rng)
}

export function randomBattleCharacters(
  mode: '1x1' | '2x2',
  rng: Rng = Math.random,
): Character[] {
  const count = mode === '2x2' ? 4 : 2
  const pool = [...CHARACTERS]
  const result: Character[] = []
  while (result.length < count && pool.length > 0) {
    const base = pool.splice(Math.floor(rng() * pool.length), 1)[0]
    const special = pick(availableSpecials(base), rng)
    result.push(characterWithSpecial(base, special.name))
  }
  return result
}

export function randomRound(rng: Rng): {
  killer: Character
  survivors: Character[]
  challenge: string
} {
  const killer = pick(KILLERS, rng)
  const pool = [...SURVIVORS]
  const survivors = Array.from({ length: 4 }, () => pool.splice(Math.floor(rng() * pool.length), 1)[0])
  return { killer, survivors, challenge: pick(CHALLENGES, rng) }
}

export function characterCardText(character: Character): string {
  const price = character.price === 0 ? 'Бесплатно' : `${character.price} монет`
  return `**${character.name}**\n${character.ability}\nЦена: ${price}`
}

export function duelText(
  leftName: string,
  left: Character,
  rightName: string,
  right: Character,
  rng: Rng,
): string {
  const leftRoll = left.power + Math.floor(rng() * 3)
  const rightRoll = right.power + Math.floor(rng() * 3)
  const leftWon = leftRoll >= rightRoll
  const winnerName = leftWon ? leftName : rightName
  const winnerCharacter = leftWon ? left : right
  const winnerScore = leftWon ? leftRoll : rightRoll
  const loserScore = leftWon ? rightRoll : leftRoll
  return (
    `⚔️ **${leftName}** — ${left.name} (${left.power}/10)\n` +
    `**${rightName}** — ${right.name} (${right.power}/10)\n\n` +
    `Победил **${winnerName}** (${winnerCharacter.name}) со счётом ${winnerScore}:${loserScore}.`
  )
}

export function randomChallenge(rng: Rng): string {
  return pick(CHALLENGES, rng)
}

export type SurvivalChoice = {
  id: string
  label: string
  score: number
  flavor: string
}

export type SurvivalStep = {
  prompt: string
  choices: readonly SurvivalChoice[]
}

export const SURVIVAL_STEPS: readonly SurvivalStep[] = [
  {
    prompt: 'Ты чинишь генератор, когда слышишь шаги. Киллер рядом, таймер идёт.',
    choices: [
      { id: 'fix', label: 'Починить генератор', score: 2, flavor: 'Ты доводишь генератор до 70%, но шум привлекает внимание.' },
      { id: 'hide', label: 'Спрятаться', score: 1, flavor: 'Ты прячешься в шкафу и пережидаешь шаги.' },
      { id: 'run', label: 'Сменить укрытие', score: 2, flavor: 'Ты бросаешь генератор и уходишь в другой угол карты.' },
    ],
  },
  {
    prompt: 'Киллер заметил тебя и начал погоню. Таймер продолжает идти.',
    choices: [
      { id: 'distract', label: 'Отвлечь киллера', score: 2, flavor: 'Ты сбиваешь киллера с толку и выигрываешь время.' },
      { id: 'window', label: 'Прыгнуть в окно', score: 2, flavor: 'Ты прыгаешь в окно и отрываешься.' },
      { id: 'sneak', label: 'Тихо обойти', score: 1, flavor: 'Ты тихо обходишь киллера по краю.' },
    ],
  },
  {
    prompt: 'Таймер почти на нуле, но киллер перекрывает путь.',
    choices: [
      { id: 'timer', label: 'Дождаться таймера', score: 3, flavor: 'Ты тянешь время, пока таймер не доходит до нуля.' },
      { id: 'cover', label: 'Прикрыть отход', score: 2, flavor: 'Ты прикрываешь отход и уходишь последним.' },
      { id: 'sprint', label: 'Рвануть напролом', score: 1, flavor: 'Ты рвёшь напролом, не оглядываясь.' },
    ],
  },
]

const WIN_SCORE = 7

export type SurvivalState = {
  killer: Character
  stepIndex: number
  score: number
}

export type SurvivalAdvance =
  | { done: false; state: SurvivalState; text: string }
  | { done: true; state: SurvivalState; text: string; won: boolean }

export function startSurvival(rng: Rng): SurvivalState {
  return { killer: pick(KILLERS, rng), stepIndex: 0, score: 0 }
}

export function advanceSurvival(state: SurvivalState, choiceId: string, rng: Rng): SurvivalAdvance {
  const step = SURVIVAL_STEPS[state.stepIndex]
  const choice = step?.choices.find(candidate => candidate.id === choiceId)
  if (!step || !choice) throw new Error(`Неизвестный ход: ${choiceId}`)

  const next: SurvivalState = {
    ...state,
    score: state.score + choice.score,
    stepIndex: state.stepIndex + 1,
  }
  const nextStep = SURVIVAL_STEPS[next.stepIndex]

  if (nextStep) {
    return {
      done: false,
      state: next,
      text: `${choice.flavor}\n\n${nextStep.prompt}`,
    }
  }

  const luck = Math.floor(rng() * 3)
  const won = next.score + luck >= WIN_SCORE
  const outcome = won
    ? `⏱ Таймер дошёл до нуля — ты выжил! ${next.killer.name} не успел.`
    : `☠️ ${next.killer.name} настиг тебя до конца таймера. Раунд проигран.`
  return {
    done: true,
    state: next,
    won,
    text: `${choice.flavor}\n\n${outcome} (очки: ${next.score} + удача: ${luck})`,
  }
}
