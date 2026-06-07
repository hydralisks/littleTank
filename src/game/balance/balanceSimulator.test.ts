import { describe, expect, it } from 'vitest'
import { createInitialEncounterState } from '../encounter/encounterFactory'
import type { EncounterState, PassiveTalentId, PersistedBuildState } from '../encounter/encounterTypes'
import { getStageById } from '../data/stageTemplates'
import { getDefaultPersistedBuildForRule } from '../data/playerBuildCatalog'
import { getStageBuildRuleId } from '../data/encounterTemplates'
import {
  runBalanceScenario,
  runStageBalanceAnalysis,
  runTwoPhaseStageBalanceAnalysis,
  selectLearningBuildCandidatesFromFixedAnalysis,
  selectTwoPhaseBalanceBuilds,
  selectTwoPhaseSharedStrategyIds,
  sampleProfileMistakeKind,
  sampleProfileReactionDelayMs,
  getBalanceDecisionPriority,
  getBalanceTargetPriorityScore,
  getBalanceMechanicThreatPreference,
  type BalanceOperationProfile,
} from './balanceSimulator'

function instantVictoryState(state: EncounterState): EncounterState {
  return {
    ...state,
    enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })),
  }
}

function highDangerCastDefeatState(state: EncounterState): EncounterState {
  return {
    ...state,
    result: { outcome: 'defeat', reason: 'forced diagnostic defeat' },
    runtime: {
      ...state.runtime,
      combatLog: [
        ...state.runtime.combatLog,
        {
          id: 'forced-cast-start',
          occurredAtMs: state.timeMs,
          type: 'cast-started',
          source: { kind: 'enemy', id: 'enemy', name: '测试敌人' },
          target: { kind: 'tank', id: 'tank', name: '坦克' },
          ability: { kind: 'enemySkill', id: 'danger', name: '危险读条' },
          castId: 'forced-cast',
          enemyId: 'enemy',
          enemySkillId: 'danger',
          dangerLevel: 'high',
          breakRule: 'interruptOrControl',
        },
        {
          id: 'forced-cast-resolved',
          occurredAtMs: state.timeMs + 100,
          type: 'cast-resolved',
          source: { kind: 'enemy', id: 'enemy', name: '测试敌人' },
          target: { kind: 'tank', id: 'tank', name: '坦克' },
          ability: { kind: 'enemySkill', id: 'danger', name: '危险读条' },
          castId: 'forced-cast',
          enemyId: 'enemy',
          enemySkillId: 'danger',
          dangerLevel: 'high',
          breakRule: 'interruptOrControl',
        },
      ],
    },
  }
}

const noMistakeProfile: BalanceOperationProfile = {
  id: 'no-mistake',
  tier: 'average',
  reactionDelayMs: 0,
  mistakeRate: 0,
  decisionIntervalMs: 100,
}

const strongProfile: BalanceOperationProfile = {
  id: 'strong',
  tier: 'expert',
  reactionDelayMs: 120,
  reactionDelayJitterMs: 20,
  reactionDelayFastChance: 0.1,
  reactionDelayFastMs: 60,
  mistakeRate: 0.01,
  forgetSkillRate: 0.003,
  wrongTargetRate: 0.004,
  prioritySlipRate: 0.003,
  decisionIntervalMs: 100,
}

function sequenceRandom(values: number[]) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)] ?? 0
}

describe('balance simulator', () => {
  it('runs deterministic attempts and reports pass rate only from outcomes', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 3,
      maxDurationMs: 1000,
      initialStateMutator: instantVictoryState,
    })

    expect(result).toMatchObject({
      stageId: 'harbor-1',
      profileId: 'no-mistake',
      profileTier: 'average',
      buildId: 'default',
      attempts: 3,
      victories: 3,
      passRate: 1,
    })
  })

  it('does not include hp or pressure ratios in scenario results', () => {
    const stage = getStageById('harbor-5')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 1,
      maxDurationMs: 1000,
      initialStateMutator: instantVictoryState,
    })

    expect(result).not.toHaveProperty('playerHpRatio')
    expect(result).not.toHaveProperty('partyPressureRatio')
  })

  it('optionally collects a minimal trace for calibration', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 1,
      maxDurationMs: 1000,
      initialStateMutator: instantVictoryState,
      collectTrace: true,
    })

    expect(result.trace?.events.length).toBeGreaterThan(0)
    expect(result.trace?.events[0]?.type).toBeDefined()
  })

  it('optionally collects a diagnostic summary for internal evaluation', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const defaultResult = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 1,
      maxDurationMs: 1000,
      initialStateMutator: highDangerCastDefeatState,
    })
    const diagnosticResult = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile: noMistakeProfile,
      attempts: 2,
      maxDurationMs: 1000,
      initialStateMutator: highDangerCastDefeatState,
      collectDiagnostics: true,
    })

    expect(defaultResult).not.toHaveProperty('diagnosticSummary')
    expect(diagnosticResult.diagnosticSummary).toMatchObject({
      attempts: 2,
      victories: 0,
      passRate: 0,
      signals: [
        expect.objectContaining({
          id: 'high_danger_casts_completed',
          defeatRate: 1,
          internalActionIds: ['try_high_danger_interrupt_focus'],
        }),
      ],
    })
  })

  it('passes diagnostic collection through stage balance analysis when requested', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const analysis = runStageBalanceAnalysis({
      stage,
      builds: [{ id: 'default', build }],
      profiles: [noMistakeProfile],
      attemptsPerScenario: 1,
      maxDurationMs: 1000,
      initialStateMutator: highDangerCastDefeatState,
      collectDiagnostics: true,
    })

    expect(analysis.scenarios[0]?.diagnosticSummary).toMatchObject({
      signals: [
        expect.objectContaining({
          id: 'high_danger_casts_completed',
          internalActionIds: ['try_high_danger_interrupt_focus'],
        }),
      ],
    })
  })

  it('samples reaction delay with occasional fast reactions', () => {
    const profile = {
      ...noMistakeProfile,
      reactionDelayMs: 600,
      reactionDelayJitterMs: 200,
      reactionDelayFastChance: 0.2,
      reactionDelayFastMs: 200,
    }

    expect(sampleProfileReactionDelayMs(profile, sequenceRandom([0.1]))).toBe(200)
    expect(sampleProfileReactionDelayMs(profile, sequenceRandom([0.8, 0.25]))).toBe(500)
  })

  it('keeps planned cast reactions stable for the same cast instead of re-sampling each decision', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const build: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        1: 'warrior_t_interrupt',
      },
      passiveTalentIds: [],
    }
    const profile = {
      ...noMistakeProfile,
      reactionDelayMs: 400,
      reactionDelayJitterMs: 0,
      decisionIntervalMs: 100,
      endCastStopWindowMs: 500,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    }

    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'default',
      profile,
      attempts: 1,
      maxDurationMs: 2000,
      collectTrace: true,
      initialStateMutator: (state) => ({
        ...state,
        player: {
          ...state.player,
          resource: state.player.maxResource,
          currentTargetId: state.enemies[0]?.id ?? state.player.currentTargetId,
        },
        enemies: state.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                cast: {
                  id: 'test-cast',
                  name: '测试读条',
                  target: 'tank' as const,
                  totalMs: 500,
                  remainingMs: 500,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'high' as const,
                },
              }
            : enemy,
        ),
      }),
    })

    expect(result.trace?.events).toContainEqual(
      expect.objectContaining({
        timeMs: 400,
        message: 'activated warrior_t_interrupt',
      }),
    )
  })

  it('samples distinct mistake kinds from weighted rates', () => {
    const profile = {
      ...noMistakeProfile,
      forgetSkillRate: 0.2,
      wrongTargetRate: 0.3,
      prioritySlipRate: 0.1,
    }

    expect(sampleProfileMistakeKind(profile, sequenceRandom([0.05]))).toBe('forget_skill')
    expect(sampleProfileMistakeKind(profile, sequenceRandom([0.25]))).toBe('wrong_target')
    expect(sampleProfileMistakeKind(profile, sequenceRandom([0.55]))).toBe('priority_slip')
    expect(sampleProfileMistakeKind(profile, sequenceRandom([0.95]))).toBe(null)
  })

  it('prefers preserving key stop skills for dangerous channeling casts in strong profiles', () => {
    expect(
      getBalanceDecisionPriority({
        profile: strongProfile,
        castReason: 'critical-channeling',
        skillMode: 'interrupt',
        isCoreSkill: true,
        isChannelingSecondPhase: true,
      }),
    ).toBeGreaterThan(
      getBalanceDecisionPriority({
        profile: noMistakeProfile,
        castReason: 'generic',
        skillMode: 'none',
        isCoreSkill: false,
        isChannelingSecondPhase: false,
      }),
    )
  })

  it('uses the same tactical priority for the same cast situation across operation tiers', () => {
    const tacticalSituation = {
      castReason: 'dangerous' as const,
      skillMode: 'interrupt' as const,
      isCoreSkill: true,
      isChannelingSecondPhase: false,
    }

    const averagePriority = getBalanceDecisionPriority({
      ...tacticalSituation,
      profile: { ...noMistakeProfile, tier: 'average' },
    })
    const skilledPriority = getBalanceDecisionPriority({
      ...tacticalSituation,
      profile: { ...noMistakeProfile, tier: 'skilled' },
    })
    const expertPriority = getBalanceDecisionPriority({
      ...tacticalSituation,
      profile: { ...noMistakeProfile, tier: 'expert' },
    })

    expect(skilledPriority).toBe(averagePriority)
    expect(expertPriority).toBe(averagePriority)
  })

  it('can prioritize a high-impact kill target over a generic lost-threat target', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)
    const lostThreatEnemy = {
      ...state.enemies[0],
      id: 'lost-threat',
      hp: 100,
      maxHp: 100,
      threatState: 'lost' as const,
      cast: null,
    }
    const highImpactEnemy = {
      ...state.enemies[1],
      id: 'high-impact',
      hp: 25,
      maxHp: 100,
      threatState: 'safe' as const,
      cast: {
        id: 'flame_missiles',
        name: '测试高伤读条',
        target: 'tank' as const,
        totalMs: 1000,
        remainingMs: 800,
        breakRule: 'interruptOrControl' as const,
        dangerLevel: 'high' as const,
      },
    }
    const tacticalState = {
      ...state,
      enemies: [lostThreatEnemy, highImpactEnemy],
    }

    expect(
      getBalanceTargetPriorityScore({
        state: tacticalState,
        enemy: highImpactEnemy,
        profile: { ...strongProfile, targetPriorityMode: 'kill_high_impact' },
      }),
    ).toBeGreaterThan(
      getBalanceTargetPriorityScore({
        state: tacticalState,
        enemy: lostThreatEnemy,
        profile: { ...strongProfile, targetPriorityMode: 'kill_high_impact' },
      }),
    )
  })

  it('reduces irregular threat urgency when the policy allows pressure splitting under tank danger', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)
    const irregularEnemy = {
      ...state.enemies[0],
      threatLogic: 'irregular' as const,
      threatState: 'lost' as const,
      target: 'ally' as const,
      tankThreat: 20,
      allyThreat: 80,
      cast: null,
    }
    const pressuredState = {
      ...state,
      timeMs: 12_000,
      player: {
        ...state.player,
        hp: Math.round(state.player.maxHp * 0.32),
      },
      enemies: [irregularEnemy],
    }

    const strictScore = getBalanceTargetPriorityScore({
      state: pressuredState,
      enemy: irregularEnemy,
      profile: { ...strongProfile, irregularThreatPolicy: 'strict' },
      lastIrregularMaintainedAtMs: 0,
    })
    const allowLeakScore = getBalanceTargetPriorityScore({
      state: pressuredState,
      enemy: irregularEnemy,
      profile: { ...strongProfile, irregularThreatPolicy: 'allow_leak_when_tank_pressure_high' },
      lastIrregularMaintainedAtMs: 0,
    })

    expect(allowLeakScore).toBeLessThan(strictScore)
  })

  it('prefers matching shadow hoe to the side that currently has wax', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)
    const candleKing = {
      ...state.enemies[0],
      threatLogic: 'irregular' as const,
      skillCycle: ['flame_bolt', 'shadow_hoa'],
      skillCycleIndex: 1,
      cast: null,
    }
    const partyWaxedState = {
      ...state,
      party: {
        ...state.party,
        statuses: [
          {
            id: 'waxed_p',
            label: '都好蜡',
            shortLabel: '蜡',
            remainingMs: 10_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'waxed_p_status',
          },
        ],
      },
      enemies: [candleKing],
    }
    const playerWaxedState = {
      ...state,
      player: {
        ...state.player,
        debuffs: [
          {
            id: 'waxed',
            label: '好蜡',
            shortLabel: '蜡',
            remainingMs: 10_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'playerDebuff' as const,
            effectLogicId: 'waxed_status',
          },
        ],
      },
      enemies: [candleKing],
    }

    expect(getBalanceMechanicThreatPreference(partyWaxedState, candleKing)).toBe('ally')
    expect(getBalanceMechanicThreatPreference(playerWaxedState, candleKing)).toBe('tank')
  })

  it('can plan wax figure to set up the same side for a later shadow hoe', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)
    const candleKing = {
      ...state.enemies[0],
      threatLogic: 'irregular' as const,
      skillCycle: ['wax_figure', 'flame_bolt', 'shadow_hoa'],
      skillCycleIndex: 0,
      cast: null,
    }

    expect(
      getBalanceMechanicThreatPreference(
        state,
        candleKing,
        { ...strongProfile, mechanicChainPlan: 'wax_party_then_hoe_party' },
      ),
    ).toBe('ally')
    expect(
      getBalanceMechanicThreatPreference(
        state,
        candleKing,
        { ...strongProfile, mechanicChainPlan: 'wax_tank_then_hoe_tank' },
      ),
    ).toBe('tank')
  })

  it('does not chase an irregular enemy when its next mechanic should stay on the party', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)
    const genericLost = {
      ...state.enemies[0],
      id: 'generic-lost',
      threatLogic: 'irregular' as const,
      threatState: 'lost' as const,
      target: 'ally' as const,
      cast: null,
    }
    const shadowHoeLost = {
      ...genericLost,
      id: 'shadow-hoe-lost',
      skillCycle: ['shadow_hoa'],
      skillCycleIndex: 0,
    }
    const waxedPartyState = {
      ...state,
      party: {
        ...state.party,
        statuses: [
          {
            id: 'waxed_p',
            label: '都好蜡',
            shortLabel: '蜡',
            remainingMs: 10_000,
            totalMs: 20_000,
            tone: 'danger' as const,
            kind: 'partyDebuff' as const,
            effectLogicId: 'waxed_p_status',
          },
        ],
      },
      enemies: [genericLost, shadowHoeLost],
    }

    expect(
      getBalanceTargetPriorityScore({
        state: waxedPartyState,
        enemy: shadowHoeLost,
        profile: { ...strongProfile, targetPriorityMode: 'mechanic_focus' },
      }),
    ).toBeLessThan(
      getBalanceTargetPriorityScore({
        state: waxedPartyState,
        enemy: genericLost,
        profile: { ...strongProfile, targetPriorityMode: 'mechanic_focus' },
      }),
    )
  })

  it('does not immediately undo a planned cast target selection during the same decision tick', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const build: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        1: null,
        2: null,
        3: null,
        4: null,
        Q: null,
      },
      passiveTalentIds: [],
    }
    const profile: BalanceOperationProfile = {
      ...noMistakeProfile,
      reactionDelayMs: 0,
      decisionIntervalMs: 100,
      targetPriorityMode: 'kill_high_impact',
      minimumTargetStickMs: 1000,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    }

    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'no-stop-tools',
      profile,
      attempts: 1,
      maxDurationMs: 200,
      collectTrace: true,
      initialStateMutator: (state) => ({
        ...state,
        player: {
          ...state.player,
          currentTargetId: state.enemies[0]?.id ?? null,
        },
        enemies: state.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                threatState: 'lost' as const,
                cast: null,
              }
            : index === 1
              ? {
                ...enemy,
                threatState: 'safe' as const,
                cast: {
                  id: 'flame_missiles',
                  name: '测试高伤读条',
                  target: 'tank' as const,
                  totalMs: 1000,
                  remainingMs: 1000,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'high' as const,
                },
              }
              : {
                ...enemy,
                hp: 0,
                cast: null,
              },
        ),
      }),
    })

    const selectionsAtZero = result.trace?.events
      .filter((event) => event.timeMs === 0 && event.type === 'target-selected')
      .map((event) => event.message)

    expect(selectionsAtZero).toEqual([`selected ${stage.id}-e02`])
  })

  it('does not churn target selection when no stop skill is actually available', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const build: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        1: 'warrior_t_taunt',
        2: null,
        3: null,
        4: null,
        Q: null,
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: [],
    }
    const profile: BalanceOperationProfile = {
      ...noMistakeProfile,
      reactionDelayMs: 0,
      decisionIntervalMs: 100,
      targetPriorityMode: 'mechanic_focus',
      irregularThreatPolicy: 'periodic',
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preferControlForChanneling: true,
    }

    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'taunt-only',
      profile,
      attempts: 1,
      maxDurationMs: 200,
      collectTrace: true,
      initialStateMutator: (state) => ({
        ...state,
        player: {
          ...state.player,
          currentTargetId: state.enemies[0]?.id ?? null,
        },
        enemies: state.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                threatState: 'lost' as const,
                cast: null,
              }
            : index === 1
              ? {
                  ...enemy,
                  threatState: 'safe' as const,
                  cast: {
                    id: 'flame_missiles',
                    name: '测试高危读条',
                    target: 'tank' as const,
                    totalMs: 1000,
                    remainingMs: 1000,
                    breakRule: 'interruptOrControl' as const,
                    dangerLevel: 'high' as const,
                  },
                }
              : {
                  ...enemy,
                  hp: 0,
                  cast: null,
                },
        ),
      }),
    })

    const selectionEvents = result.trace?.events.filter((event) => event.type === 'target-selected')
    expect(selectionEvents?.length).toBeLessThanOrEqual(2)
  })

  it('does not spend shield wall while shield wall mitigation is already active', () => {
    const stage = getStageById('harbor-5')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const build: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        1: 'warrior_t_taunt',
        2: 'warrior_t_interrupt',
        3: 'warrior_t_stun',
        4: 'warrior_t_mass_taunt',
        Q: 'warrior_t_shield_wall',
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: ['warrior_t_defenders_aegis'],
    }
    const profile: BalanceOperationProfile = {
      ...noMistakeProfile,
      reactionDelayMs: 0,
      decisionIntervalMs: 100,
      preserveKeyStopSkills: true,
      evaluateEnemySkillImpact: true,
      preemptiveDefenseHorizonMs: 2500,
    }

    const result = runBalanceScenario({
      stage,
      build,
      buildId: 'double-shield-wall',
      profile,
      attempts: 1,
      maxDurationMs: 1400,
      collectTrace: true,
      initialStateMutator: (state) => ({
        ...state,
        player: {
          ...state.player,
          hp: Math.round(state.player.maxHp * 0.3),
          mitigation: {
            id: 'shieldWall',
            label: '盾墙',
            shortLabel: '盾',
            remainingMs: 3000,
            totalMs: 4000,
            tone: 'buff' as const,
            kind: 'playerBuff' as const,
            effectLogicId: 'player_damage_reduction',
          },
        },
        enemies: state.enemies.map((enemy, index) =>
          index === 0
            ? {
                ...enemy,
                cast: {
                  id: 'flame_missiles',
                  name: '测试高伤读条',
                  target: 'tank' as const,
                  totalMs: 1000,
                  remainingMs: 1000,
                  breakRule: 'interruptOrControl' as const,
                  dangerLevel: 'high' as const,
                },
              }
            : {
                ...enemy,
                hp: 0,
                cast: null,
              },
        ),
      }),
    })

    const shieldWallUses = result.trace?.events.filter((event) => event.message === 'activated warrior_t_shield_wall')

    expect(shieldWallUses).toHaveLength(0)
  })

  it('evaluates several operation profiles and build variants for a stage', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const alternateBuild: PersistedBuildState = {
      ...build,
      passiveTalentIds: [],
    }

    const analysis = runStageBalanceAnalysis({
      stage,
      builds: [
        { id: 'default', build },
        { id: 'alternate', build: alternateBuild },
      ],
      profiles: [
        noMistakeProfile,
        {
          id: 'slow-average',
          tier: 'average',
          reactionDelayMs: 800,
          mistakeRate: 0.2,
          decisionIntervalMs: 200,
        },
      ],
      attemptsPerScenario: 2,
      maxDurationMs: 1000,
      initialStateMutator: instantVictoryState,
    })

    expect(analysis.stageId).toBe('harbor-1')
    expect(analysis.scenarios).toHaveLength(4)
    expect(analysis.rating.label).toBe('trivial')
  })

  it('exposes a two-phase build search hint for stage analysis', () => {
    const stage = getStageById('harbor-1')
    const analysis = runTwoPhaseStageBalanceAnalysis({
      stage,
      profiles: [noMistakeProfile],
      attemptsPerScenario: 1,
      phaseOneAttemptsPerScenario: 1,
      phaseOneMaxActiveBuilds: 1,
      phaseOneMaxPassiveVariants: 1,
      finalBuildCount: 1,
      maxDurationMs: 1000,
      initialStateMutator: instantVictoryState,
    })

    expect(analysis.buildSearchMode).toBe('two_phase')
    expect(analysis.scoringMode).toBe('best_build_per_profile')
    expect(analysis.phaseOneBuildCount).toBeGreaterThanOrEqual(1)
  })

  it('selects final two-phase builds by shared aggregate performance instead of profile-specific winners', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const builds = [
      { id: 'default', build: defaultBuild },
      { id: 'shared_good', build: { ...defaultBuild, passiveTalentIds: [] } },
      { id: 'expert_only', build: { ...defaultBuild, passiveTalentIds: ['expert-only' as PassiveTalentId] } },
    ]

    const selected = selectTwoPhaseBalanceBuilds(
      [
        { stageId: stage.id, profileId: 'average', profileTier: 'average', buildId: 'shared_good', attempts: 10, victories: 8, passRate: 0.8 },
        { stageId: stage.id, profileId: 'skilled', profileTier: 'skilled', buildId: 'shared_good', attempts: 10, victories: 7, passRate: 0.7 },
        { stageId: stage.id, profileId: 'expert', profileTier: 'expert', buildId: 'shared_good', attempts: 10, victories: 6, passRate: 0.6 },
        { stageId: stage.id, profileId: 'average', profileTier: 'average', buildId: 'expert_only', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'skilled', profileTier: 'skilled', buildId: 'expert_only', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'expert', profileTier: 'expert', buildId: 'expert_only', attempts: 10, victories: 10, passRate: 1 },
      ],
      builds,
      2,
    ).map((build) => build.id)

    expect(selected).toEqual(['default', 'shared_good'])
  })

  it('prefers more complete builds when phase-one pass rates tie', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const sparseBuild: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        '1': 'warrior_t_taunt',
        '2': null,
        '3': null,
        '4': null,
        Q: null,
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: [],
    }
    const fullBuild: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        '1': 'warrior_t_taunt',
        '2': 'warrior_t_interrupt',
        '3': 'warrior_t_stun',
        '4': 'warrior_t_mass_taunt',
        Q: 'warrior_t_shield_wall',
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: ['warrior_t_vital_reserve'],
    }

    const selected = selectTwoPhaseBalanceBuilds(
      [
        { stageId: stage.id, profileId: 'average', profileTier: 'average', buildId: 'aaa_sparse', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'skilled', profileTier: 'skilled', buildId: 'aaa_sparse', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'expert', profileTier: 'expert', buildId: 'aaa_sparse', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'average', profileTier: 'average', buildId: 'zzz_full', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'skilled', profileTier: 'skilled', buildId: 'zzz_full', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'expert', profileTier: 'expert', buildId: 'zzz_full', attempts: 10, victories: 0, passRate: 0 },
      ],
      [
        { id: 'aaa_sparse', build: sparseBuild },
        { id: 'zzz_full', build: fullBuild },
      ],
      1,
    ).map((build) => build.id)

    expect(selected).toEqual(['zzz_full'])
  })

  it('selects shared strategies by aggregate performance without profile-specific winners forcing entry', () => {
    const selected = selectTwoPhaseSharedStrategyIds([
      { strategyId: 'broad', passRate: 0.8 },
      { strategyId: 'broad', passRate: 0.7 },
      { strategyId: 'broad', passRate: 0.6 },
      { strategyId: 'core', passRate: 0 },
      { strategyId: 'core', passRate: 0.1 },
      { strategyId: 'core', passRate: 1 },
    ], 1)

    expect(selected).toEqual(['broad'])
  })

  it('cuts learning build candidates at a clear pass-rate gap before the maximum count', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const builds = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'].map((id) => ({
      id,
      build: defaultBuild,
    }))
    const passRates = [0.9, 0.89, 0.87, 0.85, 0.77, 0.77, 0.75, 0.5, 0.5, 0.4]
    const scenarios = passRates.map((passRate, index) => ({
      stageId: stage.id,
      profileId: 'fixed-profile',
      profileTier: 'expert' as const,
      buildId: builds[index].id,
      attempts: 100,
      victories: Math.round(passRate * 100),
      passRate,
    }))

    const selected = selectLearningBuildCandidatesFromFixedAnalysis(scenarios, builds, {
      minBuildCount: 5,
      maxBuildCount: 10,
      gapThreshold: 0.07,
    }).map((build) => build.id)

    expect(selected).toEqual(['b1', 'b2', 'b3', 'b4'])
  })

  it('keeps up to the configured maximum when learning build pass rates do not clearly break away', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const builds = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'].map((id) => ({
      id,
      build: defaultBuild,
    }))
    const passRates = [0.9, 0.86, 0.83, 0.8, 0.77, 0.74]
    const scenarios = passRates.map((passRate, index) => ({
      stageId: stage.id,
      profileId: 'fixed-profile',
      profileTier: 'expert' as const,
      buildId: builds[index].id,
      attempts: 100,
      victories: Math.round(passRate * 100),
      passRate,
    }))

    const selected = selectLearningBuildCandidatesFromFixedAnalysis(scenarios, builds, {
      minBuildCount: 5,
      maxBuildCount: 5,
      gapThreshold: 0.07,
    }).map((build) => build.id)

    expect(selected).toEqual(['b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('keeps more complete passive-heavy builds for learning when fixed pass rates tie', () => {
    const stage = getStageById('harbor-1')
    const defaultBuild = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const sparseBuild: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        '1': 'warrior_t_taunt',
        '2': null,
        '3': null,
        '4': null,
        Q: null,
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: [],
    }
    const passiveHeavyBuild: PersistedBuildState = {
      ...defaultBuild,
      loadout: {
        ...defaultBuild.loadout,
        '1': 'warrior_t_taunt',
        '2': null,
        '3': null,
        '4': null,
        Q: null,
        E: null,
        R: null,
        F: null,
      },
      passiveTalentIds: [
        'warrior_t_reinforced_plates',
        'warrior_t_defensive_stance',
        'warrior_t_barbaric_training',
        'warrior_t_immortal_stance',
      ],
    }

    const selected = selectLearningBuildCandidatesFromFixedAnalysis(
      [
        { stageId: stage.id, profileId: 'fixed-profile', profileTier: 'expert', buildId: 'aaa_sparse', attempts: 10, victories: 0, passRate: 0 },
        { stageId: stage.id, profileId: 'fixed-profile', profileTier: 'expert', buildId: 'zzz_passive_heavy', attempts: 10, victories: 0, passRate: 0 },
      ],
      [
        { id: 'aaa_sparse', build: sparseBuild },
        { id: 'zzz_passive_heavy', build: passiveHeavyBuild },
      ],
      {
        minBuildCount: 1,
        maxBuildCount: 1,
        gapThreshold: 0.07,
      },
    ).map((build) => build.id)

    expect(selected).toEqual(['zzz_passive_heavy'])
  })

  it('summarizes best build per profile by highest pass rate', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const alternateBuild: PersistedBuildState = {
      ...build,
      passiveTalentIds: [],
    }

    const analysis = runStageBalanceAnalysis({
      stage,
      builds: [
        { id: 'default', build },
        { id: 'alternate', build: alternateBuild },
      ],
      profiles: [
        {
          ...noMistakeProfile,
          id: 'z-profile',
        },
        {
          ...noMistakeProfile,
          id: 'a-profile',
        },
      ],
      attemptsPerScenario: 2,
      maxDurationMs: 1000,
      initialStateMutator: (state) =>
        state.passiveTalentIds.length > 0
          ? instantVictoryState(state)
          : { ...state, result: { outcome: 'defeat', reason: 'forced' } },
    })

    expect(analysis.scoringMode).toBe('best_build_per_profile')
    expect(analysis.bestBuildsByProfile).toEqual([
      {
        profileId: 'a-profile',
        profileTier: 'average',
        buildId: 'default',
        attempts: 2,
        victories: 2,
        passRate: 1,
        loadout: build.loadout,
        passiveTalentIds: build.passiveTalentIds,
      },
      {
        profileId: 'z-profile',
        profileTier: 'average',
        buildId: 'default',
        attempts: 2,
        victories: 2,
        passRate: 1,
        loadout: build.loadout,
        passiveTalentIds: build.passiveTalentIds,
      },
    ])
  })

  it('starts each attempt from normal encounter creation when no mutator is supplied', () => {
    const stage = getStageById('harbor-1')
    const build = getDefaultPersistedBuildForRule(getStageBuildRuleId(stage))
    const state = createInitialEncounterState(stage, build)

    expect(state.result).toBeNull()
    expect(state.enemies.length).toBeGreaterThan(0)
  })
})
