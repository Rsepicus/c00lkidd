import { describe, expect, test } from 'bun:test'
import {
  achievementsEmbed,
  resolveToken,
  BATTLE_TURN_MS,
  battleComponents,
  battleEmbed,
  battleReward,
  battleStatsText,
  battleTurnLanguage,
  bossCoopComponents,
  bossCoopEmbed,
  bossCoopRematchComponents,
  bossPanelComponents,
  bossPanelEmbed,
  coopBossBattle,
  timeoutForfeits,
  challengeReplyOptions,
  challengeText,
  characterBrowserComponents,
  characterEmbed,
  chooseComponents,
  chooseEmbed,
  commandDefinitions,
  cosmeticsComponents,
  cosmeticsEmbed,
  debugPanelComponents,
  debugPanelEmbed,
  debugStatusEmbed,
  debugTestComponents,
  debugTestEmbed,
  draftComponents,
  draftEmbed,
  draftPickOrder,
  draftPool,
  forecastEmbed,
  guideEmbed,
  helpEmbed,
  historyEmbed,
  hubComponents,
  languagePickerComponents,
  languagePickerEmbed,
  onboardingEmbed,
  shouldPromptLanguage,
  openChallengeComponents,
  openChallengeEmbed,
  parseBattleMode,
  parseToken,
  partnerCharacter,
  profileEmbed,
  pveBossComponents,
  pvePanelComponents,
  pvePanelEmbed,
  pvpSetupComponents,
  pvpSetupEmbed,
  questsComponents,
  randomBattleFor,
  recordSurvivalWave,
  questsEmbed,
  rematchComponents,
  settingsComponents,
  settingsEmbed,
  shopComponents,
  shopEmbed,
  trainingSetupComponents,
  trainingSetupEmbed,
  targetComponents,
  teamLabel,
  topEmbed,
  userCharacterEmojiData,
  userCharacterLabel,
} from './bot'
import { bossCharacter } from './boss'
import { buyCosmetic } from './cosmetics'
import {
  availableSpecials,
  CHARACTERS,
  characterByName,
  characterWithSpecial,
} from './forsaken'
import { addRottenMinion, createBattle, createTeamBattle, takeTurn } from './pvp'
import { defaultUser } from './store'

describe('parseToken', () => {
  test('returns the token from the env file contents', () => {
    expect(parseToken('DISCORD_BOT_TOKEN=abc123\n')).toBe('abc123')
  })

  test('ignores comments and blank lines', () => {
    const env = '# Discord bot credentials\n\nDISCORD_BOT_TOKEN=abc123\n'
    expect(parseToken(env)).toBe('abc123')
  })

  test('throws a clear error when the token line is absent', () => {
    expect(() => parseToken('SOMETHING=else\n')).toThrow('DISCORD_BOT_TOKEN')
  })

  test('throws when the token is empty', () => {
    expect(() => parseToken('DISCORD_BOT_TOKEN=\n')).toThrow('DISCORD_BOT_TOKEN')
  })

  test('prefers the environment token for hosting', () => {
    expect(resolveToken('from-env', 'DISCORD_BOT_TOKEN=from-file\n')).toBe('from-env')
  })

  test('falls back to the .env file when the environment is empty', () => {
    expect(resolveToken(undefined, 'DISCORD_BOT_TOKEN=from-file\n')).toBe('from-file')
    expect(resolveToken('  ', 'DISCORD_BOT_TOKEN=from-file\n')).toBe('from-file')
  })

  test('throws if neither the environment nor .env has a token', () => {
    expect(() => resolveToken(undefined, null)).toThrow('DISCORD_BOT_TOKEN')
  })
})

describe('embeds', () => {
  test('profile is a framed embed with stat fields', () => {
    const embed = profileEmbed('42', defaultUser()).toJSON()
    expect(embed.title).toContain('Профиль')
    expect(embed.fields).toHaveLength(10)
    expect(embed.color).toBeDefined()
  })

  test('profile shows the active partner', () => {
    const fields = profileEmbed('42', defaultUser()).toJSON().fields ?? []
    const partner = fields.find(field => field.name === 'Напарник')
    expect(partner?.value).toContain('Jason')

    const solo = profileEmbed('42', { ...defaultUser(), owned: ['Noob'] }).toJSON().fields ?? []
    expect(solo.find(field => field.name === 'Напарник')?.value).toBe('—')
  })

  test('profile shows the nickname instead of a mention', () => {
    const embed = profileEmbed('42', defaultUser(), 'Rsepicus').toJSON()
    expect(embed.description).toContain('**Rsepicus**')
    expect(embed.description).not.toContain('<@42>')
  })

  test('profile shows the favorite character and mastery', () => {
    const user = {
      ...defaultUser(),
      characterStats: { Jason: { wins: 2, losses: 1, xp: 120 } },
    }
    const names = profileEmbed('42', user).toJSON().fields?.map(field => field.name) ?? []
    expect(names.some(name => name.includes('Любимый'))).toBe(true)
    expect(names.some(name => name.includes('Мастерство'))).toBe(true)
  })

  test('cosmetics panel lists profile colors and a select menu', () => {
    const embed = cosmeticsEmbed(defaultUser()).toJSON()
    expect(embed.title).toContain('Косметика')
    expect(embed.description).toContain('Цвета профиля')
    expect(embed.description).toContain('Свой цвет')
    const options = cosmeticsComponents(defaultUser())
      .flatMap(row => row.toJSON().components)
      .find(component => component.custom_id === 'cosmetics:item')?.options
    expect(options?.length).toBeGreaterThan(4)
    expect(options?.some(option => option.value === 'accent_custom')).toBe(true)
  })

  test('a VIP title shows its own icon in the profile', () => {
    const user = buyCosmetic({ ...defaultUser(), coins: 3000 }, 'title_vip')
    const description = String(profileEmbed('42', user, 'Rsepicus').toJSON().description)
    expect(description).toContain('V.I.P.')
    expect(description).toContain('<:vip:')
  })

  test('a Spectre title shows its own icon in the profile', () => {
    const user = buyCosmetic({ ...defaultUser(), coins: 3000 }, 'title_forsaken')
    const description = String(profileEmbed('42', user, 'Rsepicus').toJSON().description)
    expect(description).toContain('Spectre')
    expect(description).toContain('<:spectre:')
  })

  test('settings panel switches interface language', () => {
    expect(settingsEmbed(defaultUser()).toJSON().title).toContain('Настройки')
    const options = settingsComponents(defaultUser())[0].toJSON().components[0].options
    expect(options?.map(option => option.value)).toEqual(['ru', 'en'])
  })

  test('help panel lists the commands', () => {
    const description = String(helpEmbed(defaultUser()).toJSON().description)
    expect(description).toContain('/профиль')
    expect(description).toContain('/settings')
    expect(description).toContain('/команды')
    expect(description).toContain('/пве')
    expect(description).not.toContain('/тест')
  })

  test('help and guide keep their content separate', () => {
    const help = String(helpEmbed(defaultUser()).toJSON().description)
    const guide = String(guideEmbed().toJSON().description)
    expect(help).not.toContain('**Бой**')
    expect(help).not.toContain('Уворот: у всех')
    expect(guide).not.toContain('**Команды**')
    expect(guide).not.toContain('/профиль')
  })

  test('English language uses English ability descriptions', () => {
    const user = { ...defaultUser(), language: 'en' as const }
    const description = characterEmbed(characterByName('Guest 1337')!, user).toJSON().fields
      ?.find(field => field.name.includes('Способность'))?.value
    expect(description).toContain('Protects the chosen ally')
  })

  test('finished battles offer a rematch button', () => {
    const button = rematchComponents()[0].toJSON().components[0]
    expect(button.custom_id).toBe('pvp:rematch')
    expect(button.label).toContain('Реванш')
  })

  test('battle header shows the total dodge chance next to each name', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description.match(/уворот 0%/g)).toHaveLength(2)
  })

  test('dodge button adds 60% and the active header shows the active total', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const juke = battleComponents(battle)[0]
      .toJSON()
      .components.find(component => component.custom_id === 'pvp:juke')
    expect(juke?.label).toContain('Уворот +60%')
    battle.sides[0].juking = true
    expect(String(battleEmbed(battle).toJSON().description)).toContain(
      'уворот 60% (активен)',
    )
  })

  test('battle HP bar uses the health icon', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Jason')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    expect(String(battleEmbed(battle).toJSON().description)).toContain('<:hp:')
  })

  test('battle offers an on-demand forecast with combat details', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const rows = battleComponents(battle)
    expect(rows).toHaveLength(2)
    const forecast = rows[1]
      .toJSON()
      .components.find(component => component.custom_id === 'pvp:forecast')
    expect(forecast?.label).toBe('Прогноз')

    const embed = forecastEmbed(battle, battle.sides[0]).toJSON()
    expect(embed.title).toContain('Прогноз')
    expect(embed.description).toContain('HP 100/100')
    expect(embed.description).toContain('атака 11–15')
    expect(embed.description).toContain('уворот 0%')
    expect(embed.description).toContain('Цели:')
    expect(embed.description).toContain('Jason')
  })

  test('forecast includes the recent battle log', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const embed = forecastEmbed(battle, battle.sides[0], [
      'A бьёт B.',
      'B уворачивается.',
    ]).toJSON()
    expect(embed.description).toContain('Лог боя:')
    expect(embed.description).toContain('A бьёт B')
  })

  test('negative dodge modifiers are visible in the battle header', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    battle.sides[0].jukeMods.push({ source: 'Nova', amount: -0.25, turns: 2 })
    expect(String(battleEmbed(battle).toJSON().description)).toContain(
      'уворот 0% · штраф −25%',
    )
  })

  test('battle buttons are split into two symmetrical rows', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const rows = battleComponents(battle).map(row =>
      row.toJSON().components.map(button => button.custom_id),
    )
    expect(rows).toEqual([
      ['pvp:attack', 'pvp:special', 'pvp:juke'],
      ['pvp:rest', 'pvp:forecast', 'pvp:surrender'],
    ])
  })

  test('forecast includes the full status and dodge breakdown', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    const forecast = battleComponents(battle)[1]
      .toJSON()
      .components.find(component => component.custom_id === 'pvp:forecast')
    expect(forecast?.emoji?.name).toBe('question')

    battle.sides[0].juking = true
    battle.sides[0].jukingTurns = 2
    const embed = forecastEmbed(battle, battle.sides[0]).toJSON()
    expect(embed.description).toContain('Статусы:')
    expect(embed.description).toContain('Уворот')
    expect(embed.description).toContain('стойка +60% (2)')

    battle.sides[1].effects.weakness = 2
    battle.sides[0].purified = true
    battle.sides[0].dotTurns = 2
    const explained = forecastEmbed(battle, battle.sides[0]).toJSON()
    expect(explained.description).toContain('Расшифровка эффектов:')
    expect(explained.description).toContain('WEAK — −20% к наносимому урону.')
    expect(explained.description).toContain('PURIFIED —')
    expect(explained.description).toContain('DoT —')
  })

  test('compact mode shortens the profile and guide', () => {
    const compact = { ...defaultUser(), compactMode: true }
    const profile = profileEmbed('42', compact).toJSON()
    expect(profile.fields).toHaveLength(9)
    expect(String(profile.fields?.map(field => field.name))).not.toContain('Витрина')
    const guide = String(guideEmbed(compact).toJSON().description)
    expect(guide).toContain('Режимы')
    expect(guide).not.toContain('Draft** — a shared pool')
    const settingsRows = settingsComponents(compact).map(row => row.toJSON().components)
    expect(settingsRows[1][0].custom_id).toBe('settings:compact')
  })

  test('2v2 synergy is shown in the battle and forecast panels', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'A', character: characterByName('007n7')! },
        { userId: 'a', name: 'A2', character: characterByName('c00lkidd')! },
      ],
      [
        { userId: 'b', name: 'B', character: characterByName('Noob')! },
        { userId: 'b', name: 'B2', character: characterByName('Jason')! },
      ],
    )
    const embed = battleEmbed(battle).toJSON()
    expect(embed.description).toContain('Синергия')
    expect(embed.description).toContain('Plead')
    expect(forecastEmbed(battle, battle.sides[0]).toJSON().description).toContain('Plead')
  })

  test('groups rotten minions in the battle and target panels', () => {
    const battle = createBattle(
      { userId: 'a', name: 'Alice', character: characterByName('1x1x1x1')! },
      { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
    )
    const minion = addRottenMinion(battle, battle.sides[0], {
      hp: 25,
      maxHp: 25,
      attack: 3,
    })
    const embed = battleEmbed(battle).toJSON()
    expect(String(embed.description)).toContain('Миньоны')
    expect(battleStatsText(battle)).toContain('Миньоны')
    const target = targetComponents(battle, [minion.id])[0].toJSON().components[0]
    expect(target.custom_id).toBe('pvp:target:minions')
  })

  test('groups pizza minions separately in the battle panel', () => {
    const battle = createBattle(
      { userId: 'a', name: 'Alice', character: characterByName('c00lkidd')! },
      { userId: 'b', name: 'Bob', character: characterByName('Noob')! },
    )
    const summoned = takeTurn(battle, 'special', () => 0).battle
    const embed = battleEmbed(summoned).toJSON()
    expect(String(embed.description)).toContain('Пицца-миньоны')
    expect(battleStatsText(summoned)).toContain('Пицца-миньоны')

    const minion = summoned.sides.find(side => side.pizzaMinion)!
    const target = targetComponents(summoned, [minion.id])[0].toJSON().components[0]
    expect(target.custom_id).toBe('pvp:target:minions')
  })

  test('character card shows the mastery milestone badge', () => {
    const user = {
      ...defaultUser(),
      characterStats: { Jason: { wins: 1, losses: 0, xp: 200 } },
    }
    const embed = characterEmbed(characterByName('Jason')!, user).toJSON()
    const mastery = embed.fields?.find(field => field.name.includes('Мастерство'))
    expect(mastery?.value).toContain('Бронза')
  })

  test('character card shows the equipped gold skin', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
      equippedSkins: { Jason: 'jason-gold' },
    }
    const embed = characterEmbed(characterByName('Jason')!, user).toJSON()
    const skin = embed.fields?.find(field => String(field.name).includes('Скин'))
    expect(skin?.value).toContain('Золотой Jason')
    expect(skin?.value).toContain('<:jason_gold:')
  })

  test('character browser offers only unlocked skins', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      characterStats: { Jason: { wins: 0, losses: 0, xp: 900 } },
      equippedSkins: { Jason: 'jason-gold' },
    }
    const select = characterBrowserComponents(
      false,
      characterByName('Jason')!,
      user,
      true,
    )
      .flatMap(row => row.toJSON().components)
      .find(component => component.custom_id?.startsWith('char:skin:'))
    expect(select?.options?.map(option => option.value)).toEqual([
      'jason-bronze',
      'jason-silver',
      'jason-gold',
      'none',
    ])
  })

  test('uses the equipped mastery skin in every user-facing character label', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason'],
      active: 'Jason',
      partner: 'Noob',
      characterStats: { Jason: { wins: 5, losses: 0, xp: 900 } },
      equippedSkins: { Jason: 'jason-gold' },
    }
    expect(userCharacterLabel(user, 'Jason')).toContain('<:jason_gold:')
    expect(userCharacterEmojiData(user, 'Jason')?.name).toBe('jason_gold')
    expect(userCharacterLabel(user, 'Noob')).toContain('<:noob:')
    expect(userCharacterEmojiData(user, 'Noob')?.name).toBe('noob')

    const profile = profileEmbed('1', user, 'Tester').toJSON()
    const field = (name: string) =>
      String(profile.fields?.find(entry => entry.name.includes(name))?.value ?? '')
    expect(field('Активный')).toContain('<:jason_gold:')
    expect(field('Напарник')).toContain('<:noob:')
    expect(field('Любимый персонаж')).toContain('<:jason_gold:')
    expect(field('Любимый персонаж')).not.toContain('Золотой Jason')
    expect(field('Мастерство')).toContain('<:jason_gold:')
    expect(field('Мастерство')).not.toContain('Золотой Jason')

    expect(characterEmbed(characterByName('Jason')!, user).toJSON().title).toContain(
      '<:jason_gold:',
    )
    expect(String(shopEmbed(user).toJSON().description)).toContain('<:jason_gold:')
    expect(String(trainingSetupEmbed(user, { ownerId: '1', mode: '1x1' }).toJSON().description))
      .toContain('<:jason_gold:')

    const chooseOption = chooseComponents(user)
      .flatMap(row => row.toJSON().components)
      .find(component => component.custom_id === 'hub:select')
      ?.options?.find(option => option.value === 'Jason')
    expect(chooseOption?.emoji?.name).toBe('jason_gold')

    const browserOption = characterBrowserComponents(
      false,
      characterByName('Jason')!,
      user,
      true,
    )
      .flatMap(row => row.toJSON().components)
      .find(component => component.custom_id === 'char:view')
      ?.options?.find(option => option.value === 'Jason')
    expect(browserOption?.emoji?.name).toBe('jason_gold')

    const chooseButton = hubComponents(user)[0]
      .toJSON()
      .components.find(component => component.custom_id === 'hub:choose')
    expect(chooseButton?.emoji?.name).toBe('jason_gold')
  })

  test('battle cooldown display shows remaining and base cooldown', () => {
    const azure = characterWithSpecial(characterByName('Azure')!, 'Stigmatize')
    let battle = createBattle(
      { userId: 'a', name: 'Azure', character: azure },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain('КД 2/3')
  })

  test('Observant description includes its three-turn cooldown once', () => {
    const abilities = String(
      characterEmbed(characterByName('Noli')!, defaultUser()).toJSON().fields?.find(field =>
        String(field.name).includes('Способность'),
      )?.value,
    )
    const observant = abilities.split('\n').find(line => line.includes('Observant')) ?? ''
    expect(observant).toContain('КД: 3 хода')
    expect((observant.match(/КД: 3/g) ?? []).length).toBe(1)
  })

  test('Observant fake Noli is shown but excluded from the team label and stats', () => {
    const noli = characterWithSpecial(characterByName('Noli')!, 'Observant')
    let battle = createBattle(
      { userId: 'a', name: 'A', character: noli },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    expect(battle.sides).toHaveLength(3)
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description.match(/<:noli:/g)?.length).toBe(2)
    expect(teamLabel(battle, 0)).toBe('A (Noli)')
    expect(
      battleStatsText(battle)
        .split('\n')
        .filter(line => line.includes('**A**')),
    ).toHaveLength(1)
  })

  test('the ability button shows the remaining cooldown', () => {
    let battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Elliot')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    const button = battleComponents(battle)[0]
      .toJSON()
      .components.find(component => component.custom_id === 'pvp:special')
    expect(button?.label).toContain('Pizza Throw · КД 2/3')
    expect(button?.disabled).toBe(true)
  })

  test('the turn deadline timestamp is rendered in the description, not the footer', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Jason')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    const deadline = Date.now() + 90_000
    const embed = battleEmbed(battle, [], undefined, deadline).toJSON()
    const stamp = `<t:${Math.floor(deadline / 1000)}:R>`
    expect(String(embed.description)).toContain(stamp)
    expect(String(embed.footer?.text)).not.toContain('<t:')
  })

  test('an open challenge can be accepted by anyone with one button', () => {
    const embed = openChallengeEmbed('Rsepicus', 100, '2x2').toJSON()
    expect(embed.title).toContain('Открытый вызов')
    expect(embed.description).toContain('любой')
    expect(embed.description).toContain('100')
    expect(embed.description).toContain('2 на 2')

    const buttons = openChallengeComponents()[0].toJSON().components
    expect(buttons.map(button => button.custom_id)).toEqual([
      'pvp:open:accept',
      'pvp:open:cancel',
    ])
  })

  test('/пвп works without a specific opponent', () => {
    const command = commandDefinitions().find(entry => entry.name === 'пвп')!.toJSON()
    const opponent = command.options?.find(option => option.name === 'соперник')
    expect(opponent?.required).toBe(false)
  })

  test('random challenges advertise rolled characters and stake-only rewards', () => {
    const embed = openChallengeEmbed('Rsepicus', 0, '2x2', 'random').toJSON()
    expect(embed.title).toContain('Случайный вызов')
    expect(embed.description).toContain('выпадут при принятии')
    expect(embed.description).not.toContain('только из ставки')
    expect(embed.description).toContain('2 на 2')
    expect(embed.description).not.toContain('Ставка')

    const direct = challengeReplyOptions('Rsepicus', '42', 0, '1x1', 'random').embeds[0].toJSON()
    expect(direct.title).toContain('Случайный вызов')
    expect(direct.description).toContain('на случайный бой')
    expect(direct.description).not.toContain('Ставка')

    const staked = openChallengeEmbed('Rsepicus', 100, '1x1', 'random').toJSON()
    expect(staked.description).toContain('Ставка')
    expect(staked.description).toContain('100')
  })

  test('random battles roll distinct characters and valid abilities', () => {
    let state = 42
    const rng = () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 4294967296
    }
    const solo = randomBattleFor(
      '1x1',
      { userId: 'a', name: 'A' },
      { userId: 'b', name: 'B' },
      rng,
    )
    expect(solo.sides).toHaveLength(2)
    expect(solo.sides.map(side => side.userId)).toEqual(['a', 'b'])
    expect(new Set(solo.sides.map(side => side.character.name)).size).toBe(2)

    const duo = randomBattleFor(
      '2x2',
      { userId: 'a', name: 'A' },
      { userId: 'b', name: 'B' },
      rng,
    )
    expect(duo.sides).toHaveLength(4)
    expect(new Set(duo.sides.map(side => side.character.name)).size).toBe(4)
    for (const side of duo.sides) {
      const base = characterByName(side.character.name)!
      const specials = availableSpecials(base).map(special => special.name)
      expect(specials).toContain(side.character.special.name)
    }
  })

  test('boss panel shows both abilities, weekly damage and three fight buttons', () => {
    const embed = bossPanelEmbed(defaultUser(), Date.UTC(2026, 0, 1)).toJSON()
    expect(embed.title).toContain('Босс недели')
    const fields = embed.fields?.map(field => field.name).join(' ') ?? ''
    expect(fields).toContain('Способность 1')
    expect(fields).toContain('Способность 2')
    expect(fields).not.toContain('Твой рекорд')
    expect(String(embed.description)).not.toContain('Модификатор')

    const buttons = bossPanelComponents()[0].toJSON().components
    expect(buttons.map(button => button.custom_id)).toEqual([
      'boss:start:1x1',
      'boss:start:2x2',
      'boss:coop',
    ])
  })

  test('co-op boss invite and battle bring two different players', () => {
    const embed = bossCoopEmbed('Rsepicus', '2026-W01').toJSON()
    expect(embed.title).toContain('Совместный босс')
    expect(embed.description).toContain('второго игрока')
    const targeted = bossCoopEmbed('Rsepicus', '2026-W01', '42').toJSON()
    expect(targeted.description).toContain('<@42>')
    expect(targeted.description).toContain('приглашает')
    expect(bossCoopComponents()[0].toJSON().components.map(button => button.custom_id)).toEqual([
      'boss:coop:accept',
      'boss:coop:cancel',
    ])
    expect(
      bossCoopRematchComponents()[0].toJSON().components[0].custom_id,
    ).toBe('boss:coop:again')

    const battle = coopBossBattle(
      { userId: 'a', name: 'A', character: characterByName('Noob')! },
      { userId: 'b', name: 'B', character: characterByName('Elliot')! },
      '2026-W01',
    )
    expect(battle.sides).toHaveLength(3)
    expect(battle.sides.filter(side => side.team === 0).map(side => side.userId)).toEqual([
      'a',
      'b',
    ])
    expect(battle.sides.filter(side => side.team === 1).every(side => side.boss)).toBe(true)
    battle.sides.find(side => side.userId === 'a')!.damageDealt = 12
    battle.sides.find(side => side.userId === 'b')!.damageDealt = 7
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain('Урон: A: **12** · B: **7**')
  })

  test('boss battle displays both of its abilities', () => {
    const boss = bossCharacter('1x1', '2026-W01')
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Jason')! },
      { userId: 'boss:1', name: 'БОСС', character: boss, boss: true },
    )
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain(boss.special.name)
    expect(description).toContain(boss.alternates![0].name)
  })

  test('turn timer forfeits only after two timeouts', () => {
    expect(BATTLE_TURN_MS).toBe(90_000)
    expect(timeoutForfeits(1)).toBe(false)
    expect(timeoutForfeits(2)).toBe(true)
  })

  test('finished battles show damage, healing, abilities and an MVP', () => {
    let battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Jason')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    battle = takeTurn(battle, 'attack', () => 0).battle
    battle.finished = true
    battle.winner = 0

    expect(battleStatsText(battle)).toContain('урона')
    expect(battleStatsText(battle)).toContain('лечения')
    expect(battleStatsText(battle)).toContain('способностей')
    expect(battleStatsText(battle)).toContain('MVP')
    const field = battleEmbed(battle).toJSON().fields?.find(entry => entry.name === 'Итоги')
    expect(field?.value).toContain('MVP')
  })

  test('battle HP bar handles overheal above max HP', () => {
    const battle = createBattle(
      { userId: 'a', name: 'A', character: characterByName('Jason')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    battle.sides[0].hp = 110

    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain('110/100')
  })

  test('a 2v2 battle shows both fighters of each team and the winning team', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'A', character: characterByName('Helperbot')! },
        { userId: 'a', name: 'A', character: characterByName('Jason')! },
      ],
      [
        { userId: 'b', name: 'B', character: characterByName('Noob')! },
        { userId: 'b', name: 'B', character: characterByName('Elliot')! },
      ],
    )
    battle.sides[1].hp = 0
    battle.sides[3].hp = 0
    battle.finished = true
    battle.winner = 0

    const embed = battleEmbed(battle).toJSON()
    expect(embed.description).toContain('Helperbot')
    expect(embed.description).toContain('Jason')
    expect(embed.description).toContain('Elliot')
    expect(embed.description).not.toContain('напарник')
    expect(embed.footer?.text).toContain('Победила команда')
  })

  test('2v2 target buttons point at the selected enemy sides', () => {
    const battle = createTeamBattle(
      [
        { userId: 'a', name: 'A', character: characterByName('Jason')! },
        { userId: 'a', name: 'A', character: characterByName('Noob')! },
      ],
      [
        { userId: 'b', name: 'B', character: characterByName('Helperbot')! },
        { userId: 'b', name: 'B', character: characterByName('Elliot')! },
      ],
    )
    const buttons = targetComponents(battle, [1, 3])[0].toJSON().components
    expect(buttons.map(button => button.custom_id)).toEqual([
      'pvp:target:1',
      'pvp:target:3',
      'pvp:target:cancel',
    ])
    expect(buttons[0].label).toContain('Helperbot')
    expect(buttons[0].label).toContain('B')
    expect(buttons[1].label).toContain('Elliot')
  })

  test('Haste makes the special button available a turn earlier', () => {
    const helper = characterWithSpecial(characterByName('Helperbot')!, 'Inspiration')
    let battle = createBattle(
      { userId: 'a', name: 'A', character: helper },
      { userId: 'b', name: 'B', character: characterByName('Jason')! },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'rest', () => 0).battle

    const button = battleComponents(battle)[0]
      .toJSON()
      .components.find(component => component.custom_id === 'pvp:special')
    expect(button?.disabled).toBe(false)
  })

  test('counter status uses the yellow Guestpunch icon and hides the block', () => {
    let battle = createBattle(
      { userId: 'a', name: 'Guest', character: characterByName('Guest 1337')! },
      { userId: 'b', name: 'Jason', character: characterByName('Jason')! },
    )
    battle = takeTurn(battle, 'special', () => 0).battle
    battle = takeTurn(battle, 'attack', () => 0).battle
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain('<:guestpunch:')
    expect(description).not.toContain('блок')
  })

  test('shop is one character list with killers before survivors', () => {
    const embed = shopEmbed(defaultUser()).toJSON()
    expect(embed.title).toContain('Магазин')
    expect(embed.fields).toBeUndefined()
    const value = String(embed.description)
    expect(value).not.toContain('Киллеры')
    expect(value).not.toContain('Выжившие')
    const killers = ['Jason', 'c00lkidd', 'John Doe', 'Noli', '1x1x1x1']
    const positions = killers.map(name => value.indexOf(name))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    expect(value.indexOf('Noob')).toBeGreaterThan(value.indexOf('Jason'))
  })

  test('shop prices use the custom coin and the footer stays text-only', () => {
    const embed = shopEmbed(defaultUser()).toJSON()
    expect(String(embed.description)).toContain('<:points:')
    expect(String(embed.description)).not.toContain('🪙')
    const footer = embed.footer?.text
    expect(footer).toBe('Баланс: 500')
  })

  test('simulator name is used in the profile and character footers', () => {
    expect(profileEmbed('42', defaultUser()).toJSON().footer?.text).toBe('Forsaken Simulator')
    expect(characterEmbed(characterByName('Jason')!, defaultUser()).toJSON().footer?.text).toBe(
      'Forsaken Simulator',
    )
  })

  test('shop keeps the note above the character list', () => {
    const description = String(shopEmbed(defaultUser(), 'note').toJSON().description)
    expect(description.startsWith('note\n\n')).toBe(true)
    expect(description).toContain('Jason')
  })

  test('main panels render without standard Discord emoji', () => {
    const user = defaultUser()
    const panels = [
      shopEmbed(user),
      profileEmbed('42', user),
      topEmbed(),
      historyEmbed(user),
      cosmeticsEmbed(user),
      achievementsEmbed(user),
      questsEmbed(user),
      characterEmbed(characterByName('Jason')!, user),
      helpEmbed(user),
      settingsEmbed(user),
      bossPanelEmbed(user),
    ]
    for (const panel of panels) {
      expect(JSON.stringify(panel.toJSON())).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  test('guide explains modes, statuses and progression', () => {
    const embed = guideEmbed()
    const description = String(embed.toJSON().description)
    expect(String(embed.toJSON().title)).toContain('Гайд')
    expect(description).toContain('Классика')
    expect(description).toContain('WEAK')
    expect(description).toContain('Plead')
    expect(description).toContain('Мастерство')
    expect(description).toContain('недельный квест')
  })

  test('onboarding explains the first steps', () => {
    const embed = onboardingEmbed().toJSON()
    expect(embed.title).toContain('Добро пожаловать')
    expect(embed.description).toContain('/профиль')
    expect(embed.description).toContain('/пвп')
    expect(embed.description).toContain('/пве')
  })

  test('English onboarding points at English command aliases', () => {
    const embed = onboardingEmbed({ ...defaultUser(), language: 'en' }).toJSON()
    expect(embed.title).toContain('Welcome')
    expect(embed.description).toContain('/profile')
    expect(embed.description).toContain('/pvp')
    expect(embed.description).toContain('/pve')
    expect(embed.description).toContain('/guide')
    expect(embed.description).toContain('/commands')
    const withNote = onboardingEmbed(
      { ...defaultUser(), language: 'en' },
      'Now press the same button again to continue.',
    ).toJSON()
    expect(withNote.description).toContain('Now press the same button again')
  })

  test('first-use language picker offers Russian and English', () => {
    expect(String(languagePickerEmbed().toJSON().title)).toContain('Choose language')
    const ids = languagePickerComponents()[0]
      .toJSON()
      .components.map(component => component.custom_id)
    expect(ids).toEqual(['onboarding:lang:ru', 'onboarding:lang:en'])
  })

  test('prompts a new player for language before accepting a challenge', () => {
    expect(shouldPromptLanguage(defaultUser(), 'pvp:accept')).toBe(true)
    expect(shouldPromptLanguage(defaultUser(), 'pvp:open:accept')).toBe(true)
    expect(shouldPromptLanguage(defaultUser(), 'onboarding:lang:en')).toBe(false)
    expect(shouldPromptLanguage({ ...defaultUser(), onboarded: true }, 'pvp:accept')).toBe(false)
  })

  test('PvE menu has boss, training and survival buttons', () => {
    expect(pvePanelEmbed().toJSON().title).toContain('PvE')
    const buttons = pvePanelComponents()[0]
      .toJSON()
      .components.map(component => component.custom_id)
    expect(buttons).toEqual(['pve:boss', 'pve:training', 'pve:survival'])

    const rows = pveBossComponents().map(row => row.toJSON())
    expect(rows[0].components.map(component => component.custom_id)).toEqual([
      'boss:start:1x1',
      'boss:start:2x2',
      'boss:coop',
    ])
    expect(rows[1].components[0].custom_id).toBe('pve:boss:invite')
  })

  test('debug panel exposes coins and balance test', () => {
    expect(debugPanelEmbed().toJSON().title).toContain('Дебаг')
    const buttons = debugPanelComponents()[0]
      .toJSON()
      .components.map(component => component.custom_id)
    expect(buttons).toEqual(['debug:coins', 'debug:test', 'debug:status'])

    const setup = {
      ownerId: '1',
      mode: '1x1' as const,
      character: 'Jason',
      special: 'Gashing Wound',
      battlesPerPair: 50,
    }
    const description = String(debugTestEmbed(setup).toJSON().description)
    expect(description).toContain('Jason')
    expect(description).toContain('Gashing Wound')
    expect(description).toContain('50 боёв на пару')
    const rows = debugTestComponents(setup).map(row =>
      row.toJSON().components.map(component => component.custom_id),
    )
    expect(rows).toEqual([
      ['debug:test:mode'],
      ['debug:test:character'],
      ['debug:test:special'],
      ['debug:test:battles'],
      ['debug:test:start', 'debug:menu'],
    ])
    const battlesMenu = debugTestComponents(setup)[3].toJSON().components[0] as {
      options: Array<{ value: string; default?: boolean }>
    }
    expect(battlesMenu.options.map(option => option.value)).toEqual([
      '5',
      '10',
      '30',
      '50',
      '100',
      '200',
    ])
    expect(battlesMenu.options.find(option => option.value === '50')?.default).toBe(true)
  })

  test('training setup offers a bot character and a format', () => {
    const setup = { ownerId: '1', mode: '2x2' as const, botCharacter: 'Jason' }
    const embed = trainingSetupEmbed(defaultUser(), setup).toJSON()
    expect(embed.description).toContain('Jason')
    expect(embed.description).toContain('2 на 2')
    const rows = trainingSetupComponents(defaultUser(), setup).map(row =>
      row.toJSON().components.map(component => component.custom_id),
    )
    expect(rows).toEqual([
      ['pve:training:character'],
      ['pve:training:mode'],
      ['pve:training:start', 'pve:menu'],
    ])
  })

  test('leaders is an embed', () => {
    expect(topEmbed().toJSON().title).toContain('Лидеры')
  })

  test('achievements, quests and history are embeds', () => {
    expect(achievementsEmbed(defaultUser()).toJSON().title).toContain('Достижения')
    expect(questsEmbed(defaultUser()).toJSON().title).toContain('квест')
    expect(historyEmbed(defaultUser()).toJSON().title).toContain('История')
  })

  test('daily quests list three goals and an assigned character', () => {
    const description = String(questsEmbed(defaultUser()).toJSON().description)
    expect(description).toMatch(/Noob|Jason|Shedletsky|Elliot/)
    expect(description).toContain('Задания на сегодня')
    expect((description.match(/▱/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  test('quests panel shows a weekly quest', () => {
    const description = String(questsEmbed(defaultUser()).toJSON().description)
    expect(description).toContain('Недельный квест')
  })

  test('quests panel offers one reroll menu', () => {
    const rows = questsComponents(defaultUser())
    expect(rows).toHaveLength(2)
    const menu = rows[0].toJSON().components[0]
    expect(menu.custom_id).toBe('quest:reroll')
    if (!('options' in menu)) throw new Error('expected a select menu')
    expect(menu.options).toHaveLength(3)
  })
})

describe('battleReward', () => {
  test('pays out only the combined stakes', () => {
    expect(battleReward(0)).toBe(0)
    expect(battleReward(100)).toBe(200)
  })
})

describe('challengeText', () => {
  test('mentions the opponent so they get pinged', () => {
    const text = challengeText('Rsepicus', '42')
    expect(text).toContain('<@42>')
    expect(text).toContain('Rsepicus')
    expect(text).toContain('Forsaken Simulator')
  })

  test('puts the mention in message content because embed mentions do not ping', () => {
    const reply = challengeReplyOptions('Rsepicus', '42', 100)
    expect(reply.content).toBe('<@42>')
    expect(reply.allowedMentions.users).toEqual(['42'])
    expect(reply.embeds[0].toJSON().description).toContain('<@42>')
  })

  test('shows the battle format in the challenge', () => {
    const description = String(
      challengeReplyOptions('Rsepicus', '42', 0, '2x2').embeds[0].toJSON().description,
    )
    expect(description).toContain('2 на 2')
    expect(description).toContain('по два персонажа')
  })

  test('defaults to 1 на 1 when no mode is chosen', () => {
    expect(parseBattleMode(null)).toBe('1x1')
    expect(parseBattleMode('2x2')).toBe('2x2')
    const description = String(
      challengeReplyOptions('Rsepicus', '42').embeds[0].toJSON().description,
    )
    expect(description).toContain('1 на 1')
  })
})

describe('draft', () => {
  test('builds a full shared-pool draft', () => {
    const solo = draftPickOrder('1x1')
    expect(solo).toHaveLength(6)
    expect(solo.filter(player => player === 0)).toHaveLength(3)
    const duo = draftPickOrder('2x2')
    expect(duo).toHaveLength(8)
    expect(duo.filter(player => player === 0)).toHaveLength(4)

    const state = {
      messageId: 'm',
      channelId: 'c',
      format: '1x1' as const,
      wager: 100,
      pool: CHARACTERS.slice(0, 12),
      players: [
        { userId: 'a', name: 'Alice', bans: [], picks: [], chosen: [], abilities: {} },
        { userId: 'b', name: 'Bob', bans: [], picks: [], chosen: [], abilities: {} },
      ] as [
        {
          userId: string
          name: string
          bans: string[]
          picks: string[]
          chosen: string[]
          abilities: Record<string, string>
        },
        {
          userId: string
          name: string
          bans: string[]
          picks: string[]
          chosen: string[]
          abilities: Record<string, string>
        },
      ],
      phase: 'ban' as const,
      turn: 0 as const,
      banIndex: 0,
      pickIndex: 0,
      pickOrder: solo,
      chooseIndex: 0,
      abilityIndex: 0,
      createdAt: 1,
    }
    const embed = draftEmbed(state).toJSON()
    expect(embed.title).toContain('Драфт')
    expect(embed.description).toContain('Пул')
    expect(embed.description).toContain('Alice')
    expect(embed.description).toContain('100')

    const menu = draftComponents(state)[0].toJSON().components[0]
    expect(menu.custom_id).toBe('pvp:draft:select')
    expect(menu.options).toHaveLength(12)
  })

  test('draft pool contains both roles', () => {
    const pool = draftPool(() => 0.42)
    expect(pool).toHaveLength(12)
    expect(pool.filter(character => character.role === 'killer')).toHaveLength(6)
    expect(pool.filter(character => character.role === 'survivor')).toHaveLength(6)
  })

  test('after picks each player chooses abilities', () => {
    const state = {
      messageId: 'm',
      channelId: 'c',
      format: '1x1' as const,
      wager: 0,
      pool: CHARACTERS.slice(0, 12),
      players: [
        {
          userId: 'a',
          name: 'Alice',
          bans: [],
          picks: [],
          chosen: ['Noob'],
          abilities: {},
        },
        {
          userId: 'b',
          name: 'Bob',
          bans: [],
          picks: [],
          chosen: ['Jason'],
          abilities: {},
        },
      ],
      phase: 'ability' as const,
      turn: 0 as const,
      banIndex: 4,
      pickIndex: 6,
      pickOrder: draftPickOrder('1x1'),
      chooseIndex: 2,
      abilityIndex: 0,
      createdAt: 1,
    }
    const embed = draftEmbed(state).toJSON()
    expect(embed.description).toContain('Способности')
    expect(embed.description).toContain('Noob')
    const options = draftComponents(state)[0].toJSON().components[0].options
    expect(options.map(option => option.value)).toEqual(['Bloxy Cola', 'Slateskin Potion'])
  })
})

describe('survival mastery', () => {
  test('clearing a wave grants mastery XP without PvP wins', () => {
    const progress = recordSurvivalWave(defaultUser(), 'Jason')
    expect(progress.xpGained).toBe(20)
    expect(progress.user.characterStats.Jason).toEqual({ wins: 0, losses: 0, xp: 20 })
    const withAbility = recordSurvivalWave(defaultUser(), 'Jason', 7)
    expect(withAbility.xpGained).toBe(27)
  })
})

describe('battle panel language', () => {
  test('follows the side whose turn it is', () => {
    const battle = createBattle(
      { userId: 'ru', name: 'Rus', character: characterByName('Noob')! },
      { userId: 'en', name: 'Eng', character: characterByName('Jason')! },
    )
    const languageOf = (id: string) => (id === 'en' ? 'en' : 'ru') as 'ru' | 'en'
    expect(battleTurnLanguage(battle, languageOf)).toBe('ru')
    battle.turn = 1
    expect(battleTurnLanguage(battle, languageOf)).toBe('en')
    battle.finished = true
    expect(battleTurnLanguage(battle, languageOf)).toBeUndefined()
  })

  test('ignores automated sides', () => {
    const battle = createBattle(
      { userId: 'ru', name: 'Rus', character: characterByName('Noob')! },
      { userId: 'bot:x', name: 'Bot', character: characterByName('Jason')!, boss: true },
    )
    battle.turn = 1
    expect(battleTurnLanguage(battle, () => 'ru')).toBeUndefined()
  })
})

describe('commandDefinitions', () => {
  const commands = commandDefinitions().map(command => command.toJSON())
  const find = (name: string) => commands.find(command => command.name === name)

  test('does not register the legacy bot and randomizer commands', () => {
    for (const name of ['лох', 'молодец', 'форсейкен', 'ктоты', 'дуэль', 'испытание', 'выжить']) {
      expect(find(name)).toBeUndefined()
    }
  })

  test('registers the consolidated command set', () => {
    for (const name of [
      'профиль',
      'пвп',
      'пве',
      'гайд',
      'команды',
      'дебаг',
      'settings',
    ]) {
      expect(find(name)).toBeDefined()
    }
    expect(find('настройки')).toBeUndefined()
    for (const name of ['магазин', 'купить', 'выбрать', 'бонус', 'топ']) {
      expect(find(name)).toBeUndefined()
    }
  })

  test('exposes English aliases for Cyrillic command names', () => {
    const aliases: Record<string, string> = {
      профиль: 'profile',
      пвп: 'pvp',
      пве: 'pve',
      дебаг: 'debug',
      гайд: 'guide',
      команды: 'commands',
    }
    for (const [russian, english] of Object.entries(aliases)) {
      expect(find(russian)?.name_localizations?.['en-US']).toBe(english)
    }
  })

  test('removes character, boss and training commands', () => {
    for (const name of ['персонаж', 'босс', 'тренировка']) {
      expect(find(name)).toBeUndefined()
    }
    expect(find('пве')?.options).toHaveLength(0)
  })

  test('does not register a separate /тест command', () => {
    expect(find('тест')).toBeUndefined()
  })

  test('debug status includes the bot health check', () => {
    const embed = debugStatusEmbed().toJSON()
    expect(embed.title).toContain('Проверка')
    expect(embed.description).toContain('Пинг: **нет данных**')
    expect(embed.description).toContain(`Команд: **${commandDefinitions().length}**`)
    expect(embed.description).toContain('Аптайм:')
    expect(embed.description).toContain('Пользователей в базе:')
    expect(embed.description).toContain('Активных боёв:')
  })

  test('registers /пвп with an optional opponent and a mode setup', () => {
    const command = find('пвп')
    expect(command).toBeDefined()
    expect(command?.options?.map(option => option.name)).toEqual(['соперник'])
    expect(command?.options?.[0]?.name_localizations?.['en-US']).toBe('opponent')
    const setup = {
      ownerId: '1',
      ownerName: 'Rsepicus',
      format: '1x1' as const,
      gameMode: 'draft' as const,
      wager: 100,
      bestOf: 1 as const,
      createdAt: Date.now(),
    }
    const embed = pvpSetupEmbed(setup).toJSON()
    expect(embed.description).toContain('Драфт')
    expect(embed.description).toContain('100')
    const rows = pvpSetupComponents(setup).map(row => row.toJSON())
    expect(rows[0].components[0].custom_id).toBe('pvp:setup:format')
    expect(rows[1].components[0].custom_id).toBe('pvp:setup:mode')
    expect(rows[2].components[0].custom_id).toBe('pvp:setup:series')
    expect(rows[3].components.map(component => component.custom_id)).toEqual([
      'pvp:setup:wager',
      'pvp:setup:create',
      'pvp:setup:cancel',
    ])
  })

  test('wraps owner tools in /дебаг without options', () => {
    const command = find('дебаг')
    expect(command).toBeDefined()
    expect(command?.options ?? []).toHaveLength(0)
  })

  test('profile has an optional user option and no subcommands', () => {
    const profile = find('профиль')
    expect(profile?.options?.[0]?.name).toBe('пользователь')
    expect(profile?.options?.[0]?.name_localizations?.['en-US']).toBe('user')
    expect(profile?.options?.[0]?.required).toBeFalsy()
  })

  test('bonus button uses the Robux icon', () => {
    const bonus = hubComponents(defaultUser())[1].toJSON().components[0]
    expect(bonus.emoji?.name).toBe('robux')
  })

  test('hub exposes the navigation buttons', () => {
    const ids = hubComponents(defaultUser()).flatMap(row =>
      row.toJSON().components.map(component => component.custom_id),
    )
    expect(ids).toEqual([
      'hub:shop',
      'hub:choose',
      'hub:chars',
      'hub:bonus',
      'hub:quests',
      'hub:achievements',
      'hub:history',
      'hub:top',
      'hub:cosmetics',
    ])
  })

  test('new characters show their passive, price and trial', () => {
    const embed = characterEmbed(characterByName('Jane Doe')!, defaultUser()).toJSON()
    const fields = embed.fields ?? []
    const ability = fields.find(field => field.name.includes('Способность'))?.value ?? ''
    expect(ability).toContain('Shatterpoint')
    expect(fields.find(field => field.name === 'Цена')?.value).toContain('600')
    expect(fields.some(field => field.name.includes('Испытание'))).toBe(true)
  })

  test('character panel shows abilities and stats', () => {
    const embed = characterEmbed(characterByName('c00lkidd')!, defaultUser()).toJSON()
    expect(embed.title).toContain('c00lkidd')
    expect(embed.fields?.some(field => field.name.includes('Способность'))).toBe(true)
  })

  test('ability cards and selects show cooldown length', () => {
    const card = characterEmbed(characterByName('Jason')!, defaultUser()).toJSON()
    const abilities = card.fields?.find(field => field.name.includes('Способность'))?.value
    expect(abilities).toContain('КД: 3 хода')
    expect(abilities).toContain('КД: 2 хода')

    const abilitySelect = chooseComponents(defaultUser())
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'hub:ability')
    expect(abilitySelect?.options?.some(option => option.description?.includes('КД 2'))).toBe(true)
  })

  test('character card description is the wiki class', () => {
    expect(characterEmbed(characterByName('Jason')!, defaultUser()).toJSON().description).toBe(
      'Ambusher',
    )
    expect(characterEmbed(characterByName('Noob')!, defaultUser()).toJSON().description).toBe(
      'Survivalist',
    )
    expect(characterEmbed(characterByName('Guest 1337')!, defaultUser()).toJSON().description).toBe(
      'Sentinel',
    )
  })

  test('Azure card explains Atropa and battle status shows its damage bonus', () => {
    const abilities = characterEmbed(characterByName('Azure')!, defaultUser()).toJSON().fields
      ?.find(field => field.name.includes('Способность'))?.value
    expect(abilities).toContain('Atropa')
    expect(abilities).toContain('+1 урон к атаке Azure')
    expect(abilities).toContain('Atropic')
    expect(abilities).toContain('<:atropa:')

    const battle = createBattle(
      { userId: 'a', name: 'Azure', character: characterByName('Azure')! },
      { userId: 'b', name: 'B', character: characterByName('Noob')! },
    )
    battle.sides[1].atropa = 3
    const description = String(battleEmbed(battle).toJSON().description)
    expect(description).toContain('ATROPA ×3 (+3 DMG)')
  })

  test('character cards explain their unique resources', () => {
    const abilities = (name: string) =>
      String(
        characterEmbed(characterByName(name)!, defaultUser()).toJSON().fields?.find(field =>
          String(field.name).includes('Способность'),
        )?.value ?? '',
      )
    expect(abilities('Jane Doe')).toContain('Resonance: Hatchet тратит')
    expect(abilities('Jane Doe')).toContain('Shatterpoint')
    expect(abilities('Veeronica')).toContain('Батарея: старт 30%')
    expect(abilities('Guest 666')).toContain('Blood Hunt')
    expect(abilities('Shedletsky')).toContain('Firebrand')
    expect(abilities('Helperbot')).toContain('+8 HP в начале хода')
    expect(abilities('Azure')).toContain('Atropa')
  })

  test('Guest 1337 card lists both Block and Charge', () => {
    const embed = characterEmbed(characterByName('Guest 1337')!, defaultUser()).toJSON()
    const abilities = embed.fields?.find(field => field.name.includes('Способность'))?.value
    expect(abilities).toContain('Block')
    expect(abilities).toContain('Charge')
  })

  test('character browser offers an ability selector for owned loadout characters', () => {
    const guest = characterByName('Guest 1337')!
    const user = { ...defaultUser(), owned: ['Noob', 'Jason', 'Guest 1337'] }
    const component = characterBrowserComponents(false, guest, user, true)
      .flatMap(row => row.toJSON().components)
      .find(entry => entry.custom_id?.startsWith('char:special:'))
    expect(component?.options).toHaveLength(2)
  })

  test('mastery uses the EXP icon', () => {
    const embed = characterEmbed(characterByName('c00lkidd')!, defaultUser()).toJSON()
    const mastery = embed.fields?.find(field => field.name.includes('Мастерство'))
    expect(mastery?.name).toContain('<:xp:')
  })

  test('character browser lists the whole roster', () => {
    const rows = characterBrowserComponents(false).map(row => row.toJSON())
    const select = rows
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'char:view')
    expect(select?.options).toHaveLength(21)
  })

  test('shop menu lists only unowned characters', () => {
    const values = shopComponents(defaultUser())
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .filter(component => component.custom_id === 'hub:buy')
      .flatMap(component => component.options.map(option => option.value))
    expect(values).not.toContain('Noob')
    expect(values).toContain('c00lkidd')
  })

  test('choose menu lists only owned characters', () => {
    const values = chooseComponents(defaultUser())
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .filter(component => component.custom_id === 'hub:select')
      .flatMap(component => component.options.map(option => option.value))
    expect(values).toEqual(expect.arrayContaining(['Noob', 'Jason']))
    expect(values).not.toContain('c00lkidd')
  })

  test('choose menu lets you pick a second character for 2v2', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason', 'Guest 1337'],
      active: 'Noob',
      partner: 'Guest 1337',
      loadouts: { 'Guest 1337': 'Charge' },
    }
    const partnerSelect = chooseComponents(user)
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'hub:partner')
    expect(partnerSelect?.options?.map(option => option.value)).toEqual([
      'auto',
      'Jason',
      'Guest 1337',
    ])
    expect(
      partnerSelect?.options?.find(option => option.value === 'Guest 1337')?.default,
    ).toBe(true)

    const partnerAbility = chooseComponents(user)
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'hub:partnerAbility')
    expect(partnerAbility?.options?.map(option => option.value)).toEqual(['Block', 'Charge'])
    expect(
      partnerAbility?.options?.find(option => option.value === 'Charge')?.default,
    ).toBe(true)
    expect(chooseComponents(user).length).toBeLessThanOrEqual(5)

    const description = String(chooseEmbed(user).toJSON().description)
    expect(description).toContain('Второй персонаж')
    expect(description).toContain('Guest 1337')
    expect(description).toContain('Способность напарника')
    expect(description).toContain('Charge')
    expect(partnerCharacter(user).special.name).toBe('Charge')
  })

  test('character menus show passive names', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason', 'Elliot'],
      active: 'Jason',
      partner: 'Elliot',
    }
    const option = (rows: ReturnType<typeof chooseComponents>, id: string, value: string) =>
      rows
        .map(row => row.toJSON())
        .flatMap(row => row.components)
        .find(component => component.custom_id === id)
        ?.options?.find(entry => entry.value === value)

    expect(option(chooseComponents(user), 'hub:select', 'Jason')?.description).toContain('Mute')
    expect(option(chooseComponents(user), 'hub:partner', 'Elliot')?.description).toContain(
      'First Aid',
    )
    expect(
      option(chooseComponents(user), 'hub:partner', 'Elliot')?.description,
    ).not.toContain('Passive')
  })

  test('character browser and shop menus mention the passive', () => {
    const browser = characterBrowserComponents(false)
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'char:view')
    expect(browser?.options?.find(entry => entry.value === 'John Doe')?.description).toContain(
      'Natural Malevolence',
    )

    const shop = shopComponents(defaultUser())
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'hub:buy')
    expect(shop?.options?.find(entry => entry.value === 'John Doe')?.description).toContain(
      'Natural Malevolence',
    )
  })

  test('choose panel spells out the active and partner passives', () => {
    const user = {
      ...defaultUser(),
      owned: ['Noob', 'Jason', 'Elliot'],
      active: 'Jason',
      partner: 'Elliot',
    }
    const description = String(chooseEmbed(user).toJSON().description)
    expect(description).toContain('Пассивка:')
    expect(description).toContain('Mute')
    expect(description).toContain('Пассивка напарника:')
    expect(description).toContain('First Aid')
  })

  test('partner auto-picks the first other owned character', () => {
    expect(partnerCharacter(defaultUser()).name).toBe('Jason')
  })

  test('choose menu also lets you pick the active character ability', () => {
    const ability = chooseComponents(defaultUser())
      .map(row => row.toJSON())
      .flatMap(row => row.components)
      .find(component => component.custom_id === 'hub:ability')
    expect(ability?.options?.map(option => option.value)).toEqual([
      'Bloxy Cola',
      'Slateskin Potion',
    ])
  })

  test('registers /пвп with only an optional opponent', () => {
    const pvp = find('пвп')
    expect(pvp?.options?.map(option => option.name)).toEqual(['соперник'])
    expect(pvp?.options?.[0]?.required).toBe(false)
  })

  test('makes the commands available in guild channels, bot DMs and private channels', () => {
    for (const command of commands) {
      expect(command.contexts).toEqual([0, 1, 2])
      expect(command.integration_types).toEqual([0, 1])
    }
  })
})
