import { describe, expect, test } from 'bun:test'
import { isoWeekKey } from './boss'
import {
  achievementsEmbed,
  battleComponents,
  battleEmbed,
  bossCoopComponents,
  bossCoopEmbed,
  bossPanelComponents,
  bossPanelEmbed,
  bossRushPanelComponents,
  bossRushPanelEmbed,
  challengeEmbed,
  characterBrowserComponents,
  customColorModal,
  characterEmbed,
  chooseComponents,
  chooseEmbed,
  cosmeticsComponents,
  cosmeticsEmbed,
  draftComponents,
  draftEmbed,
  draftPickOrder,
  forecastEmbed,
  helpEmbed,
  historyEmbed,
  hubComponents,
  localizeInteraction,
  openChallengeComponents,
  openChallengeEmbed,
  profileEmbed,
  pvePanelComponents,
  pvePanelEmbed,
  pvpSetupComponents,
  pvpSetupEmbed,
  questsComponents,
  questsEmbed,
  trainingSetupComponents,
  trainingSetupEmbed,
  rematchComponents,
  settingsComponents,
  settingsEmbed,
  shopComponents,
  shopEmbed,
  statusEmbed,
  survivalPanelComponents,
  survivalPanelEmbed,
  targetComponents,
  topComponents,
  topEmbed,
  towerPanelComponents,
  towerPanelEmbed,
  trialsPanelComponents,
  trialsPanelEmbed,
} from './bot'
import { TRIALS } from './trials'
import {
  availableSpecials,
  CHARACTERS,
  characterByName,
  characterWithSpecial,
} from './forsaken'
import {
  activeLanguage,
  setActiveLanguage,
  translateText,
  withLanguage,
} from './i18n'
import { createBattle, createTeamBattle, takeTurn } from './pvp'
import { defaultUser, type UserData } from './store'

const CYRILLIC = /[А-Яа-яЁё]/

function english(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function expectNoCyrillic(value: unknown): void {
  // Slash-command names stay Russian; they are the real commands users type.
  const text = english(value).replace(/\/[А-Яа-яЁё-]+/g, '/cmd')
  expect(text).not.toMatch(CYRILLIC)
}

function englishUser(): UserData {
  return {
    ...defaultUser(),
    language: 'en',
    coins: 1500,
    owned: ['Noob', 'Jason', 'Elliot', 'Builderman'],
    active: 'Noob',
    partner: 'Jason',
    wins: 3,
    losses: 2,
    streak: 2,
    bestStreak: 3,
    achievements: ['first_win'],
    characterStats: { Jason: { wins: 2, losses: 1, xp: 120 } },
    history: [
      { opponent: 'Bob (Jason)', result: 'win', coins: 150, at: 1 },
      { opponent: 'Alice (Noob)', result: 'loss', coins: -50, at: 2 },
    ],
    boss: { week: isoWeekKey(), bestDamage: 120, cleared: true, wins: 1 },
    survivalBest: { wave: 8, character: 'Jason', at: Date.UTC(2026, 9, 25) },
  }
}

describe('i18n', () => {
  test('uses Russian by default and English inside withLanguage', () => {
    expect(activeLanguage()).toBe('ru')
    expect(translateText('Профиль')).toBe('Профиль')
    expect(translateText('Профиль', 'en')).toBe('Profile')
    withLanguage('en', () => {
      expect(activeLanguage()).toBe('en')
    })
    withLanguage('ru', () => {
      setActiveLanguage('en')
      expect(activeLanguage()).toBe('en')
    })
  })

  test('translates dynamic battle text', () => {
    expect(translateText('Победил Alice.', 'en')).toBe('Alice wins.')
    expect(translateText('Alice наносит 10 урона: Bob.', 'en')).toBe(
      'Alice deals 10 damage to Bob.',
    )
    expect(translateText('Alice пропускает ход.', 'en')).toBe('Alice skips a turn.')
    expect(translateText('Щит Alice разбивается и спасает от смертельного удара.', 'en')).not.toMatch(
      CYRILLIC,
    )
    expect(translateText('Щит Alice снижает урон.', 'en')).not.toMatch(CYRILLIC)
    for (const message of [
      'Bob: галлюцинация принимает удар.',
      'Mute: первая атака Alice не уворотована.',
      'Shatterpoint: Alice поглощает 10.',
      'Alice: −10% уворота (Natural Malevolence).',
      'Levitation: Alice сбрасывает Slow.',
      'Unpredictable Fate: +10% уворота.',
      'Unstable Toxin: Bob отравлен.',
      'Battery: +15% (40%).',
      '🏅 Испытание: Jason — Ученик (+100 🪙)',
      'До «Адепт»: 3/10',
      'Максимальное испытание',
    ]) {
      expectNoCyrillic(translateText(message, 'en'))
    }
    expect(
      translateText(
        'Alice применяет «Pizza Delivery»: призывает двух пицца-миньонов.',
        'en',
      ),
    ).toBe('Alice uses “Pizza Delivery”: summons two pizza minions.')
    expect(
      translateText(
        'Pizza Minion доставляет пиццу Bob: горение 7×2 и −10% уворота; миньон исчезает.',
        'en',
      ),
    ).toBe(
      'Pizza Minion delivers pizza to Bob: burn 7×2 and −10% dodge; the minion disappears.',
    )
    expect(translateText('Bob уворачивается от доставки пиццы.', 'en')).toBe(
      'Bob evades the pizza delivery.',
    )
    expect(
      translateText('Pizza Minion доставляет пиццу Bob, но эффект не срабатывает.', 'en'),
    ).toBe('Pizza Minion delivers pizza to Bob, but the effect fails.')
    const commands = translateText('Открой /пве и /пвп.', 'en')
    expect(commands).toContain('/pve')
    expect(commands).toContain('/pvp')
  })

  test('translates duel series text', () => {
    expect(translateText('Серия **Bo3** · счёт **1:0**', 'en')).toBe(
      'Series **Bo3** · score **1:0**',
    )
    expect(translateText('Раунд 1: **Alice** · счёт **1:0**.', 'en')).toBe(
      'Round 1: **Alice** · score **1:0**.',
    )
    expect(translateText('Серия окончена: **Alice** побеждает **1:0**.', 'en')).toBe(
      'Series over: **Alice** wins **1:0**.',
    )
  })

  test('translates PvE survival text', () => {
    expect(translateText('Выживание · волна 2 · награда за забег: 30', 'en')).toBe(
      'Survival · wave 2 · run reward: 30',
    )
    expect(translateText('Волна **2** пройдена. HP: **40/100**.', 'en')).toBe(
      'Wave **2** cleared. HP: **40/100**.',
    )
    expect(translateText('Опыт: **+20 XP**.', 'en')).toBe('XP: **+20 XP**.')
    expect(translateText('Забег окончен на волне **2**.', 'en')).toBe(
      'Run ended on wave **2**.',
    )
    expect(translateText('Новый личный рекорд: **5** волн!', 'en')).toBe(
      'New personal best: **5** waves!',
    )
    expect(translateText('Личный рекорд: **5** волн.', 'en')).toBe(
      'Personal best: **5** waves.',
    )
    expect(
      translateText('Личный рекорд: **8** волн · Jason · 2026-10-25', 'en'),
    ).toBe('Personal best: **8** waves · Jason · 2026-10-25')
    expect(translateText('Забег окончен: пройдено волн **2**.', 'en')).toBe(
      'Run ended: **2** waves cleared.',
    )
    expect(translateText('Пройдено волн: **2**. Награда: **+90** 🪙', 'en')).toBe(
      'Waves cleared: **2**. Reward: **+90** 🪙',
    )
    expect(translateText('Топ-10', 'en')).toBe('Top 10')
    expect(translateText('Личного рекорда пока нет.', 'en')).toBe('No personal best yet.')
    expect(translateText('Начать забег', 'en')).toBe('Start run')
    expect(translateText('К рекордам', 'en')).toBe('Records')
    expect(
      translateText('1. <@123456789012345678> — **12** волн · Noob · 2026-10-20', 'en'),
    ).toBe('1. <@123456789012345678> — **12** waves · Noob · 2026-10-20')
  })

  test('renders every main panel without Cyrillic in English', () => {
    withLanguage('en', () => {
      const user = englishUser()
      const character = characterByName('Guest 1337')!
      const panels = [
        profileEmbed('42', user, 'Rsepicus'),
        shopEmbed(user),
        chooseEmbed(user),
        characterEmbed(character, user),
        characterEmbed(characterByName('Veeronica')!, user),
        characterEmbed(characterByName('Jane Doe')!, user),
        questsEmbed(user),
        pvePanelEmbed(),
        trainingSetupEmbed(user, {
          ownerId: '42',
          mode: '2x2',
          playerAbility: 'Slateskin Potion',
          partner: 'Elliot',
          partnerAbility: 'Rush Hour',
          botCharacter: 'Jason',
          botAbility: 'Raging Pace',
          botPartner: 'Guest 1337',
          botPartnerAbility: 'Charge',
        }),
        survivalPanelEmbed(user, {
          '123456789012345678': user,
          '123456789012345679': {
            ...user,
            survivalBest: { wave: 3, character: 'Noob', at: Date.UTC(2026, 8, 1) },
          },
        }),
        achievementsEmbed(user),
        historyEmbed(user),
        topEmbed(),
        cosmeticsEmbed(user),
        bossPanelEmbed(user),
        bossRushPanelEmbed(),
        towerPanelEmbed(),
        trialsPanelEmbed(),
        trialsPanelEmbed(TRIALS[0]),
        bossCoopEmbed('Rsepicus', '2026-W01'),
        bossCoopEmbed('Rsepicus', '2026-W01', '42'),
        settingsEmbed(user),
        helpEmbed(user),
        challengeEmbed('Rsepicus', '42', 100, '2x2'),
        openChallengeEmbed('Rsepicus', 50, '1x1'),
        challengeEmbed('Rsepicus', '42', 0, '1x1', 'random'),
        openChallengeEmbed('Rsepicus', 0, '2x2', 'random'),
        challengeEmbed('Rsepicus', '42', 100, '2x2', 'draft'),
        openChallengeEmbed('Rsepicus', 100, '1x1', 'draft'),
      ]
      for (const panel of panels) expectNoCyrillic(panel.toJSON())

      const components = [
        ...hubComponents(user),
        ...shopComponents(user),
        ...chooseComponents(user),
        ...characterBrowserComponents(false, character, user, true),
        ...questsComponents(user),
        ...pvePanelComponents(),
        ...towerPanelComponents(),
        ...trialsPanelComponents(),
        ...trainingSetupComponents(user, {
          ownerId: '42',
          mode: '2x2',
          playerAbility: 'Slateskin Potion',
          partner: 'Elliot',
          partnerAbility: 'Rush Hour',
          botCharacter: 'Jason',
          botAbility: 'Raging Pace',
          botPartner: 'Guest 1337',
          botPartnerAbility: 'Charge',
        }),
        ...trainingSetupComponents(user, {
          ownerId: '42',
          mode: '2x2',
          page: 'enemies',
          botCharacter: 'Jason',
          botAbility: 'Raging Pace',
          botPartner: 'Guest 1337',
          botPartnerAbility: 'Charge',
        }),
        ...survivalPanelComponents(),
        ...cosmeticsComponents(user),
        ...bossPanelComponents(),
        ...bossRushPanelComponents(),
        ...bossCoopComponents(),
        ...topComponents(0),
        ...openChallengeComponents(),
        ...rematchComponents(),
      ]
      for (const row of components) expectNoCyrillic(row.toJSON())
      expectNoCyrillic(customColorModal('42', null).toJSON())
    })
  })

  test('renders the on-demand forecast without Cyrillic in English', () => {
    withLanguage('en', () => {
      const battle = createBattle(
        { userId: 'a', name: 'Alice', character: characterByName('Noob')! },
        { userId: 'b', name: 'Bob', character: characterByName('Jason')! },
      )
      expectNoCyrillic(
        forecastEmbed(battle, battle.sides[0], ['Alice hits Bob.']).toJSON(),
      )
      expectNoCyrillic(statusEmbed(battle).toJSON())

      const veeronica = createBattle(
        { userId: 'a', name: 'Alice', character: characterByName('Veeronica')! },
        { userId: 'b', name: 'Bob', character: characterByName('Jason')! },
      )
      veeronica.sides[0].hp = 50
      veeronica.sides[0].charge = 30
      for (const row of battleComponents(veeronica)) expectNoCyrillic(row.toJSON())
    })
  })

  test('renders the PvP setup and draft panels without Cyrillic in English', () => {
    withLanguage('en', () => {
      const setup = {
        ownerId: '1',
        ownerName: 'Alice',
        format: '2x2' as const,
        gameMode: 'draft' as const,
        wager: 100,
        createdAt: 1,
      }
      expectNoCyrillic(pvpSetupEmbed(setup).toJSON())
      for (const row of pvpSetupComponents(setup)) expectNoCyrillic(row.toJSON())

      const draft = {
        messageId: 'm',
        channelId: 'c',
        format: '1x1' as const,
        wager: 100,
        pool: CHARACTERS.slice(0, 12),
        players: [
          { userId: 'a', name: 'Alice', bans: [], picks: [], chosen: [], abilities: {} },
          { userId: 'b', name: 'Bob', bans: [], picks: [], chosen: [], abilities: {} },
        ] as [
          { userId: string; name: string; bans: string[]; picks: string[]; chosen: string[] },
          { userId: string; name: string; bans: string[]; picks: string[]; chosen: string[] },
        ],
        phase: 'ban' as const,
        turn: 0 as const,
        banIndex: 0,
        pickIndex: 0,
        pickOrder: draftPickOrder('1x1'),
        chooseIndex: 0,
        abilityIndex: 0,
        createdAt: 1,
      }
      expectNoCyrillic(draftEmbed(draft).toJSON())
      for (const row of draftComponents(draft)) expectNoCyrillic(row.toJSON())
    })
  })

  test('renders a battle and its buttons without Cyrillic in English', () => {
    withLanguage('en', () => {
      let battle = createBattle(
        { userId: 'a', name: 'Alice', character: characterByName('Jason')! },
        { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
      )
      const turn = takeTurn(battle, 'special', () => 0)
      battle = turn.battle
      expectNoCyrillic(battleEmbed(battle, turn.events, 'Note', Date.now() + 90_000).toJSON())
      for (const row of battleComponents(battle)) expectNoCyrillic(row.toJSON())
      expectNoCyrillic(targetComponents(battle, [1])[0].toJSON())
    })
  })

  test('uses English slash-command aliases in English help', () => {
    withLanguage('en', () => {
      const text = String(helpEmbed(englishUser()).toJSON().description)
      expect(text).toContain('/pve')
      expect(text).toContain('/pvp')
      expect(text).toContain('/debug')
      expect(text).not.toContain('/пве')
      expect(text).not.toContain('/пвп')
      expect(text).not.toContain('/дебаг')
    })
  })

  test('wraps interaction replies with the current language', async () => {
    const calls: Array<Record<string, unknown>> = []
    const fake = {
      reply(options: Record<string, unknown>) {
        calls.push(options)
        return Promise.resolve()
      },
    }
    await withLanguage('en', async () => {
      localizeInteraction(fake as never)
      await fake.reply({ content: 'Профиль' })
    })
    expect(calls[0].content).toBe('Profile')
  })

  test('renders finished battle stats in English', () => {
    withLanguage('en', () => {
      const battle = createBattle(
        { userId: 'a', name: 'Alice', character: characterByName('Jason')! },
        { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
      )
      battle.finished = true
      battle.winner = 0
      battle.sides[0].damageDealt = 48
      battle.sides[0].healingDone = 20
      battle.sides[0].abilityUses = 3
      expectNoCyrillic(battleEmbed(battle).toJSON())
    })
  })

  test('translates errors and modal labels', () => {
    const messages = [
      'Такого персонажа нет.',
      'Сначала купи этого персонажа.',
      'Не хватает монет: нужно 900, у тебя 100.',
      'Бонус уже получен. Следующий через 2 ч 5 мин.',
      'Не получилось сменить способность.',
      'Не получилось выбрать.',
      'Не получилось выбрать напарника.',
      'Не получилось купить.',
      'Не получилось заменить квест.',
      'Не получилось применить косметику.',
      'Не получилось сохранить цвет.',
      'Не получилось сменить способность напарника.',
      'Этот вызов уже неактуален.',
      'Это чужая панель.',
      'Это чужая карточка.',
      'Это чужой профиль.',
      'Цвет #ff00aa сохранён.',
      'Нужен HEX-код вида #ff00aa.',
      'Сумма должна быть положительной.',
      'Напарник должен отличаться от активного персонажа.',
      'У этого персонажа нет такой способности.',
      'Этот персонаж уже куплен.',
      'Эта косметика уже куплена.',
      'Сначала купи эту косметику.',
      'Такой косметики нет.',
      'HEX-код цвета',
      'Свой цвет профиля',
      'Нажми, чтобы изменить HEX-цвет',
      'Способность ещё не готова.',
      'Oblation ещё не накоплен.',
      'Бой уже окончен.',
      'Сейчас некому ходить.',
      'В команде должен быть боец.',
      'В команде не может быть больше двух бойцов.',
      'У команды не осталось живых соперников.',
      'Эту цель нельзя атаковать.',
      'У этого бойца нет второй способности.',
      'Ты не участник этого боя.',
    ]
    for (const message of messages) expectNoCyrillic(translateText(message, 'en'))
  })

  test('translates every ability event and status line', () => {
    withLanguage('en', () => {
      for (const character of CHARACTERS) {
        for (const special of availableSpecials(character)) {
          const user = characterWithSpecial(character, special.name)
          let battle = createBattle(
            { userId: 'a', name: 'Alice', character: user },
            { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
          )
          battle.sides[0].hp = 40
          battle.sides[0].charge = 100
          if (character.name === 'Guest 666') battle.sides[0].charge = 2
          for (const row of battleComponents(battle)) expectNoCyrillic(row.toJSON())
          const events: string[] = []
          let current = battle
          try {
            const turn = takeTurn(current, 'special', () => 0)
            current = turn.battle
            events.push(...turn.events, ...turn.notices)
          } catch {
            // Some specials need a different setup; the generic status test below still covers them.
          }
          for (let index = 0; index < 4 && !current.finished; index++) {
            const turn = takeTurn(current, index % 2 === 0 ? 'rest' : 'attack', () => 0)
            current = turn.battle
            events.push(...turn.events, ...turn.notices)
          }
          for (const event of events) expectNoCyrillic(translateText(event, 'en'))
          expectNoCyrillic(battleEmbed(current, events, 'Result').toJSON())
        }
      }
    })
  })

  test('translates synergy panels and mastery badges', () => {
    withLanguage('en', () => {
      const battle = createTeamBattle(
        [
          { userId: 'a', name: 'Alice', character: characterByName('007n7')! },
          { userId: 'a', name: 'Alice 2', character: characterByName('c00lkidd')! },
        ],
        [
          { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
          { userId: 'b', name: 'Bob 2', character: characterByName('Jason')! },
        ],
      )
      expectNoCyrillic(battleEmbed(battle).toJSON())
      expectNoCyrillic(forecastEmbed(battle, battle.sides[0]).toJSON())
      for (const line of [
        '**Синергия:** **Plead** — Когда один уворачивается, второй получает +10% уворота на 1 ход (до +20%).',
        'Plead: Alice +10% уворота.',
        'Survival for the Fittest: Alice и Bob +10% уворота на 2 хода.',
        'You and I: Alice +2 HP.',
        'Creation of Hatred: +2 урона.',
        'Dead Ringer: Alice +10% уворота на 2 хода.',
        'And the Seraphim Wept: Oblation 40%.',
      ]) {
        expectNoCyrillic(translateText(line, 'en'))
      }
      const user = {
        ...defaultUser(),
        language: 'en' as const,
        owned: ['Noob', 'Jason'],
        characterStats: { Jason: { wins: 1, losses: 0, xp: 900 } },
        equippedSkins: { Jason: 'jason-gold' },
      }
      expectNoCyrillic(characterEmbed(characterByName('Jason')!, user).toJSON())
    })
  })
})
