import type { Special } from './forsaken'

export type Language = 'ru' | 'en'

const EN: Record<string, string> = {
  'Gashing Wound': 'A series of machete strikes: 18 damage and 6 bleeding damage for 2 turns.',
  'Raging Pace': 'Rage: +20% damage for 2 turns.',
  'Pizza Delivery': 'Burns the opponent for 7 damage at the start of their turn for 2 turns and lowers their dodge by 10%.',
  'Corrupt Nature': "Corruption: lowers the opponent's dodge by 60% for 2 turns.",
  'Corrupt Energy': '14 damage and −10% enemy dodge for 2 turns.',
  'Digital Footprint': '6 damage and Weakness: −20% enemy damage and −15% dodge for 2 turns.',
  'Void Rush': '12 damage and −20% enemy dodge for 2 turns.',
  Nova: 'Hallucinations: 8 damage and −25% enemy dodge for 2 turns.',
  Observant: 'Fake Noli with the same HP and effects; disappears when hit. CD: 3 turns.',
  Entanglement: "Glitch: blocks the opponent's ability for 2 turns.",
  'Rejuvenate the Rotten':
    "Necromancy: raises every killed enemy as a rotten minion. Starting minion: 25 HP and 3 attack; corpse minion: 50 HP and half the killed enemy's attack. Minion hits apply Glitch for 1 turn.",
  'Mass Infection': "Poison: 6 damage at the start of the enemy's turn for 2 turns and −15% dodge.",
  'Infernal Cry': 'Cry: 6 damage, −10% enemy dodge, +1 Blood. At 2 Blood the ability becomes Blood Hunt.',
  'Blood Hunt': 'Roar: 8 damage, +15% dodge for 2 turns, and 3 empowered attacks (+3 damage, heals on hit).',
  Eviscerate: 'Evisceration: the opponent cannot heal for 2 turns; Rest clears it without healing. Builds Blood (2 charges → Blood Hunt).',
  Ascension: 'The next attack misses; +10% dodge for 2 turns.',
  Lacerate: 'Swarm: the opponent takes +25% damage for 2 turns.',
  'Bloxy Cola': '+20% dodge for 2 turns.',
  'Slateskin Potion': 'Slateskin: +25 overheal, DoT immunity, −10% dodge for 2 turns.',
  'Fried Chicken': 'Heals 18 HP for both allies; Shedletsky gets −10% dodge for 2 turns.',
  'Sword Switch': 'Random SFOTH sword: SFOTH — Strength, Firebrand — Burning, Venomshank — Poison, Ice Dagger — Stun, Darkheart — Lifesteal, Illumina — Regeneration, Ghostwalker — dodge, Windforce — Weakness.',
  'Pizza Throw': 'Restores 20 HP to the teammate; in solo it heals Elliot.',
  'Rush Hour': 'Speed: +20% dodge for both allies for 2 turns.',
  Clone: 'The next attack misses; +15% dodge for 2 turns.',
  c00lgui: "Copies the chosen enemy's ability for the rest of the battle; the copy is ready immediately.",
  Block: 'Protects the chosen ally or yourself from the next hit; after blocking, the next attack deals +50%. On a miss: −30% dodge for 2 turns.',
  Charge: 'Charge: the opponent skips a turn.',
  Oblation: 'Charges by 25% per landed hit; at 100% grants one 40 HP second life.',
  Pray: 'Spends Oblation charge to heal only Two Time: 1 HP per 2% (up to 50). No second life.',
  Sentry: "Turret: 6 damage at the start of the enemy's turn for 2 turns; Builderman gets −10% dodge for 2 turns.",
  Dispenser: 'Heals both allies for 8 HP at the start of their turns for 2 turns. Builderman gets −10% dodge.',
  'Spawn Protection': 'Shields the teammate: next damage −60%, a lethal hit leaves 1 HP; +10% dodge for 2 turns. In solo it shields Dusekkar.',
  'Plasma Beam': 'Beam: slows the opponent (−15% dodge), speeds the teammate (+15%) for 2 turns and grants 10 temporary HP for 1 turn. In solo it buffs Dusekkar. No damage.',
  'Subspace Tripmine': 'The enemy skips a turn and gets −15% dodge for 2 turns.',
  Tripwire: "Bleeding: 7 damage at the start of the enemy's turn for 2 turns and −10% dodge.",
  'Coin Flip': '50%: double damage and +20% dodge for 2 turns; 50%: nothing.',
  'One Shot': '50%: fires for 24 damage and applies Vulnerable for 2 turns; otherwise Chance gets Weakness for 2 turns.',
  Sk8: '+25% dodge for 2 turns, spends up to 15% battery. At 100% Overcharge: +35% dodge and discharge to 50%. Battery: starts at 30%, +15% at the start of each turn and +15% when resting.',
  'Activate Battery': 'Spends up to 40% battery to heal 1 HP per 2% (up to 20 HP). At 100% Overcharge: heals 25 HP and discharges to 50%. Battery: starts at 30%, +15% at the start of each turn and +15% when resting.',
  'Crystal Pitch': '9 damage, 2 Resonance stacks and +8 Shatterpoint. Resonance: Hatchet consumes stacks for +4 damage each; 3 stacks stun.',
  Purified: 'Grants one-hit resistance to Jane and her ally: the next hit is reduced by 20% for every 20 HP lost (up to 80%).',
  "Hunter's Feast": 'Creatures: the opponent takes +25% damage for 2 turns.',
  'Seeker Bulb': 'Shoots for 8 damage and applies 3 Atropa stacks.',
  Stigmatize: 'Snares: the opponent skips a turn and gains 3 Atropa stacks.',
  Pulse: 'Regeneration (+8 HP at turn start) and Resistance (−20% damage taken) for both allies for 2 turns.',
  Inspiration: 'Haste: ability cooldowns tick twice as fast for both allies for 2 turns.',
}

const PASSIVE_EN: Record<string, string> = {
  Mute: "Jason's first attack cannot be dodged.",
  'Natural Malevolence': 'The attacker who hits John Doe gets −10% dodge for 2 turns.',
  Hallucinations: 'The first attack against Noli misses.',
  'Unstable Toxin': 'Basic attacks add 2 poison damage for 1 turn.',
  Bloodthirst: 'Deals +3 damage to targets with Bleeding or Hemorrhage.',
  Vampirism: 'Basic attacks heal for 20% of damage dealt.',
  Atropic: "Azure's attack heals him for 1 HP per 2 Atropa stacks; the stacks are consumed.",
  Exploit: "Deals +3 damage if the target's ability is on cooldown.",
  'Made to Last': 'Starts battle with 110 HP.',
  'First Aid': 'When an ally takes 15+ damage, heals them for 4 HP once per turn.',
  Tripwire: "Hits lower the target's dodge by 10% for 2 turns.",
  'Unpredictable Fate': 'At battle start, gains +10% dodge or 10 shield.',
  Levitation: 'At the start of his turn, removes a negative dodge modifier from himself.',
  'Support Protocol': 'At the start of each turn, heals the most wounded ally for 2 HP.',
  'Metal Frame': 'Cannot be healed by allies; restores HP with the battery and by resting. At ≥50% battery +5% dodge, below 20% −5%.',
  'Pizza Fury': 'Every third basic attack deals +4 damage.',
  Swordmaster: 'While a sword effect is active, basic attacks deal +2 damage.',
  'Sturdy Build': 'Takes 10% less damage.',
  'Once More': 'After reviving, gains +20% dodge for 2 turns.',
  Shatterpoint: '25 separate durability that absorbs damage before HP; restored by Crystal Pitch and Hatchet.',
}

export function specialDescription(special: Special, language: Language = 'ru'): string {
  return language === 'en' ? (EN[special.name] ?? special.description) : special.description
}

export function passiveDescription(name: string, fallback: string, language: Language = 'ru'): string {
  return language === 'en' ? (PASSIVE_EN[name] ?? fallback) : fallback
}

export function atropaDescription(language: Language = 'ru'): string {
  return language === 'en'
    ? "+1 damage to Azure's attack per stack; an attack consumes the stacks."
    : '+1 урон к атаке Azure за стак; атака тратит стаки.'
}
