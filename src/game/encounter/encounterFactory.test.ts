import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { applyEncounterWorkbookOverrides, getStageBuildRuleId } from '../data/encounterTemplates'
import {
  applyPlayerBuildWorkbookOverrides,
  getActiveSkillDefinition,
  getDefaultPersistedBuildForRule,
  getPassiveModifiers,
  getSkillEffectsForSkill,
  resetPlayerBuildCatalog,
} from '../data/playerBuildCatalog'
import {
  parseEncounterWorkbook,
  parseEnemyWorkbook,
  parsePlayerBuildWorkbook,
  parseStageWorkbook,
} from '../data/workbookLoader'
import { applyEnemyWorkbookOverrides } from '../data/enemyCatalog'
import { getEnemyStatusDefinition } from '../data/enemyCatalog'
import { applyStageWorkbookOverrides, getStageById } from '../data/stageTemplates'
import {
  activateSkill,
  applyBuildConfiguration,
  closePauseOverlay,
  createInitialEncounterState,
  getEncounterWarning,
  getSkillActivationBlockReason,
  openPauseOverlay,
  playerSkillNeedsEnemyTarget,
  resolveEnemyTargetIdsBySelector,
  selectEnemy,
  tickEncounter,
} from './encounterFactory'
import { createEnemyStatusEffect } from './encounterStatusEffects'
import { applyEnemyStatusOnApply } from './enemyStatusEffectRegistry'
import { buildEncounterStats } from './combatStats'
import { enqueueEncounterCommand } from './encounterCommands'
import {
  dispatchEncounterCommand,
  flushEncounterCommands,
} from './encounterCommandSystem'
import { enqueueEncounterEvent } from './encounterEvents'
import type { DamageSourceThreatSource, EncounterState } from './encounterTypes'

function createHarborEncounter() {
  const stage = getStageById('harbor-1')
  const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
  return createInitialEncounterState(stage, build)
}

function createHarborEncounterWithStandardBuild() {
  const stage = getStageById('harbor-1')
  const build = getDefaultPersistedBuildForRule('standard_5slot')
  return createInitialEncounterState(stage, build)
}

function createHarborEncounterWithBuildOverride(
  loadoutOverrides: Partial<ReturnType<typeof getDefaultPersistedBuildForRule>['loadout']>,
) {
  const stage = getStageById('harbor-1')
  const baseBuild = getDefaultPersistedBuildForRule('standard_5slot')
  return createInitialEncounterState(stage, {
    ...baseBuild,
    loadout: {
      ...baseBuild.loadout,
      ...loadoutOverrides,
    },
  })
}

function createWestFallEncounterWithBuildOverride(
  loadoutOverrides: Partial<ReturnType<typeof getDefaultPersistedBuildForRule>['loadout']>,
) {
  const stage = getStageById('WestFall-1')
  const baseBuild = getDefaultPersistedBuildForRule('standard_5slot')
  return createInitialEncounterState(stage, {
    ...baseBuild,
    loadout: {
      ...baseBuild.loadout,
      ...loadoutOverrides,
    },
  })
}

function stripStageSpecialRules<T extends ReturnType<typeof createInitialEncounterState>>(encounter: T): T {
  return {
    ...encounter,
    stage: {
      ...encounter.stage,
      specialRules: [],
    },
    runtime: {
      ...encounter.runtime,
      stageRuleRuntime: {},
    },
  }
}

function emptyPlayerBuildOverrides() {
  return {
    classDefinitions: [],
    buildRuleDefinitions: [],
    activeSkillDefinitions: [],
    activeSkillEffectDefinitions: [],
    activeStatusDefinitions: [],
    passiveTalentDefinitions: [],
    passiveTalentEffectDefinitions: [],
    passiveStatusDefinitions: [],
    defaultActiveBuilds: [],
    defaultPassiveBuilds: [],
    iconDefinitions: [],
  }
}

function emptyEncounterWorkbookOverrides() {
  return {
    openingOverrides: {},
    placementOverrides: {},
    openingStatusOverrides: {},
    affixBindings: {},
    affixDefinitions: {},
    specialRuleBindings: {},
    specialRuleDefinitions: {},
  }
}

function loadCurrentDesignerWorkbooks() {
  applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
  applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
  applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
  applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))
}

function resetDesignerWorkbookOverrides() {
  applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
  applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
  applyEnemyWorkbookOverrides({
    enemyDefinitions: [],
    skillDefinitions: [],
    enemyBuffDefinitions: [],
    playerDebuffDefinitions: [],
    partyDebuffDefinitions: [],
    iconDefinitions: [],
  })
  resetPlayerBuildCatalog()
}

function withTemporaryStunTargeting(
  targetingType: string,
  targetSelector: string,
  run: () => void,
) {
  const originalSkill = getActiveSkillDefinition('warrior_t_stun')
  const originalEffect = getSkillEffectsForSkill('warrior_t_stun').find(
    (effect) => effect.skillEffectId === 'warrior_t_stun_main',
  )

  if (!originalSkill || !originalEffect) {
    throw new Error('warrior_t_stun sample data is missing')
  }

  applyPlayerBuildWorkbookOverrides({
    ...emptyPlayerBuildOverrides(),
    activeSkillDefinitions: [
      {
        skillId: 'warrior_t_stun',
        targetingType,
      },
    ],
    activeSkillEffectDefinitions: [
      {
        skillEffectId: 'warrior_t_stun_main',
        targetSelector,
      },
    ],
  })

  try {
    run()
  } finally {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'warrior_t_stun',
          targetingType: originalSkill.targetingType,
        },
      ],
      activeSkillEffectDefinitions: [
        {
          skillEffectId: 'warrior_t_stun_main',
          targetSelector: originalEffect.targetSelector,
        },
      ],
    })
  }
}

function withTemporarySkillEffectOverrides(
  effectOverrides: Array<{
    skillId: string
    skillEffectId: string
    skillLogicId?: string
    resourceCost?: number
    targetingType?: string
    targetSelector?: string
    valueA?: number
    valueB?: number
    durationMs?: number
    statusId?: string
    threatDelta?: number
    threatMultiplier?: number
    threatSource?: DamageSourceThreatSource
  }>,
  run: () => void,
) {
  const originalSkills = effectOverrides.map((override) => ({
    skillId: override.skillId,
    definition: getActiveSkillDefinition(override.skillId),
  }))
  const originalEffects = effectOverrides.map((override) => ({
    skillEffectId: override.skillEffectId,
    effect: getSkillEffectsForSkill(override.skillId).find(
      (effect) => effect.skillEffectId === override.skillEffectId,
    ),
  }))

  applyPlayerBuildWorkbookOverrides({
    ...emptyPlayerBuildOverrides(),
    activeSkillDefinitions: effectOverrides.flatMap((override) =>
      override.targetingType || override.skillLogicId || typeof override.resourceCost === 'number'
        ? [
            {
              skillId: override.skillId,
              ...(override.targetingType ? { targetingType: override.targetingType } : {}),
              ...(override.skillLogicId ? { skillLogicId: override.skillLogicId } : {}),
              ...(typeof override.resourceCost === 'number' ? { resourceCost: override.resourceCost } : {}),
            },
          ]
        : [],
    ),
    activeSkillEffectDefinitions: effectOverrides.map((override) => ({
      skillEffectId: override.skillEffectId,
      skillId: override.skillId,
      ...(override.targetSelector ? { targetSelector: override.targetSelector } : {}),
      ...(typeof override.valueA === 'number' ? { valueA: override.valueA } : {}),
      ...(typeof override.valueB === 'number' ? { valueB: override.valueB } : {}),
      ...(typeof override.durationMs === 'number' ? { durationMs: override.durationMs } : {}),
      ...(typeof override.threatDelta === 'number' ? { threatDelta: override.threatDelta } : {}),
      ...(typeof override.threatMultiplier === 'number' ? { threatMultiplier: override.threatMultiplier } : {}),
      ...(override.threatSource ? { threatSource: override.threatSource } : {}),
      ...(typeof override.statusId === 'string' ? { statusId: override.statusId } : {}),
    })),
  })

  try {
    run()
  } finally {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: originalSkills.flatMap((entry) =>
        entry.definition
          ? [
              {
                skillId: entry.skillId,
                targetingType: entry.definition.targetingType,
                skillLogicId: entry.definition.skillLogicId,
                resourceCost: entry.definition.resourceCost,
              },
            ]
          : [],
      ),
      activeSkillEffectDefinitions: originalEffects.flatMap((entry) =>
        entry.effect
          ? [
              {
                skillEffectId: entry.skillEffectId,
                skillId: entry.effect.skillId,
                targetSelector: entry.effect.targetSelector,
                ...(typeof entry.effect.valueA === 'number' ? { valueA: entry.effect.valueA } : {}),
                ...(typeof entry.effect.valueB === 'number' ? { valueB: entry.effect.valueB } : {}),
                ...(typeof entry.effect.durationMs === 'number' ? { durationMs: entry.effect.durationMs } : {}),
                ...(typeof entry.effect.threatDelta === 'number' ? { threatDelta: entry.effect.threatDelta } : {}),
                ...(typeof entry.effect.threatMultiplier === 'number' ? { threatMultiplier: entry.effect.threatMultiplier } : {}),
                ...(entry.effect.threatSource ? { threatSource: entry.effect.threatSource } : {}),
                ...(typeof entry.effect.statusId === 'string' ? { statusId: entry.effect.statusId } : {}),
              },
            ]
          : [],
      ),
    })
  }
}

function withEnemyCasting(
  encounter: ReturnType<typeof createHarborEncounterWithStandardBuild>,
  skillId: string,
  breakRule: 'interruptOrControl' | 'controlOnly' | 'unstoppable',
  options?: {
    targetEnemyId?: string
    isSkull?: boolean
    remainingMs?: number
    phase?: 'casting' | 'channeling'
  },
) {
  const targetEnemy =
    (options?.targetEnemyId
      ? encounter.enemies.find((enemy) => enemy.id === options.targetEnemyId)
      : encounter.enemies.find((enemy) => enemy.skillIds.includes(skillId))) ?? encounter.enemies[0]

  if (!targetEnemy) {
    throw new Error('No target enemy available for test')
  }

  const nextState = {
    ...encounter,
    player: {
      ...encounter.player,
      currentTargetId: targetEnemy.id,
    },
    enemies: encounter.enemies.map((enemy) =>
      enemy.id === targetEnemy.id
        ? ({
            ...enemy,
            isSkull: options?.isSkull ?? enemy.isSkull,
            skillCycleIndex: Math.max(0, enemy.skillCycle.indexOf(skillId)),
            cast: {
              id: skillId,
              name: skillId,
              target: enemy.target,
              totalMs: options?.remainingMs ?? 1500,
              remainingMs: options?.remainingMs ?? 1500,
              breakRule,
              dangerLevel: 'high',
              ...(options?.phase ? { phase: options.phase } : {}),
            },
          } as typeof enemy)
        : enemy,
    ),
  } as typeof encounter

  return {
    encounter: nextState,
    targetEnemyId: targetEnemy.id,
  }
}

describe('encounterFactory hand-cast flow', () => {
  it('creates the first three RingingDeeps stages from current designer workbooks', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))

    try {
      const first = createInitialEncounterState(
        getStageById('RingingDeeps-1'),
        getDefaultPersistedBuildForRule(getStageBuildRuleId(getStageById('RingingDeeps-1'))),
      )
      expect(first.stage.playerMaxHp).toBe(50)
      expect(first.player.maxHp).toBe(75)
      expect(first.party.hp).toBe(50)
      expect(first.party.maxHp).toBe(50)
      expect(first.party.maxPressure).toBe(50)
      expect(first.enemies.map((enemy) => enemy.definitionId)).toEqual(['kobold_miner', 'kobold_miner'])
      expect(first.enemies.every((enemy) => enemy.hp === enemy.maxHp)).toBe(true)
      expect(first.enemies.every((enemy) => enemy.skillCycle.includes('work_work'))).toBe(true)

      const second = createInitialEncounterState(
        getStageById('RingingDeeps-2'),
        getDefaultPersistedBuildForRule(getStageBuildRuleId(getStageById('RingingDeeps-2'))),
      )
      expect(second.enemies.map((enemy) => enemy.definitionId)).toEqual(['kobold_apprentice', 'kobold_apprentice'])
      expect(second.enemies.every((enemy) => enemy.skillCycle[0] === 'flame_missiles')).toBe(true)

      const third = createInitialEncounterState(
        getStageById('RingingDeeps-3'),
        getDefaultPersistedBuildForRule(getStageBuildRuleId(getStageById('RingingDeeps-3'))),
      )
      expect(third.stage.playerMaxHp).toBe(80)
      expect(third.player.maxHp).toBe(120)
      expect(third.enemies.map((enemy) => enemy.definitionId)).toEqual(['kobold_monk', 'kobold_miner'])
      expect(third.enemies[0]).toEqual(expect.objectContaining({ hp: 180, maxHp: 180 }))
      expect(third.enemies[0].skillCycle).toContain('wind_strike')
    } finally {
      applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
      applyEncounterWorkbookOverrides({
        openingOverrides: {},
        placementOverrides: {},
        openingStatusOverrides: {},
        affixBindings: {},
        affixDefinitions: {},
        specialRuleBindings: {},
        specialRuleDefinitions: {},
      })
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
      resetPlayerBuildCatalog()
    }
  })

  it('creates all six RingingDeeps stages from current designer workbooks', () => {
    applyStageWorkbookOverrides(parseStageWorkbook(XLSX.readFile('public/designer-data/stage_content.xlsx')))
    applyEncounterWorkbookOverrides(parseEncounterWorkbook(XLSX.readFile('public/designer-data/encounter_balance.xlsx')))
    applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(XLSX.readFile('public/designer-data/player_build.xlsx')))

    try {
      const expected = [
        {
          stageId: 'RingingDeeps-1',
          buildRuleId: 'tutorial_2slot',
          enemyDefinitionIds: ['kobold_miner', 'kobold_miner'],
          unlockedActiveSkillIds: ['warrior_t_taunt'],
          specialRuleLogicIds: ['sensitiveParty', 'watchAndLearn'],
        },
        {
          stageId: 'RingingDeeps-2',
          buildRuleId: 'tutorial_2slot',
          enemyDefinitionIds: ['kobold_apprentice', 'kobold_apprentice'],
          unlockedActiveSkillIds: ['warrior_t_interrupt'],
          specialRuleLogicIds: ['sensitiveParty', 'watchAndLearn'],
        },
        {
          stageId: 'RingingDeeps-3',
          buildRuleId: 'tutorial_2slot',
          enemyDefinitionIds: ['kobold_monk', 'kobold_miner'],
          unlockedActiveSkillIds: ['warrior_t_stun'],
          specialRuleLogicIds: ['sensitiveParty', 'watchAndLearn'],
        },
        {
          stageId: 'RingingDeeps-4',
          buildRuleId: 'standard_5slot',
          enemyDefinitionIds: [
            'kobold_geomancer',
            'kobold_miner',
            'kobold_monk',
            'kobold_apprentice',
          ],
          unlockedActiveSkillIds: ['warrior_t_mass_taunt'],
          specialRuleLogicIds: ['sensitiveParty', 'watchAndLearn'],
        },
        {
          stageId: 'RingingDeeps-5',
          buildRuleId: 'standard_5slot',
          enemyDefinitionIds: [
            'kobold_monk',
            'kobold_rummager',
            'kobold_apprentice',
            'kobold_apprentice',
          ],
          unlockedActiveSkillIds: ['warrior_t_shield_wall'],
          specialRuleLogicIds: ['sensitiveParty', 'watchAndLearn'],
        },
        {
          stageId: 'RingingDeeps-6',
          buildRuleId: 'standard_5slot',
          enemyDefinitionIds: ['kobold_apprentice', 'kobold_apprentice', 'The_Candle_King', 'kobold_rummager'],
          unlockedActiveSkillIds: [],
          specialRuleLogicIds: ['sensitiveParty?', 'watchAndLearn'],
        },
      ]

      for (const entry of expected) {
        const stage = getStageById(entry.stageId)
        const encounter = createInitialEncounterState(
          stage,
          getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
        )

        expect(getStageBuildRuleId(stage)).toBe(entry.buildRuleId)
        expect(stage.unlockedActiveSkillIds).toEqual(entry.unlockedActiveSkillIds)
        expect(encounter.enemies.map((enemy) => enemy.definitionId)).toEqual(entry.enemyDefinitionIds)
        expect(encounter.enemies.every((enemy) => enemy.hp > 0 && enemy.maxHp > 0)).toBe(true)
        expect(encounter.enemies.every((enemy) => enemy.skillCycle.length > 0)).toBe(true)
        expect(encounter.stage.affixes.map((affix) => affix.affixId)).toEqual(['affix_dislike'])
        expect(encounter.stage.specialRules.map((rule) => rule.ruleLogicId)).toEqual(entry.specialRuleLogicIds)
      }
    } finally {
      applyStageWorkbookOverrides({ areaOverrides: [], stageOverrides: [], legendOverrides: [] })
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
      resetPlayerBuildCatalog()
    }
  })

  it('starts combat with opening caps from encounter workbook overrides', () => {
    try {
      applyEncounterWorkbookOverrides({
        openingOverrides: {
          'harbor-1': {
            playerHp: 777,
            playerMaxHp: 1200,
            partyHp: 888,
            partyMaxHp: 1500,
            partyPressure: 33,
            partyMaxPressure: 140,
          },
        },
        placementOverrides: {},
        openingStatusOverrides: {},
        affixBindings: {},
        affixDefinitions: {},
        specialRuleBindings: {},
        specialRuleDefinitions: {},
      })

      const stage = getStageById('harbor-1')
      const baseBuild = getDefaultPersistedBuildForRule('standard_5slot')
      const encounter = createInitialEncounterState(stage, {
        ...baseBuild,
        passiveTalentIds: [],
      })

      expect(encounter.player.hp).toBe(777)
      expect(encounter.player.maxHp).toBe(1200)
      expect(encounter.party.hp).toBe(888)
      expect(encounter.party.maxHp).toBe(1500)
      expect(encounter.party.pressure).toBe(33)
      expect(encounter.party.maxPressure).toBe(140)
    } finally {
      applyEncounterWorkbookOverrides({
        openingOverrides: {},
        placementOverrides: {},
        openingStatusOverrides: {},
        affixBindings: {},
        affixDefinitions: {},
        specialRuleBindings: {},
        specialRuleDefinitions: {},
      })
    }
  })

  it('uses encounter opening player auto damage and player and party auto healing fields', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        openingOverrides: {
          'harbor-1': {
            playerHp: 80,
            playerMaxHp: 100,
            partyHp: 70,
            partyMaxHp: 100,
            playerAutoDamage: 7,
            playerAutoHeal: 5,
            partyAutoHeal: 9,
            partyAutoDamageIntervalMs: 0,
            partyAutoDamageTargetCount: 0,
          },
        },
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'auto-field-target',
              enemyId: 'harbor_raider',
              row: 1,
              col: 1,
              maxHpOverride: 100,
              openingRecoveryRemainingMs: 999999,
            },
          ],
        },
      })

      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const targetBefore = encounter.enemies[0]
      const afterOneSecond = tickEncounter({
        ...encounter,
        stage: {
          ...encounter.stage,
          specialRules: [],
          damageSources: encounter.stage.damageSources.filter((source) => source.sourceId !== 'party_ambient_random'),
        },
        runtime: {
          ...encounter.runtime,
          stageRuleRuntime: {},
          pendingAffixTriggers: [],
          damageSources: [],
        },
      }, 1000)
      const targetAfter = afterOneSecond.enemies.find((enemy) => enemy.id === targetBefore.id)

      expect(encounter.stage.playerAutoDamage).toBe(7)
      expect(encounter.stage.playerAutoHeal).toBe(5)
      expect(encounter.stage.partyAutoHeal).toBe(9)
      expect(targetBefore.hp - (targetAfter?.hp ?? 0)).toBe(7)
      expect(afterOneSecond.player.hp - encounter.player.hp).toBe(5)
      expect(afterOneSecond.party.hp - encounter.party.hp).toBe(9)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('allows mostInjured enemy skills to target the most injured living enemy including self', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'dark-mend',
          targetRuleId: 'mostInjured',
          castTimeMs: 1000,
          recoveryMs: 500,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: ['fortified'],
          appliedSelfStatusIds: [],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const configured = {
        ...encounter,
        enemies: encounter.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                hp: 40,
                maxHp: 100,
                skillIds: ['dark-mend'],
                skillCycle: ['dark-mend'],
                skillCycleIndex: 0,
                cast: null,
                recoveryRemainingMs: 0,
              }
            : index === 1
              ? {
                  ...enemy,
                  hp: 75,
                  maxHp: 100,
                }
              : {
                  ...enemy,
                  hp: 0,
                  cast: null,
                },
        ),
      }

      const casting = tickEncounter(configured, 0)
      const caster = casting.enemies[0]

      expect(caster.cast?.target).toBe('enemy')

      const completed = tickEncounter(casting, 1000)
      expect(completed.enemies[0].statuses.some((status) => status.id === 'fortified')).toBe(true)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('defaults player auto damage to 3 and auto healing to 0 when opening fields are blank', () => {
    try {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())

      const encounter = createHarborEncounterWithStandardBuild()

      expect(encounter.stage.playerAutoDamage).toBe(3)
      expect(encounter.stage.playerAutoHeal).toBe(0)
      expect(encounter.stage.partyAutoHeal).toBe(0)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('allows encounter opening party max hp below the old demo floor', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        openingOverrides: {
          'harbor-1': {
            partyHp: 50,
            partyMaxHp: 50,
          },
        },
      })

      const stage = getStageById('harbor-1')
      const baseBuild = getDefaultPersistedBuildForRule('standard_5slot')
      const encounter = createInitialEncounterState(stage, {
        ...baseBuild,
        passiveTalentIds: [],
      })

      expect(encounter.party.hp).toBe(50)
      expect(encounter.party.maxHp).toBe(50)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('defaults enemies with blank hp override to full max hp at combat start', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'blank-hp-default',
              enemyId: 'harbor_raider',
              row: 1,
              col: 1,
              maxHpOverride: 123,
              openingRecoveryRemainingMs: 5000,
            },
          ],
        },
      })

      const encounter = createHarborEncounterWithStandardBuild()

      expect(encounter.enemies[0].maxHp).toBe(123)
      expect(encounter.enemies[0].hp).toBe(123)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('uses enemy base max hp directly when placement max hp override is blank', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        placementOverrides: {
          'harbor-3': [
            {
              stageId: 'harbor-3',
              spawnId: 'base-hp-direct',
              enemyId: 'harbor_breaker',
              row: 1,
              col: 1,
              openingRecoveryRemainingMs: 5000,
            },
          ],
        },
      })

      const stage = getStageById('harbor-3')
      const encounter = createInitialEncounterState(stage, {
        ...getDefaultPersistedBuildForRule('standard_5slot'),
        passiveTalentIds: [],
      })

      expect(encounter.enemies[0].maxHp).toBe(156)
      expect(encounter.enemies[0].hp).toBe(156)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('selects the topmost then leftmost living enemy as the initial player target', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'row-two-left',
              enemyId: 'harbor_raider',
              row: 2,
              col: 1,
              openingRecoveryRemainingMs: 5000,
            },
            {
              stageId: 'harbor-1',
              spawnId: 'row-one-right',
              enemyId: 'harbor_raider',
              row: 1,
              col: 3,
              openingRecoveryRemainingMs: 5000,
            },
            {
              stageId: 'harbor-1',
              spawnId: 'row-one-left',
              enemyId: 'harbor_raider',
              row: 1,
              col: 2,
              openingRecoveryRemainingMs: 5000,
            },
          ],
        },
      })

      const encounter = createHarborEncounterWithStandardBuild()

      expect(encounter.player.currentTargetId).toBe('row-one-left')
      expect(encounter.party.currentTargetId).toBe('row-one-left')
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('uses explicit opening threat fields and party auto damage max for non-bloodlust threat presentation', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        openingOverrides: {
          'harbor-1': {
            partyAutoDamageMax: 20,
          },
        },
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'test-lost',
              enemyId: 'harbor_raider',
              row: 1,
              col: 1,
              openingTankThreat: 99,
              openingAllyThreat: 100,
              openingRecoveryRemainingMs: 5000,
            },
            {
              stageId: 'harbor-1',
              spawnId: 'test-warning-low',
              enemyId: 'harbor_raider',
              row: 1,
              col: 2,
              openingTankThreat: 100,
              openingAllyThreat: 100,
              openingRecoveryRemainingMs: 5000,
            },
            {
              stageId: 'harbor-1',
              spawnId: 'test-warning-high',
              enemyId: 'harbor_raider',
              row: 1,
              col: 3,
              openingTankThreat: 119,
              openingAllyThreat: 100,
              openingRecoveryRemainingMs: 5000,
            },
            {
              stageId: 'harbor-1',
              spawnId: 'test-safe',
              enemyId: 'harbor_raider',
              row: 1,
              col: 4,
              openingTankThreat: 120,
              openingAllyThreat: 100,
              openingRecoveryRemainingMs: 5000,
            },
          ],
        },
      })

      const encounter = createHarborEncounterWithStandardBuild()

      expect(encounter.enemies.map((enemy) => ({
        id: enemy.id,
        tankThreat: enemy.tankThreat,
        allyThreat: enemy.allyThreat,
        target: enemy.target,
        threatState: enemy.threatState,
      }))).toEqual([
        { id: 'test-lost', tankThreat: 99, allyThreat: 100, target: 'ally', threatState: 'lost' },
        { id: 'test-warning-low', tankThreat: 100, allyThreat: 100, target: 'tank', threatState: 'warning' },
        { id: 'test-warning-high', tankThreat: 119, allyThreat: 100, target: 'tank', threatState: 'warning' },
        { id: 'test-safe', tankThreat: 120, allyThreat: 100, target: 'tank', threatState: 'safe' },
      ])
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('does not add implicit threat while time passes or when an enemy cast resolves', () => {
    const baseEncounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
    const encounter = {
      ...baseEncounter,
      stage: {
        ...baseEncounter.stage,
        partyAutoDamageIntervalMs: 0,
      },
    }
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              tankThreat: 50,
              allyThreat: 40,
              cast: {
                id: 'bone-jab',
                name: 'bone-jab',
                target: 'tank' as const,
                totalMs: 1000,
                remainingMs: 1000,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'low' as const,
              },
              recoveryRemainingMs: 5000,
            }
          : {
              ...enemy,
              tankThreat: 25,
              allyThreat: 15,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: encounter.runtime.damageSources.filter((source) => source.sourceId === 'player_auto_attack'),
        partyAutoDamageRemainingMs: 0,
      },
    }

    const elapsed = tickEncounter(configured, 500)
    expect(elapsed.enemies[0]).toEqual(expect.objectContaining({ tankThreat: 50, allyThreat: 40 }))
    expect(elapsed.enemies[1]).toEqual(expect.objectContaining({ tankThreat: 25, allyThreat: 15 }))

    const resolved = tickEncounter(elapsed, 500)
    expect(resolved.enemies[0]).toEqual(expect.objectContaining({ tankThreat: 50, allyThreat: 40 }))
  })

  it('clears threat when an irregular enemy completes a full skill-cycle round', () => {
    const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              threatLogic: 'irregular' as const,
              skillCycle: ['bone-jab', 'reckless-rush'],
              skillCycleIndex: 1,
              tankThreat: 77,
              allyThreat: 33,
              cast: {
                id: 'reckless-rush',
                name: 'reckless-rush',
                target: 'tank' as const,
                totalMs: 1000,
                remainingMs: 1,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'low' as const,
              },
              recoveryRemainingMs: 5000,
            }
          : {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 0,
      },
    }

    const resolved = tickEncounter(configured, 1)
    const irregularEnemy = resolved.enemies[0]

    expect(irregularEnemy.skillCycleIndex).toBe(0)
    expect(irregularEnemy.tankThreat).toBe(0)
    expect(irregularEnemy.allyThreat).toBe(0)
  })

  it('locks threat-target casts when the cast starts but updates threat presentation from live threat', () => {
    const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              skillCycle: ['bone-jab'],
              skillCycleIndex: 0,
              tankThreat: 100,
              allyThreat: 90,
              cast: null,
              recoveryRemainingMs: 0,
            }
          : {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 0,
      },
    }

    const castStarted = tickEncounter(configured, 0)
    expect(castStarted.enemies[0].cast?.target).toBe('tank')

    const overtakenDuringCast = {
      ...castStarted,
      enemies: castStarted.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              tankThreat: 100,
              allyThreat: 140,
            }
          : enemy,
      ),
    }
    const stillCasting = tickEncounter(overtakenDuringCast, 100)
    expect(stillCasting.enemies[0].cast?.target).toBe('tank')
    expect(stillCasting.enemies[0].threatState).toBe('lost')

    const recovering = {
      ...stillCasting,
      enemies: stillCasting.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            }
          : enemy,
      ),
    }
    const liveTarget = tickEncounter(recovering, 100)
    expect(liveTarget.enemies[0].cast).toBeNull()
    expect(liveTarget.enemies[0].target).toBe('ally')
  })

  it('treats opening recovery as idle time before starting the configured skill-cycle slot at full cast time', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'test-caster',
              enemyId: 'harbor_pyromancer',
              row: 1,
              col: 1,
              openingCastSkillNum: 2,
              openingRecoveryRemainingMs: 1000,
              openingTankThreat: 10,
              openingAllyThreat: 0,
            },
          ],
        },
      })

      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const configured = {
        ...encounter,
        runtime: {
          ...encounter.runtime,
          damageSources: [],
          partyAutoDamageRemainingMs: 0,
        },
      }
      expect(configured.enemies[0].cast).toBeNull()
      expect(configured.enemies[0].recoveryRemainingMs).toBe(1000)

      const nearlyReady = tickEncounter(configured, 999)
      expect(nearlyReady.enemies[0].cast).toBeNull()

      const castStarted = tickEncounter(nearlyReady, 1)
      expect(castStarted.enemies[0].cast).toEqual(
        expect.objectContaining({
          id: 'ember-bolt',
          remainingMs: expect.any(Number),
          totalMs: expect.any(Number),
        }),
      )
      expect(castStarted.enemies[0].cast?.remainingMs).toBe(castStarted.enemies[0].cast?.totalMs)
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('uses enemy definition skill cycle, threat logic, and skull flag instead of placement overrides', () => {
    try {
      applyEncounterWorkbookOverrides({
        ...emptyEncounterWorkbookOverrides(),
        placementOverrides: {
          'harbor-1': [
            {
              stageId: 'harbor-1',
              spawnId: 'test-definition-driven',
              enemyId: 'harbor_stalker',
              row: 1,
              col: 1,
              openingCastSkillNum: 2,
              openingRecoveryRemainingMs: 1000,
              openingTankThreat: 10,
              openingAllyThreat: 0,
            },
          ],
        },
      })

      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const enemy = encounter.enemies[0]

      expect(enemy.skillCycle).toEqual(['feint-slash', 'backstab'])
      expect(enemy.threatLogic).toBe('irregular')
      expect(enemy.isSkull).toBe(false)

      const castStarted = tickEncounter({
        ...encounter,
        runtime: {
          ...encounter.runtime,
          damageSources: [],
          partyAutoDamageRemainingMs: 0,
        },
      }, 1000)

      expect(castStarted.enemies[0].cast?.id).toBe('backstab')
    } finally {
      applyEncounterWorkbookOverrides(emptyEncounterWorkbookOverrides())
    }
  })

  it('uses bloodlust target selection directly as bloodlust threat presentation', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const bloodlustEnemy = encounter.enemies[0]
    const partyTargetState = tickEncounter({
      ...encounter,
      player: {
        ...encounter.player,
        hp: 900,
        maxHp: 1000,
      },
      party: {
        ...encounter.party,
        hp: 300,
        maxHp: 1000,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              threatLogic: 'bloodlust' as const,
              cast: null,
              recoveryRemainingMs: 5000,
            }
          : {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 0,
      },
    }, 100)

    expect(partyTargetState.enemies.find((enemy) => enemy.id === bloodlustEnemy.id)).toEqual(
      expect.objectContaining({ target: 'ally', threatState: 'lost' }),
    )

    const lockedTankCastState = tickEncounter({
      ...partyTargetState,
      enemies: partyTargetState.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              cast: {
                id: 'bone-jab',
                name: 'bone-jab',
                target: 'tank' as const,
                totalMs: 1000,
                remainingMs: 900,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'low' as const,
              },
            }
          : enemy,
      ),
    }, 100)

    expect(lockedTankCastState.enemies.find((enemy) => enemy.id === bloodlustEnemy.id)).toEqual(
      expect.objectContaining({ threatState: 'safe' }),
    )
  })

  it('shows battle warning for high danger casts regardless of tank or party target', () => {
    const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
    const highTankCast = {
      ...encounter,
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              cast: {
                id: 'bone-jab',
                name: 'High Tank Cast',
                target: 'tank' as const,
                totalMs: 1000,
                remainingMs: 500,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'high' as const,
              },
            }
          : {
              ...enemy,
              cast: null,
            },
      ),
    }
    const highPartyCast = {
      ...highTankCast,
      enemies: highTankCast.enemies.map((enemy, index) =>
        index === 0 && enemy.cast
          ? {
              ...enemy,
              cast: {
                ...enemy.cast,
                target: 'party' as const,
              },
            }
          : enemy,
      ),
    }

    expect(getEncounterWarning(highTankCast)).toContain('High Tank Cast')
    expect(getEncounterWarning(highPartyCast)).toContain('High Tank Cast')
  })

  it('does not show battle warning for medium danger party casts', () => {
    const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
    const mediumPartyCast = {
      ...encounter,
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              target: 'tank' as const,
              cast: {
                id: 'bone-jab',
                name: 'Medium Party Cast',
                target: 'party' as const,
                totalMs: 1000,
                remainingMs: 500,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'medium' as const,
              },
            }
          : {
              ...enemy,
              target: 'tank' as const,
              cast: null,
            },
      ),
    }

    expect(getEncounterWarning(mediumPartyCast)).not.toContain('Medium Party Cast')
  })

  it('keeps negative-duration statuses active until explicitly removed', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const permanentEnemyStatus = {
      id: 'permanent-test-status',
      label: '永久测试',
      shortLabel: '永',
      remainingMs: -1,
      totalMs: -1,
      tone: 'danger' as const,
      kind: 'enemyBuff' as const,
    }
    const configured = {
      ...encounter,
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              statuses: [permanentEnemyStatus],
            }
          : enemy,
      ),
    }

    const nextState = tickEncounter(configured, 60_000)
    const status = nextState.enemies[0].statuses.find((entry) => entry.id === permanentEnemyStatus.id)

    expect(status).toEqual(expect.objectContaining({ remainingMs: -1, totalMs: -1 }))
  })

  it('initializes runtime command and event queues empty with no rejected command message', () => {
    const encounter = createHarborEncounter()

    expect(encounter.runtime.commandQueue).toEqual([])
    expect(encounter.runtime.eventQueue).toEqual([])
    expect(encounter.runtime.lastRejectedCommandMessage).toBeNull()
    expect(encounter.runtime.lastProcessedEvents).toEqual([])
  })

  it('enqueueEncounterCommand preserves submit order', () => {
    const encounter = createHarborEncounter()

    const withFirstCommand = enqueueEncounterCommand(encounter, {
      type: 'player/select-target',
      submittedAtMs: 10,
      targetEnemyId: 'enemy-a',
    })
    const withSecondCommand = enqueueEncounterCommand(withFirstCommand, {
      type: 'player/activate-skill',
      submittedAtMs: 20,
      skillId: 'warrior_t_stun',
    })

    expect(withSecondCommand.runtime.commandQueue).toEqual([
      {
        type: 'player/select-target',
        submittedAtMs: 10,
        targetEnemyId: 'enemy-a',
      },
      {
        type: 'player/activate-skill',
        submittedAtMs: 20,
        skillId: 'warrior_t_stun',
      },
    ])
  })

  it('enqueueEncounterEvent preserves submit order', () => {
    const encounter = createHarborEncounter()

    const withFirstEvent = enqueueEncounterEvent(encounter, {
      type: 'player/target-selected',
      occurredAtMs: 10,
      targetEnemyId: 'enemy-a',
    })
    const withSecondEvent = enqueueEncounterEvent(withFirstEvent, {
      type: 'player/skill-activated',
      occurredAtMs: 20,
      skillId: 'warrior_t_stun',
    })

    expect(withSecondEvent.runtime.eventQueue).toEqual([
      {
        type: 'player/target-selected',
        occurredAtMs: 10,
        targetEnemyId: 'enemy-a',
      },
      {
        type: 'player/skill-activated',
        occurredAtMs: 20,
        skillId: 'warrior_t_stun',
      },
    ])
  })

  it('tick applies queued threat and status events and preserves duplicate processed events in order', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for queued threat/status event test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
    }

    const queued = enqueueEncounterEvent(
      enqueueEncounterEvent(
        enqueueEncounterEvent(configured, {
          type: 'enemy/threat-applied',
          occurredAtMs: 10,
          enemyId: targetEnemy.id,
          tankThreatDelta: 7,
          allyThreatDelta: 0,
        }),
        {
          type: 'enemy/threat-applied',
          occurredAtMs: 10,
          enemyId: targetEnemy.id,
          tankThreatDelta: 7,
          allyThreatDelta: 0,
        },
      ),
      {
        type: 'enemy/status-applied',
        occurredAtMs: 11,
        enemyId: targetEnemy.id,
        statusId: 'taunted',
        status: {
          id: 'taunted',
          label: '被嘲讽',
          shortLabel: '被',
          remainingMs: 3000,
          totalMs: 3000,
          tone: 'buff',
          kind: 'playerDebuff',
        },
      } as never,
    )

    const before = configured.enemies.find((enemy) => enemy.id === targetEnemy.id)
    const nextState = tickEncounter(queued, 0)
    const after = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect((after?.tankThreat ?? 0) - (before?.tankThreat ?? 0)).toBe(14)
    expect(after?.statuses.find((status) => status.id === 'taunted')).toMatchObject({
      label: '被嘲讽',
      shortLabel: '被',
    })
    expect(
      nextState.runtime.lastProcessedEvents.filter((event) => event.type === 'enemy/threat-applied'),
    ).toHaveLength(2)
    expect(
      nextState.runtime.lastProcessedEvents.find((event) => event.type === 'enemy/status-applied'),
    ).toMatchObject({
      type: 'enemy/status-applied',
      enemyId: targetEnemy.id,
      statusId: 'taunted',
      status: {
        label: '被嘲讽',
        shortLabel: '被',
      },
    })
    expect(nextState.runtime.lastProcessedEvents[0]).toMatchObject({
      type: 'enemy/threat-applied',
      enemyId: targetEnemy.id,
      tankThreatDelta: 7,
    })
    expect(nextState.runtime.lastProcessedEvents[1]).toMatchObject({
      type: 'enemy/threat-applied',
      enemyId: targetEnemy.id,
      tankThreatDelta: 7,
    })
  })

  it('queued status events preserve definition-backed label and shortLabel through drain', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for queued status presentation test')
    }

    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeStatusDefinitions: [
        {
          statusId: 'taunted',
            statusName: '锁定嘲讽',
        },
      ],
    })

    try {
      const nextState = tickEncounter(
        activateSkill(
          {
            ...encounter,
            player: {
              ...encounter.player,
              currentTargetId: targetEnemy.id,
            },
          },
          'warrior_t_taunt',
        ),
        0,
      )
      const tauntedEnemy = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)
      const tauntedStatus = tauntedEnemy?.statuses.find((status) => status.id === 'taunted')
      const statusEvent = nextState.runtime.lastProcessedEvents.find(
        (event) => event.type === 'enemy/status-applied' && event.enemyId === targetEnemy.id,
      )

      expect(tauntedStatus).toMatchObject({
        label: '锁定嘲讽',
        shortLabel: '锁',
      })
      expect(statusEvent).toMatchObject({
        type: 'enemy/status-applied',
        enemyId: targetEnemy.id,
        statusId: 'taunted',
        status: {
          label: '锁定嘲讽',
          shortLabel: '锁',
        },
      })
    } finally {
      applyPlayerBuildWorkbookOverrides({
        ...emptyPlayerBuildOverrides(),
        activeStatusDefinitions: [
          {
            statusId: 'taunted',
            statusName: '被嘲讽',
          },
        ],
      })
    }
  })

  it('applies enemy status event effects through combat event triggers', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for enemy status event trigger test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              statuses: [
                {
                  id: 'threat-on-skill',
                  label: '技能激怒',
                  shortLabel: '怒',
                  remainingMs: 3000,
                  totalMs: 3000,
                  tone: 'danger' as const,
                  kind: 'enemyBuff' as const,
                  effectLogicId: 'enemy_threat_on_player_skill',
                  valueA: 13,
                },
              ],
            }
          : enemy,
      ),
    }

    const nextState = tickEncounter(
      enqueueEncounterEvent(configured, {
        type: 'player/skill-activated',
        occurredAtMs: 10,
        skillId: 'warrior_t_taunt',
      }),
      0,
    )
    const nextEnemy = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect((nextEnemy?.tankThreat ?? 0) - targetEnemy.tankThreat).toBe(13)
  })

  it('tick applies queued interrupt events through the event system', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl')

    const queued = enqueueEncounterEvent(
      enqueueEncounterEvent(
        enqueueEncounterEvent(setup.encounter, {
          type: 'enemy/cast-interrupted',
          occurredAtMs: 10,
          enemyId: setup.targetEnemyId,
          skillId: 'ember-bolt',
          sourceSkillId: 'warrior_t_interrupt',
          recoveryRemainingMs: 1200,
          advanceSkillCycle: true,
        } as never),
        {
          type: 'enemy/status-applied',
          occurredAtMs: 10,
          enemyId: setup.targetEnemyId,
          statusId: 'countered',
          status: {
            id: 'countered',
            label: '被反制',
            shortLabel: '被',
            remainingMs: 1200,
            totalMs: 1200,
            tone: 'danger',
            kind: 'playerDebuff',
          },
        } as never,
      ),
      {
        type: 'enemy/threat-applied',
        occurredAtMs: 10,
        enemyId: setup.targetEnemyId,
        tankThreatDelta: 24,
        allyThreatDelta: 0,
      },
    )

    const before = setup.encounter.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
    const nextState = tickEncounter(queued, 0)
    const after = nextState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(before?.cast?.id).toBe('ember-bolt')
    expect(after?.cast).toBeNull()
    expect(after?.recoveryRemainingMs).toBe(1200)
    expect(after?.skillCycleIndex).not.toBe(before?.skillCycleIndex)
    expect(after?.statuses.some((status) => status.id === 'countered')).toBe(true)
    expect((after?.tankThreat ?? 0) - (before?.tankThreat ?? 0)).toBe(24)
  })

  it('tick applies queued control events through the event system and retries after control expires', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly')

    const queued = enqueueEncounterEvent(
      enqueueEncounterEvent(
        enqueueEncounterEvent(setup.encounter, {
          type: 'enemy/cast-controlled',
          occurredAtMs: 10,
          enemyId: setup.targetEnemyId,
          skillId: 'ember-bolt',
          sourceSkillId: 'warrior_t_stun',
          pendingRetryCastSkillId: 'ember-bolt',
        } as never),
        {
          type: 'enemy/status-applied',
          occurredAtMs: 10,
          enemyId: setup.targetEnemyId,
          statusId: 'stunned',
          status: {
            id: 'stunned',
            label: '昏迷',
            shortLabel: '晕',
            remainingMs: 2000,
            totalMs: 2000,
            tone: 'buff',
            kind: 'playerDebuff',
          },
        } as never,
      ),
      {
        type: 'enemy/threat-applied',
        occurredAtMs: 10,
        enemyId: setup.targetEnemyId,
        tankThreatDelta: 18,
        allyThreatDelta: 0,
      },
    )

    const controlledState = tickEncounter(queued, 0)
    const controlledEnemy = controlledState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(controlledEnemy?.cast).toBeNull()
    expect(controlledEnemy?.pendingRetryCastSkillId).toBe('ember-bolt')
    expect(controlledEnemy?.statuses.some((status) => status.id === 'stunned')).toBe(true)

    const retriedState = tickEncounter(controlledState, 2500)
    const retriedEnemy = retriedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(retriedEnemy?.cast?.id).toBe('ember-bolt')
  })

  it('tick applies queued damage, death, and current-target-clear events through the event system', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      R: 'warrior_t_burst',
    })
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for queued damage/death event test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
      party: {
        ...encounter.party,
        currentTargetId: targetEnemy.id,
      },
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
        damageSources: [],
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              hp: 40,
              cast: {
                id: 'ember-bolt',
                name: 'ember-bolt',
                target: enemy.target,
                totalMs: 1500,
                remainingMs: 1500,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'high' as const,
              },
            }
          : enemy,
      ),
    }

    const queued = enqueueEncounterEvent(
      enqueueEncounterEvent(
        enqueueEncounterEvent(configured, {
          type: 'enemy/damage-applied',
          occurredAtMs: 10,
          enemyId: targetEnemy.id,
          amount: 50,
          sourceSkillId: 'warrior_t_burst',
        }),
        {
          type: 'enemy/died',
          occurredAtMs: 10,
          enemyId: targetEnemy.id,
          sourceSkillId: 'warrior_t_burst',
        },
      ),
      {
        type: 'player/current-target-cleared',
        occurredAtMs: 10,
        previousTargetEnemyId: targetEnemy.id,
      },
    )

    const nextState = tickEncounter(queued, 0)
    const deadEnemy = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(deadEnemy?.hp).toBe(0)
    expect(deadEnemy?.cast).toBeNull()
    expect(nextState.player.currentTargetId).toBeNull()
  })

  it('sequential command dispatch uses the latest state for each queued command', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const firstEnemy = encounter.enemies[0]
    const secondEnemy = encounter.enemies[1]

    if (!firstEnemy || !secondEnemy) {
      throw new Error('Expected at least two enemies for command sequencing test')
    }

    const setup = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: firstEnemy.id,
      },
    }

    const queued = dispatchEncounterCommand(
      dispatchEncounterCommand(
        dispatchEncounterCommand(setup, {
          type: 'player/activate-skill',
          submittedAtMs: 10,
          skillId: 'warrior_t_taunt',
        }),
        {
          type: 'player/select-target',
          submittedAtMs: 11,
          targetEnemyId: secondEnemy.id,
        },
      ),
      {
        type: 'player/activate-skill',
        submittedAtMs: 12,
        skillId: 'warrior_t_taunt',
      },
    )

    const flushed = tickEncounter(queued, 0)
    const taunt = flushed.skills.find((skill) => skill.id === 'warrior_t_taunt')
    const firstEnemyAfter = flushed.enemies.find((enemy) => enemy.id === firstEnemy.id)
    const secondEnemyAfter = flushed.enemies.find((enemy) => enemy.id === secondEnemy.id)

    expect(flushed.player.currentTargetId).toBe(secondEnemy.id)
    expect(taunt?.remainingCooldownMs).toBeGreaterThan(0)
    expect(firstEnemyAfter?.statuses.some((status) => status.id === 'taunted')).toBe(true)
    expect(secondEnemyAfter?.statuses.some((status) => status.id === 'taunted')).toBe(false)
    expect(flushed.runtime.lastRejectedCommandMessage).toContain('仍在冷却中')
    expect(flushed.runtime.commandQueue).toEqual([])
  })

  it('same-frame target selection followed by a target-requiring skill is not wrongly rejected', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[1]

    if (!targetEnemy) {
      throw new Error('Expected a second enemy for same-frame target selection test')
    }

    const setup = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
    }

    const queued = dispatchEncounterCommand(
      dispatchEncounterCommand(setup, {
        type: 'player/select-target',
        submittedAtMs: 10,
        targetEnemyId: targetEnemy.id,
      }),
      {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_taunt',
      },
    )

    const flushed = tickEncounter(queued, 0)
    const taunt = flushed.skills.find((skill) => skill.id === 'warrior_t_taunt')
    const selectedEnemy = flushed.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(flushed.player.currentTargetId).toBe(targetEnemy.id)
    expect(taunt?.remainingCooldownMs).toBeGreaterThan(0)
    expect(selectedEnemy?.statuses.some((status) => status.id === 'taunted')).toBe(true)
    expect(flushed.runtime.lastRejectedCommandMessage).toBeNull()
    expect(flushed.runtime.commandQueue).toEqual([])
  })

  it('retains queued commands while paused and processes them after resume', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for paused command retention test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
    }

    const queuedBeforePause = dispatchEncounterCommand(configured, {
      type: 'player/activate-skill',
      submittedAtMs: 10,
      skillId: 'warrior_t_taunt',
    })
    const paused = openPauseOverlay(queuedBeforePause)

    const flushedWhilePaused = tickEncounter(paused, 0)
    const tauntBeforeResume = flushedWhilePaused.skills.find((skill) => skill.id === 'warrior_t_taunt')

    expect(flushedWhilePaused.runtime.commandQueue).toEqual(paused.runtime.commandQueue)
    expect(flushedWhilePaused.runtime.lastProcessedEvents).toEqual([])
    expect(flushedWhilePaused.runtime.lastRejectedCommandMessage).toBeNull()
    expect(tauntBeforeResume?.remainingCooldownMs).toBe(0)

    const resumed = closePauseOverlay(flushedWhilePaused)
    const flushedAfterResume = tickEncounter(resumed, 0)
    const tauntAfterResume = flushedAfterResume.skills.find((skill) => skill.id === 'warrior_t_taunt')
    const targetAfterResume = flushedAfterResume.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(flushedAfterResume.runtime.commandQueue).toEqual([])
    expect(
      flushedAfterResume.runtime.lastProcessedEvents.some(
        (event) => event.type === 'player/skill-activated' && event.skillId === 'warrior_t_taunt',
      ),
    ).toBe(true)
    expect(tauntAfterResume?.remainingCooldownMs).toBeGreaterThan(0)
    expect(targetAfterResume?.statuses.some((status) => status.id === 'taunted')).toBe(true)
  })

  it('tickEncounter records command-originated processed events once in queue order', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for processed event dedupe test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
    }

    const nextState = tickEncounter(
      dispatchEncounterCommand(configured, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_taunt',
      }),
      0,
    )

    expect(nextState.runtime.lastProcessedEvents).toEqual([
      {
        type: 'enemy/status-applied',
        occurredAtMs: configured.timeMs,
        enemyId: targetEnemy.id,
        statusId: 'taunted',
        status: expect.objectContaining({
          id: 'taunted',
          label: '被嘲讽',
          shortLabel: '被',
          remainingMs: 3000,
          totalMs: 3000,
          tone: 'buff',
          kind: 'playerDebuff',
        }),
      },
      {
        type: 'enemy/threat-applied',
        occurredAtMs: configured.timeMs,
        enemyId: targetEnemy.id,
        tankThreatDelta: Math.max(0, targetEnemy.allyThreat + 72 - targetEnemy.tankThreat),
        allyThreatDelta: 0,
      },
      {
        type: 'player/skill-activated',
        occurredAtMs: 10,
        skillId: 'warrior_t_taunt',
      },
    ])
  })

  it('clears the last rejected command message on the next idle flush', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const queued = dispatchEncounterCommand(encounter, {
      type: 'player/activate-skill',
      submittedAtMs: 10,
      skillId: 'warrior_t_taunt',
    })
    const rejected = flushEncounterCommands(
      dispatchEncounterCommand(flushEncounterCommands(queued), {
        type: 'player/activate-skill',
        submittedAtMs: 20,
        skillId: 'warrior_t_taunt',
      }),
    )

    expect(rejected.runtime.lastRejectedCommandMessage).not.toBeNull()
    expect(rejected.runtime.lastProcessedEvents).toEqual([
      {
        type: 'command/rejected',
        occurredAtMs: 20,
        message: rejected.runtime.lastRejectedCommandMessage,
        commandType: 'player/activate-skill',
      },
    ])

    const staleRejectedMessageState = {
      ...rejected,
      runtime: {
        ...rejected.runtime,
        lastProcessedEvents: [],
      },
    }

    const idled = flushEncounterCommands(staleRejectedMessageState)

    expect(idled.runtime.commandQueue).toEqual([])
    expect(idled.runtime.lastProcessedEvents).toEqual([])
    expect(idled.runtime.lastRejectedCommandMessage).toBeNull()
  })

  it('player auto attack hits the locked current target every second with player threat formula', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
      },
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 0,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            }
          : {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
    }

    const before = configured.enemies.find((enemy) => enemy.id === targetEnemy.id)
    const nextState = tickEncounter(configured, 1000)
    const after = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(before).toBeDefined()
    expect(after).toBeDefined()
    expect((before?.hp ?? 0) - (after?.hp ?? 0)).toBe(3)
    expect((after?.tankThreat ?? 0) - (before?.tankThreat ?? 0)).toBe(15)
  })

  it('immediately auto attacks once when selecting a target after having no target', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        cast: null,
        recoveryRemainingMs: 5000,
      })),
    }

    expect(configured.player.currentTargetId).toBeNull()

    const selected = selectEnemy(configured, targetEnemy.id)
    const selectedTarget = selected.enemies.find((enemy) => enemy.id === targetEnemy.id)
    const autoAttackSource = selected.runtime.damageSources.find(
      (source) => source.sourceId === 'player_auto_attack',
    )

    expect(selected.player.currentTargetId).toBe(targetEnemy.id)
    expect(targetEnemy.hp - (selectedTarget?.hp ?? 0)).toBe(3)
    expect(autoAttackSource?.remainingMs).toBe(1000)

    const beforeNextSwing = tickEncounter(selected, 999)
    expect(targetEnemy.hp - beforeNextSwing.enemies[0].hp).toBe(3)

    const afterNextSwing = tickEncounter(beforeNextSwing, 1)
    expect(targetEnemy.hp - afterNextSwing.enemies[0].hp).toBe(6)
  })

  it('player auto attack pauses ready when the current target dies and resumes after selecting a new target', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const firstTarget = encounter.enemies[0]
    const secondTarget = encounter.enemies[1]
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: firstTarget.id,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === firstTarget.id || enemy.id === secondTarget.id
          ? {
              ...enemy,
              threatLogic: 'bloodlust' as const,
              hp: enemy.id === firstTarget.id ? 3 : enemy.hp,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const killedState = tickEncounter(configured, 1000)
    const autoAttackSourceAfterKill = killedState.runtime.damageSources.find(
      (source) => source.sourceId === 'player_auto_attack',
    )

    expect(killedState.player.currentTargetId).toBeNull()
    expect(autoAttackSourceAfterKill?.remainingMs).toBe(0)

    const secondTargetBefore = killedState.enemies.find((enemy) => enemy.id === secondTarget.id)
    const resumedBase = selectEnemy(killedState, secondTarget.id)
    const autoAttackSourceAfterResume = resumedBase.runtime.damageSources.find(
      (source) => source.sourceId === 'player_auto_attack',
    )
    const secondTargetAfter = resumedBase.enemies.find((enemy) => enemy.id === secondTarget.id)

    expect((secondTargetBefore?.hp ?? 0) - (secondTargetAfter?.hp ?? 0)).toBe(3)
    expect(autoAttackSourceAfterResume?.remainingMs).toBe(1000)
  })

  it('uses warrior resource rules and ignores stage resource tuning for passive rage gain', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        tuning: {
          ...encounter.stage.tuning,
          playerResourceRegenMultiplier: 9,
        },
      },
      player: {
        ...encounter.player,
        resource: 0,
      },
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        hp: 0,
        cast: null,
        recoveryRemainingMs: 0,
        pendingRetryCastSkillId: null,
      })),
    }

    const nextState = tickEncounter(configured, 1000)

    expect(nextState.player.resource).toBe(3)
  })

  it('caps damage-taken rage gain at 10 per second', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        resource: 0,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index < 3
          ? {
              ...enemy,
              target: 'tank' as const,
              cast: {
                id: 'rage-cap-hit',
                name: 'rage-cap-hit',
                target: 'tank' as const,
                remainingMs: 0,
                totalMs: 0,
                breakRule: 'interruptOrControl' as const,
                dangerLevel: 'low' as const,
                phase: 'casting' as const,
              },
              skillIds: ['rage-cap-hit'],
              skillCycle: ['rage-cap-hit'],
              recoveryRemainingMs: 999999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'rage-cap-hit',
          skillName: '怒气封顶测试',
          castTimeMs: 0,
          channelingMs: 0,
          recoveryMs: 999999,
          playerDamage: 30,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          targetRuleId: 'threatTarget',
          castBreakRule: 'interruptOrControl',
          dangerLevel: 'low',
          damageType: 'magic',
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
      iconDefinitions: [],
    })

    try {
      const firstSecond = tickEncounter(configured, 0)
      const secondSecond = tickEncounter({
        ...firstSecond,
        enemies: firstSecond.enemies.map((enemy, index) =>
          index < 3
            ? {
                ...enemy,
                cast: {
                  id: 'rage-cap-hit',
                  name: 'rage-cap-hit',
                  target: 'tank' as const,
                  remainingMs: 0,
                  totalMs: 0,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'low' as const,
                  phase: 'casting' as const,
                },
                recoveryRemainingMs: 999999,
              }
            : enemy,
        ),
      }, 1000)

      expect(firstSecond.player.resource).toBe(10)
      expect(secondSecond.player.resource).toBe(23)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
        iconDefinitions: [],
      })
    }
  })

  it('requires an enemy target for the new enemy-area targeting enums only', () => {
    expect(playerSkillNeedsEnemyTarget('currentEnemy')).toBe(true)
    expect(playerSkillNeedsEnemyTarget('crossEnemy')).toBe(true)
    expect(playerSkillNeedsEnemyTarget('matrix3x3Enemy')).toBe(true)
    expect(playerSkillNeedsEnemyTarget('topLeft2x2Enemy')).toBe(true)
    expect(playerSkillNeedsEnemyTarget('allEnemy')).toBe(true)
    expect(playerSkillNeedsEnemyTarget('party')).toBe(false)
    expect(playerSkillNeedsEnemyTarget('self')).toBe(false)
  })

  it('resolves cross targets by row and column around the current target slot', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e02',
      },
    }

    expect([...resolveEnemyTargetIdsBySelector(configured, 'cross')].sort()).toEqual([
      'harbor-1-e01',
      'harbor-1-e02',
      'harbor-1-e03',
      'harbor-1-e07',
    ])
  })

  it('resolves matrix3x3 and topLeft2x2 targets from the current target slot', () => {
    const encounter = createHarborEncounterWithStandardBuild()

    const centerConfigured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e02',
      },
    }

    expect([...resolveEnemyTargetIdsBySelector(centerConfigured, 'matrix3x3')].sort()).toEqual([
      'harbor-1-e01',
      'harbor-1-e02',
      'harbor-1-e03',
      'harbor-1-e06',
      'harbor-1-e07',
    ])

    const topLeftConfigured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e01',
      },
    }

    expect([...resolveEnemyTargetIdsBySelector(topLeftConfigured, 'topLeft2x2')].sort()).toEqual([
      'harbor-1-e01',
      'harbor-1-e02',
      'harbor-1-e06',
      'harbor-1-e07',
    ])
  })

  it('resolves allEnemy to all living enemies only', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e02',
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === 'harbor-1-e03'
          ? {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            }
          : enemy,
      ),
    }

    const resolved = resolveEnemyTargetIdsBySelector(configured, 'allEnemy')

    expect(resolved.has('harbor-1-e03')).toBe(false)
    expect(resolved.size).toBe(configured.enemies.filter((enemy) => enemy.hp > 0).length)
  })

  it('party ambient random damage adds allyThreat by damage x 1 + 0', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 10,
        partyAutoDamageMax: 10,
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              threatLogic: 'bloodlust' as const,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const before = configured.enemies.find((enemy) => enemy.id === targetEnemy.id)
    const nextState = tickEncounter(configured, 1000)
    const after = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect((before?.hp ?? 0) - (after?.hp ?? 0)).toBe(10)
    expect((after?.allyThreat ?? 0) - (before?.allyThreat ?? 0)).toBe(10)
  })

  it('uses encounter opening party auto damage interval and fixed min max values', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1500,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 7,
        partyAutoDamageMax: 7,
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              threatLogic: 'bloodlust' as const,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 1500,
      },
    }

    const before = configured.enemies[0]
    const beforeInterval = tickEncounter(configured, 1499)
    expect(before.hp - beforeInterval.enemies[0].hp).toBe(0)

    const afterInterval = tickEncounter(beforeInterval, 1)
    expect(before.hp - afterInterval.enemies[0].hp).toBe(7)
  })

  it('uses matrix3x3Enemy and matrix3x3 declarations when resolving stun targets', () => {
    withTemporaryStunTargeting('matrix3x3Enemy', 'matrix3x3', () => {
      const encounter = createHarborEncounterWithStandardBuild()
      const configured = {
        ...encounter,
        player: {
          ...encounter.player,
          currentTargetId: 'harbor-1-e02',
        },
        enemies: encounter.enemies.map((enemy) => ({
          ...enemy,
          isSkull: false,
          cast: null,
          recoveryRemainingMs: 0,
          pendingRetryCastSkillId: null,
        })),
      }

      const nextState = tickEncounter(activateSkill(configured, 'warrior_t_stun'), 0)
      const stunnedIds = nextState.enemies
        .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
        .map((enemy) => enemy.id)
        .sort()

      expect(stunnedIds).toEqual([
        'harbor-1-e01',
        'harbor-1-e02',
        'harbor-1-e03',
        'harbor-1-e06',
        'harbor-1-e07',
      ])
    })
  })

  it('uses topLeft2x2Enemy and topLeft2x2 declarations when resolving stun targets', () => {
    withTemporaryStunTargeting('topLeft2x2Enemy', 'topLeft2x2', () => {
      const encounter = createHarborEncounterWithStandardBuild()
      const configured = {
        ...encounter,
        player: {
          ...encounter.player,
          currentTargetId: 'harbor-1-e01',
        },
        enemies: encounter.enemies.map((enemy) => ({
          ...enemy,
          isSkull: false,
          cast: null,
          recoveryRemainingMs: 0,
          pendingRetryCastSkillId: null,
        })),
      }

      const nextState = tickEncounter(activateSkill(configured, 'warrior_t_stun'), 0)
      const stunnedIds = nextState.enemies
        .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
        .map((enemy) => enemy.id)
        .sort()

      expect(stunnedIds).toEqual([
        'harbor-1-e01',
        'harbor-1-e02',
        'harbor-1-e06',
        'harbor-1-e07',
      ])
    })
  })

  it('uses effect-row targetSelector for mass taunt instead of always hitting all enemies', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_mass_taunt',
          skillEffectId: 'warrior_t_mass_taunt_main',
          targetSelector: 'cross',
          threatDelta: 55,
          durationMs: 2600,
          statusId: 'mass-taunt',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithStandardBuild()
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: 'harbor-1-e02',
          },
        }

      const nextState = tickEncounter(activateSkill(configured, 'warrior_t_mass_taunt'), 0)
        const tauntedEnemy = nextState.enemies.find((enemy) => enemy.id === 'harbor-1-e02')
        const massTauntedIds = nextState.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'mass-taunt'))
          .map((enemy) => enemy.id)
          .sort()

        expect(massTauntedIds).toEqual([
          'harbor-1-e01',
          'harbor-1-e02',
          'harbor-1-e03',
          'harbor-1-e07',
        ])
        expect(tauntedEnemy?.statuses.find((status) => status.id === 'mass-taunt')).toMatchObject({
          label: '群体嘲讽',
          shortLabel: '群',
        })
      },
    )
  })

  it('uses effect-row valueA, threatMultiplier and threatDelta for burst damage and threat gain', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_burst',
          skillEffectId: 'warrior_t_burst_main',
          targetSelector: 'current',
          valueA: 60,
          threatMultiplier: 5,
          threatDelta: 7,
          threatSource: 'player',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          R: 'warrior_t_burst',
        })
        const targetEnemy = encounter.enemies[0]
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: targetEnemy.id,
          },
          enemies: encounter.enemies.map((enemy) =>
            enemy.id === targetEnemy.id
              ? {
                  ...enemy,
                  threatLogic: 'bloodlust' as const,
                }
              : enemy,
          ),
        }

        const before = configured.enemies.find((enemy) => enemy.id === targetEnemy.id)
        const nextState = tickEncounter(activateSkill(configured, 'warrior_t_burst'), 0)
        const after = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

        expect(before).toBeDefined()
        expect(after).toBeDefined()
        expect((before?.hp ?? 0) - (after?.hp ?? 0)).toBe(60)
        expect((after?.tankThreat ?? 0) - (before?.tankThreat ?? 0)).toBe(307)
      },
    )
  })

  it('applies revenge as top-left 2x2 damage using effect-row threat formula', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_revenge',
          skillEffectId: 'warrior_t_revenge_main',
          skillLogicId: 'revenge',
          resourceCost: 20,
          targetingType: 'topLeft2x2Enemy',
          targetSelector: 'topLeft2x2',
          valueA: 10,
          valueB: 10,
          threatMultiplier: 5,
          threatDelta: 0,
          threatSource: 'player',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          R: 'warrior_t_revenge',
        })
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: 'harbor-1-e01',
            resource: 100,
          },
        }
        const beforeTargets = ['harbor-1-e01', 'harbor-1-e02', 'harbor-1-e06', 'harbor-1-e07']
          .map((enemyId) => configured.enemies.find((enemy) => enemy.id === enemyId))

        const nextState = tickEncounter(activateSkill(configured, 'warrior_t_revenge'), 0)

        for (const before of beforeTargets) {
          const after = nextState.enemies.find((enemy) => enemy.id === before?.id)
          expect(before).toBeDefined()
          expect(after).toBeDefined()
          expect((before?.hp ?? 0) - (after?.hp ?? 0)).toBe(10)
          expect((after?.tankThreat ?? 0) - (before?.tankThreat ?? 0)).toBe(50)
        }
        expect(nextState.enemies.find((enemy) => enemy.id === 'harbor-1-e03')?.hp).toBe(
          configured.enemies.find((enemy) => enemy.id === 'harbor-1-e03')?.hp,
        )
      },
    )
  })

  it('applies current workbook range skills to every legal target in WestFall-1', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const makeWestFallState = (skillId: string, currentTargetId: string) => {
        const encounter = createWestFallEncounterWithBuildOverride({
          '1': skillId,
          '2': null,
          '3': null,
          '4': null,
          Q: null,
          E: null,
          R: null,
          F: null,
        })

        return {
          ...stripStageSpecialRules(encounter),
          player: {
            ...encounter.player,
            currentTargetId,
            resource: 100,
            gcdRemainingMs: 0,
          },
          enemies: encounter.enemies.map((enemy) => ({
            ...enemy,
            isSkull: false,
            cast: null,
            recoveryRemainingMs: 0,
            pendingRetryCastSkillId: null,
          })),
        }
      }

      const revengeBase = makeWestFallState('warrior_t_revenge', 'WestFall-1-e01')
      const revengeNext = tickEncounter(activateSkill(revengeBase, 'warrior_t_revenge'), 0)
      const expectHpLoss = (before: typeof revengeBase, after: typeof revengeNext, enemyId: string, amount: number) => {
        const beforeEnemy = before.enemies.find((enemy) => enemy.id === enemyId)
        const afterEnemy = after.enemies.find((enemy) => enemy.id === enemyId)
        expect(beforeEnemy).toBeDefined()
        expect(afterEnemy).toBeDefined()
        expect((beforeEnemy?.hp ?? 0) - (afterEnemy?.hp ?? 0)).toBe(amount)
      }

      expectHpLoss(revengeBase, revengeNext, 'WestFall-1-e01', 10)
      expectHpLoss(revengeBase, revengeNext, 'WestFall-1-e02', 10)
      expectHpLoss(revengeBase, revengeNext, 'WestFall-1-e05', 10)
      expectHpLoss(revengeBase, revengeNext, 'WestFall-1-e03', 0)

      const thunderBase = makeWestFallState('warrior_t_thunderstruck', 'WestFall-1-e02')
      const thunderNext = tickEncounter(activateSkill(thunderBase, 'warrior_t_thunderstruck'), 0)
      expectHpLoss(thunderBase, thunderNext, 'WestFall-1-e01', 15)
      expectHpLoss(thunderBase, thunderNext, 'WestFall-1-e02', 15)
      expectHpLoss(thunderBase, thunderNext, 'WestFall-1-e05', 15)
      expectHpLoss(thunderBase, thunderNext, 'WestFall-1-e03', 0)
      expectHpLoss(thunderBase, thunderNext, 'WestFall-1-e04', 0)

      const shockwaveBase = makeWestFallState('warrior_t_shockwave', 'WestFall-1-e02')
      const shockwaveNext = tickEncounter(activateSkill(shockwaveBase, 'warrior_t_shockwave'), 0)
      expect(
        shockwaveNext.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
          .map((enemy) => enemy.id)
          .sort(),
      ).toEqual(['WestFall-1-e01', 'WestFall-1-e02', 'WestFall-1-e05'])

      const massTauntBase = makeWestFallState('warrior_t_mass_taunt', 'WestFall-1-e02')
      const massTauntNext = tickEncounter(activateSkill(massTauntBase, 'warrior_t_mass_taunt'), 0)
      const allWestFallEnemyIds = massTauntBase.enemies.map((enemy) => enemy.id).sort()
      expect(
        massTauntNext.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'taunted'))
          .map((enemy) => enemy.id)
          .sort(),
      ).toEqual(allWestFallEnemyIds)

      const shoutBase = makeWestFallState('warrior_t_demoralizing_shout', 'WestFall-1-e02')
      const shoutNext = tickEncounter(activateSkill(shoutBase, 'warrior_t_demoralizing_shout'), 0)
      expect(
        shoutNext.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'demoralized'))
          .map((enemy) => enemy.id)
          .sort(),
      ).toEqual(allWestFallEnemyIds)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('spends rage when casting revenge and blocks revenge when rage is insufficient', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_revenge',
          skillEffectId: 'warrior_t_revenge_main',
          skillLogicId: 'revenge',
          resourceCost: 20,
          targetingType: 'topLeft2x2Enemy',
          targetSelector: 'topLeft2x2',
          valueA: 10,
          valueB: 0,
          threatMultiplier: 5,
          threatDelta: 0,
          threatSource: 'player',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          R: 'warrior_t_revenge',
        })
        const revenge = encounter.skills.find((skill) => skill.id === 'warrior_t_revenge')
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: 'harbor-1-e01',
            resource: 50,
          },
        }

        const spentState = tickEncounter(activateSkill(configured, 'warrior_t_revenge'), 0)

        expect(revenge?.resourceCost).toBe(20)
        expect(spentState.player.resource).toBe(30)
        expect(getSkillActivationBlockReason({
          ...configured,
          player: {
            ...configured.player,
            resource: 19,
          },
        }, 'warrior_t_revenge')).toContain('所需资源不足')
        expect(activateSkill({
          ...configured,
          player: {
            ...configured.player,
            resource: 19,
          },
        }, 'warrior_t_revenge').player.resource).toBe(19)
      },
    )
  })

  it('uses effect-row duration for shield wall mitigation duration', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_shield_wall',
          skillEffectId: 'warrior_t_shield_wall_main',
          targetSelector: 'self',
          durationMs: 5500,
          statusId: 'shieldWall',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithStandardBuild()
        const nextState = activateSkill(encounter, 'warrior_t_shield_wall')

        expect(nextState.player.mitigation?.id).toBe('shieldWall')
        expect(nextState.player.mitigation?.label).toBe('盾墙')
        expect(nextState.player.mitigation?.shortLabel).toBe('盾')
        expect(nextState.player.mitigation?.remainingMs).toBe(5500)
        expect(nextState.player.mitigation?.totalMs).toBe(5500)
      },
    )
  })

  it('applies ignore pain as an xlsx-defined player buff with effect-row duration', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeStatusDefinitions: [
        {
          statusId: 'ignorePain',
          statusName: '无视苦痛',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_ignorePain_status_pic',
          durationMs: 5000,
          maxStacks: 4,
          dispellable: false,
          description: '玩家的漏气盾',
          effectLogicId: 'playerBuff_ignorePain',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_ignore_pain',
          skillEffectId: 'warrior_t_ignore_pain_main',
          skillLogicId: 'ignore_pain',
          resourceCost: 20,
          targetingType: 'self',
          targetSelector: 'self',
          valueA: 30,
          valueB: 0.5,
          durationMs: 5000,
          statusId: 'ignorePain',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          R: 'warrior_t_ignore_pain',
        })
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            resource: 100,
          },
        }

        const nextState = tickEncounter(activateSkill(configured, 'warrior_t_ignore_pain'), 0)
        const ignorePain = nextState.player.buffs.find((status) => status.id === 'ignorePain')

        expect(ignorePain).toMatchObject({
          id: 'ignorePain',
          label: '无视苦痛',
          shortLabel: '无',
          remainingMs: 5000,
          totalMs: 5000,
          effectLogicId: 'playerBuff_ignorePain',
          absorbRemaining: 30,
          absorbRatio: 0.5,
        })

        const expiredState = tickEncounter(nextState, 5000)
        expect(expiredState.player.buffs.some((status) => status.id === 'ignorePain')).toBe(false)
        expect(expiredState.player.buffs.every((status) => status.id === 'stable')).toBe(true)
      },
    )
  })

  it('spends rage when casting ignore pain and blocks ignore pain when rage is insufficient', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeStatusDefinitions: [
        {
          statusId: 'ignorePain',
          statusName: '无视苦痛',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_ignorePain_status_pic',
          durationMs: 5000,
          maxStacks: 4,
          dispellable: false,
          description: '玩家的漏气盾',
          effectLogicId: 'playerBuff_ignorePain',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_ignore_pain',
          skillEffectId: 'warrior_t_ignore_pain_main',
          skillLogicId: 'ignore_pain',
          resourceCost: 20,
          targetingType: 'self',
          targetSelector: 'self',
          valueA: 30,
          valueB: 0.5,
          durationMs: 5000,
          statusId: 'ignorePain',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          F: 'warrior_t_ignore_pain',
        })
        const ignorePain = encounter.skills.find((skill) => skill.id === 'warrior_t_ignore_pain')
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            resource: 50,
          },
        }

        const spentState = tickEncounter(activateSkill(configured, 'warrior_t_ignore_pain'), 0)
        const blockedState = activateSkill({
          ...configured,
          player: {
            ...configured.player,
            resource: 19,
          },
        }, 'warrior_t_ignore_pain')

        expect(ignorePain?.resourceCost).toBe(20)
        expect(spentState.player.resource).toBe(30)
        expect(spentState.player.buffs.some((status) => status.id === 'ignorePain')).toBe(true)
        expect(getSkillActivationBlockReason({
          ...configured,
          player: {
            ...configured.player,
            resource: 19,
          },
        }, 'warrior_t_ignore_pain')).toContain('所需资源不足')
        expect(blockedState.player.resource).toBe(19)
        expect(blockedState.player.buffs.some((status) => status.id === 'ignorePain')).toBe(false)
      },
    )
  })

  it('lets ignore pain absorb part of player damage and deducts absorbed amount from the buff', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeStatusDefinitions: [
        {
          statusId: 'ignorePain',
          statusName: '无视苦痛',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_ignorePain_status_pic',
          durationMs: 5000,
          maxStacks: 4,
          dispellable: false,
          description: '玩家的漏气盾',
          effectLogicId: 'playerBuff_ignorePain',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_ignore_pain',
          skillEffectId: 'warrior_t_ignore_pain_main',
          skillLogicId: 'ignore_pain',
          targetingType: 'self',
          targetSelector: 'self',
          valueA: 30,
          valueB: 0.5,
          durationMs: 5000,
          statusId: 'ignorePain',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          R: 'warrior_t_ignore_pain',
        })
        const castSetup = withEnemyCasting(encounter, 'bone-jab', 'controlOnly', {
          remainingMs: 1,
        })
        const configured = {
          ...castSetup.encounter,
          stage: {
            ...castSetup.encounter.stage,
            tuning: {
              ...castSetup.encounter.stage.tuning,
              enemyDamageMultiplier: 1,
            },
          },
          player: {
            ...castSetup.encounter.player,
            hp: 500,
            resource: 100,
            mitigation: null,
          },
          enemies: castSetup.encounter.enemies.map((enemy) =>
            enemy.id === castSetup.targetEnemyId
              ? {
                  ...enemy,
                  target: 'tank' as const,
                  tankThreat: 100,
                  allyThreat: 0,
                }
              : enemy,
          ),
        }
        const shielded = tickEncounter(activateSkill(configured, 'warrior_t_ignore_pain'), 0)

        const castReady = tickEncounter(shielded, 1)
        const damaged = tickEncounter(castReady, 0)
        const ignorePain = damaged.player.buffs.find((status) => status.id === 'ignorePain')

        expect(damaged.player.hp).toBe(491)
        expect(ignorePain).toMatchObject({
          absorbRemaining: 21,
          absorbRatio: 0.5,
        })
      },
    )
  })

  it('lets shield block reduce physical player damage but not magic player damage', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'warrior_t_shield_block',
          classId: 'warrior_t',
          skillName: '盾牌格挡',
          shortName: '物理减伤',
          description: '耗怒物理减伤',
          iconId: 'warrior_t_shield_block_pic',
          pointCost: 4,
          resourceCost: 20,
          cooldownMs: 0,
          initialRemainingCooldownMs: 0,
          gcdMs: 1500,
          targetingType: 'self',
          skillLogicId: 'shield_block',
          castStopMode: 'none',
          canAffectSkull: true,
          grantedStatusIds: ['shieldBlock'],
          enabled: true,
        },
      ],
      activeStatusDefinitions: [
        {
          statusId: 'shieldBlock',
          statusName: '盾牌格挡',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_shieldBlock_status_pic',
          durationMs: 7000,
          maxStacks: 1,
          dispellable: false,
          description: '玩家物理减伤',
          effectLogicId: 'playerBuff_shieldBlock',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_shield_block',
          skillEffectId: 'warrior_t_shield_block_main',
          skillLogicId: 'shield_block',
          resourceCost: 20,
          targetingType: 'self',
          targetSelector: 'self',
          valueB: 0.5,
          durationMs: 7000,
          statusId: 'shieldBlock',
        },
      ],
      () => {
        const physicalEncounter = createHarborEncounterWithBuildOverride({
          F: 'warrior_t_shield_block',
        })
        const physicalCastSetup = withEnemyCasting(physicalEncounter, 'bone-jab', 'controlOnly', {
          remainingMs: 1,
        })
        const physicalConfigured = {
          ...physicalCastSetup.encounter,
          stage: {
            ...physicalCastSetup.encounter.stage,
            tuning: {
              ...physicalCastSetup.encounter.stage.tuning,
              enemyDamageMultiplier: 1,
            },
          },
          player: {
            ...physicalCastSetup.encounter.player,
            hp: 500,
            resource: 100,
            mitigation: null,
          },
          enemies: physicalCastSetup.encounter.enemies.map((enemy) =>
            enemy.id === physicalCastSetup.targetEnemyId
              ? {
                  ...enemy,
                  target: 'tank' as const,
                  tankThreat: 100,
                  allyThreat: 0,
                }
              : enemy,
          ),
        }

        const physicalBlocked = tickEncounter(activateSkill(physicalConfigured, 'warrior_t_shield_block'), 0)
        const physicalDamaged = tickEncounter(tickEncounter(physicalBlocked, 1), 0)
        const shieldBlock = physicalDamaged.player.buffs.find((status) => status.id === 'shieldBlock')

        expect(physicalBlocked.player.resource).toBe(80)
        expect(shieldBlock).toMatchObject({
          remainingMs: 6999,
          totalMs: 7000,
          damageReductionRatio: 0.5,
          damageReductionTypes: ['physical'],
        })
        expect(physicalDamaged.player.hp).toBe(491)

        const magicEncounter = createHarborEncounterWithBuildOverride({
          F: 'warrior_t_shield_block',
        })
        const magicCastSetup = withEnemyCasting(magicEncounter, 'flame-lance', 'interruptOrControl', {
          remainingMs: 1,
        })
        const magicConfigured = {
          ...magicCastSetup.encounter,
          stage: {
            ...magicCastSetup.encounter.stage,
            tuning: {
              ...magicCastSetup.encounter.stage.tuning,
              enemyDamageMultiplier: 1,
            },
          },
          player: {
            ...magicCastSetup.encounter.player,
            hp: 500,
            resource: 100,
            mitigation: null,
          },
          enemies: magicCastSetup.encounter.enemies.map((enemy) =>
            enemy.id === magicCastSetup.targetEnemyId
              ? {
                  ...enemy,
                  target: 'tank' as const,
                  tankThreat: 100,
                  allyThreat: 0,
                }
              : enemy,
          ),
        }

        const magicBlocked = tickEncounter(activateSkill(magicConfigured, 'warrior_t_shield_block'), 0)
        const magicDamaged = tickEncounter(tickEncounter(magicBlocked, 1), 0)

        expect(magicDamaged.player.hp).toBe(468)
      },
    )
  })

  it('uses the planner-aligned shield block fallback duration when the effect row omits duration', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'warrior_t_shield_block',
          classId: 'warrior_t',
          skillName: '盾牌格挡',
          shortName: '物理减伤',
          description: '耗怒物理减伤',
          iconId: 'warrior_t_shield_block_pic',
          pointCost: 4,
          resourceCost: 20,
          cooldownMs: 0,
          initialRemainingCooldownMs: 0,
          gcdMs: 1500,
          targetingType: 'self',
          skillLogicId: 'shield_block',
          castStopMode: 'none',
          canAffectSkull: true,
          grantedStatusIds: ['shieldBlock'],
          enabled: true,
        },
      ],
      activeStatusDefinitions: [
        {
          statusId: 'shieldBlock',
          statusName: '盾牌格挡',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_shieldBlock_status_pic',
          durationMs: 7000,
          maxStacks: 1,
          dispellable: false,
          description: '玩家物理减伤',
          effectLogicId: 'playerBuff_shieldBlock',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_shield_block',
          skillEffectId: 'warrior_t_shield_block_main',
          skillLogicId: 'shield_block',
          resourceCost: 20,
          targetingType: 'self',
          targetSelector: 'self',
          valueB: 0.5,
          statusId: 'shieldBlock',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          F: 'warrior_t_shield_block',
        })
        const nextState = tickEncounter(activateSkill({
          ...encounter,
          player: {
            ...encounter.player,
            resource: 100,
          },
        }, 'warrior_t_shield_block'), 0)
        const shieldBlock = nextState.player.buffs.find((status) => status.id === 'shieldBlock')

        expect(shieldBlock).toMatchObject({
          remainingMs: 7000,
          totalMs: 7000,
        })
      },
    )
  })

  it('shield slam deals single-target damage, grants rage, and applies formula threat', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_shield_slam',
    })
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
        resource: 20,
      },
    }

    const nextState = tickEncounter(activateSkill(configured, 'warrior_t_shield_slam'), 0)
    const targetAfter = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(nextState.player.resource).toBe(30)
    expect(targetAfter?.hp).toBe(targetEnemy.hp - 15)
    expect((targetAfter?.tankThreat ?? 0) - targetEnemy.tankThreat).toBe(75)
  })

  it('shield reflection only prevents and reflects the player-facing part of the next enemy skill', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'crusher-slam',
          playerDamage: 88,
          partyDamageOnHit: 18,
          pressureOnHit: 6,
          partyDamageOnMiss: 26,
          pressureOnMiss: 18,
          damageType: 'magic',
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = createHarborEncounterWithBuildOverride({
        F: 'warrior_t_shield_reflection',
      })
      const skullEnemy = encounter.enemies.find((enemy) => enemy.skillIds.includes('crusher-slam')) ?? encounter.enemies[0]
      const setup = withEnemyCasting(encounter, 'crusher-slam', 'unstoppable', {
        targetEnemyId: skullEnemy.id,
        remainingMs: 1,
      })
      const strippedSetup = stripStageSpecialRules(setup.encounter)
      const configured = {
        ...strippedSetup,
        stage: {
          ...strippedSetup.stage,
          tuning: {
            ...setup.encounter.stage.tuning,
            enemyDamageMultiplier: 1,
          },
        },
        player: {
          ...setup.encounter.player,
          currentTargetId: null,
          hp: 500,
          resource: 100,
          mitigation: null,
          buffs: [],
        },
        party: {
          ...setup.encounter.party,
          hp: 500,
          pressure: 20,
        },
        runtime: {
          ...strippedSetup.runtime,
          damageSources: [],
        },
        enemies: setup.encounter.enemies.map((enemy) =>
          enemy.id === setup.targetEnemyId
            ? {
                ...enemy,
                hp: 300,
                target: 'tank' as const,
                threatLogic: 'normal' as const,
                statuses: [],
                tankThreat: 100,
                allyThreat: 0,
              }
            : enemy,
        ),
      }

      const reflectedReady = tickEncounter(activateSkill(configured, 'warrior_t_shield_reflection'), 0)
      const enemyBeforeCast = reflectedReady.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
      const castResolved = tickEncounter(reflectedReady, 1)
      const afterCast = tickEncounter(castResolved, 0)
      const enemyAfter = afterCast.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
      expect(afterCast.player.hp).toBe(500)
      expect(afterCast.party.hp).toBe(482)
      expect(afterCast.party.pressure).toBe(26)
      expect(enemyAfter?.hp).toBe(212)
      expect(enemyAfter?.tankThreat).toBeCloseTo((enemyBeforeCast?.tankThreat ?? 0) + 0.0004)
      expect(afterCast.player.buffs.some((status) => status.id === 'shieldReflection')).toBe(false)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('WF-5 shield reflection ignores physical skills and records the first reflected magic skill in combat stats', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-5')
      const baseBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
      const baseEncounter = stripStageSpecialRules(createInitialEncounterState(stage, {
        ...baseBuild,
        loadout: {
          ...baseBuild.loadout,
          F: 'warrior_t_shield_reflection',
        },
      }))
      const warleader = baseEncounter.enemies.find((enemy) => enemy.definitionId === 'murloc_warleader')
      const oracle = baseEncounter.enemies.find((enemy) => enemy.definitionId === 'coldlight_oracle')
      const shieldReflection = getActiveSkillDefinition('warrior_t_shield_reflection')

      if (!warleader || !oracle || !shieldReflection) {
        throw new Error('Expected WF-5 to contain a murloc warleader, a coldlight oracle, and shield reflection')
      }

      expect(shieldReflection.skillTags).toEqual(expect.arrayContaining(['immune', 'reflect']))

      const configured = {
        ...baseEncounter,
        stage: {
          ...baseEncounter.stage,
          playerAutoHeal: 0,
          partyAutoHeal: 0,
          tuning: {
            ...baseEncounter.stage.tuning,
            ambientPressurePerSecond: 0,
            enemyDamageMultiplier: 1,
          },
        },
        player: {
          ...baseEncounter.player,
          hp: 150,
          maxHp: 150,
          resource: 100,
          gcdRemainingMs: 0,
          currentTargetId: warleader.id,
          buffs: [],
          debuffs: [],
          mitigation: null,
        },
        party: {
          ...baseEncounter.party,
          hp: 100,
          pressure: 0,
          statuses: [],
        },
        passiveTalentIds: [],
        runtime: {
          ...baseEncounter.runtime,
          combatLog: [],
          commandQueue: [],
          eventQueue: [],
          damageSources: [],
          partyAutoDamageRemainingMs: 999_999,
          stageRuleRuntime: {},
          partyStatusRuntime: {},
        },
        enemies: baseEncounter.enemies.map((enemy) => ({
          ...enemy,
          cast: null,
          recoveryRemainingMs: 0,
          pendingRetryCastSkillId: null,
          target: 'tank' as const,
          tankThreat: 100,
          allyThreat: 0,
          statuses: [],
        })),
      }

      const armCast = (
        encounter: EncounterState,
        enemyId: string,
        skillId: string,
      ) => ({
        ...encounter,
        enemies: encounter.enemies.map((enemy) =>
          enemy.id === enemyId
            ? {
                ...enemy,
                cast: {
                  id: skillId,
                  name: skillId,
                  target: 'tank' as const,
                  remainingMs: 1,
                  totalMs: 1,
                  breakRule: 'controlOnly' as const,
                  dangerLevel: 'low' as const,
                },
              }
            : enemy,
        ),
      })

      const reflectedReady = tickEncounter(activateSkill(configured, 'warrior_t_shield_reflection'), 0)
      const hpBeforePhysical = reflectedReady.player.hp
      const afterPhysical = tickEncounter(armCast(reflectedReady, warleader.id, 'murloc_melee'), 1)
      const hpBeforeMagic = afterPhysical.player.hp
      const oracleBeforeMagic = afterPhysical.enemies.find((enemy) => enemy.id === oracle.id)
      const afterMagic = tickEncounter(armCast(afterPhysical, oracle.id, 'murloc_lightning'), 1)
      const oracleAfterMagic = afterMagic.enemies.find((enemy) => enemy.id === oracle.id)
      const stats = buildEncounterStats(afterMagic)

      expect(hpBeforePhysical - afterPhysical.player.hp).toBe(4)
      expect(afterPhysical.player.buffs.some((status) => status.id === 'shieldReflection')).toBe(true)
      expect(afterMagic.player.hp).toBe(hpBeforeMagic)
      expect(afterMagic.player.buffs.some((status) => status.id === 'shieldReflection')).toBe(false)
      expect((oracleBeforeMagic?.hp ?? 0) - (oracleAfterMagic?.hp ?? 0)).toBe(30)
      expect(stats.healingAndAbsorb.find((row) => row.id.includes('warrior_t_shield_reflection'))).toMatchObject({
        kind: 'absorb',
        total: 30,
      })
      expect(stats.damageDealt.find((row) => row.id.includes('warrior_t_shield_reflection'))).toMatchObject({
        total: 30,
      })
      expect(afterMagic.runtime.combatLog).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'damage',
            source: expect.objectContaining({ kind: 'enemy', id: oracle.id }),
            target: expect.objectContaining({ kind: 'tank' }),
            ability: expect.objectContaining({ id: 'murloc_lightning' }),
          }),
        ]),
      )
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('shield reflection ignores player damage reduction when computing reflected damage', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'arcane-jab',
          playerDamage: 18,
          partyDamageOnHit: 0,
          pressureOnHit: 0,
          damageType: 'magic',
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = createHarborEncounterWithBuildOverride({
        F: 'warrior_t_shield_reflection',
      })
      const setup = withEnemyCasting(encounter, 'arcane-jab', 'controlOnly', { remainingMs: 1 })
      const strippedSetup = stripStageSpecialRules(setup.encounter)
      const configured = {
        ...strippedSetup,
        stage: {
          ...strippedSetup.stage,
          tuning: {
            ...setup.encounter.stage.tuning,
            enemyDamageMultiplier: 1,
          },
        },
        player: {
          ...setup.encounter.player,
          currentTargetId: null,
          hp: 500,
          resource: 100,
          mitigation: null,
          buffs: [
            {
              id: 'shieldBlock',
              label: '盾牌格挡',
              shortLabel: '盾',
              remainingMs: 7000,
              totalMs: 7000,
              tone: 'buff' as const,
              kind: 'playerBuff' as const,
              damageReductionRatio: 0.5,
              damageReductionTypes: ['physical' as const],
            },
          ],
        },
        runtime: {
          ...strippedSetup.runtime,
          damageSources: [],
        },
        enemies: setup.encounter.enemies.map((enemy) =>
          enemy.id === setup.targetEnemyId
            ? {
                ...enemy,
                hp: 100,
                target: 'tank' as const,
                tankThreat: 100,
                allyThreat: 0,
              }
            : enemy,
        ),
      }

      const reflectedReady = tickEncounter(activateSkill({
        ...configured,
        player: {
          ...configured.player,
          gcdRemainingMs: 0,
        },
      }, 'warrior_t_shield_reflection'), 0)
      const afterCast = tickEncounter(tickEncounter(reflectedReady, 1), 0)
      const enemyAfter = afterCast.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(afterCast.player.hp).toBe(500)
      expect(enemyAfter?.hp).toBe(82)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('avatar grants rage and increases subsequent player skill damage and threat', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      E: 'warrior_t_avatar',
      F: 'warrior_t_shield_slam',
    })
    const targetEnemy = encounter.enemies[0]
    const avatarState = tickEncounter(activateSkill({
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
        resource: 20,
      },
    }, 'warrior_t_avatar'), 0)
    const avatarBuff = avatarState.player.buffs.find((status) => status.id === 'avatar')

    const slammed = tickEncounter(activateSkill({
      ...avatarState,
      player: {
        ...avatarState.player,
        gcdRemainingMs: 0,
      },
    }, 'warrior_t_shield_slam'), 0)
    const targetAfter = slammed.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(avatarState.player.resource).toBe(70)
    expect(avatarBuff).toMatchObject({
      remainingMs: 16000,
      damageMultiplierBonus: 0.5,
    })
    expect(targetAfter?.hp).toBe(targetEnemy.hp - 22.5)
    expect((targetAfter?.tankThreat ?? 0) - targetEnemy.tankThreat).toBe(112.5)
  })

  it('shockwave stuns a cross target set and can control casts', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_shockwave',
    })
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e02',
        resource: 100,
      },
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        isSkull: false,
        cast: enemy.id === 'harbor-1-e02'
          ? {
              id: 'ember-bolt',
              name: 'ember-bolt',
              target: enemy.target,
              totalMs: 1500,
              remainingMs: 1500,
              breakRule: 'controlOnly' as const,
              dangerLevel: 'high' as const,
            }
          : null,
      })),
    }

    const nextState = tickEncounter(activateSkill(configured, 'warrior_t_shockwave'), 0)
    const stunnedIds = nextState.enemies
      .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
      .map((enemy) => enemy.id)
      .sort()
    const controlledEnemy = nextState.enemies.find((enemy) => enemy.id === 'harbor-1-e02')

    expect(stunnedIds).toEqual([
      'harbor-1-e01',
      'harbor-1-e02',
      'harbor-1-e03',
      'harbor-1-e07',
    ])
    expect(controlledEnemy?.cast).toBeNull()
    expect(controlledEnemy?.pendingRetryCastSkillId).toBe('ember-bolt')
  })

  it('thunderstruck damages a 3x3 target set and grants rage', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_thunderstruck',
    })
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: 'harbor-1-e02',
        resource: 20,
      },
    }
    const beforeById = new Map(configured.enemies.map((enemy) => [enemy.id, enemy]))
    const expectedDamagedIds = [...resolveEnemyTargetIdsBySelector(configured, 'matrix3x3')].sort()

    const nextState = tickEncounter(activateSkill(configured, 'warrior_t_thunderstruck'), 0)
    const damagedIds = nextState.enemies
      .filter((enemy) => enemy.hp < (beforeById.get(enemy.id)?.hp ?? 0))
      .map((enemy) => enemy.id)
      .sort()

    expect(nextState.player.resource).toBe(30)
    expect(damagedIds).toEqual(expectedDamagedIds)
  })

  it('rallying cry heals player and party for 20 percent max hp', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_rallying_cry',
    })
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        hp: 500,
        resource: 100,
      },
      party: {
        ...encounter.party,
        hp: 600,
      },
    }

    const nextState = tickEncounter(activateSkill(configured, 'warrior_t_rallying_cry'), 0)

    expect(nextState.player.resource).toBe(90)
    expect(nextState.player.hp).toBe(configured.player.hp + configured.player.maxHp * 0.2)
    expect(nextState.party.hp).toBe(800)
  })

  it('intervene redirects the next party damage to the player and then expires', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_intervene',
    })
    const setup = withEnemyCasting(encounter, 'ruin-volley', 'controlOnly', { remainingMs: 1 })
    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        tuning: {
          ...setup.encounter.stage.tuning,
          enemyDamageMultiplier: 1,
        },
      },
      player: {
        ...setup.encounter.player,
        hp: 500,
        resource: 100,
        mitigation: null,
      },
      party: {
        ...setup.encounter.party,
        hp: 500,
      },
    }

    const intervened = tickEncounter(activateSkill(configured, 'warrior_t_intervene'), 0)
    const afterCast = tickEncounter(tickEncounter(intervened, 1), 0)

    expect(afterCast.party.hp).toBe(500)
    expect(afterCast.player.hp).toBe(416)
    expect(afterCast.party.statuses.some((status) => status.id === 'intervened')).toBe(false)
  })

  it('defeats immediately when enemy cast damage drops player hp to zero', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'bone-jab', 'controlOnly', { remainingMs: 1 })
    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        tuning: {
          ...setup.encounter.stage.tuning,
          enemyDamageMultiplier: 1,
        },
      },
      player: {
        ...setup.encounter.player,
        hp: 1,
        mitigation: null,
        buffs: [],
      },
      enemies: setup.encounter.enemies.map((enemy) =>
        enemy.id === setup.targetEnemyId
          ? {
              ...enemy,
              target: 'tank' as const,
              cast: enemy.cast ? { ...enemy.cast, target: 'tank' as const } : enemy.cast,
            }
          : {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 5000,
            },
      ),
    }

    const afterCast = tickEncounter(configured, 1)

    expect(afterCast.player.hp).toBeLessThanOrEqual(0)
    expect(afterCast.result).toEqual({
      outcome: 'defeat',
      reason: configured.stage.tuning.defeatPlayerReason,
    })
  })

  it('stops resolving later enemy damage in the same tick after player hp reaches zero', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'bone-jab', 'controlOnly', { remainingMs: 1 })
    const channelEnemy = setup.encounter.enemies.find((enemy) => enemy.id !== setup.targetEnemyId && enemy.hp > 0)

    if (!channelEnemy) {
      throw new Error('Expected a second enemy for lethal damage ordering test')
    }

    const channelStatus = {
      id: 'windStrike!',
      label: '疾风连击！',
      shortLabel: '风',
      remainingMs: 1000,
      totalMs: 1000,
      tone: 'danger' as const,
      kind: 'enemyBuff' as const,
      effectLogicId: 'wind_strike!_status',
    }
    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        tuning: {
          ...setup.encounter.stage.tuning,
          enemyDamageMultiplier: 1,
        },
      },
      player: {
        ...setup.encounter.player,
        hp: 1,
        mitigation: null,
        buffs: [],
      },
      party: {
        ...setup.encounter.party,
        hp: 100,
      },
      enemies: setup.encounter.enemies.map((enemy) => {
        if (enemy.id === setup.targetEnemyId) {
          return {
            ...enemy,
            target: 'tank' as const,
            cast: enemy.cast ? { ...enemy.cast, target: 'tank' as const } : enemy.cast,
          }
        }

        if (enemy.id === channelEnemy.id) {
          return {
            ...enemy,
            cast: {
              id: 'wind_strike',
              name: 'wind_strike',
              target: 'party' as const,
              totalMs: 1000,
              remainingMs: 1000,
              breakRule: 'controlOnly' as const,
              dangerLevel: 'high' as const,
              phase: 'channeling' as const,
            },
            statuses: [channelStatus],
            recoveryRemainingMs: 0,
          }
        }

        return {
          ...enemy,
          cast: null,
          recoveryRemainingMs: 5000,
        }
      }),
    }

    const afterTick = tickEncounter(configured, 1000)

    expect(afterTick.result).toEqual({
      outcome: 'defeat',
      reason: configured.stage.tuning.defeatPlayerReason,
    })
    expect(afterTick.party.hp).toBe(100)
  })

  it('stops resolving later enemy damage in the same tick after party hp reaches zero', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly', { remainingMs: 1 })
    const targetEnemyIndex = setup.encounter.enemies.findIndex((enemy) => enemy.id === setup.targetEnemyId)
    const channelEnemy = setup.encounter.enemies.find(
      (enemy, index) => index > targetEnemyIndex && enemy.id !== setup.targetEnemyId && enemy.hp > 0,
    )

    if (!channelEnemy) {
      throw new Error('Expected a second enemy for party lethal damage ordering test')
    }

    const channelStatus = {
      id: 'windStrike!',
      label: '疾风连击！',
      shortLabel: '风',
      remainingMs: 1000,
      totalMs: 1000,
      tone: 'danger' as const,
      kind: 'enemyBuff' as const,
      effectLogicId: 'wind_strike!_status',
    }
    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        tuning: {
          ...setup.encounter.stage.tuning,
          enemyDamageMultiplier: 1,
        },
      },
      player: {
        ...setup.encounter.player,
        hp: 100,
        mitigation: null,
        buffs: [],
      },
      party: {
        ...setup.encounter.party,
        hp: 1,
      },
      enemies: setup.encounter.enemies.map((enemy) => {
        if (enemy.id === setup.targetEnemyId) {
          return enemy
        }

        if (enemy.id === channelEnemy.id) {
          return {
            ...enemy,
            cast: {
              id: 'wind_strike',
              name: 'wind_strike',
              target: 'tank' as const,
              totalMs: 1000,
              remainingMs: 1000,
              breakRule: 'controlOnly' as const,
              dangerLevel: 'high' as const,
              phase: 'channeling' as const,
            },
            statuses: [channelStatus],
            recoveryRemainingMs: 0,
          }
        }

        return {
          ...enemy,
          cast: null,
          recoveryRemainingMs: 5000,
        }
      }),
    }

    const afterTick = tickEncounter(configured, 1000)

    expect(afterTick.result).toEqual({
      outcome: 'defeat',
      reason: configured.stage.tuning.defeatPartyReason,
    })
    expect(afterTick.player.hp).toBe(100)
  })

  it('demoralizing shout reduces all enemy outgoing damage and adds threat', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      F: 'warrior_t_demoralizing_shout',
    })
    const setup = withEnemyCasting(encounter, 'bone-jab', 'controlOnly', { remainingMs: 1 })
    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        tuning: {
          ...setup.encounter.stage.tuning,
          enemyDamageMultiplier: 1,
        },
      },
      player: {
        ...setup.encounter.player,
        hp: 500,
        resource: 100,
        mitigation: null,
      },
      enemies: setup.encounter.enemies.map((enemy) =>
        enemy.id === setup.targetEnemyId
          ? {
              ...enemy,
              target: 'tank' as const,
              tankThreat: 100,
              allyThreat: 0,
            }
          : enemy,
      ),
    }

    const shouted = tickEncounter(activateSkill(configured, 'warrior_t_demoralizing_shout'), 0)
    const targetAfterShout = shouted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
    const afterCast = tickEncounter(tickEncounter(shouted, 1), 0)

    expect(targetAfterShout?.statuses.find((status) => status.id === 'demoralized')).toMatchObject({
      outgoingDamageReductionRatio: 0.25,
    })
    expect((targetAfterShout?.tankThreat ?? 0) - 100).toBe(20)
    expect(afterCast.player.hp).toBe(486.5)
  })

  it('allows the default taunt to be cast immediately at combat start', () => {
    const baseEncounter = createHarborEncounter()
    const encounter = selectEnemy(baseEncounter, baseEncounter.enemies[0].id)

    expect(getSkillActivationBlockReason(encounter, 'warrior_t_taunt')).toBeNull()

    const nextState = tickEncounter(activateSkill(encounter, 'warrior_t_taunt'), 0)
    const taunt = nextState.skills.find((skill) => skill.id === 'warrior_t_taunt')
    const target = nextState.enemies.find((enemy) => enemy.id === nextState.player.currentTargetId)

    expect(nextState).not.toBe(encounter)
    expect(taunt?.remainingCooldownMs).toBeGreaterThan(0)
    expect(target?.statuses.find((status) => status.id === 'taunted')).toMatchObject({
      label: '被嘲讽',
      shortLabel: '被',
    })
  })

  it('reports a target requirement before using enemy-targeted skills', () => {
    const encounter = createHarborEncounter()
    const nextState = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
    }

    expect(getSkillActivationBlockReason(nextState, 'warrior_t_interrupt')).toBe('请先选择一个敌方目标。')
  })

  it('interrupt emits/records countered flow and enemy advances to next skill after recovery', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl')

    const interruptedState = tickEncounter(
      dispatchEncounterCommand(setup.encounter, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_interrupt',
      }),
      0,
    )
    const targetEnemy = interruptedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(interruptedState.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/cast-interrupted')).toBe(true)
    expect(interruptedState.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/status-applied')).toBe(true)
    expect(targetEnemy?.cast).toBeNull()
    expect(targetEnemy?.statuses.find((status) => status.id === 'countered')).toMatchObject({
      label: '被反制',
      shortLabel: '被',
    })

    const recoveredState = tickEncounter(interruptedState, 2500)
    const recoveredEnemy = recoveredState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(recoveredEnemy?.cast?.id).not.toBe('ember-bolt')
  })

  it('applies enemy skill recovery only after a cast completes successfully', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          castTimeMs: 1500,
          recoveryMs: 1000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl')
      const configured = {
        ...setup.encounter,
        enemies: setup.encounter.enemies.map((enemy) =>
          enemy.id === setup.targetEnemyId
            ? {
                ...enemy,
                skillIds: ['ember-bolt'],
                skillCycle: ['ember-bolt'],
                skillCycleIndex: 0,
              }
            : enemy,
        ),
      }

      const castComplete = tickEncounter(configured, 1500)
      const recoveringEnemy = castComplete.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(recoveringEnemy?.cast).toBeNull()
      expect(recoveringEnemy?.recoveryRemainingMs).toBe(1000)

      const stillRecovering = tickEncounter(castComplete, 999)
      const stillRecoveringEnemy = stillRecovering.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(stillRecoveringEnemy?.cast).toBeNull()
      expect(stillRecoveringEnemy?.recoveryRemainingMs).toBe(1)

      const nextCastStarted = tickEncounter(stillRecovering, 1)
      const nextCastingEnemy = nextCastStarted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(nextCastingEnemy?.cast).toMatchObject({
        id: 'ember-bolt',
        totalMs: 1500,
        remainingMs: 1500,
      })
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('routes threatTarget player and party debuffs by the actual locked target only', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          targetRuleId: 'threatTarget',
          castTimeMs: 1,
          recoveryMs: 0,
          playerDamage: 0,
          partyDamageOnHit: 12,
          partyDamageOnMiss: 12,
          pressureOnHit: 4,
          pressureOnMiss: 4,
          appliedTargetStatusIds: ['sundered', 'suppression'],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [
        {
          statusId: 'sundered',
          durationMs: 4000,
          effectLogicId: 'none',
        },
      ],
      partyDebuffDefinitions: [
        {
          statusId: 'suppression',
          durationMs: 4000,
          effectLogicId: 'none',
        },
      ],
    })

    try {
      const tankSetup = withEnemyCasting(stripStageSpecialRules(createHarborEncounterWithStandardBuild()), 'ember-bolt', 'controlOnly', {
        remainingMs: 1,
      })
      const tankLocked = {
        ...tankSetup.encounter,
        enemies: tankSetup.encounter.enemies.map((enemy) =>
          enemy.id === tankSetup.targetEnemyId
            ? {
                ...enemy,
                target: 'tank' as const,
                cast: enemy.cast ? { ...enemy.cast, target: 'tank' as const } : enemy.cast,
              }
            : enemy,
        ),
      }
      const tankHit = tickEncounter(tankLocked, 1)

      expect(tankHit.player.debuffs.some((status) => status.id === 'sundered')).toBe(true)
      expect(tankHit.party.statuses.some((status) => status.id === 'suppression')).toBe(false)

      const partySetup = withEnemyCasting(stripStageSpecialRules(createHarborEncounterWithStandardBuild()), 'ember-bolt', 'controlOnly', {
        remainingMs: 1,
      })
      const partyLocked = {
        ...partySetup.encounter,
        enemies: partySetup.encounter.enemies.map((enemy) =>
          enemy.id === partySetup.targetEnemyId
            ? {
                ...enemy,
                target: 'ally' as const,
                cast: enemy.cast ? { ...enemy.cast, target: 'ally' as const } : enemy.cast,
              }
            : enemy,
        ),
      }
      const partyHit = tickEncounter(partyLocked, 1)

      expect(partyHit.player.debuffs.some((status) => status.id === 'sundered')).toBe(false)
      expect(partyHit.party.statuses.some((status) => status.id === 'suppression')).toBe(true)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('lets tankAndParty target rules apply both player and party debuffs regardless of locked target', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          targetRuleId: 'tankAndParty',
          castTimeMs: 1,
          recoveryMs: 0,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 12,
          pressureOnHit: 0,
          pressureOnMiss: 4,
          appliedTargetStatusIds: ['sundered', 'suppression'],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [
        {
          statusId: 'sundered',
          durationMs: 4000,
          effectLogicId: 'none',
        },
      ],
      partyDebuffDefinitions: [
        {
          statusId: 'suppression',
          durationMs: 4000,
          effectLogicId: 'none',
        },
      ],
    })

    try {
      for (const lockedTarget of ['tank', 'party'] as const) {
        const setup = withEnemyCasting(stripStageSpecialRules(createHarborEncounterWithStandardBuild()), 'ember-bolt', 'controlOnly', {
          remainingMs: 1,
        })
        const configured = {
          ...setup.encounter,
          enemies: setup.encounter.enemies.map((enemy) =>
            enemy.id === setup.targetEnemyId
              ? {
                  ...enemy,
                  target: lockedTarget === 'tank' ? 'tank' as const : 'ally' as const,
                  cast: enemy.cast ? { ...enemy.cast, target: lockedTarget } : enemy.cast,
                }
              : enemy,
          ),
        }
        const afterCast = tickEncounter(configured, 1)

        expect(afterCast.player.debuffs.some((status) => status.id === 'sundered')).toBe(true)
        expect(afterCast.party.statuses.some((status) => status.id === 'suppression')).toBe(true)
      }
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('applies wind strike channel status damage every half second to the locked tank target', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'wind_strike',
          targetRuleId: 'threatTarget',
          castTimeMs: 0,
          channelingMs: 3000,
          recoveryMs: 1000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: ['windStrike!'],
          castBreakRule: 'controlOnly',
        },
      ],
      enemyBuffDefinitions: [
        {
          statusId: 'windStrike!',
          statusName: '疾风连击！',
          durationMs: 3000,
          effectLogicId: 'wind_strike!_status',
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const setup = withEnemyCasting(stripStageSpecialRules(createHarborEncounterWithStandardBuild()), 'wind_strike', 'controlOnly', {
        remainingMs: 1,
      })
      const configured = {
        ...setup.encounter,
        player: {
          ...setup.encounter.player,
          hp: 80,
          maxHp: 80,
          mitigation: null,
          buffs: [],
        },
        enemies: setup.encounter.enemies.map((enemy) =>
          enemy.id === setup.targetEnemyId
            ? {
                ...enemy,
                target: 'tank' as const,
                cast: enemy.cast ? { ...enemy.cast, target: 'tank' as const } : enemy.cast,
              }
            : {
                ...enemy,
                cast: null,
                recoveryRemainingMs: 5000,
              },
        ),
      }

      const channeling = tickEncounter(configured, 1)
      const afterOneSecond = tickEncounter(channeling, 1000)
      const channelingEnemy = afterOneSecond.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(afterOneSecond.player.hp).toBe(70)
      expect(channelingEnemy?.statuses.some((status) => status.id === 'windStrike!')).toBe(true)

      const channelFinished = tickEncounter(afterOneSecond, 2000)
      const finishedEnemy = channelFinished.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(channelFinished.player.hp).toBe(50)
      expect(finishedEnemy?.statuses.some((status) => status.id === 'windStrike!')).toBe(false)
      expect(finishedEnemy?.recoveryRemainingMs).toBe(1000)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('uses structured valueA and tickIntervalMs for wind strike channel status damage', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'wind_strike',
          targetRuleId: 'threatTarget',
          castTimeMs: 0,
          channelingMs: 1000,
          recoveryMs: 1000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: ['windStrike!'],
          castBreakRule: 'controlOnly',
        },
      ],
      enemyBuffDefinitions: [
        {
          statusId: 'windStrike!',
          statusName: '疾风连击！',
          durationMs: 1000,
          effectLogicId: 'wind_strike!_status',
          valueA: 7,
          tickIntervalMs: 250,
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const setup = withEnemyCasting(stripStageSpecialRules(createHarborEncounterWithStandardBuild()), 'wind_strike', 'controlOnly', {
        remainingMs: 1,
      })
      const configured = {
        ...setup.encounter,
        player: {
          ...setup.encounter.player,
          hp: 80,
          maxHp: 80,
          mitigation: null,
          buffs: [],
        },
        enemies: setup.encounter.enemies.map((enemy) =>
          enemy.id === setup.targetEnemyId
            ? {
                ...enemy,
                target: 'tank' as const,
                cast: enemy.cast ? { ...enemy.cast, target: 'tank' as const } : enemy.cast,
              }
            : {
                ...enemy,
                cast: null,
                recoveryRemainingMs: 5000,
              },
        ),
      }

      const channeling = tickEncounter(configured, 1)
      const afterOneSecond = tickEncounter(channeling, 1000)

      expect(afterOneSecond.player.hp).toBe(52)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('uses structured valueA for murloc healing status amount', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [],
      enemyBuffDefinitions: [
        {
          statusId: 'murloc_healing',
          statusName: '鱼人在治疗',
          durationMs: 0,
          effectLogicId: 'murlocHealing_status',
          valueA: 42,
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const status = createEnemyStatusEffect('murloc_healing')
      const encounter = createHarborEncounterWithStandardBuild()
      const enemy = {
        ...encounter.enemies[0],
        hp: 20,
        maxHp: 100,
      }

      if (!status) {
        throw new Error('Expected murloc healing status definition')
      }

      const healed = applyEnemyStatusOnApply('murlocHealing_status', enemy, status, {
        tuning: encounter.stage.tuning,
      })

      expect(healed.hp).toBe(62)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('control interruption retries the same enemy skill after control expires without applying skill recovery', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          castTimeMs: 1500,
          recoveryMs: 1000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      withTemporarySkillEffectOverrides(
        [
          {
            skillId: 'warrior_t_stun',
            skillEffectId: 'warrior_t_stun_main',
            durationMs: 3000,
          },
        ],
        () => {
          const encounter = stripStageSpecialRules(createHarborEncounterWithBuildOverride({
            Q: 'warrior_t_stun',
          }))
          const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly', {
            remainingMs: 1500,
          })
          const halfSecondIntoCast = tickEncounter(setup.encounter, 500)
          const controlled = tickEncounter(activateSkill(halfSecondIntoCast, 'warrior_t_stun'), 0)
          const controlledEnemy = controlled.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(controlledEnemy?.cast).toBeNull()
          expect(controlledEnemy?.recoveryRemainingMs).toBe(0)
          expect(controlledEnemy?.pendingRetryCastSkillId).toBe('ember-bolt')
          expect(controlledEnemy?.statuses.find((status) => status.id === 'stunned')).toMatchObject({
            remainingMs: 3000,
          })

          const justBeforeControlEnds = tickEncounter(controlled, 2999)
          const justBeforeEnemy = justBeforeControlEnds.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(justBeforeEnemy?.cast).toBeNull()
          expect(justBeforeEnemy?.pendingRetryCastSkillId).toBe('ember-bolt')

          const retried = tickEncounter(justBeforeControlEnds, 1)
          const retriedEnemy = retried.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(retriedEnemy?.cast).toMatchObject({
            id: 'ember-bolt',
            totalMs: 1500,
            remainingMs: 1500,
          })
          expect(retriedEnemy?.recoveryRemainingMs).toBe(0)
          expect(retriedEnemy?.pendingRetryCastSkillId).toBeNull()
        },
      )
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('hard interrupt uses countered duration and next-cycle skill recovery instead of interrupted skill recovery', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [
        {
          enemyId: 'harbor_pyromancer',
          skillIds: ['ember-bolt', 'flame-lance'],
          skillCycle: ['ember-bolt', 'flame-lance', 'flame-lance'],
          counteredDurationMs: 2000,
        },
      ],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          castTimeMs: 1500,
          recoveryMs: 1000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
          castBreakRule: 'interruptOrControl',
        },
        {
          skillId: 'flame-lance',
          castTimeMs: 500,
          recoveryMs: 2000,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
          castBreakRule: 'interruptOrControl',
        },
      ],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      withTemporarySkillEffectOverrides(
        [
          {
            skillId: 'warrior_t_interrupt',
            skillEffectId: 'warrior_t_interrupt_main',
            durationMs: 1200,
          },
        ],
        () => {
          const encounter = stripStageSpecialRules(createHarborEncounterWithBuildOverride({
            Q: 'warrior_t_interrupt',
          }))
          const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl', {
            remainingMs: 1500,
          })
          const configured = {
            ...setup.encounter,
            enemies: setup.encounter.enemies.map((enemy) =>
              enemy.id === setup.targetEnemyId
                ? {
                    ...enemy,
                    skillIds: ['ember-bolt', 'flame-lance'],
                    skillCycle: ['ember-bolt', 'flame-lance', 'flame-lance'],
                    skillCycleIndex: 0,
                  }
                : enemy,
            ),
          }
          const oneSecondIntoCast = tickEncounter(configured, 1000)
          const interrupted = tickEncounter(activateSkill(oneSecondIntoCast, 'warrior_t_interrupt'), 0)
          const interruptedEnemy = interrupted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(interruptedEnemy?.cast).toBeNull()
          expect(interruptedEnemy?.recoveryRemainingMs).toBe(2000)
          expect(interruptedEnemy?.skillCycleIndex).toBe(1)

          const justBeforeCounteredEnds = tickEncounter(interrupted, 1999)
          const justBeforeEnemy = justBeforeCounteredEnds.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(justBeforeEnemy?.cast).toBeNull()
          expect(justBeforeEnemy?.recoveryRemainingMs).toBe(1)

          const firstFlameStarted = tickEncounter(justBeforeCounteredEnds, 1)
          const firstFlameCastingEnemy = firstFlameStarted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(firstFlameCastingEnemy?.cast).toMatchObject({
            id: 'flame-lance',
            totalMs: 500,
            remainingMs: 500,
          })

          const firstFlameCompleted = tickEncounter(firstFlameStarted, 500)
          const firstFlameCompletedEnemy = firstFlameCompleted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(firstFlameCompletedEnemy?.cast).toBeNull()
          expect(firstFlameCompletedEnemy?.recoveryRemainingMs).toBe(2000)
          expect(firstFlameCompletedEnemy?.skillCycleIndex).toBe(2)

          const justBeforeRecoveryEnds = tickEncounter(firstFlameCompleted, 1999)
          const justBeforeRecoveryEnemy = justBeforeRecoveryEnds.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(justBeforeRecoveryEnemy?.cast).toBeNull()
          expect(justBeforeRecoveryEnemy?.recoveryRemainingMs).toBe(1)

          const secondFlameStarted = tickEncounter(justBeforeRecoveryEnds, 1)
          const secondFlameCastingEnemy = secondFlameStarted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(secondFlameCastingEnemy?.cast).toMatchObject({
            id: 'flame-lance',
            totalMs: 500,
            remainingMs: 500,
          })
        },
      )
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('enters channeling after a successful cast and keeps the self status until channeling ends', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          targetRuleId: 'self',
          castTimeMs: 500,
          channelingMs: 2000,
          recoveryMs: 300,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: ['ember-aegis', 'haste'],
          castBreakRule: 'interruptOrControl',
        },
      ],
      enemyBuffDefinitions: [
        {
          statusId: 'ember-aegis',
          durationMs: -1,
          effectLogicId: 'channel_self_until_end',
        },
        {
          statusId: 'haste',
          durationMs: -1,
          effectLogicId: 'channel_speed_bonus',
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = stripStageSpecialRules(createHarborEncounterWithStandardBuild())
      const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl', {
        remainingMs: 500,
      })
      const initialCycleIndex = setup.encounter.enemies.find(
        (enemy) => enemy.id === setup.targetEnemyId,
      )?.skillCycleIndex
      const castComplete = tickEncounter(setup.encounter, 500)
      const channelingEnemy = castComplete.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(channelingEnemy?.cast).toMatchObject({
        id: 'ember-bolt',
        phase: 'channeling',
        totalMs: 2000,
        remainingMs: 2000,
      })
      expect(channelingEnemy?.recoveryRemainingMs).toBe(0)
      expect(channelingEnemy?.skillCycleIndex).toBe(initialCycleIndex)
      expect(channelingEnemy?.statuses.find((status) => status.id === 'ember-aegis')).toMatchObject({
        channelSourceSkillId: 'ember-bolt',
        remainingMs: -1,
      })
      expect(channelingEnemy?.statuses.find((status) => status.id === 'haste')).toMatchObject({
        effectLogicId: 'channel_speed_bonus',
        remainingMs: -1,
      })

      const channelFinished = tickEncounter(castComplete, 2000)
      const finishedEnemy = channelFinished.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(finishedEnemy?.cast).toBeNull()
      expect(finishedEnemy?.statuses.some((status) => status.id === 'ember-aegis')).toBe(false)
      expect(finishedEnemy?.statuses.some((status) => status.id === 'haste')).toBe(true)
      expect(finishedEnemy?.recoveryRemainingMs).toBe(300)
      expect(finishedEnemy?.skillCycleIndex).not.toBe(initialCycleIndex)
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('control during channeling stops the channel and advances to the next skill after control expires', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [
        {
          enemyId: 'harbor_pyromancer',
          skillIds: ['ember-bolt', 'flame-lance'],
          skillCycle: ['ember-bolt', 'flame-lance'],
        },
      ],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          targetRuleId: 'self',
          castTimeMs: 500,
          channelingMs: 2000,
          recoveryMs: 300,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: ['ember-aegis', 'haste'],
          castBreakRule: 'controlOnly',
        },
        {
          skillId: 'flame-lance',
          castTimeMs: 400,
          recoveryMs: 0,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
          castBreakRule: 'interruptOrControl',
        },
      ],
      enemyBuffDefinitions: [
        {
          statusId: 'ember-aegis',
          durationMs: -1,
          effectLogicId: 'channel_self_until_end',
        },
        {
          statusId: 'haste',
          durationMs: -1,
          effectLogicId: 'channel_speed_bonus',
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      withTemporarySkillEffectOverrides(
        [
          {
            skillId: 'warrior_t_stun',
            skillEffectId: 'warrior_t_stun_main',
            durationMs: 3000,
          },
        ],
        () => {
          const encounter = stripStageSpecialRules(createHarborEncounterWithBuildOverride({
            Q: 'warrior_t_stun',
          }))
          const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly', {
            remainingMs: 500,
          })
          const channeling = tickEncounter(setup.encounter, 500)
          const controlled = tickEncounter(activateSkill(channeling, 'warrior_t_stun'), 0)
          const controlledEnemy = controlled.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(controlledEnemy?.cast).toBeNull()
          expect(controlledEnemy?.pendingRetryCastSkillId).toBeNull()
          expect(controlledEnemy?.recoveryRemainingMs).toBe(0)
          expect(controlledEnemy?.skillCycleIndex).toBe(1)
          expect(controlledEnemy?.statuses.some((status) => status.id === 'ember-aegis')).toBe(false)
          expect(controlledEnemy?.statuses.some((status) => status.id === 'haste')).toBe(true)

          const nextSkillStarted = tickEncounter(controlled, 3000)
          const nextEnemy = nextSkillStarted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

          expect(nextEnemy?.cast).toMatchObject({
            id: 'flame-lance',
            totalMs: 400,
            remainingMs: 400,
          })
        },
      )
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('hard interrupt during channeling waits for countered duration and then starts the next skill', () => {
    applyEnemyWorkbookOverrides({
      enemyDefinitions: [
        {
          enemyId: 'harbor_pyromancer',
          skillIds: ['ember-bolt', 'flame-lance'],
          skillCycle: ['ember-bolt', 'flame-lance'],
          counteredDurationMs: 1200,
        },
      ],
      skillDefinitions: [
        {
          skillId: 'ember-bolt',
          targetRuleId: 'self',
          castTimeMs: 500,
          channelingMs: 2000,
          recoveryMs: 300,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: ['ember-aegis', 'haste'],
          castBreakRule: 'interruptOrControl',
        },
        {
          skillId: 'flame-lance',
          castTimeMs: 400,
          recoveryMs: 0,
          playerDamage: 0,
          partyDamageOnHit: 0,
          partyDamageOnMiss: 0,
          pressureOnHit: 0,
          pressureOnMiss: 0,
          appliedTargetStatusIds: [],
          appliedSelfStatusIds: [],
          castBreakRule: 'interruptOrControl',
        },
      ],
      enemyBuffDefinitions: [
        {
          statusId: 'ember-aegis',
          durationMs: -1,
          effectLogicId: 'channel_self_until_end',
        },
        {
          statusId: 'haste',
          durationMs: -1,
          effectLogicId: 'channel_speed_bonus',
        },
      ],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    try {
      const encounter = stripStageSpecialRules(createHarborEncounterWithBuildOverride({
        Q: 'warrior_t_interrupt',
      }))
      const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl', {
        remainingMs: 500,
      })
      const channeling = tickEncounter(setup.encounter, 500)
      const interrupted = tickEncounter(activateSkill(channeling, 'warrior_t_interrupt'), 0)
      const interruptedEnemy = interrupted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(interruptedEnemy?.cast).toBeNull()
      expect(interruptedEnemy?.recoveryRemainingMs).toBe(1200)
      expect(interruptedEnemy?.pendingRetryCastSkillId).toBeNull()
      expect(interruptedEnemy?.skillCycleIndex).toBe(1)
      expect(interruptedEnemy?.statuses.some((status) => status.id === 'ember-aegis')).toBe(false)
      expect(interruptedEnemy?.statuses.some((status) => status.id === 'haste')).toBe(true)

      const nextSkillStarted = tickEncounter(interrupted, 1200)
      const nextEnemy = nextSkillStarted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(nextEnemy?.cast).toMatchObject({
        id: 'flame-lance',
        totalMs: 400,
        remainingMs: 400,
      })
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('interrupt falls back to the player skill effect duration when enemy countered duration is -1', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl')
    const targetDefinitionId = setup.encounter.enemies.find(
      (enemy) => enemy.id === setup.targetEnemyId,
    )?.definitionId

    if (!targetDefinitionId) {
      throw new Error('Expected interrupt target to have an enemy definition id')
    }

    applyEnemyWorkbookOverrides({
      enemyDefinitions: [
        {
          enemyId: targetDefinitionId,
          counteredDurationMs: -1,
        },
      ],
      skillDefinitions: [],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_interrupt',
          skillEffectId: 'warrior_t_interrupt_main',
          durationMs: 2600,
        },
      ],
      () => {
        const interruptedState = tickEncounter(activateSkill(setup.encounter, 'warrior_t_interrupt'), 0)
        const targetEnemy = interruptedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

        expect(targetEnemy?.recoveryRemainingMs).toBe(2600)
        expect(targetEnemy?.statuses.find((status) => status.id === 'countered')).toMatchObject({
          remainingMs: 2600,
          totalMs: 2600,
        })
      },
    )

    applyEnemyWorkbookOverrides({
      enemyDefinitions: [],
      skillDefinitions: [],
      enemyBuffDefinitions: [],
      playerDebuffDefinitions: [],
      partyDebuffDefinitions: [],
    })
  })

  it('interrupt falls back to zero duration when enemy countered duration and skill effect duration are absent', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'test_interrupt_no_duration',
          classId: 'warrior_t',
          skillName: '测试打断',
          shortName: '测断',
          description: '没有效果持续时间的测试打断',
          iconId: 'interrupt',
          pointCost: 1,
          resourceCost: 0,
          cooldownMs: 0,
          initialRemainingCooldownMs: 0,
          gcdMs: 0,
          targetingType: 'currentEnemy',
          skillLogicId: 'interrupt_cast',
          castStopMode: 'interrupt',
          canAffectSkull: true,
          grantedStatusIds: ['countered'],
          enabled: true,
        },
      ],
    })

    try {
      const encounter = createHarborEncounterWithBuildOverride({
        Q: 'test_interrupt_no_duration',
      })
      const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl')
      const targetDefinitionId = setup.encounter.enemies.find(
        (enemy) => enemy.id === setup.targetEnemyId,
      )?.definitionId

      if (!targetDefinitionId) {
        throw new Error('Expected interrupt target to have an enemy definition id')
      }

      applyEnemyWorkbookOverrides({
        enemyDefinitions: [
          {
            enemyId: targetDefinitionId,
            counteredDurationMs: -1,
          },
        ],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })

      const interruptedState = tickEncounter(activateSkill(setup.encounter, 'test_interrupt_no_duration'), 0)
      const targetEnemy = interruptedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

      expect(targetEnemy?.recoveryRemainingMs).toBe(0)
      expect(targetEnemy?.statuses.some((status) => status.id === 'countered')).toBe(false)
    } finally {
      applyPlayerBuildWorkbookOverrides({
        ...emptyPlayerBuildOverrides(),
        activeSkillDefinitions: [
          {
            skillId: 'warrior_t_interrupt',
          },
        ],
      })
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('blocks non-allEnemy interrupt skills when the current target is not a legal enemy', () => {
    const originalInterrupt = getActiveSkillDefinition('warrior_t_interrupt')

    if (!originalInterrupt) {
      throw new Error('warrior_t_interrupt sample data is missing')
    }

    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'warrior_t_interrupt',
          targetingType: 'currentEnemy',
          canAffectSkull: false,
        },
      ],
    })

    try {
      const encounter = createHarborEncounterWithBuildOverride({
        Q: 'warrior_t_interrupt',
      })
      const setup = withEnemyCasting(encounter, 'ember-bolt', 'interruptOrControl', {
        isSkull: true,
      })
      const configured = {
        ...setup.encounter,
        player: {
          ...setup.encounter.player,
          resource: 100,
        },
      }

      expect(getSkillActivationBlockReason(configured, 'warrior_t_interrupt')).toBe('请选择一个有效的敌方目标。')
      expect(activateSkill(configured, 'warrior_t_interrupt')).toMatchObject({
        player: { resource: 100 },
      })
    } finally {
      applyPlayerBuildWorkbookOverrides({
        ...emptyPlayerBuildOverrides(),
        activeSkillDefinitions: [
          {
            skillId: 'warrior_t_interrupt',
            resourceCost: originalInterrupt.resourceCost,
            cooldownMs: originalInterrupt.cooldownMs,
            gcdMs: originalInterrupt.gcdMs,
            targetingType: originalInterrupt.targetingType,
            canAffectSkull: originalInterrupt.canAffectSkull,
          },
        ],
      })
    }
  })

  it('incorrigible doubles interrupt and control skill cooldowns without affecting normal skills', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const encounter = createWestFallEncounterWithBuildOverride({
        '1': 'warrior_t_taunt',
        '2': 'warrior_t_interrupt',
        '3': 'warrior_t_stun',
      })
      const targetEnemy = encounter.enemies[0]

      if (!targetEnemy) {
        throw new Error('Expected WestFall encounter to have at least one enemy')
      }

      const configured = {
        ...encounter,
        player: {
          ...encounter.player,
          currentTargetId: targetEnemy.id,
          resource: 100,
        },
        enemies: encounter.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                cast: {
                  id: 'flame_missiles',
                  name: '烛火飞弹',
                  target: 'tank' as const,
                  remainingMs: 1000,
                  totalMs: 1000,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'medium' as const,
                },
              }
            : enemy,
        ),
      }
      const interrupted = activateSkill(configured, 'warrior_t_interrupt')
      const stunned = activateSkill({
        ...configured,
        player: {
          ...configured.player,
          gcdRemainingMs: 0,
        },
        skills: configured.skills.map((skill) =>
          skill.id === 'warrior_t_interrupt'
            ? { ...skill, remainingCooldownMs: 0 }
            : skill,
        ),
      }, 'warrior_t_stun')
      const taunted = activateSkill({
        ...configured,
        player: {
          ...configured.player,
          gcdRemainingMs: 0,
        },
        skills: configured.skills.map((skill) =>
          skill.id === 'warrior_t_interrupt' || skill.id === 'warrior_t_stun'
            ? { ...skill, remainingCooldownMs: 0 }
            : skill,
        ),
      }, 'warrior_t_taunt')

      const interrupt = interrupted.skills.find((skill) => skill.id === 'warrior_t_interrupt')
      const stun = stunned.skills.find((skill) => skill.id === 'warrior_t_stun')
      const taunt = taunted.skills.find((skill) => skill.id === 'warrior_t_taunt')

      expect(encounter.player.debuffs.some((status) => status.effectLogicId === 'incorrigibled_status')).toBe(true)
      expect(interrupt?.remainingCooldownMs).toBe((interrupt?.cooldownMs ?? 0) * 2)
      expect(stun?.remainingCooldownMs).toBe((stun?.cooldownMs ?? 0) * 2)
      expect(taunt?.remainingCooldownMs).toBe(taunt?.cooldownMs)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('WestFall affix and special rules initialize old grudge, healer sustain, and incorrigible cooldown tax', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-1')
      const encounter = createInitialEncounterState(
        stage,
        {
          ...getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
          loadout: {
            '1': 'warrior_t_taunt',
            '2': 'warrior_t_interrupt',
            '3': 'warrior_t_stun',
            '4': 'warrior_t_revenge',
            Q: 'warrior_t_ignore_pain',
            E: null,
            R: null,
            F: null,
          },
        },
      )
      const firstEnemy = encounter.enemies[0]

      if (!firstEnemy) {
        throw new Error('Expected WestFall encounter to have enemies')
      }

      const afterAffixTick = tickEncounter({
        ...encounter,
        player: {
          ...encounter.player,
          currentTargetId: firstEnemy.id,
          hp: 30,
          resource: 0,
        },
      }, 0)
      const afterHealTick = tickEncounter({
        ...afterAffixTick,
        player: {
          ...afterAffixTick.player,
          currentTargetId: null,
          hp: 40,
        },
        enemies: afterAffixTick.enemies.map((enemy) => ({
          ...enemy,
          cast: null,
          recoveryRemainingMs: 999_999,
        })),
      }, 1000)

      expect(afterAffixTick.player.hp).toBe(50)
      expect(afterAffixTick.player.resource).toBe(50)
      expect(afterAffixTick.player.debuffs.some((status) => status.effectLogicId === 'incorrigibled_status')).toBe(true)
      expect(afterAffixTick.party.statuses.some((status) => status.effectLogicId === 'sensitive?_status')).toBe(true)
      expect(afterHealTick.player.hp).toBe(43)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('WestFall murloc statuses heal, suppress healing, and modify incoming player damage', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-1')
      const base = stripStageSpecialRules(createInitialEncounterState(
        stage,
        getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
      ))
      const isolatedBase = {
        ...base,
        runtime: {
          ...base.runtime,
          pendingAffixTriggers: [],
        },
      }
      const murloc = isolatedBase.enemies.find((enemy) => enemy.definitionId === 'murloc_scout') ?? isolatedBase.enemies[0]
      if (!murloc) {
        throw new Error('Expected WestFall encounter to have a murloc')
      }

      const running = tickEncounter({
        ...isolatedBase,
        player: {
          ...isolatedBase.player,
          currentTargetId: null,
        },
        enemies: isolatedBase.enemies.map((enemy) =>
          enemy.id === murloc.id
            ? {
                ...enemy,
                hp: 40,
                maxHp: 100,
                statuses: [
                  {
                    id: 'run!',
                    iconId: 'run!_status_pic',
                    label: '跑啊',
                    shortLabel: '跑',
                    remainingMs: 6000,
                    totalMs: 6000,
                    tone: 'buff',
                    kind: 'enemyBuff',
                    effectLogicId: 'run!_status',
                  },
                ],
                cast: {
                  id: 'run!',
                  name: '跑啊！',
                  target: 'self',
                  remainingMs: 6000,
                  totalMs: 6000,
                  breakRule: 'controlOnly',
                  dangerLevel: 'low',
                  phase: 'channeling',
                },
              }
            : {
                ...enemy,
                cast: null,
                recoveryRemainingMs: 999_999,
              },
        ),
      }, 500)
      const watched = tickEncounter({
        ...isolatedBase,
        player: {
          ...isolatedBase.player,
          currentTargetId: null,
          hp: 40,
        },
        enemies: isolatedBase.enemies.map((enemy) =>
          enemy.id === murloc.id
            ? {
                ...enemy,
                statuses: [
                  {
                    id: 'murloc_watching',
                    iconId: 'murlocWatching_status_pic',
                    label: '鱼人在观察',
                    shortLabel: '观',
                    remainingMs: 6000,
                    totalMs: 6000,
                    tone: 'buff',
                    kind: 'enemyBuff',
                    effectLogicId: 'murlocWatching_status',
                  },
                ],
                cast: {
                  id: 'murloc_watch',
                  name: '鱼人观察',
                  target: 'tank',
                  remainingMs: 6000,
                  totalMs: 6000,
                  breakRule: 'controlOnly',
                  dangerLevel: 'low',
                  phase: 'channeling',
                },
              }
            : {
                ...enemy,
                cast: null,
                recoveryRemainingMs: 999_999,
              },
        ),
      }, 1000)
      const upgradedMarked = tickEncounter({
        ...isolatedBase,
        player: {
          ...isolatedBase.player,
          currentTargetId: null,
          hp: 100,
          debuffs: [
            {
              id: 'marked',
              iconId: 'marked_status_pic',
              label: '被标记',
              shortLabel: '标',
              remainingMs: 10_000,
              totalMs: 10_000,
              tone: 'danger',
              kind: 'playerDebuff',
              effectLogicId: 'marked_status',
            },
          ],
          mitigation: null,
        },
        enemies: isolatedBase.enemies.map((enemy) =>
          enemy.id === murloc.id
            ? {
                ...enemy,
                statuses: [
                  {
                    id: 'murloc_upgraded',
                    iconId: 'murlocUpgraded_status_pic',
                    label: '鱼人升级啦',
                    shortLabel: '升',
                    remainingMs: -1,
                    totalMs: -1,
                    tone: 'buff',
                    kind: 'enemyBuff',
                    effectLogicId: 'murlocUpgraded_status',
                    stacks: 2,
                    maxStacks: 99,
                  },
                ],
                cast: {
                  id: 'murloc_melee',
                  name: '鱼人攻击',
                  target: 'tank',
                  remainingMs: 0,
                  totalMs: 500,
                  breakRule: 'controlOnly',
                  dangerLevel: 'low',
                },
              }
            : {
                ...enemy,
                hp: 0,
                cast: null,
                recoveryRemainingMs: 0,
              },
        ),
      }, 0)

      expect(running.enemies.find((enemy) => enemy.id === murloc.id)?.hp).toBe(42)
      expect(watched.player.hp).toBe(40)
      expect(upgradedMarked.player.hp).toBe(93)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('WestFall-2 marked and murloc upgrade modify physical blowgun damage from table data', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-2')
      const base = stripStageSpecialRules(createInitialEncounterState(
        stage,
        getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
      ))
      const markedDefinition = getEnemyStatusDefinition('marked')
      const upgradedDefinition = getEnemyStatusDefinition('murloc_upgraded')
      const tidehunter = base.enemies.find((enemy) => enemy.definitionId === 'murloc_tidehunter')
      const blowgiller = base.enemies.find((enemy) => enemy.definitionId === 'murloc_blowgiller')

      if (!markedDefinition || markedDefinition.kind !== 'playerDebuff') {
        throw new Error('Expected marked player debuff definition from current workbook')
      }
      if (!upgradedDefinition || upgradedDefinition.kind !== 'enemyBuff') {
        throw new Error('Expected murloc_upgraded enemy buff definition from current workbook')
      }
      if (!tidehunter || !blowgiller) {
        throw new Error('Expected WestFall-2 to contain a tidehunter and a blowgiller')
      }
      const markedStatus = createEnemyStatusEffect('marked')
      const upgradedStatus = createEnemyStatusEffect('murloc_upgraded')
      if (!markedStatus || !upgradedStatus) {
        throw new Error('Expected WestFall-2 status runtime definitions from current workbook')
      }

      const setupCast = (
        casterId: string,
        skillId: 'murloc_mark' | 'murloc_blowgun',
        options: {
          playerDebuffs?: typeof base.player.debuffs
          upgradedStacks?: number
        } = {},
      ) => ({
        ...base,
        runtime: {
          ...base.runtime,
          pendingAffixTriggers: [],
          damageSources: base.runtime.damageSources.map((source) => ({
            ...source,
            remainingMs: 999_999,
          })),
        },
        stage: {
          ...base.stage,
          playerAutoHeal: 0,
          partyAutoHeal: 0,
          partyAutoDamageMin: 0,
          partyAutoDamageMax: 0,
        },
        player: {
          ...base.player,
          hp: 100,
          resource: 0,
          mitigation: null,
          debuffs: options.playerDebuffs ?? [],
          buffs: [],
        },
        enemies: base.enemies.map((enemy) =>
          enemy.id === casterId
            ? {
                ...enemy,
                target: 'tank' as const,
                tankThreat: 100,
                allyThreat: 0,
                statuses: options.upgradedStacks
                  ? [
                      {
                        ...upgradedStatus,
                        stacks: options.upgradedStacks,
                        maxStacks: 99,
                      },
                    ]
                  : [],
                cast: {
                  id: skillId,
                  name: skillId,
                  target: 'tank' as const,
                  remainingMs: 0,
                  totalMs: 1,
                  breakRule: 'controlOnly' as const,
                  dangerLevel: 'low' as const,
                },
                recoveryRemainingMs: 0,
              }
            : {
                ...enemy,
                cast: null,
                recoveryRemainingMs: 999_999,
              },
        ),
      })

      const afterMark = tickEncounter(setupCast(tidehunter.id, 'murloc_mark'), 0)
      const baselineBlowgun = tickEncounter(setupCast(blowgiller.id, 'murloc_blowgun'), 0)
      const markedBlowgun = tickEncounter(setupCast(blowgiller.id, 'murloc_blowgun', {
        playerDebuffs: [markedStatus],
      }), 0)
      const upgradedOnceBlowgun = tickEncounter(setupCast(blowgiller.id, 'murloc_blowgun', {
        upgradedStacks: 1,
      }), 0)
      const upgradedThreeTimesBlowgun = tickEncounter(setupCast(blowgiller.id, 'murloc_blowgun', {
        upgradedStacks: 3,
      }), 0)

      const damageTaken = (state: typeof baselineBlowgun) => 100 - state.player.hp

      expect(afterMark.player.debuffs.some((status) => status.effectLogicId === 'marked_status')).toBe(true)
      expect(damageTaken(baselineBlowgun)).toBe(2)
      expect(damageTaken(markedBlowgun)).toBe(3)
      expect(damageTaken(upgradedOnceBlowgun)).toBe(3)
      expect(damageTaken(upgradedThreeTimesBlowgun)).toBe(5)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('murloc watching suppresses healing and outgoing damage on the locked target side only', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-1')
      const base = {
        ...stripStageSpecialRules(createInitialEncounterState(
          stage,
          {
            ...getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
            loadout: {
              '1': 'warrior_t_rallying_cry',
              '2': 'warrior_t_revenge',
              '3': null,
              '4': null,
              Q: null,
              E: null,
              R: null,
              F: null,
            },
          },
        )),
      }
      const warleader = base.enemies.find((enemy) => enemy.definitionId === 'murloc_warleader') ?? base.enemies[0]
      if (!warleader) {
        throw new Error('Expected WestFall encounter to have a warleader')
      }
      const watchedStatus = {
        id: 'murloc_watching',
        iconId: 'murlocWatching_status_pic',
        label: '鱼人在观察',
        shortLabel: '观',
        remainingMs: 6000,
        totalMs: 6000,
        tone: 'buff' as const,
        kind: 'enemyBuff' as const,
        effectLogicId: 'murlocWatching_status',
      }
      const withWatcher = (
        target: 'tank' | 'party',
      ) => ({
        ...base,
        stage: {
          ...base.stage,
          partyAutoDamageMin: 10,
          partyAutoDamageMax: 10,
        },
        runtime: {
          ...base.runtime,
          pendingAffixTriggers: [],
        },
        player: {
          ...base.player,
          hp: 40,
          mitigation: null,
          resource: 100,
          currentTargetId: null,
        },
        party: {
          ...base.party,
          hp: 40,
          pressure: 0,
        },
        enemies: base.enemies.map((enemy) =>
          enemy.id === warleader.id
            ? {
                ...enemy,
                statuses: [watchedStatus],
                cast: {
                  id: 'murloc_watch',
                  name: '鱼人观察',
                  target,
                  remainingMs: 6000,
                  totalMs: 6000,
                  breakRule: 'controlOnly' as const,
                  dangerLevel: 'low' as const,
                  phase: 'channeling' as const,
                },
                recoveryRemainingMs: 999_999,
              }
            : {
                ...enemy,
                hp: 0,
                cast: null,
                recoveryRemainingMs: 0,
              },
        ),
      })
      const playerWatchedAutoHeal = tickEncounter(withWatcher('tank'), 1000)
      const partyWatchedAutoHeal = tickEncounter({
        ...withWatcher('party'),
        stage: {
          ...base.stage,
          playerAutoHeal: 5,
          partyAutoHeal: 5,
        },
      }, 1000)
      const playerWatchedRallyingCry = activateSkill(withWatcher('tank'), 'warrior_t_rallying_cry')
      const partyWatchedRallyingCry = activateSkill(withWatcher('party'), 'warrior_t_rallying_cry')
      const playerWatchedSkillDamage = tickEncounter(activateSkill({
        ...withWatcher('tank'),
        player: {
          ...withWatcher('tank').player,
          currentTargetId: warleader.id,
          resource: 100,
        },
      }, 'warrior_t_revenge'), 0)
      const playerUnwatchedSkillDamage = tickEncounter(activateSkill({
        ...withWatcher('party'),
        player: {
          ...withWatcher('party').player,
          currentTargetId: warleader.id,
          resource: 100,
        },
      }, 'warrior_t_revenge'), 0)
      const partyWatchedAutoDamage = tickEncounter({
        ...withWatcher('party'),
        party: {
          ...withWatcher('party').party,
          currentTargetId: warleader.id,
        },
        runtime: {
          ...withWatcher('party').runtime,
          damageSources: withWatcher('party').runtime.damageSources.map((source) =>
            source.sourceKind === 'party_ambient_random'
              ? {
                  ...source,
                  remainingMs: 1,
                  minDamage: 10,
                  maxDamage: 10,
                }
              : source,
          ),
        },
      }, 1)
      const partyUnwatchedAutoDamage = tickEncounter({
        ...withWatcher('tank'),
        party: {
          ...withWatcher('tank').party,
          currentTargetId: warleader.id,
        },
        runtime: {
          ...withWatcher('tank').runtime,
          damageSources: withWatcher('tank').runtime.damageSources.map((source) =>
            source.sourceKind === 'party_ambient_random'
              ? {
                  ...source,
                  remainingMs: 1,
                  minDamage: 10,
                  maxDamage: 10,
                }
              : source,
          ),
        },
      }, 1)
      const unwatchedSkillDamage =
        warleader.hp -
        (playerUnwatchedSkillDamage.enemies.find((enemy) => enemy.id === warleader.id)?.hp ?? warleader.hp)
      const unwatchedPartyDamage =
        warleader.hp -
        (partyUnwatchedAutoDamage.enemies.find((enemy) => enemy.id === warleader.id)?.hp ?? warleader.hp)

      expect(playerWatchedAutoHeal.player.hp).toBe(40)
      expect(playerWatchedAutoHeal.party.hp).toBe(40)
      expect(partyWatchedAutoHeal.player.hp).toBe(45)
      expect(partyWatchedAutoHeal.party.hp).toBe(40)
      expect(playerWatchedRallyingCry.player.hp).toBe(40)
      expect(playerWatchedRallyingCry.party.hp).toBe(60)
      expect(partyWatchedRallyingCry.player.hp).toBe(60)
      expect(partyWatchedRallyingCry.party.hp).toBe(40)
      expect(playerWatchedSkillDamage.enemies.find((enemy) => enemy.id === warleader.id)?.hp).toBe(warleader.hp - unwatchedSkillDamage * 0.5)
      expect(partyWatchedAutoDamage.enemies.find((enemy) => enemy.id === warleader.id)?.hp).toBe(warleader.hp - unwatchedPartyDamage * 0.5)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('WestFall healing and Old Murk-Eye effects target the intended side from table data', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-6')
      const base = stripStageSpecialRules(createInitialEncounterState(
        stage,
        getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
      ))
      const isolatedBase = {
        ...base,
        runtime: {
          ...base.runtime,
          pendingAffixTriggers: [],
        },
      }
      const seerIndex = isolatedBase.enemies.findIndex((enemy) => enemy.definitionId === 'coldlight_seer')
      const murkIndex = isolatedBase.enemies.findIndex((enemy) => enemy.definitionId === 'Old_Murk-Eye')
      if (seerIndex < 0 || murkIndex < 0) {
        throw new Error('Expected WestFall-6 to contain a seer and Old Murk-Eye')
      }

      const healed = tickEncounter({
        ...isolatedBase,
        enemies: isolatedBase.enemies.map((enemy, index) => {
          if (index === seerIndex) {
            return {
              ...enemy,
              cast: {
                id: 'murloc_heal',
                name: '鱼人治疗术',
                target: 'enemy',
                remainingMs: 0,
                totalMs: 3000,
                breakRule: 'interruptOrControl',
                dangerLevel: 'high',
              },
            }
          }
          if (index === murkIndex) {
            return {
              ...enemy,
              hp: enemy.maxHp - 10,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          }
          return {
            ...enemy,
            hp: enemy.maxHp - 80,
            cast: null,
            recoveryRemainingMs: 999_999,
          }
        }),
      }, 0)
      const murked = tickEncounter({
        ...isolatedBase,
        player: {
          ...isolatedBase.player,
          hp: 150,
        },
        party: {
          ...isolatedBase.party,
          hp: 100,
          pressure: 20,
        },
        enemies: isolatedBase.enemies.map((enemy, index) =>
          index === murkIndex
            ? {
                ...enemy,
                cast: {
                  id: 'Murk-Eye_rush',
                  name: '瞎眼冲锋',
                  target: 'party',
                  remainingMs: 0,
                  totalMs: 4000,
                  breakRule: 'controlOnly',
                  dangerLevel: 'low',
                },
              }
            : enemy,
        ),
      }, 0)
      const tankMurked = tickEncounter({
        ...isolatedBase,
        player: {
          ...isolatedBase.player,
          hp: 150,
        },
        enemies: isolatedBase.enemies.map((enemy, index) =>
          index === murkIndex
            ? {
                ...enemy,
                cast: {
                  id: 'Murk-Eye_rush',
                  name: '瞎眼冲锋',
                  target: 'tank',
                  remainingMs: 0,
                  totalMs: 4000,
                  breakRule: 'controlOnly',
                  dangerLevel: 'low',
                },
              }
            : enemy,
        ),
      }, 0)
      const healedMostInjuredEnemy = healed.enemies
        .filter((_enemy, index) => index !== murkIndex && index !== seerIndex)
        .find((enemy) => enemy.maxHp - enemy.hp === 5)
      const murlocHealingDefinition = getEnemyStatusDefinition('murloc_healing')

      const livingFishCount = isolatedBase.enemies.filter(
        (enemy) =>
          enemy.hp > 0 &&
          (enemy.definitionId.startsWith('murloc') || enemy.definitionId.startsWith('coldlight')),
      ).length

      expect(murlocHealingDefinition?.description).toContain('75')
      expect(healedMostInjuredEnemy).toBeDefined()
      expect(murked.player.hp).toBe(150)
      expect(murked.party.hp).toBe(100 - 10 - livingFishCount * 5)
      expect(murked.party.pressure).toBe(20 + 10 + livingFishCount * 5)
      expect(buildEncounterStats(murked).pressureGained).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectName: expect.stringContaining('瞎眼'),
            category: '状态',
            total: livingFishCount * 5,
          }),
        ]),
      )
      expect(buildEncounterStats(tankMurked).tankDamageTaken).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            effectName: expect.stringContaining('瞎眼'),
            category: '状态',
            total: livingFishCount * 5,
          }),
        ]),
      )
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('WestFall-3 simultaneous mostInjured heals keep their cast-start target and can overheal it', () => {
    loadCurrentDesignerWorkbooks()

    try {
      const stage = getStageById('WestFall-3')
      const base = stripStageSpecialRules(createInitialEncounterState(
        stage,
        getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)),
      ))
      const warleader = base.enemies.find((enemy) => enemy.definitionId === 'murloc_warleader')
      const injuredBlowgiller = base.enemies.find((enemy) => enemy.definitionId === 'murloc_blowgiller')
      const seers = base.enemies.filter((enemy) => enemy.definitionId === 'coldlight_seer')

      if (!warleader || !injuredBlowgiller || seers.length < 2) {
        throw new Error('Expected WestFall-3 to contain a warleader, a blowgiller, and two seers')
      }

      const casting = tickEncounter({
        ...base,
        runtime: {
          ...base.runtime,
          pendingAffixTriggers: [],
          damageSources: base.runtime.damageSources.map((source) => ({
            ...source,
            remainingMs: 999_999,
          })),
        },
        stage: {
          ...base.stage,
          playerAutoHeal: 0,
          partyAutoHeal: 0,
          partyAutoDamageMin: 0,
          partyAutoDamageMax: 0,
        },
        enemies: base.enemies.map((enemy) => {
          if (enemy.id === warleader.id) {
            return {
              ...enemy,
              hp: enemy.maxHp - 60,
              cast: null,
              recoveryRemainingMs: 0,
            }
          }

          if (enemy.id === injuredBlowgiller.id) {
            return {
              ...enemy,
              hp: enemy.maxHp - 30,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          }

          if (seers.some((seer) => seer.id === enemy.id)) {
            return {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 0,
              skillIds: ['murloc_heal'],
              skillCycle: ['murloc_heal'],
              skillCycleIndex: 0,
            }
          }

          return {
            ...enemy,
            cast: null,
            recoveryRemainingMs: 999_999,
          }
        }),
      }, 0)
      const completed = tickEncounter(casting, 3000)
      const healedWarleader = completed.enemies.find((enemy) => enemy.id === warleader.id)
      const stillInjuredBlowgiller = completed.enemies.find((enemy) => enemy.id === injuredBlowgiller.id)

      expect(casting.enemies.filter((enemy) => enemy.definitionId === 'coldlight_seer').map((enemy) => enemy.cast?.id)).toEqual([
        'murloc_heal',
        'murloc_heal',
      ])
      expect(healedWarleader?.hp).toBe(warleader.maxHp)
      expect(stillInjuredBlowgiller?.hp).toBe(injuredBlowgiller.maxHp - 30)
    } finally {
      resetDesignerWorkbookOverrides()
    }
  })

  it('allows allEnemy interrupt skills without a current target and interrupts all legal casting enemies', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'test_all_enemy_interrupt',
          classId: 'warrior_t',
          skillName: '群体打断',
          shortName: '群断',
          description: '测试全体打断',
          iconId: 'interrupt',
          pointCost: 1,
          resourceCost: 0,
          cooldownMs: 0,
          initialRemainingCooldownMs: 0,
          gcdMs: 0,
          targetingType: 'allEnemy',
          skillLogicId: 'interrupt_cast',
          castStopMode: 'interrupt',
          canAffectSkull: true,
          grantedStatusIds: ['countered'],
          enabled: true,
        },
      ],
    })

    try {
      const encounter = createHarborEncounterWithBuildOverride({
        Q: 'test_all_enemy_interrupt',
      })
      const castingEnemyIds = encounter.enemies.slice(0, 2).map((enemy) => enemy.id)
      const configured = {
        ...encounter,
        player: {
          ...encounter.player,
          currentTargetId: null,
        },
        enemies: encounter.enemies.map((enemy, index) =>
          index <= 1
            ? {
                ...enemy,
                cast: {
                  id: 'ember-bolt',
                  name: 'ember-bolt',
                  target: enemy.target,
                  totalMs: 1500,
                  remainingMs: 1500,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'high' as const,
                },
              }
            : enemy,
        ),
      }

      const interruptedState = tickEncounter(activateSkill(configured, 'test_all_enemy_interrupt'), 0)

      expect(getSkillActivationBlockReason(configured, 'test_all_enemy_interrupt')).toBeNull()
      for (const enemyId of castingEnemyIds) {
        const enemy = interruptedState.enemies.find((entry) => entry.id === enemyId)
        expect(enemy?.cast).toBeNull()
        expect(enemy?.statuses.some((status) => status.id === 'countered')).toBe(true)
      }
    } finally {
      applyPlayerBuildWorkbookOverrides({
        ...emptyPlayerBuildOverrides(),
        activeSkillDefinitions: [
          {
            skillId: 'warrior_t_interrupt',
          },
        ],
      })
    }
  })

  it('interrupt does not stop controlOnly casts', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly')

    const interruptedState = activateSkill(setup.encounter, 'warrior_t_interrupt')
    const targetEnemy = interruptedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(targetEnemy?.cast?.id).toBe('ember-bolt')
    expect(targetEnemy?.statuses.some((status) => status.id === 'countered')).toBe(false)
  })

  it('control-only casts retry the same skill after control expires', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly')

    const controlledState = tickEncounter(
      dispatchEncounterCommand(setup.encounter, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_stun',
      }),
      0,
    )
    const targetEnemy = controlledState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(controlledState.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/cast-controlled')).toBe(true)
    expect(targetEnemy?.cast).toBeNull()
    expect(targetEnemy?.statuses.find((status) => status.id === 'stunned')).toMatchObject({
      label: '昏迷',
      shortLabel: '昏',
    })

    const retriedState = tickEncounter(controlledState, 2500)
    const retriedEnemy = retriedState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(retriedEnemy?.cast?.id).toBe('ember-bolt')
    expect(retriedEnemy?.pendingRetryCastSkillId).toBeNull()
  })

  it('control skills with skull immunity do not stop skull casts', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const skullEnemy = encounter.enemies.find((enemy) => enemy.isSkull) ?? encounter.enemies[0]
    const setup = withEnemyCasting(encounter, 'ruin-volley', 'controlOnly', {
      targetEnemyId: skullEnemy.id,
      isSkull: true,
      remainingMs: 1800,
    })

    const controlledState = activateSkill(setup.encounter, 'warrior_t_stun')
    const targetEnemy = controlledState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(targetEnemy?.cast?.id).toBe('ruin-volley')
    expect(targetEnemy?.statuses.some((status) => status.id === 'stunned')).toBe(false)
  })

  it('pause freezes combat time and enemy cast progress until resumed', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly', { remainingMs: 1800 })

    const paused = openPauseOverlay(setup.encounter)
    const pausedTick = tickEncounter(paused, 1000)
    const pausedEnemy = pausedTick.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(pausedTick.timeMs).toBe(paused.timeMs)
    expect(pausedEnemy?.cast?.remainingMs).toBe(1800)

    const resumed = closePauseOverlay(pausedTick)
    const resumedTick = tickEncounter(resumed, 1000)
    const resumedEnemy = resumedTick.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(resumedTick.timeMs).toBe(resumed.timeMs + 1000)
    expect(resumedEnemy?.cast?.remainingMs).toBeLessThan(1800)
  })

  it('party auto damage only hits living enemies', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const aliveEnemyId = encounter.enemies[0]?.id ?? ''
    const deadEnemyId = encounter.enemies[1]?.id ?? ''

    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 2,
        partyAutoDamageMin: 10,
        partyAutoDamageMax: 10,
      },
      runtime: {
        ...encounter.runtime,
        partyAutoDamageRemainingMs: 1000,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === aliveEnemyId
          ? enemy
          : enemy.id === deadEnemyId
          ? {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const nextState = tickEncounter(configured, 1000)
    const aliveEnemy = nextState.enemies.find((enemy) => enemy.id === aliveEnemyId)
    const deadEnemy = nextState.enemies.find((enemy) => enemy.id === deadEnemyId)

    expect(aliveEnemy?.hp).toBeLessThan(encounter.enemies[0]?.hp ?? 0)
    expect(deadEnemy?.hp).toBe(0)
  })

  it('party auto damage can randomly hit the party current target instead of excluding it', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 10,
        partyAutoDamageMax: 10,
      },
      party: {
        ...encounter.party,
        currentTargetId: targetEnemy.id,
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 1000,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index < 3
          ? {
              ...enemy,
              hp: 100,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    try {
      const nextState = tickEncounter(configured, 1000)
      const hitEnemy = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)
      const otherLivingEnemies = nextState.enemies.filter((enemy) => enemy.id !== targetEnemy.id && enemy.hp > 0)

      expect(hitEnemy?.hp).toBe(90)
      expect(otherLivingEnemies.map((enemy) => enemy.hp)).toEqual([100, 100])
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('party ambient random damage avoids disgusting enemies while other living enemies are available', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const encounter = createHarborEncounterWithStandardBuild()
    const disgustingEnemy = encounter.enemies[0]
    const cleanEnemy = encounter.enemies[1]

    const configured = {
      ...stripStageSpecialRules(encounter),
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 10,
        partyAutoDamageMax: 10,
        damageSources: [],
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      party: {
        ...encounter.party,
        currentTargetId: null,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 1000,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === disgustingEnemy.id
          ? {
              ...enemy,
              hp: 100,
              statuses: [
                {
                  id: 'disgusting',
                  label: '恶心心',
                  shortLabel: '恶',
                  remainingMs: 15000,
                  totalMs: 15000,
                  tone: 'buff' as const,
                  kind: 'enemyBuff' as const,
                  effectLogicId: 'disgusting_status',
                },
              ],
            }
          : enemy.id === cleanEnemy.id
            ? {
                ...enemy,
                hp: 100,
                statuses: [],
              }
            : {
                ...enemy,
                hp: 0,
                cast: null,
                recoveryRemainingMs: 0,
                pendingRetryCastSkillId: null,
              },
      ),
    }

    try {
      const nextState = tickEncounter(configured, 1000)
      const disgustingAfter = nextState.enemies.find((enemy) => enemy.id === disgustingEnemy.id)
      const cleanAfter = nextState.enemies.find((enemy) => enemy.id === cleanEnemy.id)

      expect(disgustingAfter?.hp).toBe(100)
      expect(cleanAfter?.hp).toBe(90)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('party ambient random damage can hit disgusting enemies when every living enemy is disgusting', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const encounter = createHarborEncounterWithStandardBuild()
    const firstEnemy = encounter.enemies[0]
    const secondEnemy = encounter.enemies[1]
    const disgustingStatus = {
      id: 'disgusting',
      label: '恶心心',
      shortLabel: '恶',
      remainingMs: 15000,
      totalMs: 15000,
      tone: 'buff' as const,
      kind: 'enemyBuff' as const,
      effectLogicId: 'disgusting_status',
    }

    const configured = {
      ...stripStageSpecialRules(encounter),
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 10,
        partyAutoDamageMax: 10,
        damageSources: [],
      },
      player: {
        ...encounter.player,
        currentTargetId: null,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyAutoDamageRemainingMs: 1000,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === firstEnemy.id || enemy.id === secondEnemy.id
          ? {
              ...enemy,
              hp: 100,
              statuses: [disgustingStatus],
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    try {
      const nextState = tickEncounter(configured, 1000)
      const livingHp = nextState.enemies
        .filter((enemy) => enemy.id === firstEnemy.id || enemy.id === secondEnemy.id)
        .map((enemy) => enemy.hp)

      expect(livingHp).toContain(90)
      expect(livingHp).toContain(100)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('kobold rummager applies disgusting to itself when trash resolves from designer data', () => {
    applyEnemyWorkbookOverrides(parseEnemyWorkbook(XLSX.readFile('public/designer-data/enemy_data.xlsx')))

    try {
      const encounter = createHarborEncounterWithStandardBuild()
      const rummager = {
        ...encounter.enemies[0],
        id: 'test-rummager',
        definitionId: 'kobold_rummager',
        name: '狗头人拾荒者',
        hp: 100,
        maxHp: 100,
        skillIds: ['throw', 'trash', 'get_it！'],
        skillCycle: ['trash'],
        skillCycleIndex: 0,
        cast: {
          id: 'trash',
          name: '垃圾',
          target: 'tank' as const,
          remainingMs: 1,
          totalMs: 1,
          breakRule: 'controlOnly' as const,
          dangerLevel: 'low' as const,
        },
        statuses: [],
        recoveryRemainingMs: 0,
        pendingRetryCastSkillId: null,
      }
      const configured = {
        ...stripStageSpecialRules(encounter),
        stage: {
          ...encounter.stage,
          tuning: {
            ...encounter.stage.tuning,
            enemyDamageMultiplier: 1,
          },
          partyAutoDamageIntervalMs: 0,
          partyAutoDamageTargetCount: 0,
          damageSources: [],
        },
        player: {
          ...encounter.player,
          hp: 500,
          mitigation: null,
        },
        party: {
          ...encounter.party,
          hp: 500,
          pressure: 0,
        },
        runtime: {
          ...encounter.runtime,
          damageSources: [],
        },
        enemies: [
          rummager,
          ...encounter.enemies.slice(1).map((enemy) => ({
            ...enemy,
            hp: 0,
            cast: null,
            recoveryRemainingMs: 0,
            pendingRetryCastSkillId: null,
          })),
        ],
      }

      const nextState = tickEncounter(configured, 1)
      const rummagerAfter = nextState.enemies.find((enemy) => enemy.id === rummager.id)

      expect(rummagerAfter?.statuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'disgusting',
            label: '恶心心',
            kind: 'enemyBuff',
            effectLogicId: 'disgusting_status',
          }),
        ]),
      )
    } finally {
      applyEnemyWorkbookOverrides({
        enemyDefinitions: [],
        skillDefinitions: [],
        enemyBuffDefinitions: [],
        playerDebuffDefinitions: [],
        partyDebuffDefinitions: [],
      })
    }
  })

  it('party auto damage can kill an enemy and stop its cast while keeping the slot', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const setup = withEnemyCasting(encounter, 'ember-bolt', 'controlOnly', { remainingMs: 1800 })

    const configured = {
      ...setup.encounter,
      stage: {
        ...setup.encounter.stage,
        partyAutoDamageIntervalMs: 1000,
        partyAutoDamageTargetCount: 1,
        partyAutoDamageMin: 999,
        partyAutoDamageMax: 999,
      },
      runtime: {
        ...setup.encounter.runtime,
        partyAutoDamageRemainingMs: 1000,
      },
      enemies: setup.encounter.enemies.map((enemy) =>
        enemy.id === setup.targetEnemyId
          ? {
              ...enemy,
              hp: 50,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const nextState = tickEncounter(configured, 1000)
    const targetEnemy = nextState.enemies.find((enemy) => enemy.id === setup.targetEnemyId)

    expect(targetEnemy).toBeDefined()
    expect(targetEnemy?.hp).toBe(0)
    expect(targetEnemy?.cast).toBeNull()
  })

  it('killing the current target emits/records death cleanup and clears current target', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      R: 'warrior_t_burst',
    })
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for death cleanup test')
    }

    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
      enemies: encounter.enemies.map((enemy) =>
        enemy.id === targetEnemy.id
          ? {
              ...enemy,
              hp: 40,
              cast: {
                id: 'ember-bolt',
                name: 'ember-bolt',
                target: enemy.target,
                totalMs: 1500,
                remainingMs: 1500,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'high' as const,
              },
            }
          : enemy,
      ),
    }

    const nextState = tickEncounter(
      dispatchEncounterCommand(configured, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_burst',
      }),
      0,
    )
    const deadEnemy = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(nextState.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/died')).toBe(true)
    expect(nextState.runtime.lastProcessedEvents.some((event) => event.type === 'player/current-target-cleared')).toBe(true)
    expect(nextState.player.currentTargetId).toBeNull()
    expect(deadEnemy?.hp).toBe(0)
    expect(deadEnemy?.cast).toBeNull()
  })

  it('wins the encounter when all enemies are dead before any defeat condition is met', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...encounter,
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        hp: 0,
        cast: null,
        recoveryRemainingMs: 0,
        pendingRetryCastSkillId: null,
      })),
    }

    const nextState = tickEncounter(configured, 100)

    expect(nextState.result?.outcome).toBe('victory')
  })

  it('uses skill targetingType to apply the shared taunt handler to multiple targets', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_taunt',
          skillEffectId: 'warrior_t_taunt_main',
          skillLogicId: 'taunt',
          targetingType: 'allEnemy',
          targetSelector: 'current',
          threatDelta: 45,
          durationMs: 2600,
          statusId: 'taunted',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithStandardBuild()
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: encounter.enemies[0].id,
          },
        }

        const nextState = tickEncounter(activateSkill(configured, 'warrior_t_taunt'), 0)
        const tauntedIds = nextState.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'taunted'))
          .map((enemy) => enemy.id)
          .sort()

        expect(tauntedIds).toEqual(nextState.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id).sort())
      },
    )
  })

  it('uses skill targetingType to apply the shared stun handler to a cross target set', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_stun',
          skillEffectId: 'warrior_t_stun_main',
          skillLogicId: 'stun',
          targetingType: 'crossEnemy',
          targetSelector: 'current',
          threatDelta: 18,
          durationMs: 1800,
          statusId: 'stunned',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithStandardBuild()
        const configured = {
          ...encounter,
          player: {
            ...encounter.player,
            currentTargetId: 'harbor-1-e02',
          },
          enemies: encounter.enemies.map((enemy) => ({
            ...enemy,
            isSkull: false,
            cast: null,
            recoveryRemainingMs: 0,
            pendingRetryCastSkillId: null,
          })),
        }

        const nextState = tickEncounter(activateSkill(configured, 'warrior_t_stun'), 0)
        const stunnedIds = nextState.enemies
          .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
          .map((enemy) => enemy.id)
          .sort()

        expect(stunnedIds).toEqual([
          'harbor-1-e01',
          'harbor-1-e02',
          'harbor-1-e03',
          'harbor-1-e07',
        ])
      },
    )
  })

  it('allows skill logic to generate rage through runtime resource events', () => {
    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_taunt',
          skillEffectId: 'warrior_t_taunt_main',
          targetSelector: 'current',
        },
      ],
      () => {
        const originalSkill = getActiveSkillDefinition('warrior_t_taunt')
        if (!originalSkill) {
          throw new Error('warrior_t_taunt sample data is missing')
        }

        applyPlayerBuildWorkbookOverrides({
          ...emptyPlayerBuildOverrides(),
          activeSkillDefinitions: [
            {
              skillId: 'warrior_t_taunt',
              skillLogicId: 'rage_gain_debug',
            },
          ],
        })

        try {
          const encounter = createHarborEncounterWithStandardBuild()
          const configured = {
            ...encounter,
            player: {
              ...encounter.player,
              currentTargetId: encounter.enemies[0].id,
              resource: 10,
            },
          }

          const nextState = tickEncounter(activateSkill(configured, 'warrior_t_taunt'), 0)

          expect(nextState.player.resource).toBe(22)
        } finally {
          applyPlayerBuildWorkbookOverrides({
            ...emptyPlayerBuildOverrides(),
            activeSkillDefinitions: [
              {
                skillId: 'warrior_t_taunt',
                skillLogicId: originalSkill.skillLogicId,
              },
            ],
          })
        }
      },
    )
  })

  it('stores stage special rule runtime state on encounter creation', () => {
    const encounter = createHarborEncounter()

    expect(encounter.stage.specialRules.map((rule) => rule.ruleLogicId)).toContain('opening_pressure_shift')
    expect(encounter.runtime.stageRuleRuntime).toEqual(
      expect.objectContaining({
        opening_pressure_shift: expect.objectContaining({
          initialized: false,
        }),
      }),
    )
  })

  it('initializes empty party status runtime on encounter creation', () => {
    const encounter = createHarborEncounter()

    expect(encounter.runtime.partyStatusRuntime).toEqual({})
  })

  it('applies party status interval effects once per second', () => {
    const encounter = createHarborEncounter()
    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        specialRules: [],
      },
      party: {
        ...encounter.party,
        pressure: 40,
        statuses: [
          {
            id: 'steady-relief',
            label: '稳压',
            shortLabel: '压',
            remainingMs: 3000,
            totalMs: 3000,
            tone: 'buff' as const,
            kind: 'neutral' as const,
            effectLogicId: 'steady_relief',
          },
        ],
      },
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        hp: 0,
        cast: null,
        recoveryRemainingMs: 0,
        pendingRetryCastSkillId: null,
      })),
      runtime: {
        ...encounter.runtime,
        stageRuleRuntime: {},
      },
    }

    const nextState = tickEncounter(configured, 1000)

    expect(nextState.party.pressure).toBe(38)
  })

  it('applies party status event effects through combat event triggers', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetEnemy = encounter.enemies[0]

    if (!targetEnemy) {
      throw new Error('Expected an enemy for party status event effect test')
    }

    const configured = {
      ...encounter,
      stage: {
        ...encounter.stage,
        specialRules: [],
      },
      party: {
        ...encounter.party,
        pressure: 30,
        statuses: [
          {
            id: 'skill-relief',
            label: '技能稳压',
            shortLabel: '技',
            remainingMs: 5000,
            totalMs: 5000,
            tone: 'buff' as const,
            kind: 'neutral' as const,
            effectLogicId: 'skill_relief_on_use',
          },
        ],
      },
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
      },
      runtime: {
        ...encounter.runtime,
        stageRuleRuntime: {},
      },
    }

    const baseline = {
      ...configured,
      party: {
        ...configured.party,
        statuses: [
          {
            id: 'stable',
            label: '稳定',
            shortLabel: '稳',
            remainingMs: 0,
            totalMs: 0,
            tone: 'neutral' as const,
            kind: 'neutral' as const,
          },
        ],
      },
      runtime: {
        ...configured.runtime,
        partyStatusRuntime: {},
      },
    }

    const withStatus = tickEncounter(
      dispatchEncounterCommand(configured, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_taunt',
      }),
      0,
    )
    const withoutStatus = tickEncounter(
      dispatchEncounterCommand(baseline, {
        type: 'player/activate-skill',
        submittedAtMs: 10,
        skillId: 'warrior_t_taunt',
      }),
      0,
    )

    expect(withStatus.party.pressure - withoutStatus.party.pressure).toBe(-10)
  })

  it('grants a party status instead of direct pressure drift for pressure-valve talent', () => {
    const encounter = createInitialEncounterState(
      getStageById('harbor-1'),
      {
        ...getDefaultPersistedBuildForRule('standard_5slot'),
        passiveTalentIds: ['warrior_t_pressure_valve'],
      },
    )

    expect(
      encounter.party.statuses.some((status) => status.effectLogicId === 'steady_relief'),
    ).toBe(true)
    expect(getPassiveModifiers(['warrior_t_pressure_valve']).partyPressureDriftPerSecond).toBe(0)
  })

  it('keeps buildRuleId and stage special rules when creating an encounter', () => {
    const stage = getStageById('harbor-1')
    const encounter = createInitialEncounterState(stage, getDefaultPersistedBuildForRule(getStageBuildRuleId(stage)))

    expect(encounter.stage.buildRuleId).toBe('tutorial_2slot')
    expect(encounter.stage.specialRules.map((rule) => rule.ruleLogicId)).toContain('opening_pressure_shift')
  })

  it('applies opening_pressure_shift exactly once at combat start', () => {
    const encounter = createHarborEncounter()
    const baseline = stripStageSpecialRules(encounter)

    const firstWithRule = tickEncounter(encounter, 100)
    const firstWithoutRule = tickEncounter(baseline, 100)
    const secondWithRule = tickEncounter(firstWithRule, 100)
    const secondWithoutRule = tickEncounter(firstWithoutRule, 100)

    expect(firstWithRule.party.pressure - firstWithoutRule.party.pressure).toBe(8)
    expect(secondWithRule.party.pressure - secondWithoutRule.party.pressure).toBe(8)
    expect(firstWithRule.runtime.stageRuleRuntime.opening_pressure_shift?.initialized).toBe(true)
  })

  it('periodic_reinforcement grants an enrage-song status after its timer elapses', () => {
    const stage = getStageById('midland-2')
    const encounter = {
      ...createInitialEncounterState(stage, getDefaultPersistedBuildForRule('standard_5slot')),
      enemies: createInitialEncounterState(stage, getDefaultPersistedBuildForRule('standard_5slot')).enemies.map(
        (enemy, index) =>
          index === 0
            ? {
                ...enemy,
                recoveryRemainingMs: 999_999,
                cast: null,
              }
            : {
                ...enemy,
                hp: 0,
                cast: null,
                recoveryRemainingMs: 0,
                pendingRetryCastSkillId: null,
              },
      ),
    }
    const baseline = stripStageSpecialRules(encounter)

    const nextState = tickEncounter(encounter, 3000)
    const baselineState = tickEncounter(baseline, 3000)

    expect(nextState.enemies.some((enemy) => enemy.statuses.some((status) => status.id === 'enrage-song'))).toBe(true)
    expect(baselineState.enemies.some((enemy) => enemy.statuses.some((status) => status.id === 'enrage-song'))).toBe(false)
  })

  it('player_control_tax only applies while the player is controlled', () => {
    const stage = getStageById('highland-4')
    const encounter = createInitialEncounterState(stage, getDefaultPersistedBuildForRule('full_8slot'))
    const baseline = stripStageSpecialRules(encounter)
    const controlledEncounter = {
      ...encounter,
      player: {
        ...encounter.player,
        debuffs: [
          {
            id: 'stunned',
            label: '眩晕',
            shortLabel: '晕',
            remainingMs: 2000,
            totalMs: 2000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
          },
        ],
      },
    }
    const controlledBaseline = stripStageSpecialRules(controlledEncounter)

    const idleState = tickEncounter(encounter, 1000)
    const idleBaseline = tickEncounter(baseline, 1000)
    const controlledState = tickEncounter(controlledEncounter, 1000)
    const controlledBaselineState = tickEncounter(controlledBaseline, 1000)

    expect(idleState.party.pressure - idleBaseline.party.pressure).toBe(0)
    expect(controlledState.party.pressure - controlledBaselineState.party.pressure).toBe(6)
  })

  it('treats negative-duration control statuses as active for stage rules', () => {
    const stage = getStageById('highland-4')
    const encounter = createInitialEncounterState(stage, getDefaultPersistedBuildForRule('full_8slot'))
    const controlledEncounter = {
      ...encounter,
      player: {
        ...encounter.player,
        debuffs: [
          {
            id: 'stunned',
            label: '眩晕',
            shortLabel: '晕',
            remainingMs: -1,
            totalMs: -1,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
          },
        ],
      },
    }
    const controlledBaseline = stripStageSpecialRules(controlledEncounter)

    const controlledState = tickEncounter(controlledEncounter, 1000)
    const controlledBaselineState = tickEncounter(controlledBaseline, 1000)

    expect(controlledState.party.pressure - controlledBaselineState.party.pressure).toBe(6)
  })

  it('sensitiveParty and sensitiveParty? add pressure after enemy party hits', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const baseParty = {
      ...encounter.party,
      pressure: 20,
      statuses: [
        {
          id: 'sensitive',
          label: '敏感吗',
          shortLabel: '敏',
          remainingMs: -1,
          totalMs: -1,
          tone: 'danger' as const,
          kind: 'partyDebuff' as const,
          effectLogicId: 'sensitive_status',
        },
        {
          id: 'sensitive?',
          label: '会了吗',
          shortLabel: '会',
          remainingMs: -1,
          totalMs: -1,
          tone: 'danger' as const,
          kind: 'partyDebuff' as const,
          effectLogicId: 'sensitive?_status',
        },
      ],
    }
    const configured = {
      ...stripStageSpecialRules(encounter),
      party: baseParty,
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              cast: {
                id: 'ember-bolt',
                name: 'ember-bolt',
                target: 'party' as const,
                totalMs: 0,
                remainingMs: 0,
                breakRule: 'controlOnly' as const,
                dangerLevel: 'high' as const,
              },
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }
    const baseline = {
      ...configured,
      party: {
        ...baseParty,
        statuses: [],
      },
    }

    const withSensitive = tickEncounter(configured, 0)
    const withoutSensitive = tickEncounter(baseline, 0)

    expect(withSensitive.party.pressure - withoutSensitive.party.pressure).toBe(11)
  })

  it('battleHunger drains player health until an enemy death resets andThen timer', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...stripStageSpecialRules(encounter),
      stage: {
        ...encounter.stage,
        specialRules: [
          {
            ruleId: 'andThen',
            ruleName: '然后呢',
            iconId: 'andThen_rule_pic',
            description: 'No enemy death applies battle hunger.',
            ruleLogicId: 'andThen',
            grantedStatusIds: ['battleHunger'],
            enabled: true,
          },
        ],
      },
      player: {
        ...encounter.player,
        hp: 100,
        maxHp: 100,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 999_999,
              maxHp: 999_999,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        pendingAffixTriggers: [],
        stageRuleRuntime: {
          andThen: { initialized: false },
        },
      },
    }

    const hungry = tickEncounter(configured, 15_000)
    const damaged = tickEncounter(hungry, 1000)
    const afterDeath = tickEncounter(enqueueEncounterEvent(damaged, {
      type: 'enemy/died',
      occurredAtMs: damaged.timeMs,
      enemyId: damaged.enemies[0].id,
      sourceSkillId: 'warrior_t_taunt',
    }), 0)

    expect(hungry.player.debuffs.some((status) => status.id === 'battleHunger')).toBe(true)
    expect(damaged.player.hp).toBe(95)
    expect(afterDeath.player.debuffs.some((status) => status.id === 'battleHunger')).toBe(false)
    expect(afterDeath.runtime.stageRuleRuntime.andThen?.timerMs).toBe(15_000)
  })

  it('battleHunger physical damage is reduced by shield block', () => {
    applyPlayerBuildWorkbookOverrides({
      ...emptyPlayerBuildOverrides(),
      activeSkillDefinitions: [
        {
          skillId: 'warrior_t_shield_block',
          classId: 'warrior_t',
          skillName: '盾牌格挡',
          shortName: '物理减伤',
          description: '耗怒物理减伤',
          iconId: 'warrior_t_shield_block_pic',
          pointCost: 4,
          resourceCost: 20,
          cooldownMs: 0,
          initialRemainingCooldownMs: 0,
          gcdMs: 1500,
          targetingType: 'self',
          skillLogicId: 'shield_block',
          castStopMode: 'none',
          canAffectSkull: true,
          grantedStatusIds: ['shieldBlock'],
          enabled: true,
        },
      ],
      activeStatusDefinitions: [
        {
          statusId: 'shieldBlock',
          statusName: '盾牌格挡',
          statusCategory: 'playerBuff',
          iconId: 'warrior_t_shieldBlock_status_pic',
          durationMs: 7000,
          maxStacks: 1,
          dispellable: false,
          description: '玩家物理减伤',
          effectLogicId: 'playerBuff_shieldBlock',
          enabled: true,
        },
      ],
    })

    withTemporarySkillEffectOverrides(
      [
        {
          skillId: 'warrior_t_shield_block',
          skillEffectId: 'warrior_t_shield_block_main',
          skillLogicId: 'shield_block',
          resourceCost: 20,
          targetingType: 'self',
          targetSelector: 'self',
          valueB: 0.5,
          durationMs: 7000,
          statusId: 'shieldBlock',
        },
      ],
      () => {
        const encounter = createHarborEncounterWithBuildOverride({
          F: 'warrior_t_shield_block',
        })
        const configured = {
          ...stripStageSpecialRules(encounter),
          stage: {
            ...encounter.stage,
            damageSources: [],
          },
          player: {
            ...encounter.player,
            hp: 100,
            maxHp: 100,
            resource: 100,
            mitigation: null,
            debuffs: [
              {
                id: 'battleHunger',
                label: '战斗饥渴',
                shortLabel: '饥',
                remainingMs: -1,
                totalMs: -1,
                tone: 'danger' as const,
                kind: 'playerDebuff' as const,
                effectLogicId: 'battleHunger_status',
              },
            ],
          },
          enemies: encounter.enemies.map((enemy, index) =>
            index === 0
              ? {
                  ...enemy,
                  hp: 999_999,
                  maxHp: 999_999,
                  cast: null,
                  recoveryRemainingMs: 999_999,
                  pendingRetryCastSkillId: null,
                }
              : {
                  ...enemy,
                  hp: 0,
                  cast: null,
                  recoveryRemainingMs: 0,
                  pendingRetryCastSkillId: null,
                },
          ),
          runtime: {
            ...encounter.runtime,
            damageSources: [],
            pendingAffixTriggers: [],
            stageRuleRuntime: {},
          },
        }

        const shielded = activateSkill(configured, 'warrior_t_shield_block')
        const damaged = tickEncounter(shielded, 1000)

        expect(damaged.player.hp).toBeCloseTo(97.5)
      },
    )
  })

  it('incorrigibled keeps interrupt and control usable while doubling their cooldowns', () => {
    const encounter = createHarborEncounterWithBuildOverride({
      Q: 'warrior_t_interrupt',
      E: 'warrior_t_stun',
    })
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: encounter.enemies[0].id,
        resource: 100,
        debuffs: [
          {
            id: 'incorrigibled',
            label: '教不动了',
            shortLabel: '教',
            remainingMs: -1,
            totalMs: -1,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            effectLogicId: 'incorrigibled_status',
          },
        ],
      },
    }

    expect(getSkillActivationBlockReason(configured, 'warrior_t_interrupt')).toBeNull()
    expect(getSkillActivationBlockReason(configured, 'warrior_t_stun')).toBeNull()
    expect(getSkillActivationBlockReason(configured, 'warrior_t_taunt')).toBeNull()

    const interrupted = activateSkill(configured, 'warrior_t_interrupt')
    const stunned = activateSkill({
      ...configured,
      player: {
        ...configured.player,
        gcdRemainingMs: 0,
      },
    }, 'warrior_t_stun')
    const interrupt = interrupted.skills.find((skill) => skill.id === 'warrior_t_interrupt')
    const stun = stunned.skills.find((skill) => skill.id === 'warrior_t_stun')

    expect(interrupt?.remainingCooldownMs).toBe((interrupt?.cooldownMs ?? 0) * 2)
    expect(stun?.remainingCooldownMs).toBe((stun?.cooldownMs ?? 0) * 2)
  })

  it('disliked multiplies threat from the first three party attacks only', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetId = encounter.enemies[0].id
    const source = {
      sourceId: 'party_test',
      sourceKind: 'party_test',
      ownerSide: 'party' as const,
      sourceTags: ['party'],
      intervalMs: 1,
      startReady: true,
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
    }
    const baseState = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        currentTargetId: targetId,
      },
      party: {
        ...encounter.party,
        currentTargetId: targetId,
      },
      stage: {
        ...encounter.stage,
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
        damageSources: [source],
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 999_999,
              maxHp: 999_999,
              allyThreat: 0,
              tankThreat: 0,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
      },
    }
    const withDisliked = {
      ...baseState,
      party: {
        ...baseState.party,
        statuses: [
          {
            id: 'disliked',
            label: '讨厌',
            shortLabel: '讨',
            remainingMs: -1,
            totalMs: -1,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'disliked_status',
          },
        ],
      },
    }

    const tickFourTimes = (state: EncounterState) =>
      Array.from({ length: 4 }).reduce<EncounterState>((current) => tickEncounter(current, 1), state)
    const tickThreeTimes = (state: EncounterState) =>
      Array.from({ length: 3 }).reduce<EncounterState>((current) => tickEncounter(current, 1), state)
    const baseline = tickFourTimes(baseState)
    const multiplied = tickFourTimes(withDisliked)
    const afterThreePartyAttacks = tickThreeTimes(withDisliked)

    expect(multiplied.enemies[0].allyThreat - baseline.enemies[0].allyThreat).toBeCloseTo(60)
    expect(afterThreePartyAttacks.party.statuses.some((status) => status.id === 'disliked')).toBe(false)
  })

  it('asHisWish locks the party target to the highest player threat enemy at the interval only', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const firstEnemyId = encounter.enemies[0].id
    const secondEnemyId = encounter.enemies[1].id
    const configured = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        currentTargetId: secondEnemyId,
        resource: 100,
      },
      party: {
        ...encounter.party,
        currentTargetId: firstEnemyId,
        statuses: [
          {
            id: 'asHisWish',
            label: '如他所愿',
            shortLabel: '愿',
            remainingMs: -1,
            totalMs: -1,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'asHisWish_status',
          },
        ],
      },
      enemies: encounter.enemies.map((enemy, index) => ({
        ...enemy,
        hp: index <= 1 ? 999_999 : 0,
        maxHp: index <= 1 ? 999_999 : enemy.maxHp,
        tankThreat: index === 0 ? 200 : 10,
        allyThreat: index === 1 ? 200 : 0,
        cast: null,
        recoveryRemainingMs: 999_999,
        pendingRetryCastSkillId: null,
      })),
    }

    const afterPreIntervalTaunt = tickEncounter(activateSkill(configured, 'warrior_t_taunt'), 0)
    const locked = tickEncounter(afterPreIntervalTaunt, 10_000)
    const tauntFirstEnemyAfterLock = {
      ...locked,
      player: {
        ...locked.player,
        currentTargetId: firstEnemyId,
        resource: 100,
        gcdRemainingMs: 0,
      },
      skills: locked.skills.map((skill) =>
        skill.id === 'warrior_t_taunt'
          ? {
              ...skill,
              remainingCooldownMs: 0,
            }
          : skill,
      ),
      enemies: locked.enemies.map((enemy) =>
        enemy.id === firstEnemyId
          ? {
              ...enemy,
              allyThreat: 1_000,
            }
          : enemy,
      ),
    }
    const afterPostIntervalTaunt = tickEncounter(activateSkill(tauntFirstEnemyAfterLock, 'warrior_t_taunt'), 0)

    expect(afterPreIntervalTaunt.enemies.find((enemy) => enemy.id === secondEnemyId)?.tankThreat).toBeGreaterThan(200)
    expect((locked.party as { currentTargetId?: string | null }).currentTargetId).toBe(secondEnemyId)
    expect(locked.player.currentTargetId).toBe(secondEnemyId)
    expect(afterPostIntervalTaunt.enemies.find((enemy) => enemy.id === firstEnemyId)?.tankThreat).toBeGreaterThan(
      locked.enemies.find((enemy) => enemy.id === secondEnemyId)?.tankThreat ?? 0,
    )
    expect((afterPostIntervalTaunt.party as { currentTargetId?: string | null }).currentTargetId).toBe(secondEnemyId)
  })

  it('slowDown_status pauses player skill cooldown recovery', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        debuffs: [
          {
            id: 'slowDown',
            label: '慢下来',
            shortLabel: '慢',
            remainingMs: 5000,
            totalMs: 5000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            effectLogicId: 'slowDown_status',
          },
        ],
      },
      skills: encounter.skills.map((skill) =>
        skill.id === 'warrior_t_taunt'
          ? {
              ...skill,
              remainingCooldownMs: 1200,
            }
          : skill,
      ),
    }

    const slowed = tickEncounter(configured, 1000)
    const recovered = tickEncounter({
      ...configured,
      player: {
        ...configured.player,
        debuffs: [],
      },
    }, 1000)

    expect(slowed.skills.find((skill) => skill.id === 'warrior_t_taunt')?.remainingCooldownMs).toBe(1200)
    expect(recovered.skills.find((skill) => skill.id === 'warrior_t_taunt')?.remainingCooldownMs).toBe(200)
  })

  it('slowDown_p_status pauses party ambient attacks', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetId = encounter.enemies[0].id
    const source = {
      sourceId: 'party_test',
      sourceKind: 'party_test',
      ownerSide: 'party' as const,
      sourceTags: ['party'],
      intervalMs: 1,
      startReady: true,
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
    }
    const configured = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        currentTargetId: targetId,
      },
      party: {
        ...encounter.party,
        currentTargetId: targetId,
        statuses: [
          {
            id: 'slowDown_p',
            label: '都慢下来',
            shortLabel: '慢',
            remainingMs: 5000,
            totalMs: 5000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'slowDown_p_status',
          },
        ],
      },
      stage: {
        ...encounter.stage,
        damageSources: [source],
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 100,
              maxHp: 100,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
      },
    }

    const paused = tickEncounter(configured, 1)
    const active = tickEncounter({
      ...configured,
      party: {
        ...configured.party,
        statuses: [],
      },
    }, 1)

    expect(paused.enemies[0].hp).toBe(97)
    expect(active.enemies[0].hp).toBe(87)
  })

  it('waxed statuses deal damage over time to player and party', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const configured = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        hp: 20,
        maxHp: 20,
        debuffs: [
          {
            id: 'waxed',
            label: '好蜡',
            shortLabel: '蜡',
            remainingMs: 20_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            effectLogicId: 'waxed_status',
          },
        ],
      },
      party: {
        ...encounter.party,
        hp: 20,
        maxHp: 20,
        statuses: [
          {
            id: 'waxed_p',
            label: '都好蜡',
            shortLabel: '蜡',
            remainingMs: 20_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'waxed_p_status',
          },
        ],
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
        partyPressureNoGainMs: 12_000,
        partyPressureLastValue: encounter.party.pressure,
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 999_999,
              maxHp: 999_999,
              cast: null,
              recoveryRemainingMs: 999_999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const damaged = tickEncounter(configured, 2000)

    expect(damaged.player.hp).toBe(18)
    expect(damaged.party.hp).toBe(18)
    expect(damaged.runtime.partyPressureNoGainMs).toBeLessThan(12_000)
  })

  it('hoe statuses consume waxed statuses or deal fallback damage', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const waxedPlayer = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        hp: 100,
        maxHp: 100,
        debuffs: [
          {
            id: 'waxed',
            label: '好蜡',
            shortLabel: '蜡',
            remainingMs: 20_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            effectLogicId: 'waxed_status',
          },
        ],
      },
    }
    const hoe = {
      id: 'hoe',
      label: '锄',
      shortLabel: '锄',
      remainingMs: 0,
      totalMs: 0,
      tone: 'danger' as const,
      kind: 'playerDebuff' as const,
      effectLogicId: 'hoe_status',
    }

    const consumedWax = tickEncounter({
      ...waxedPlayer,
      player: {
        ...waxedPlayer.player,
        debuffs: [...waxedPlayer.player.debuffs, hoe],
      },
    }, 0)
    const damagedPlayer = tickEncounter({
      ...waxedPlayer,
      player: {
        ...waxedPlayer.player,
        debuffs: [hoe],
      },
    }, 0)

    const waxedParty = {
      ...stripStageSpecialRules(encounter),
      party: {
        ...encounter.party,
        hp: 100,
        maxHp: 100,
        statuses: [
          {
            id: 'waxed_p',
            label: '都好蜡',
            shortLabel: '蜡',
            remainingMs: 20_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'waxed_p_status',
          },
          {
            id: 'hoe_p',
            label: '锄',
            shortLabel: '锄',
            remainingMs: 0,
            totalMs: 0,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'hoe_p_status',
          },
        ],
      },
    }
    const damagedParty = tickEncounter({
      ...waxedParty,
      party: {
        ...waxedParty.party,
        statuses: [waxedParty.party.statuses[1]],
      },
    }, 0)
    const consumedPartyWax = tickEncounter(waxedParty, 0)

    expect(consumedWax.player.debuffs.some((status) => status.id === 'waxed')).toBe(false)
    expect(consumedWax.player.hp).toBe(100)
    expect(damagedPlayer.player.hp).toBe(70)
    expect(consumedPartyWax.party.statuses.some((status) => status.id === 'waxed_p')).toBe(false)
    expect(consumedPartyWax.party.hp).toBe(100)
    expect(damagedParty.party.hp).toBe(70)
  })

  it('got!_status pauses the matching auto attack source while channeling and clears when stopped', () => {
    const encounter = createHarborEncounterWithStandardBuild()
    const targetId = encounter.enemies[0].id
    const playerSource = {
      sourceId: 'player_test',
      sourceKind: 'player_auto_attack',
      ownerSide: 'player' as const,
      sourceTags: ['player'],
      intervalMs: 1,
      startReady: true,
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
      threatSource: 'player' as const,
      enabled: true,
    }
    const configured = {
      ...stripStageSpecialRules(encounter),
      player: {
        ...encounter.player,
        currentTargetId: targetId,
      },
      party: {
        ...encounter.party,
        currentTargetId: targetId,
      },
      stage: {
        ...encounter.stage,
        damageSources: [playerSource],
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 100,
              maxHp: 100,
              statuses: [
                {
                  id: 'got!',
                  label: '拿下了',
                  shortLabel: '拿',
                  remainingMs: 5000,
                  totalMs: 5000,
                  tone: 'buff' as const,
                  kind: 'enemyBuff' as const,
                  effectLogicId: 'got!_status',
                  channelSourceSkillId: 'get_it！',
                },
              ],
              cast: {
                id: 'get_it！',
                name: '拿下',
                target: 'tank' as const,
                totalMs: 5000,
                remainingMs: 5000,
                breakRule: 'interruptOrControl' as const,
                dangerLevel: 'high' as const,
                phase: 'channeling' as const,
              },
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
      runtime: {
        ...encounter.runtime,
        damageSources: [],
      },
    }

    const paused = tickEncounter(configured, 1)
    const completed = tickEncounter(configured, 5000)

    expect(paused.enemies[0].hp).toBe(100)
    expect(completed.enemies[0].statuses.some((status) => status.id === 'got!')).toBe(false)
  })

  function applyDesignerPlayerBuildWorkbook() {
    const workbook = XLSX.readFile('public/designer-data/player_build.xlsx')
    applyPlayerBuildWorkbookOverrides(parsePlayerBuildWorkbook(workbook))
  }

  function createDesignerPassiveEncounter(
    passiveTalentIds: string[],
    loadoutOverrides: Partial<ReturnType<typeof getDefaultPersistedBuildForRule>['loadout']> = {},
  ) {
    applyDesignerPlayerBuildWorkbook()
    const stage = getStageById('harbor-1')
    const baseBuild = getDefaultPersistedBuildForRule('full_8slot')

    return createInitialEncounterState(stage, {
      ...baseBuild,
      loadout: {
        ...baseBuild.loadout,
        ...loadoutOverrides,
      },
      passiveTalentIds,
    })
  }

  function createQuiescentPressureEncounter(
    encounter: ReturnType<typeof createDesignerPassiveEncounter>,
    pressure = 40,
  ) {
    const stripped = stripStageSpecialRules(encounter)

    return {
      ...stripped,
      stage: {
        ...stripped.stage,
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
        damageSources: [],
      },
      player: {
        ...stripped.player,
        currentTargetId: null,
      },
      party: {
        ...stripped.party,
        pressure,
      },
      runtime: {
        ...stripped.runtime,
        pendingAffixTriggers: [],
        damageSources: [],
        partyPressureNoGainMs: 0,
        partyPressureLastValue: pressure,
      },
      enemies: stripped.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              cast: null,
              recoveryRemainingMs: 999999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }
  }

  it('applies planner passive build start bonuses and keeps permanent stance buffs active', () => {
    const encounter = createDesignerPassiveEncounter([
      'warrior_t_reinforced_plates',
      'warrior_t_defensive_stance',
      'warrior_t_raise_banner',
      'warrior_t_immortal_stance',
    ])

    const afterTick = tickEncounter({
      ...encounter,
      player: {
        ...encounter.player,
        hp: 1000,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
      },
    }, 1000)

    expect(encounter.player.maxHp).toBe(1500)
    expect(encounter.player.hp).toBe(1350)
    expect(encounter.party.maxPressure).toBe(150)
    expect(encounter.party.pressure).toBe(27)
    expect(afterTick.player.buffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'defensiveStance',
          damageReductionRatio: 0.1,
        }),
        expect.objectContaining({
          id: 'immortalStance',
          damageReductionRatio: 0.3,
          damageMultiplierBonus: -0.2,
        }),
      ]),
    )
  })

  it('does not stack passive max hp and pressure bonuses when build configuration reapplies', () => {
    const encounter = createDesignerPassiveEncounter([
      'warrior_t_reinforced_plates',
      'warrior_t_raise_banner',
    ])
    const build = getDefaultPersistedBuildForRule('full_8slot')
    const reapplied = applyBuildConfiguration(encounter, build.loadout, [
      'warrior_t_reinforced_plates',
      'warrior_t_raise_banner',
    ])

    expect(encounter.player.maxHp).toBe(1500)
    expect(encounter.player.hp).toBe(1350)
    expect(encounter.party.maxPressure).toBe(150)
    expect(encounter.party.pressure).toBe(27)
    expect(reapplied.player.maxHp).toBe(1500)
    expect(reapplied.player.hp).toBe(1350)
    expect(reapplied.party.maxPressure).toBe(150)
    expect(reapplied.party.pressure).toBe(27)
  })

  it('lets defenders aegis spend two shield wall charges before blocking on recharge', () => {
    const encounter = createDesignerPassiveEncounter(['warrior_t_defenders_aegis'], {
      F: 'warrior_t_shield_wall',
    })
    const firstCast = activateSkill(encounter, 'warrior_t_shield_wall')
    const secondCast = activateSkill(firstCast, 'warrior_t_shield_wall')

    expect(encounter.skills.find((skill) => skill.id === 'warrior_t_shield_wall')).toMatchObject({
      maxCharges: 2,
      currentCharges: 2,
    })
    expect(firstCast.skills.find((skill) => skill.id === 'warrior_t_shield_wall')).toMatchObject({
      maxCharges: 2,
      currentCharges: 1,
      remainingCooldownMs: 60000,
    })
    expect(secondCast.skills.find((skill) => skill.id === 'warrior_t_shield_wall')).toMatchObject({
      maxCharges: 2,
      currentCharges: 0,
      remainingCooldownMs: 60000,
    })
    expect(getSkillActivationBlockReason(secondCast, 'warrior_t_shield_wall')).toContain('仍在冷却')
  })

  it('applies auto attack rage and damage bonuses plus party damage and threat modifiers', () => {
    const encounter = createDesignerPassiveEncounter([
      'warrior_t_bloodsurge',
      'warrior_t_focused_vigor',
      'warrior_t_barbaric_training',
    ])
    const targetEnemy = encounter.enemies[0]
    const configured = {
      ...stripStageSpecialRules(encounter),
      stage: {
        ...encounter.stage,
        specialRules: [],
        partyAutoDamageIntervalMs: 0,
        partyAutoDamageTargetCount: 0,
        damageSources: [
          {
            sourceId: 'test-party-hit',
            sourceKind: 'test_party_fixed',
            ownerSide: 'party' as const,
            sourceTags: ['party'],
            intervalMs: 1000,
            startReady: true,
            invalidTargetPolicy: 'retargetLivingEnemy' as const,
            targetRule: 'randomLivingEnemy' as const,
            targetSelector: 'randomLivingEnemy',
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
          },
        ],
      },
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
        resource: 0,
      },
      runtime: {
        ...encounter.runtime,
        damageSources: [],
      },
      enemies: encounter.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              hp: 100,
              tankThreat: 0,
              allyThreat: 0,
              cast: null,
              recoveryRemainingMs: 999999,
            }
          : {
              ...enemy,
              hp: 0,
              cast: null,
              recoveryRemainingMs: 0,
              pendingRetryCastSkillId: null,
            },
      ),
    }

    const nextState = tickEncounter(configured, 1000)
    const targetAfter = nextState.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(nextState.player.resource).toBe(4)
    expect(targetAfter?.hp).toBe(81)
    expect(targetAfter?.tankThreat).toBe(20)
    expect(targetAfter?.allyThreat).toBe(10.5)
  })

  it('prevents passive party pressure decreases while barbaric training is selected', () => {
    const encounter = createDesignerPassiveEncounter([
      'warrior_t_barbaric_training',
      'warrior_t_pressure_valve',
    ])
    const baseline = createDesignerPassiveEncounter(['warrior_t_pressure_valve'])
    const configured = createQuiescentPressureEncounter(encounter)
    const baselineConfigured = createQuiescentPressureEncounter(baseline)

    const nextState = tickEncounter(configured, 1000)
    const baselineState = tickEncounter(baselineConfigured, 1000)

    expect(nextState.party.pressure - baselineState.party.pressure).toBe(2)
  })

  it('passively lowers party pressure by 5 per second after 10 seconds without pressure gain', () => {
    const encounter = createDesignerPassiveEncounter([])
    const configured = createQuiescentPressureEncounter(encounter)

    const beforeDecay = tickEncounter(configured, 10000)
    const afterFirstDecay = tickEncounter(beforeDecay, 1000)
    const afterSecondDecay = tickEncounter(afterFirstDecay, 1000)

    expect(beforeDecay.party.pressure).toBe(40)
    expect(afterFirstDecay.party.pressure).toBe(35)
    expect(afterSecondDecay.party.pressure).toBe(30)
  })

  it('resets the party pressure decay timer when pressure increases', () => {
    const encounter = createDesignerPassiveEncounter([])
    const configured = createQuiescentPressureEncounter(encounter)

    const nineSecondsIdle = tickEncounter(configured, 9000)
    const pressureIncreased = {
      ...nineSecondsIdle,
      party: {
        ...nineSecondsIdle.party,
        pressure: nineSecondsIdle.party.pressure + 10,
      },
    }
    const tenSecondsAfterIncrease = tickEncounter(pressureIncreased, 10000)
    const firstDecayAfterReset = tickEncounter(tenSecondsAfterIncrease, 1000)

    expect(tenSecondsAfterIncrease.party.pressure).toBe(50)
    expect(firstDecayAfterReset.party.pressure).toBe(45)
  })

  it('does not apply passive party pressure decay while barbaric training is selected', () => {
    const encounter = createDesignerPassiveEncounter(['warrior_t_barbaric_training'])
    const configured = createQuiescentPressureEncounter(encounter)

    const nextState = tickEncounter(configured, 12000)

    expect(nextState.party.pressure).toBe(40)
  })

  it('applies interrupt vulnerability, revenge refund, punish stacks, and shield block duration bonus', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.49)

    try {
      const encounter = createDesignerPassiveEncounter([
        'warrior_t_honed_reflexes',
        'warrior_t_frothing_berserker',
        'warrior_t_punish',
        'warrior_t_enduring_defenses',
      ], {
        Q: 'warrior_t_interrupt',
        E: 'warrior_t_revenge',
        R: 'warrior_t_shield_slam',
        F: 'warrior_t_shield_block',
      })
      const setup = withEnemyCasting(encounter, 'bone-jab', 'interruptOrControl', { remainingMs: 1500 })
      const targetBefore = setup.encounter.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
      const interrupted = tickEncounter(activateSkill({
        ...setup.encounter,
        player: {
          ...setup.encounter.player,
          resource: 100,
          gcdRemainingMs: 0,
        },
      }, 'warrior_t_interrupt'), 0)
      const vulnerableTarget = interrupted.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
      const slammed = tickEncounter(activateSkill({
        ...interrupted,
        player: {
          ...interrupted.player,
          gcdRemainingMs: 0,
        },
        skills: interrupted.skills.map((skill) =>
          skill.id === 'warrior_t_shield_slam'
            ? { ...skill, cooldownMs: 0, remainingCooldownMs: 0 }
            : skill,
        ),
      }, 'warrior_t_shield_slam'), 0)
      const punishedOnce = slammed.enemies.find((enemy) => enemy.id === setup.targetEnemyId)
      const revengeRefunded = tickEncounter(activateSkill({
        ...slammed,
        player: {
          ...slammed.player,
          resource: 20,
          gcdRemainingMs: 0,
        },
        skills: slammed.skills.map((skill) =>
          skill.id === 'warrior_t_revenge'
            ? { ...skill, cooldownMs: 0, remainingCooldownMs: 0 }
            : skill,
        ),
      }, 'warrior_t_revenge'), 0)
      const shieldBlocked = tickEncounter(activateSkill({
        ...revengeRefunded,
        player: {
          ...revengeRefunded.player,
          resource: 100,
          gcdRemainingMs: 0,
        },
        skills: revengeRefunded.skills.map((skill) =>
          skill.id === 'warrior_t_shield_block'
            ? { ...skill, cooldownMs: 0, remainingCooldownMs: 0 }
            : skill,
        ),
      }, 'warrior_t_shield_block'), 0)
      const shieldBlock = shieldBlocked.player.buffs.find((status) => status.id === 'shieldBlock')

      expect(vulnerableTarget?.statuses.find((status) => status.id === 'honedReflexesed')).toMatchObject({
        remainingMs: 5000,
        damageTakenMultiplierBonus: 0.5,
      })
      expect((targetBefore?.hp ?? 0) - (punishedOnce?.hp ?? 0)).toBe(22.5)
      expect(punishedOnce?.statuses.find((status) => status.id === 'punished')).toMatchObject({
        stacks: 1,
        maxStacks: 3,
        outgoingDamageReductionRatio: 0.1,
      })
      expect(revengeRefunded.player.resource).toBe(10)
      expect(shieldBlock).toMatchObject({
        remainingMs: 10000,
        totalMs: 10000,
      })
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('applies booming voice, rumbling earth, and crackling thunder skill upgrades', () => {
    const encounter = createDesignerPassiveEncounter([
      'warrior_t_booming_voice',
      'warrior_t_rumbling_earth',
      'warrior_t_crackling_thunder',
    ], {
      Q: 'warrior_t_demoralizing_shout',
      E: 'warrior_t_shockwave',
      R: 'warrior_t_thunderstruck',
    })
    const targetEnemy = encounter.enemies.find((enemy) => enemy.id === 'harbor-1-e02') ?? encounter.enemies[0]
    const configured = {
      ...encounter,
      player: {
        ...encounter.player,
        currentTargetId: targetEnemy.id,
        resource: 20,
        gcdRemainingMs: 0,
      },
      enemies: encounter.enemies.map((enemy) => ({
        ...enemy,
        isSkull: false,
        cast: null,
        recoveryRemainingMs: 999999,
        hp: 100,
        tankThreat: 0,
      })),
    }
    const shouted = tickEncounter(activateSkill(configured, 'warrior_t_demoralizing_shout'), 0)
    const shocked = tickEncounter(activateSkill({
      ...shouted,
      player: {
        ...shouted.player,
        gcdRemainingMs: 0,
      },
      skills: shouted.skills.map((skill) =>
        skill.id === 'warrior_t_shockwave'
          ? { ...skill, cooldownMs: 0, remainingCooldownMs: 0 }
          : skill,
      ),
    }, 'warrior_t_shockwave'), 0)
    const thundered = tickEncounter(activateSkill({
      ...shocked,
      player: {
        ...shocked.player,
        gcdRemainingMs: 0,
      },
      skills: shocked.skills.map((skill) =>
        skill.id === 'warrior_t_thunderstruck'
          ? { ...skill, cooldownMs: 0, remainingCooldownMs: 0 }
          : skill,
      ),
    }, 'warrior_t_thunderstruck'), 0)
    const expectedStunnedIds = [...resolveEnemyTargetIdsBySelector(configured, 'matrix3x3')].sort()
    const stunnedIds = shocked.enemies
      .filter((enemy) => enemy.statuses.some((status) => status.id === 'stunned'))
      .map((enemy) => enemy.id)
      .sort()
    const thunderTargetAfter = thundered.enemies.find((enemy) => enemy.id === targetEnemy.id)
    const thunderTargetBefore = shocked.enemies.find((enemy) => enemy.id === targetEnemy.id)

    expect(shouted.player.resource).toBe(60)
    expect(stunnedIds).toEqual(expectedStunnedIds)
    expect((thunderTargetBefore?.hp ?? 0) - (thunderTargetAfter?.hp ?? 0)).toBe(45)
    expect((thunderTargetAfter?.tankThreat ?? 0) - (thunderTargetBefore?.tankThreat ?? 0)).toBe(90)
  })
})
