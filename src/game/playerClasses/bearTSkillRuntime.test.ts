import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyPlayerBuildWorkbookOverrides, getDefaultPersistedBuildForRule, resetPlayerBuildCatalog } from '../data/playerBuildCatalog'
import { parsePlayerBuildWorkbook } from '../data/workbookLoader'
import { activateSkill, createInitialEncounterState, resolveEnemyTargetIdsBySelector, tickEncounter } from '../encounter/encounterFactory'
import { getStageById } from '../data/stageTemplates'
import { getPassiveModifiers } from '../data/playerBuildCatalog'

describe('bear tank runtime smoke behavior', () => {
  beforeEach(() => {
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
  })
  afterEach(() => resetPlayerBuildCatalog())

  it('executes bear rage generators, ironfur, roar and moonfire in a real encounter state', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const activatedMangle = tickEncounter(activateSkill(encounter, 'druid_bear_t_mangle'), 0)
    expect(activatedMangle.player.resource).toBeGreaterThan(encounter.player.resource)

    const withIronfur = activateSkill({
      ...activatedMangle,
      player: { ...activatedMangle.player, resource: 100 },
    }, 'druid_bear_t_ironfur')
    expect(withIronfur.player.mitigation?.id).toBe('druid_bear_t_ironfur')
    expect(withIronfur.player.mitigation?.damageReductionTypes).toEqual(['physical'])

    const withMoonfire = activateSkill({
      ...withIronfur,
      player: { ...withIronfur.player, gcdRemainingMs: 0 },
    }, 'druid_bear_t_moonfire')
    expect(withMoonfire.enemies.map((enemy) => enemy.statuses.map((status) => status.id))).toEqual(expect.arrayContaining([expect.arrayContaining(['druid_bear_t_moonfire'])]))
  })

  it('ticks frenzied regeneration from current max hp without repeating prior ticks', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const wounded = {
      ...encounter,
      player: { ...encounter.player, hp: encounter.player.maxHp * 0.5, resource: 100, gcdRemainingMs: 0 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(wounded, 'druid_bear_t_frenzied_regeneration')
    const afterFirstTick = tickEncounter(active, 2000)
    expect(afterFirstTick.player.hp).toBeGreaterThan(active.player.hp)
    expect(afterFirstTick.player.buffs.find((status) => status.id === 'druid_bear_t_frenzied_regeneration')?.remainingMs).toBe(6000)
  })

  it('keeps the HoT ticking through control while applying healing suppression per tick', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const build = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const suppressed = {
      ...encounter,
      player: {
        ...encounter.player,
        hp: encounter.player.maxHp * 0.5,
        resource: 100,
        gcdRemainingMs: 0,
        debuffs: [{
          id: 'troll-ruptured',
          effectLogicId: 'trollRuptured_status',
          label: '禁疗',
          shortLabel: '禁疗',
          remainingMs: 5000,
          totalMs: 5000,
          tone: 'danger' as const,
          kind: 'playerDebuff' as const,
        }],
      },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(suppressed, 'druid_bear_t_frenzied_regeneration')
    const controlled = tickEncounter({
      ...active,
      player: {
        ...active.player,
        debuffs: [...active.player.debuffs, {
          id: 'stunned',
          label: '控制',
          shortLabel: '晕',
          remainingMs: 1000,
          totalMs: 1000,
          tone: 'danger' as const,
          kind: 'playerDebuff' as const,
        }],
      },
    }, 2000)

    expect(controlled.player.hp).toBeGreaterThan(active.player.hp)
    expect(controlled.player.hp - active.player.hp).toBeLessThan(active.player.maxHp * 0.06)
    expect(controlled.player.buffs.find((status) => status.id === 'druid_bear_t_frenzied_regeneration')?.remainingMs).toBe(6000)
  })

  it('scales current hp with temporary max hp windows and returns after expiry', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, loadout: { ...baseBuild.loadout, F: 'druid_bear_t_survival_instincts' } }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const active = activateSkill({ ...encounter, player: { ...encounter.player, resource: 100 } }, 'druid_bear_t_survival_instincts')
    expect(active.player.maxHp).toBeGreaterThan(encounter.player.maxHp)
    const expired = tickEncounter(active, 8000)
    expect(expired.player.maxHp).toBe(encounter.player.maxHp)
  })

  it('preserves the final HoT tick when a max-hp buff expires in the same tick', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, loadout: { ...baseBuild.loadout, F: 'druid_bear_t_lunar_beam' } }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const wounded = {
      ...encounter,
      player: { ...encounter.player, hp: encounter.player.maxHp * 0.5, resource: 100 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(wounded, 'druid_bear_t_lunar_beam')
    const expired = tickEncounter(active, 10000)

    expect(expired.player.maxHp).toBe(encounter.player.maxHp)
    expect(expired.player.hp).toBeGreaterThan(wounded.player.hp)
  })

  it('applies the bear team-interaction talents at their named skill boundaries', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = {
      ...baseBuild,
      passiveTalentIds: [
        ...baseBuild.passiveTalentIds,
        'druid_bear_t_regrowth_of_the_pack',
        'druid_bear_t_ursoc_shelter',
        'druid_bear_t_bark_dispelling',
        'druid_bear_t_spring_returns',
      ],
      loadout: { ...baseBuild.loadout, E: 'druid_bear_t_regrowth', R: 'druid_bear_t_rage_of_the_sleeper' },
    }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const healed = activateSkill({ ...encounter, player: { ...encounter.player, resource: 100 }, party: { ...encounter.party, hp: encounter.party.maxHp - 20 } }, 'druid_bear_t_regrowth')
    expect(healed.party.hp).toBeGreaterThan(encounter.party.hp - 20)
    const sheltered = activateSkill({ ...healed, player: { ...healed.player, resource: 100, gcdRemainingMs: 0 } }, 'druid_bear_t_rage_of_the_sleeper')
    expect(sheltered.party.statuses.find((status) => status.id === 'druid_bear_t_ursoc_shelter')?.damageTakenMultiplierBonus).toBe(-0.12)
  })

  it('exposes bear-only passive combat modifiers instead of warrior fallbacks', () => {
    const modifiers = getPassiveModifiers([
      'druid_bear_t_thick_hide',
      'druid_bear_t_ursine_threat',
      'druid_bear_t_natural_tenacity',
    ])

    expect(modifiers.bearPhysicalDamageReduction).toBe(0.08)
    expect(modifiers.bearThreatMultiplier).toBe(1.2)
    expect(modifiers.bearControlDurationMultiplier).toBe(0.75)
  })

  it('heals the party for every completed spring-returns rage threshold', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: [...baseBuild.passiveTalentIds, 'druid_bear_t_spring_returns'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const quiet = {
      ...encounter,
      player: { ...encounter.player, resource: 0 },
      party: { ...encounter.party, hp: encounter.party.maxHp - 20 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const afterMangle = tickEncounter(activateSkill(quiet, 'druid_bear_t_mangle'), 0)
    const readyForThrash = {
      ...afterMangle,
      player: { ...afterMangle.player, gcdRemainingMs: 0 },
      skills: afterMangle.skills.map((skill) => skill.id === 'druid_bear_t_thrash' ? { ...skill, remainingCooldownMs: 0 } : skill),
    }
    const afterThrash = tickEncounter(activateSkill(readyForThrash, 'druid_bear_t_thrash'), 0)

    expect(afterMangle.party.hp).toBe(quiet.party.hp)
    expect(afterThrash.party.hp).toBe(quiet.party.hp + 5)
    expect(afterThrash.runtime.classRuntime.springReturnsRage).toBe(15)
  })

  it('rewards successful skull bash and multi-target roar talent events', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = {
      ...baseBuild,
      passiveTalentIds: [
        ...baseBuild.passiveTalentIds,
        'druid_bear_t_skull_bash_instinct',
        'druid_bear_t_feral_aftershock',
      ],
      loadout: { ...baseBuild.loadout, F: 'druid_bear_t_roar' },
    }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const target = encounter.enemies.find((enemy) => resolveEnemyTargetIdsBySelector({ ...encounter, player: { ...encounter.player, currentTargetId: enemy.id } }, 'cross').size >= 2) ?? encounter.enemies[0]
    const casting = {
      ...encounter,
      player: { ...encounter.player, currentTargetId: target.id, resource: 20 },
      enemies: encounter.enemies.map((enemy) => enemy.id === target.id ? {
        ...enemy,
        cast: {
          id: 'flame-lance',
          name: 'flame-lance',
          target: 'tank' as const,
          totalMs: 1500,
          remainingMs: 1500,
          breakRule: 'interruptOrControl' as const,
          dangerLevel: 'high' as const,
        },
      } : enemy),
    }
    const interrupted = tickEncounter(activateSkill(casting, 'druid_bear_t_skull_bash'), 0)
    expect(interrupted.player.resource).toBe(20)

    const roaring = {
      ...interrupted,
      player: { ...interrupted.player, currentTargetId: target.id, resource: 100, gcdRemainingMs: 0 },
    }
    const roared = activateSkill(roaring, 'druid_bear_t_roar')
    expect(roared.player.buffs.find((status) => status.id === 'druid_bear_t_feral_aftershock')).toMatchObject({
      remainingMs: 6000,
      damageReductionRatio: 0.12,
      damageReductionTypes: ['physical'],
    })
  })

  it('uses giant bear last stand only once per encounter', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: [...baseBuild.passiveTalentIds, 'druid_bear_t_last_bear_stand'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const triggered = tickEncounter({ ...encounter, player: { ...encounter.player, hp: 0 } }, 0)

    expect(triggered.player.hp).toBe(1)
    expect(triggered.runtime.classRuntime.lastBearStandUsed).toBe(1)
    expect(triggered.player.mitigation).toMatchObject({ id: 'druid_bear_t_ironfur', stacks: 1 })

    const exhausted = tickEncounter({ ...triggered, result: null, player: { ...triggered.player, hp: 0 } }, 0)
    expect(exhausted.result?.outcome).toBe('defeat')
  })

  it('does not reward broken bark when an absorb expires naturally', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: ['druid_bear_t_broken_bark'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const quiet = {
      ...encounter,
      player: {
        ...encounter.player,
        resource: 0,
        buffs: [{
          id: 'ignorePain',
          label: '测试吸收',
          shortLabel: '盾',
          remainingMs: 1000,
          totalMs: 1000,
          tone: 'buff' as const,
          kind: 'neutral' as const,
          absorbRemaining: 20,
          absorbRatio: 1,
        }],
      },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }

    expect(tickEncounter(quiet, 1000).player.resource).toBe(0)
  })

  it('rewards broken bark when incoming damage fully consumes an active absorb', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: ['druid_bear_t_broken_bark'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const shielded = {
      ...encounter,
      player: {
        ...encounter.player,
        resource: 0,
        buffs: [{
          id: 'ignorePain',
          label: '测试吸收',
          shortLabel: '盾',
          remainingMs: 5000,
          totalMs: 5000,
          tone: 'buff' as const,
          kind: 'neutral' as const,
          absorbRemaining: 10,
          absorbRatio: 1,
        }],
      },
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      enemies: encounter.enemies.map((enemy, index) => index === 0 ? {
        ...enemy,
        cast: {
          id: 'bone-jab',
          name: 'bone-jab',
          target: 'tank' as const,
          totalMs: 1,
          remainingMs: 0,
          breakRule: 'controlOnly' as const,
          dangerLevel: 'low' as const,
        },
      } : { ...enemy, cast: null, recoveryRemainingMs: 999999 }),
    }

    expect(tickEncounter(shielded, 0).player.resource).toBe(12)
  })

  it('berserk removes only one dispellable control and leaves nondispellable slows', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, loadout: { ...baseBuild.loadout, F: 'druid_bear_t_berserk' } }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const controlled = {
      ...encounter,
      player: {
        ...encounter.player,
        debuffs: [
          { id: 'stunned', effectLogicId: 'stunned', label: '眩晕', shortLabel: '晕', remainingMs: 3000, totalMs: 3000, tone: 'danger' as const, kind: 'playerDebuff' as const },
          { id: 'slowDown', effectLogicId: 'slowDown_status', label: '减速', shortLabel: '慢', remainingMs: 3000, totalMs: 3000, tone: 'danger' as const, kind: 'playerDebuff' as const },
        ],
      },
    }
    const berserked = activateSkill(controlled, 'druid_bear_t_berserk')

    expect(berserked.player.debuffs.map((status) => status.id)).toEqual(['slowDown'])
  })

  it('dispels all dispellable player debuffs when talented barkskin ends', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = {
      ...baseBuild,
      passiveTalentIds: ['druid_bear_t_bark_dispelling'],
      loadout: { ...baseBuild.loadout, F: 'druid_bear_t_barkskin' },
    }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const debuffed = {
      ...encounter,
      player: {
        ...encounter.player,
        debuffs: [
          { id: 'druid_bear_t_moonfire', effectLogicId: 'test_dispellable', label: '可驱散', shortLabel: '驱', remainingMs: 10000, totalMs: 10000, tone: 'danger' as const, kind: 'playerDebuff' as const },
          { id: 'slowDown', effectLogicId: 'slowDown_status', label: '不可驱散', shortLabel: '慢', remainingMs: 10000, totalMs: 10000, tone: 'danger' as const, kind: 'playerDebuff' as const },
        ],
      },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(debuffed, 'druid_bear_t_barkskin')
    const expired = tickEncounter(active, 6000)

    expect(expired.player.debuffs.map((status) => status.id)).toEqual(['slowDown'])
  })

  it('activates and removes pack presence with the second ironfur stack', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: ['druid_bear_t_pack_presence'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const quiet = {
      ...encounter,
      player: { ...encounter.player, resource: 100 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const first = activateSkill(quiet, 'druid_bear_t_ironfur')
    expect(first.party.statuses.some((status) => status.id === 'druid_bear_t_pack_presence')).toBe(false)
    const ready = {
      ...first,
      player: { ...first.player, resource: 100 },
      skills: first.skills.map((skill) => skill.id === 'druid_bear_t_ironfur' ? { ...skill, remainingCooldownMs: 0, selfCooldownRemainingMs: 0 } : skill),
    }
    const second = activateSkill(ready, 'druid_bear_t_ironfur')
    expect(second.party.statuses.find((status) => status.id === 'druid_bear_t_pack_presence')?.damageTakenMultiplierBonus).toBe(-0.08)
    const expired = tickEncounter(second, 8000)
    expect(expired.party.statuses.some((status) => status.id === 'druid_bear_t_pack_presence')).toBe(false)
  })

  it('applies ironfur and armor-style talents to physical damage only', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: [...baseBuild.passiveTalentIds, 'druid_bear_t_thick_hide'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const ironfur = activateSkill({ ...encounter, player: { ...encounter.player, resource: 100 } }, 'druid_bear_t_ironfur')
    const resolveCast = (withMitigation: boolean, skillId: 'bone-jab' | 'flame-lance') => {
      const source = {
        ...ironfur,
        player: { ...ironfur.player, mitigation: withMitigation ? ironfur.player.mitigation : null },
        runtime: { ...ironfur.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
        enemies: ironfur.enemies.map((enemy, index) => index === 0 ? {
          ...enemy,
          cast: {
            id: skillId,
            name: skillId,
            target: 'tank' as const,
            totalMs: 1,
            remainingMs: 0,
            breakRule: skillId === 'bone-jab' ? 'controlOnly' as const : 'interruptOrControl' as const,
            dangerLevel: 'medium' as const,
          },
        } : { ...enemy, cast: null, recoveryRemainingMs: 999999 }),
      }
      const resolved = tickEncounter(source, 0)
      return source.player.hp - resolved.player.hp
    }

    expect(resolveCast(true, 'bone-jab')).toBeLessThan(resolveCast(false, 'bone-jab'))
    expect(resolveCast(true, 'flame-lance')).toBe(resolveCast(false, 'flame-lance'))
  })
})
