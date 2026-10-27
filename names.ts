import type { Special } from './forsaken'

export type Language = 'ru' | 'en'

const EN: Record<string, string> = {
  'Gashing Wound': 'A series of machete strikes: 14 damage and 4 bleeding damage for 2 turns.',
  'Raging Pace': 'Rage: +20% damage and stun immunity for 2 turns, plus turn priority.',
  'Pizza Delivery':
    'Summons two 8 HP pizza minions. On a hit, a minion burns the enemy for 7 damage at the start of their turn for 2 turns, lowers their dodge by 10%, and disappears. CD: 3 turns.',
  'Corrupt Nature': 'Corruption: 10 damage, −25% enemy dodge and Weakness for 2 turns.',
  'Corrupt Energy': '14 damage and −10% enemy dodge for 2 turns.',
  'Digital Footprint': '10 damage, Weakness (−20% enemy damage and −15% dodge) for 3 turns and 2 poison for 2 turns.',
  'Void Rush': '12 damage and −20% enemy dodge for 2 turns.',
  Nova: 'Hallucinations: 12 damage and −20% enemy dodge for 2 turns.',
  Observant: 'Fake Noli with the same HP and effects; it deals 2 damage, grants Noli +10% dodge, and lowers enemy dodge by 10%. Disappears when hit. CD: 3 turns.',
  Entanglement: "Glitch: blocks the opponent's ability for 2 turns.",
  'Rejuvenate the Rotten':
    "Necromancy: raises every killed enemy as a rotten minion. Starting minion: 20 HP and 2 attack; corpse minion: 40 HP and half the killed enemy's attack. Minion hits apply Glitch for 1 turn. CD: 3 turns.",
  'Mass Infection': "4 damage, then poison for 6 damage at the start of the enemy's turn for 2 turns and −15% dodge.",
  'Infernal Cry': 'Cry: 5 damage, −20% enemy dodge and Weakness for 2 turns, +1 Blood and Strength for 2 turns. At 2 Blood the ability becomes Blood Hunt.',
  'Blood Hunt': 'Roar: 8 damage, +15% dodge for 2 turns, and 3 empowered attacks (+3 damage, heals on hit).',
  Eviscerate: 'Evisceration: 10 damage; the opponent cannot heal for 2 turns; Rest clears it without healing. Builds Blood (2 charges → Blood Hunt).',
  Ascension: 'The next enemy attack misses. CD: 4 turns.',
  Dive: 'Dive: 14 damage; on a hit the target skips a turn. Appears after Ascension and consumes it.',
  Lacerate: 'Swarm: the opponent takes +25% damage for 2 turns.',
  'Bloxy Cola': 'Speed: +25% dodge and Strength (+20% damage) for 2 turns, removes a dodge debuff, and grants turn priority.',
  'Slateskin Potion': 'Slateskin: +22 overheal, DoT immunity and −10% dodge for 2 turns.',
  'Fried Chicken': 'Heals 18 HP for both allies.',
  'Sword Switch': 'Random SFOTH sword: SFOTH — Strength, Firebrand — Burning, Venomshank — Poison, Ice Dagger — Stun, Darkheart — Lifesteal, Illumina — Regeneration, Ghostwalker — dodge, Windforce — Weakness. Also empowers the next attack and grants +20% damage for 2 turns.',
  'Pizza Throw': 'Restores 16 HP to the teammate; in solo it heals Elliot.',
  'Rush Hour': 'Speed: both allies gain +20% dodge, Strength (+20% damage) for 2 turns and turn priority.',
  Clone: 'The next attack misses; +15% dodge for 2 turns.',
  c00lgui: "Copies the chosen enemy's ability for the rest of the battle, grants 12 temporary HP; the copy is ready immediately.",
  Block: 'Protects the chosen ally or yourself from the next hit; after blocking, gain +5 temporary HP and +50% on the next attack. On a miss: −30% dodge for 2 turns.',
  Charge: 'Charge: 3 damage and the opponent skips a turn.',
  Oblation: 'Charges by 25% per landed hit; at 100% grants one 50 HP second life and turn priority.',
  Pray: 'Spends Oblation charge to heal only Two Time: 1 HP per 2% (up to 35). No second life.',
  Sentry: 'Places a 25 HP turret that deals 6 damage on its own turn; the turret can be destroyed. Builderman gets −10% dodge for 2 turns.',
  Dispenser: 'Places a 25 HP dispenser that heals allies for 10 HP on its own turn; it can be destroyed. Builderman gets −10% dodge.',
  'Spawn Protection': 'Shields the teammate: next damage −60%, a lethal hit leaves 1 HP, +5 temporary HP and stun immunity for 2 turns. In solo it shields Dusekkar. CD: 3 turns.',
  'Plasma Beam': 'Beam: slows the opponent (−15% dodge), grants the teammate +15% dodge and 10 temporary HP for 1 turn. In solo it buffs Dusekkar. No damage.',
  'Subspace Tripmine': 'Deals 5 damage; the enemy skips a turn, gets −15% dodge and Weakness for 2 turns.',
  Tripwire: "Deals 4 damage and bleeding: 7 damage at the start of the enemy's turn for 2 turns and −10% dodge.",
  'Coin Flip': '50%: double damage and +20% dodge for 2 turns; 50%: 75% damage and Weakness for 2 turns.',
  'One Shot': '50%: fires for 28 damage and applies Vulnerable for 2 turns; otherwise Chance gets Weakness for 2 turns.',
  Sk8: '+25% dodge for 2 turns and turn priority, spends up to 15% battery. At 100% Overcharge: +35% dodge and discharge to 50%. Battery: starts at 30%, +15% at the start of each turn and +15% when resting.',
  'Activate Battery': 'Spends up to 40% battery to heal 1 HP per 2% (up to 15 HP). At 100% Overcharge: heals 20 HP and discharges to 50%. Battery: starts at 30%, +15% at the start of each turn and +15% when resting. CD: 3 turns.',
  'Crystal Pitch': '6 damage, 2 Resonance stacks and +4 Shatterpoint. Resonance: Hatchet consumes stacks for +4 damage each; 3 stacks stun.',
  Purified: 'Grants Jane and her ally +8 HP, Resistance for 1 turn and one-hit resistance: the next hit is reduced by 20% for every 20 HP lost (up to 80%).',
  "Hunter's Feast": '8 damage, Creatures (+25% damage taken), Oblivious for 2 turns, and +15% dodge for Nosferatu.',
  'Seeker Bulb': 'Shoots for 8 damage, applies 3 Atropa stacks and 3 bleeding damage for 2 turns.',
  Stigmatize: 'Snares: the opponent skips a turn and gains 3 Atropa stacks.',
  Pulse: 'Regeneration (+8 HP at turn start), Resistance (−20% damage taken) and a 20% shield for both allies for 1 turn.',
  Inspiration: 'Haste: ability cooldowns tick twice as fast for both allies for 2 turns, plus Regeneration and Resistance for 1 turn and a 20% shield. CD: 5 turns.',
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
