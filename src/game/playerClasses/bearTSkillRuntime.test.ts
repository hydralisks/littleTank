import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { applyPlayerBuildWorkbookOverrides, getDefaultPersistedBuildForRule, resetPlayerBuildCatalog } from '../data/playerBuildCatalog'
import { parsePlayerBuildWorkbook } from '../data/workbookLoader'
import { activateSkill, createInitialEncounterState, getSkillActivationBlockReason, resolveEnemyTargetIdsBySelector, tickEncounter } from '../encounter/encounterFactory'
import { getStageById } from '../data/stageTemplates'
import { getPassiveModifiers } from '../data/playerBuildCatalog'
import type { EncounterState } from '../encounter/encounterTypes'

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

  it('reads Ironfur physical reduction per stack from the designer effect percentage', () => {
    const workbook = parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx'))
    applyPlayerBuildWorkbookOverrides({
      ...workbook,
      activeSkillEffectDefinitions: workbook.activeSkillEffectDefinitions.map((effect) => (
        effect.skillId === 'druid_bear_t_ironfur'
          ? { ...effect, valueA: 10 }
          : effect
      )),
    })
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)

    const withIronfur = activateSkill({
      ...encounter,
      player: { ...encounter.player, resource: 100 },
    }, 'druid_bear_t_ironfur')

    expect(withIronfur.player.mitigation?.damageReductionRatio).toBe(0.1)
  })

  it('uses the approved Thrash, Swipe, and Moonfire damage and threat profiles', () => {
    const stage = {
      ...getStageById('harbor-1'),
      playerAutoDamage: 0,
      playerAutoHeal: 0,
      partyAutoDamageIntervalMs: 0,
      partyAutoDamageTargetCount: 0,
      partyAutoHeal: 0,
      damageSources: [],
    }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const createQuiet = () => {
      const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
        ...baseBuild,
        passiveTalentIds: [],
        loadout: {
          ...baseBuild.loadout,
          '1': 'druid_bear_t_thrash',
          '2': 'druid_bear_t_swipe',
          '3': 'druid_bear_t_moonfire',
        },
      })
      const currentTargetId = encounter.enemies[0].id
      const crossPositions = [[2, 2], [2, 1], [2, 3], [1, 2], [3, 2]]
      return {
        ...encounter,
        stage: {
          ...encounter.stage,
          playerAutoDamage: 0,
          playerAutoHeal: 0,
          partyAutoDamageIntervalMs: 0,
          partyAutoDamageTargetCount: 0,
          partyAutoHeal: 0,
          damageSources: [],
        },
        player: { ...encounter.player, currentTargetId, resource: 0 },
        enemies: encounter.enemies.map((enemy, index) => ({
          ...enemy,
          row: crossPositions[index]?.[0] ?? enemy.row,
          col: crossPositions[index]?.[1] ?? enemy.col,
          cast: null,
          recoveryRemainingMs: 999999,
        })),
        runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      }
    }

    const thrashState = createQuiet()
    const afterThrash = tickEncounter(activateSkill(thrashState, 'druid_bear_t_thrash'), 0)
    expect(afterThrash.player.resource).toBe(10)
    expect(thrashState.enemies[0].hp - afterThrash.enemies[0].hp).toBe(10)
    expect(afterThrash.enemies[0].tankThreat - thrashState.enemies[0].tankThreat).toBe(50)

    const swipeState = createQuiet()
    const afterSwipe = tickEncounter(activateSkill(swipeState, 'druid_bear_t_swipe'), 0)
    expect(swipeState.enemies[0].hp - afterSwipe.enemies[0].hp).toBe(8)
    expect(afterSwipe.enemies[0].tankThreat - swipeState.enemies[0].tankThreat).toBe(40)

    const moonfireState = createQuiet()
    let afterMoonfire = tickEncounter(activateSkill(moonfireState, 'druid_bear_t_moonfire'), 0)
    const targetIndex = moonfireState.enemies.findIndex((enemy) => enemy.id === moonfireState.player.currentTargetId)
    expect(afterMoonfire.player.resource).toBe(5)
    expect(moonfireState.enemies[targetIndex].hp - afterMoonfire.enemies[targetIndex].hp).toBe(5)
    expect(afterMoonfire.enemies[targetIndex].tankThreat - moonfireState.enemies[targetIndex].tankThreat).toBe(25)

    const cumulativeDamage = []
    const cumulativeThreat = []
    for (let tick = 0; tick < 4; tick += 1) {
      afterMoonfire = tickEncounter(afterMoonfire, 3000)
      cumulativeDamage.push(moonfireState.enemies[targetIndex].hp - afterMoonfire.enemies[targetIndex].hp)
      cumulativeThreat.push(afterMoonfire.enemies[targetIndex].tankThreat - moonfireState.enemies[targetIndex].tankThreat)
    }
    expect(cumulativeDamage).toEqual([10, 15, 20, 25])
    expect(cumulativeThreat).toEqual([50, 75, 100, 125])
  })

  it('stacks Thick Hide linearly with default Ironfur before other mitigation multipliers', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')
    let state = createInitialEncounterState(stage, 'druid_bear_t', {
      ...baseBuild,
      passiveTalentIds: ['druid_bear_t_thick_hide'],
    })
    for (let stack = 0; stack < 3; stack += 1) {
      state = tickEncounter(
        activateSkill({
          ...state,
          player: { ...state.player, resource: 100 },
          skills: state.skills.map((skill) => skill.id === 'druid_bear_t_ironfur'
            ? { ...skill, remainingCooldownMs: 0, selfCooldownRemainingMs: 0 }
            : skill),
        }, 'druid_bear_t_ironfur'),
        0,
      )
    }

    expect(state.player.mitigation).toMatchObject({
      stacks: 3,
      maxStacks: 3,
      damageReductionRatio: 0.6,
      damageReductionTypes: ['physical'],
    })

    const physicalHit = {
      ...state,
      runtime: { ...state.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      enemies: state.enemies.map((enemy, index) => index === 0 ? {
        ...enemy,
        cast: {
          id: 'bone-jab',
          name: 'bone-jab',
          target: 'tank' as const,
          totalMs: 1,
          remainingMs: 0,
          breakRule: 'controlOnly' as const,
          dangerLevel: 'medium' as const,
        },
      } : { ...enemy, cast: null, recoveryRemainingMs: 999999 }),
    }
    const resolved = tickEncounter(physicalHit, 0)
    const withoutMitigation = tickEncounter({
      ...physicalHit,
      passiveTalentIds: [],
      player: { ...physicalHit.player, mitigation: null },
    }, 0)
    const baselineDamage = physicalHit.player.hp - withoutMitigation.player.hp
    expect(physicalHit.player.hp - resolved.player.hp).toBeCloseTo(baselineDamage * (1 - 0.6 - 0.1), 5)
  })

  it('makes Barkskin a ten-second thirty-percent all-damage reduction', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
      ...baseBuild,
      loadout: { ...baseBuild.loadout, E: 'druid_bear_t_barkskin' },
    })
    const active = tickEncounter(activateSkill(encounter, 'druid_bear_t_barkskin'), 0)

    expect(active.player.buffs.find((status) => status.id === 'druid_bear_t_barkskin')).toMatchObject({
      remainingMs: 10000,
      totalMs: 10000,
      damageReductionRatio: 0.3,
      damageReductionTypes: ['physical', 'magic'],
    })
  })

  it('heals Regrowth for a fixed twenty-five plus three ticks of five', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
      ...baseBuild,
      passiveTalentIds: [],
      loadout: { ...baseBuild.loadout, E: 'druid_bear_t_regrowth' },
    })
    const wounded = {
      ...encounter,
      player: { ...encounter.player, hp: 50, maxHp: 200, resource: 100 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(wounded, 'druid_bear_t_regrowth')
    expect(active.player.hp - wounded.player.hp).toBe(25)

    const completed = tickEncounter(active, 6000)
    expect(completed.player.hp - wounded.player.hp).toBe(40)
  })

  it('turns Thrash into capped, accumulating Pain Immunity instead of rage', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')
    const createQuiet = (enemyCount: number): EncounterState => {
      const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
        ...baseBuild,
        passiveTalentIds: [],
      })
      const positions = [[2, 2], [1, 1], [1, 2], [2, 1], [3, 3]]
      return {
        ...encounter,
        passiveTalentIds: ['druid_bear_t_pain_immunity'],
        player: { ...encounter.player, currentTargetId: encounter.enemies[0].id, resource: 0 },
        enemies: encounter.enemies.map((enemy, index) => ({
          ...enemy,
          hp: index < enemyCount ? enemy.hp : 0,
          row: positions[index]?.[0] ?? enemy.row,
          col: positions[index]?.[1] ?? enemy.col,
          cast: null,
          recoveryRemainingMs: 999999,
        })),
        runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      }
    }
    const getAbsorbs = (state: EncounterState) => (
      state.player.buffs.filter((status) => typeof status.absorbRemaining === 'number')
    )
    const readyThrash = (state: EncounterState): EncounterState => ({
      ...state,
      player: { ...state.player, gcdRemainingMs: 0 },
      skills: state.skills.map((skill) => skill.id === 'druid_bear_t_thrash'
        ? { ...skill, remainingCooldownMs: 0 }
        : skill),
    })

    const oneTarget = createQuiet(1)
    let accumulated = tickEncounter(activateSkill(oneTarget, 'druid_bear_t_thrash'), 0)
    expect(accumulated.player.resource).toBe(0)
    expect(oneTarget.enemies[0].hp - accumulated.enemies[0].hp).toBe(7)
    expect(getAbsorbs(accumulated)).toEqual([
      expect.objectContaining({ absorbRemaining: 5, remainingMs: 9000, absorbRatio: 1 }),
    ])

    accumulated = tickEncounter(accumulated, 3000)
    accumulated = tickEncounter(activateSkill(readyThrash(accumulated), 'druid_bear_t_thrash'), 0)
    expect(getAbsorbs(accumulated)).toEqual([
      expect.objectContaining({ absorbRemaining: 10, remainingMs: 9000, absorbRatio: 1 }),
    ])
    accumulated = tickEncounter(activateSkill(readyThrash(accumulated), 'druid_bear_t_thrash'), 0)
    accumulated = tickEncounter(activateSkill(readyThrash(accumulated), 'druid_bear_t_thrash'), 0)
    accumulated = tickEncounter(activateSkill(readyThrash(accumulated), 'druid_bear_t_thrash'), 0)
    expect(getAbsorbs(accumulated)).toEqual([
      expect.objectContaining({ absorbRemaining: 20, remainingMs: 9000, absorbRatio: 1 }),
    ])

    const fiveTargets = createQuiet(5)
    const afterAreaThrash = tickEncounter(activateSkill(fiveTargets, 'druid_bear_t_thrash'), 0)
    expect(afterAreaThrash.player.resource).toBe(0)
    expect(fiveTargets.enemies.map((enemy, index) => enemy.hp - afterAreaThrash.enemies[index].hp)).toEqual([7, 7, 7, 7, 7, 0, 0])
    expect(getAbsorbs(afterAreaThrash)).toEqual([
      expect.objectContaining({ absorbRemaining: 20, remainingMs: 9000, absorbRatio: 1 }),
    ])
  })

  it('adds magic reduction without changing Ironfur physical reduction or stack cap', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')
    const createIronfur = (stacks: number) => {
      let state = createInitialEncounterState(stage, 'druid_bear_t', {
        ...baseBuild,
        passiveTalentIds: ['druid_bear_t_water_fire_immunity'],
      })
      for (let stack = 0; stack < stacks; stack += 1) {
        state = tickEncounter(
          activateSkill({
            ...state,
            player: { ...state.player, resource: 100 },
            skills: state.skills.map((skill) => skill.id === 'druid_bear_t_ironfur'
              ? { ...skill, remainingCooldownMs: 0, selfCooldownRemainingMs: 0 }
              : skill),
          }, 'druid_bear_t_ironfur'),
          0,
        )
      }
      return state
    }
    const resolveCast = (stacks: number, skillId: 'bone-jab' | 'flame-lance') => {
      const state = createIronfur(stacks)
      const casting = {
        ...state,
        player: { ...state.player, mitigation: stacks === 0 ? null : state.player.mitigation },
        runtime: { ...state.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
        enemies: state.enemies.map((enemy, index) => index === 0 ? {
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
      const resolved = tickEncounter(casting, 0)
      return casting.player.hp - resolved.player.hp
    }

    expect(createIronfur(4).player.mitigation).toMatchObject({ stacks: 3, maxStacks: 3 })
    const baselinePhysical = resolveCast(0, 'bone-jab')
    const baselineMagic = resolveCast(0, 'flame-lance')
    expect(resolveCast(1, 'bone-jab')).toBeCloseTo(baselinePhysical * (1 - 0.2), 5)
    expect(resolveCast(1, 'flame-lance')).toBeCloseTo(baselineMagic * (1 - 0.1), 5)
    expect(resolveCast(3, 'bone-jab')).toBeCloseTo(baselinePhysical * (1 - 0.6), 5)
    expect(resolveCast(3, 'flame-lance')).toBeCloseTo(baselineMagic * (1 - 0.3), 5)
  })

  it('applies Moonlit Resolve as ten-percent all-damage reduction while Moonfire is active', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
      ...baseBuild,
      passiveTalentIds: ['druid_bear_t_moonlit_resolve'],
    })
    const active = tickEncounter(activateSkill(encounter, 'druid_bear_t_moonfire'), 0)

    expect(active.player.buffs.find((status) => status.id === 'druid_bear_t_moonlit_resolve')).toMatchObject({
      damageReductionRatio: 0.1,
      damageReductionTypes: ['physical', 'magic'],
    })
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

  it('reads Lunar Beam periodic healing from the designer effect value', () => {
    const workbook = parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx'))
    applyPlayerBuildWorkbookOverrides({
      ...workbook,
      activeSkillEffectDefinitions: workbook.activeSkillEffectDefinitions.map((effect) => (
        effect.skillEffectId === 'druid_bear_t_lunar_beam_main'
          ? { ...effect, valueB: 0.07 }
          : effect
      )),
    })
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
    const afterFirstTick = tickEncounter(active, 2000)

    expect(afterFirstTick.player.hp - active.player.hp).toBeCloseTo(active.player.maxHp * 0.07, 5)
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

  it('gives Sleeper rage and a proportional ten-second max-hp window', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, loadout: { ...baseBuild.loadout, F: 'druid_bear_t_rage_of_the_sleeper' } }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const quiet = {
      ...encounter,
      player: { ...encounter.player, hp: encounter.player.maxHp * 0.4, resource: 40 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = tickEncounter(activateSkill(quiet, 'druid_bear_t_rage_of_the_sleeper'), 0)
    const sleeper = active.player.buffs.find((status) => status.id === 'druid_bear_t_rage_of_the_sleeper')

    expect(active.player.resource).toBe(45)
    expect(active.player.maxHp).toBe(Math.round(encounter.player.maxHp * 1.25))
    expect(active.player.hp / active.player.maxHp).toBeCloseTo(0.4, 5)
    expect(sleeper).toMatchObject({ remainingMs: 10000, valueA: 0.25, valueB: 0.25 })

    const expired = tickEncounter(active, 10000)
    expect(expired.player.maxHp).toBe(encounter.player.maxHp)
    expect(expired.player.hp / expired.player.maxHp).toBeCloseTo(0.4, 5)
  })

  it('keeps Ursoc Incarnation as a max-hp and threat window without mitigation', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, loadout: { ...baseBuild.loadout, F: 'druid_bear_t_incarnation_ursoc' } }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)

    const active = activateSkill(encounter, 'druid_bear_t_incarnation_ursoc')
    const incarnation = active.player.buffs.find((status) => status.id === 'druid_bear_t_incarnation_ursoc')

    expect(active.player.maxHp).toBe(Math.round(encounter.player.maxHp * 1.35))
    expect(incarnation).toMatchObject({ remainingMs: 30000, valueA: 0.35, valueB: 0 })
    expect(incarnation).not.toHaveProperty('damageReductionRatio')
    expect(incarnation).not.toHaveProperty('damageReductionTypes')
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

  it('copies half of Regrowth immediate healing to the party without copying its HoT', () => {
    const stage = {
      ...getStageById('harbor-1'),
      playerAutoHeal: 0,
      partyAutoHeal: 0,
      partyAutoDamageIntervalMs: 0,
      partyAutoDamageTargetCount: 0,
      damageSources: [],
    }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
      ...baseBuild,
      passiveTalentIds: ['druid_bear_t_regrowth_of_the_pack'],
      loadout: { ...baseBuild.loadout, E: 'druid_bear_t_regrowth' },
    })
    const wounded = {
      ...encounter,
      player: { ...encounter.player, resource: 100 },
      party: { ...encounter.party, hp: encounter.party.maxHp - 50 },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }

    const healed = activateSkill(wounded, 'druid_bear_t_regrowth')
    expect(healed.party.hp - wounded.party.hp).toBe(12.5)

    const afterHot = tickEncounter(healed, 6000)
    expect(afterHot.party.hp).toBe(healed.party.hp)
  })

  it('exposes bear-only passive combat modifiers instead of warrior fallbacks', () => {
    const modifiers = getPassiveModifiers([
      'druid_bear_t_thick_hide',
      'druid_bear_t_ursine_threat',
    ])

    expect(modifiers.bearPhysicalDamageReduction).toBe(0.1)
    expect(modifiers.bearThreatMultiplier).toBe(1.35)
    expect(getPassiveModifiers(['druid_bear_t_great_bear_vigor']).playerMaxHpMultiplier).toBe(1.3)
    expect(modifiers.bearControlDurationMultiplier).toBe(1)
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
      runtime: {
        ...encounter.runtime,
        classRuntime: { ...encounter.runtime.classRuntime, springReturnsRage: 59 },
        damageSources: [],
        partyAutoDamageRemainingMs: 999999,
      },
    }
    const afterThrash = tickEncounter(activateSkill(quiet, 'druid_bear_t_thrash'), 0)

    expect(afterThrash.party.hp).toBe(quiet.party.hp + 5)
    expect(afterThrash.runtime.classRuntime.springReturnsRage).toBe(9)
  })

  it('uses the approved single-target and area rage generator values', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('standard_5slot', 'druid_bear_t')
    const createQuiet = (passiveTalentIds: string[], enemyCount: number) => {
      const encounter = createInitialEncounterState(stage, 'druid_bear_t', {
        ...baseBuild,
        passiveTalentIds,
      })
      const currentTargetId = encounter.enemies[0]?.id ?? null
      const positions = [[2, 2], [1, 1], [1, 2], [2, 1], [3, 3]]
      return {
        ...encounter,
        player: { ...encounter.player, currentTargetId, resource: 0 },
        enemies: encounter.enemies.map((enemy, index) => ({
          ...enemy,
          hp: index < enemyCount ? enemy.hp : 0,
          row: positions[index]?.[0] ?? enemy.row,
          col: positions[index]?.[1] ?? enemy.col,
          cast: null,
          recoveryRemainingMs: 999999,
        })),
        runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      }
    }
    const useGenerator = (skillId: 'druid_bear_t_mangle' | 'druid_bear_t_thrash', passiveTalentIds: string[], enemyCount = 1) => (
      tickEncounter(activateSkill(createQuiet(passiveTalentIds, enemyCount), skillId), 0).player.resource
    )

    expect(useGenerator('druid_bear_t_mangle', [])).toBe(15)
    expect(useGenerator('druid_bear_t_mangle', ['druid_bear_t_savage_focus'])).toBe(22)
    expect(useGenerator('druid_bear_t_thrash', ['druid_bear_t_savage_focus'])).toBe(10)
    expect(useGenerator('druid_bear_t_thrash', ['druid_bear_t_pain_rage'])).toBe(12)
    expect(useGenerator('druid_bear_t_thrash', ['druid_bear_t_pain_rage'], 5)).toBe(20)
  })

  it('blocks every Bear rage gain while rage exhaustion is active', () => {
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', baseBuild)
    const exhausted = {
      ...encounter,
      player: {
        ...encounter.player,
        resource: 10,
        debuffs: [
          ...encounter.player.debuffs,
          {
            id: 'druid_bear_t_rage_exhaustion',
            label: '怒气枯竭',
            shortLabel: '竭',
            remainingMs: 10000,
            totalMs: 10000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            dispellable: true,
          },
        ],
      },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const afterMangle = tickEncounter(activateSkill(exhausted, 'druid_bear_t_mangle'), 0)
    const berserkReady = {
      ...afterMangle,
      player: { ...afterMangle.player, gcdRemainingMs: 0 },
    }
    const afterBerserk = tickEncounter(activateSkill(berserkReady, 'druid_bear_t_berserk'), 0)

    expect(afterMangle.player.resource).toBe(10)
    expect(afterBerserk.player.resource).toBe(10)
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
    expect(interrupted.player.resource).toBe(35)

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

    expect(triggered.player.hp).toBe(triggered.player.maxHp * 0.15)
    expect(triggered.runtime.classRuntime.lastBearStandUsed).toBe(1)
    expect(triggered.player.mitigation).toMatchObject({ id: 'druid_bear_t_ironfur', stacks: 1 })
    expect(triggered.player.debuffs.find((status) => status.id === 'druid_bear_t_rage_exhaustion')).toMatchObject({
      remainingMs: 10000,
      dispellable: true,
      kind: 'playerDebuff',
    })

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

  it('does not reward broken bark when another absorb is fully consumed', () => {
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

    expect(tickEncounter(shielded, 0).player.resource).toBe(0)
  })

  it('makes Barkskin cost ten rage and grant its exclusive shield only with Broken Bark', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const createEncounter = (withTalent: boolean, resource: number) => {
      const build = {
        ...baseBuild,
        passiveTalentIds: withTalent ? ['druid_bear_t_broken_bark'] : [],
        loadout: { ...baseBuild.loadout, F: 'druid_bear_t_barkskin' as const },
      }
      const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
      return {
        ...encounter,
        player: { ...encounter.player, resource },
        enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
        runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      }
    }

    const untalented = activateSkill(createEncounter(false, 0), 'druid_bear_t_barkskin')
    const insufficient = createEncounter(true, 9)
    const talented = activateSkill(createEncounter(true, 30), 'druid_bear_t_barkskin')
    const shield = talented.player.buffs.find((status) => status.id === 'druid_bear_t_broken_bark_shield')

    expect(untalented.player.resource).toBe(0)
    expect(untalented.player.buffs.some((status) => status.id === 'druid_bear_t_broken_bark_shield')).toBe(false)
    expect(getSkillActivationBlockReason(insufficient, 'druid_bear_t_barkskin')).toContain('资源不足')
    expect(activateSkill(insufficient, 'druid_bear_t_barkskin')).toBe(insufficient)
    expect(talented.player.resource).toBe(20)
    expect(shield).toMatchObject({ absorbRemaining: 30, absorbRatio: 1, remainingMs: 5000 })
  })

  it('returns rage only when the Barkskin shield is consumed before expiry', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const build = {
      ...baseBuild,
      passiveTalentIds: ['druid_bear_t_broken_bark'],
      loadout: { ...baseBuild.loadout, F: 'druid_bear_t_barkskin' as const },
    }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const active = activateSkill({ ...encounter, player: { ...encounter.player, resource: 30 } }, 'druid_bear_t_barkskin')
    const quiet = {
      ...active,
      enemies: active.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...active.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const breaking = {
      ...active,
      player: {
        ...active.player,
        buffs: active.player.buffs.map((status) => status.id === 'druid_bear_t_broken_bark_shield'
          ? { ...status, absorbRemaining: 1 }
          : status),
      },
      runtime: { ...active.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
      enemies: active.enemies.map((enemy, index) => index === 0 ? {
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

    expect(tickEncounter(quiet, 5000).player.resource).toBe(20)
    expect(tickEncounter(breaking, 0).player.resource).toBe(50)
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

  it('dispels debuffs and heals ten-percent max hp when talented barkskin ends', () => {
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
        hp: encounter.player.maxHp * 0.5,
        debuffs: [
          { id: 'druid_bear_t_moonfire', effectLogicId: 'test_dispellable', label: '可驱散', shortLabel: '驱', remainingMs: 20000, totalMs: 20000, tone: 'danger' as const, kind: 'playerDebuff' as const },
          { id: 'druid_bear_t_rage_exhaustion', effectLogicId: 'bear_rage_exhaustion', label: '怒气枯竭', shortLabel: '竭', remainingMs: 20000, totalMs: 20000, tone: 'danger' as const, kind: 'playerDebuff' as const, dispellable: true },
          { id: 'slowDown', effectLogicId: 'slowDown_status', label: '不可驱散', shortLabel: '慢', remainingMs: 20000, totalMs: 20000, tone: 'danger' as const, kind: 'playerDebuff' as const },
        ],
      },
      enemies: encounter.enemies.map((enemy) => ({ ...enemy, cast: null, recoveryRemainingMs: 999999 })),
      runtime: { ...encounter.runtime, damageSources: [], partyAutoDamageRemainingMs: 999999 },
    }
    const active = activateSkill(debuffed, 'druid_bear_t_barkskin')
    const expired = tickEncounter(active, 10000)

    expect(expired.player.debuffs.map((status) => status.id)).toEqual(['slowDown'])
    expect(expired.player.hp).toBeCloseTo(encounter.player.maxHp * 0.6, 5)

    const watched = {
      ...debuffed,
      enemies: debuffed.enemies.map((enemy, index) => index === 0 ? {
        ...enemy,
        statuses: [...enemy.statuses, {
          id: 'murloc_watching',
          iconId: 'murlocWatching_status_pic',
          label: '鱼人在观察',
          shortLabel: '观',
          remainingMs: 20000,
          totalMs: 20000,
          tone: 'buff' as const,
          kind: 'enemyBuff' as const,
          effectLogicId: 'murlocWatching_status',
        }],
        cast: {
          id: 'murloc_watch',
          name: '鱼人观察',
          target: 'tank' as const,
          totalMs: 20000,
          remainingMs: 20000,
          breakRule: 'interruptOrControl' as const,
          dangerLevel: 'high' as const,
        },
      } : enemy),
    }
    const watchedExpired = tickEncounter(activateSkill(watched, 'druid_bear_t_barkskin'), 10000)
    expect(watchedExpired.player.debuffs.map((status) => status.id)).toEqual(['slowDown'])
    expect(watchedExpired.player.hp).toBeCloseTo(encounter.player.maxHp * 0.5, 5)
  })

  it('increases Bear and party damage with Mark of the Wild without an independent threat multiplier', () => {
    const stage = {
      ...getStageById('harbor-1'),
      playerAutoDamage: 0,
      playerAutoHeal: 0,
      partyAutoDamageIntervalMs: 0,
      partyAutoDamageTargetCount: 0,
      partyAutoHeal: 0,
      damageSources: [{
        sourceId: 'bear-party-offense-test',
        sourceKind: 'party_test',
        ownerSide: 'party' as const,
        sourceTags: ['party', 'auto-attack'],
        intervalMs: 1000,
        startReady: false,
        invalidTargetPolicy: 'pauseReady' as const,
        targetRule: 'lockedCurrentTarget' as const,
        targetSelector: 'currentTarget',
        targetCount: 1,
        damageMode: 'fixed' as const,
        baseDamage: 10,
        minDamage: 10,
        maxDamage: 10,
        threatMode: 'formula' as const,
        threatMultiplier: 1,
        flatThreat: 0,
        threatSource: 'party' as const,
        enabled: true,
      }],
    }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const createIsolatedState = (passiveTalentIds: string[]) => {
      const encounter = createInitialEncounterState(
        stage,
        'druid_bear_t',
        { ...baseBuild, passiveTalentIds },
      )
      return {
        ...encounter,
        stage: {
          ...encounter.stage,
          playerAutoDamage: stage.playerAutoDamage,
          playerAutoHeal: stage.playerAutoHeal,
          partyAutoDamageIntervalMs: stage.partyAutoDamageIntervalMs,
          partyAutoDamageTargetCount: stage.partyAutoDamageTargetCount,
          partyAutoHeal: stage.partyAutoHeal,
          damageSources: stage.damageSources,
        },
        player: { ...encounter.player, currentTargetId: encounter.enemies[0].id },
        party: { ...encounter.party, currentTargetId: encounter.enemies[0].id },
        enemies: encounter.enemies.map((enemy) => ({
          ...enemy,
          cast: null,
          recoveryRemainingMs: 999999,
        })),
      }
    }

    const baselineSkillState = createIsolatedState([])
    const markedSkillState = createIsolatedState(['druid_bear_t_mark_of_the_wild'])
    const baselineSkillResult = tickEncounter(activateSkill(baselineSkillState, 'druid_bear_t_mangle'), 0)
    const markedSkillResult = tickEncounter(activateSkill(markedSkillState, 'druid_bear_t_mangle'), 0)
    const baselineSkillDamage = baselineSkillState.enemies[0].hp - baselineSkillResult.enemies[0].hp
    const markedSkillDamage = markedSkillState.enemies[0].hp - markedSkillResult.enemies[0].hp
    const baselineSkillThreat = baselineSkillResult.enemies[0].tankThreat - baselineSkillState.enemies[0].tankThreat
    const markedSkillThreat = markedSkillResult.enemies[0].tankThreat - markedSkillState.enemies[0].tankThreat

    const baselinePartyState = createIsolatedState([])
    const markedPartyState = createIsolatedState(['druid_bear_t_mark_of_the_wild'])
    const baselinePartyResult = tickEncounter(baselinePartyState, 1000)
    const markedPartyResult = tickEncounter(markedPartyState, 1000)
    const getPartySourceDamage = (state: typeof baselinePartyResult) => state.runtime.combatLog
      .filter((event) => event.type === 'damage' && event.source.id === 'bear-party-offense-test')
      .reduce((total, event) => total + (event.type === 'damage' ? event.amount : 0), 0)
    const getPartyThreat = (state: typeof baselinePartyResult) => state.enemies
      .reduce((total, enemy) => total + enemy.allyThreat, 0)
    const baselinePartyDamage = getPartySourceDamage(baselinePartyResult)
    const markedPartyDamage = getPartySourceDamage(markedPartyResult)
    const baselinePartyThreat = getPartyThreat(baselinePartyResult) - getPartyThreat(baselinePartyState)
    const markedPartyThreat = getPartyThreat(markedPartyResult) - getPartyThreat(markedPartyState)

    expect(markedSkillDamage).toBeCloseTo(baselineSkillDamage * 1.25, 5)
    expect(markedSkillThreat).toBeCloseTo(baselineSkillThreat * 1.25, 5)
    expect(markedPartyDamage).toBeCloseTo(baselinePartyDamage * 1.25, 5)
    expect(markedPartyThreat).toBeCloseTo(baselinePartyThreat * 1.25, 5)
    expect(getPassiveModifiers(['druid_bear_t_mark_of_the_wild']).partyThreatMultiplier).toBe(1)
  })

  it('scales party damage with zero through three Ironfur stacks and drops immediately after expiration', () => {
    const stage = {
      ...getStageById('harbor-1'),
      playerAutoDamage: 0,
      playerAutoHeal: 0,
      partyAutoDamageIntervalMs: 0,
      partyAutoDamageTargetCount: 0,
      partyAutoHeal: 0,
      damageSources: [{
        sourceId: 'bear-party-offense-test',
        sourceKind: 'party_test',
        ownerSide: 'party' as const,
        sourceTags: ['party', 'auto-attack'],
        intervalMs: 1000,
        startReady: false,
        invalidTargetPolicy: 'pauseReady' as const,
        targetRule: 'lockedCurrentTarget' as const,
        targetSelector: 'currentTarget',
        targetCount: 1,
        damageMode: 'fixed' as const,
        baseDamage: 10,
        minDamage: 10,
        maxDamage: 10,
        threatMode: 'formula' as const,
        threatMultiplier: 1,
        flatThreat: 0,
        threatSource: 'party' as const,
        enabled: true,
      }],
    }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const createState = (stacks: number, remainingMs = 8000) => {
      const encounter = createInitialEncounterState(
        stage,
        'druid_bear_t',
        { ...baseBuild, passiveTalentIds: ['druid_bear_t_iron_thorns'] },
      )
      const withIronfur = activateSkill(
        { ...encounter, player: { ...encounter.player, resource: 100 } },
        'druid_bear_t_ironfur',
      )
      return {
        ...withIronfur,
        stage: {
          ...withIronfur.stage,
          playerAutoDamage: stage.playerAutoDamage,
          playerAutoHeal: stage.playerAutoHeal,
          partyAutoDamageIntervalMs: stage.partyAutoDamageIntervalMs,
          partyAutoDamageTargetCount: stage.partyAutoDamageTargetCount,
          partyAutoHeal: stage.partyAutoHeal,
          damageSources: stage.damageSources,
        },
        player: {
          ...withIronfur.player,
          currentTargetId: withIronfur.enemies[0].id,
          mitigation: stacks > 0 && withIronfur.player.mitigation
            ? { ...withIronfur.player.mitigation, stacks, remainingMs }
            : null,
        },
        party: { ...withIronfur.party, currentTargetId: withIronfur.enemies[0].id },
        enemies: withIronfur.enemies.map((enemy) => ({
          ...enemy,
          cast: null,
          recoveryRemainingMs: 999999,
        })),
      }
    }
    const resolvePartyDamage = (stacks: number) => {
      const state = createState(stacks)
      const result = tickEncounter(state, 1000)
      return result.runtime.combatLog
        .filter((event) => event.type === 'damage' && event.source.id === 'bear-party-offense-test')
        .reduce((total, event) => total + (event.type === 'damage' ? event.amount : 0), 0)
    }

    expect([0, 1, 2, 3].map(resolvePartyDamage)).toEqual([10, 11.5, 13, 14.5])

    const expiring = createState(3, 500)
    const expired = tickEncounter(expiring, 500)
    const afterNextAttack = tickEncounter(expired, 500)
    const postExpirationDamage = afterNextAttack.runtime.combatLog
      .slice(expired.runtime.combatLog.length)
      .filter((event) => event.type === 'damage' && event.source.id === 'bear-party-offense-test')
      .reduce((total, event) => total + (event.type === 'damage' ? event.amount : 0), 0)
    expect(expired.player.mitigation).toBeNull()
    expect(postExpirationDamage).toBe(10)
  })

  it('shortens party auto-attack intervals without changing per-hit threat or player intervals', () => {
    const stage = {
      ...getStageById('harbor-1'),
      playerAutoDamage: 3,
      playerAutoHeal: 0,
      partyAutoDamageIntervalMs: 0,
      partyAutoDamageTargetCount: 0,
      partyAutoHeal: 0,
      damageSources: [{
        sourceId: 'bear-party-offense-test',
        sourceKind: 'party_test',
        ownerSide: 'party' as const,
        sourceTags: ['party', 'auto-attack'],
        intervalMs: 1000,
        startReady: false,
        invalidTargetPolicy: 'pauseReady' as const,
        targetRule: 'lockedCurrentTarget' as const,
        targetSelector: 'currentTarget',
        targetCount: 1,
        damageMode: 'fixed' as const,
        baseDamage: 10,
        minDamage: 10,
        maxDamage: 10,
        threatMode: 'formula' as const,
        threatMultiplier: 1,
        flatThreat: 0,
        threatSource: 'party' as const,
        enabled: true,
      }],
    }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_0', 'druid_bear_t')
    const baseline = createInitialEncounterState(stage, 'druid_bear_t', { ...baseBuild, passiveTalentIds: [] })
    const inspired = createInitialEncounterState(
      stage,
      'druid_bear_t',
      { ...baseBuild, passiveTalentIds: ['druid_bear_t_natural_inspiration'] },
    )
    const baselinePartySource = baseline.runtime.damageSources.find((source) => source.ownerSide === 'party')
    const inspiredPartySource = inspired.runtime.damageSources.find((source) => source.ownerSide === 'party')
    const baselinePlayerSource = baseline.runtime.damageSources.find((source) => source.sourceKind === 'player_auto_attack')
    const inspiredPlayerSource = inspired.runtime.damageSources.find((source) => source.sourceKind === 'player_auto_attack')

    expect(baselinePartySource?.intervalMs).toBe(1000)
    expect(inspiredPartySource?.intervalMs).toBe(750)
    expect(inspiredPartySource?.remainingMs).toBe(750)
    expect(inspiredPlayerSource?.intervalMs).toBe(baselinePlayerSource?.intervalMs)

    const isolated = {
      ...inspired,
      stage: {
        ...inspired.stage,
        playerAutoDamage: stage.playerAutoDamage,
        playerAutoHeal: stage.playerAutoHeal,
        partyAutoDamageIntervalMs: stage.partyAutoDamageIntervalMs,
        partyAutoDamageTargetCount: stage.partyAutoDamageTargetCount,
        partyAutoHeal: stage.partyAutoHeal,
        damageSources: stage.damageSources,
      },
      player: { ...inspired.player, currentTargetId: inspired.enemies[0].id },
      party: { ...inspired.party, currentTargetId: inspired.enemies[0].id },
      enemies: inspired.enemies.map((enemy) => ({
        ...enemy,
        cast: null,
        recoveryRemainingMs: 999999,
      })),
    }
    const result = tickEncounter(isolated, 800)
    expect(result.runtime.combatLog
      .filter((event) => event.type === 'damage' && event.source.id === 'bear-party-offense-test')
      .reduce((total, event) => total + (event.type === 'damage' ? event.amount : 0), 0)).toBe(10)
    expect(result.enemies.reduce((total, enemy) => total + enemy.allyThreat, 0) -
      isolated.enemies.reduce((total, enemy) => total + enemy.allyThreat, 0)).toBe(10)
  })

  it('raises Guardian of the Grove party reduction to twenty-five percent', () => {
    const stage = { ...getStageById('harbor-1'), playerAutoHeal: 0 }
    const baseBuild = getDefaultPersistedBuildForRule('8slot_2', 'druid_bear_t')
    const build = { ...baseBuild, passiveTalentIds: ['druid_bear_t_guardian_of_the_grove'] }
    const encounter = createInitialEncounterState(stage, 'druid_bear_t', build)
    const synced = tickEncounter(encounter, 0)

    expect(synced.party.statuses.find((status) => status.id === 'druid_bear_t_guardian_of_the_grove')?.damageTakenMultiplierBonus).toBe(-0.25)
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
