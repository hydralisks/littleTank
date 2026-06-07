import { describe, expect, it } from 'vitest'
import { getStageById } from '../data/stageTemplates'
import {
  filterLearningTacticalStrategiesForStage,
  runLearningStageBalanceAnalysis,
  type LearningCastStrategy,
  type LearningTacticalStrategy,
} from './learningBalanceEvaluator'
import type { BalanceOperationProfile } from './balanceSimulator'
import type { EncounterState } from '../encounter/encounterTypes'

const smokeProfile: BalanceOperationProfile = {
  id: 'learning-smoke',
  tier: 'average',
  reactionDelayMs: 0,
  mistakeRate: 0,
  decisionIntervalMs: 100,
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

describe('learning balance evaluator', () => {
  it('tries multiple cast strategies, selects shared winners, and reports final pass-rate rating', () => {
    const stage = getStageById('harbor-1')
    const strategies: LearningCastStrategy[] = [
      {
        id: 'broad',
        profileOverrides: {
          endCastStopWindowMs: 1000,
          preserveKeyStopSkills: true,
          evaluateEnemySkillImpact: true,
          preferControlForChanneling: true,
        },
      },
      {
        id: 'late',
        profileOverrides: {
          endCastStopWindowMs: 350,
          preserveKeyStopSkills: true,
          evaluateEnemySkillImpact: true,
          preferControlForChanneling: true,
        },
      },
    ]

    const analysis = runLearningStageBalanceAnalysis({
      stage,
      profiles: [smokeProfile],
      castStrategies: strategies,
      phaseOneAttemptsPerScenario: 1,
      attemptsPerScenario: 1,
      maxDurationMs: 1000,
      phaseOneMaxActiveBuilds: 1,
      phaseOneMaxPassiveVariants: 1,
      finalBuildCount: 1,
      finalStrategyCount: 1,
      initialStateMutator: (state) => ({
        ...state,
        enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })),
      }),
    })

    expect(analysis.stageId).toBe(stage.id)
    expect(analysis.learningMode).toBe('build_and_cast_strategy_search')
    expect(analysis.selectedBuildIds.length).toBe(1)
    expect(analysis.selectedCastStrategyIds.length).toBe(1)
    expect(analysis.learningDifficultyRating.label).toBe('trivial')
    expect(analysis.learningEffort.label).toBe('none')
    expect(analysis.learningPath.label).toBe('direct')
    expect(analysis.finalAnalysis.rating.label).toBe('trivial')
  })

  it('tries tactical strategies separately from cast strategies and reports the shared winners', () => {
    const stage = {
      ...getStageById('harbor-1'),
      strategyTips: '优先击杀高威胁目标，并在机制目标出现时集火。',
    }
    const castStrategies: LearningCastStrategy[] = [
      { id: 'broad', profileOverrides: { endCastStopWindowMs: 1000 } },
    ]
    const tacticalStrategies: LearningTacticalStrategy[] = [
      {
        id: 'strict-threat',
        profileOverrides: {
          targetPriorityMode: 'threat_first',
          irregularThreatPolicy: 'strict',
        },
      },
      {
        id: 'kill-high-impact',
        profileOverrides: {
          targetPriorityMode: 'kill_high_impact',
          irregularThreatPolicy: 'periodic',
        },
      },
      {
        id: 'mechanic-wax-party-chain',
        profileOverrides: {
          targetPriorityMode: 'mechanic_focus',
          irregularThreatPolicy: 'allow_leak_when_tank_pressure_high',
          mechanicChainPlan: 'wax_party_then_hoe_party',
        },
      },
    ]

    const analysis = runLearningStageBalanceAnalysis({
      stage,
      profiles: [smokeProfile],
      castStrategies,
      tacticalStrategies,
      phaseOneAttemptsPerScenario: 1,
      attemptsPerScenario: 1,
      maxDurationMs: 1000,
      phaseOneMaxActiveBuilds: 1,
      phaseOneMaxPassiveVariants: 1,
      finalBuildCount: 1,
      finalStrategyCount: 1,
      initialStateMutator: (state) => ({
        ...state,
        enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })),
      }),
    })

    expect(analysis.learningMode).toBe('build_cast_and_tactical_strategy_search')
    expect(analysis.selectedCastStrategyIds).toEqual(['broad'])
    expect(analysis.selectedTacticalStrategyIds.length).toBe(1)
    expect(analysis.explorationScenarios.every((scenario) => scenario.tacticalStrategyId)).toBe(true)
  })

  it('uses provided build candidates instead of generating phase-one builds', () => {
    const stage = getStageById('harbor-1')
    const buildCandidates = [
      {
        id: 'external_candidate',
        build: {
          loadout: {
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
        },
      },
    ]

    const analysis = runLearningStageBalanceAnalysis({
      stage,
      profiles: [smokeProfile],
      buildCandidates,
      castStrategies: [{ id: 'broad', profileOverrides: { endCastStopWindowMs: 1000 } }],
      phaseOneAttemptsPerScenario: 1,
      attemptsPerScenario: 1,
      maxDurationMs: 1000,
      finalBuildCount: 1,
      finalStrategyCount: 1,
      initialStateMutator: (state) => ({
        ...state,
        enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })),
      }),
    })

    expect(analysis.phaseOneBuildCount).toBe(1)
    expect(analysis.selectedBuildIds).toEqual(['external_candidate'])
    expect(analysis.explorationScenarios.every((scenario) => scenario.buildId === 'external_candidate')).toBe(true)
  })

  it('optionally collects diagnostics on final learning scenarios without changing exploration results', () => {
    const stage = getStageById('harbor-1')
    const buildCandidates = [
      {
        id: 'external_candidate',
        build: {
          loadout: {
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
        },
      },
    ]

    const analysis = runLearningStageBalanceAnalysis({
      stage,
      profiles: [smokeProfile],
      buildCandidates,
      castStrategies: [{ id: 'broad', profileOverrides: { endCastStopWindowMs: 1000 } }],
      phaseOneAttemptsPerScenario: 1,
      attemptsPerScenario: 1,
      maxDurationMs: 1000,
      finalBuildCount: 1,
      finalStrategyCount: 1,
      initialStateMutator: highDangerCastDefeatState,
      collectDiagnostics: true,
    })

    expect(analysis.explorationScenarios[0]).not.toHaveProperty('diagnosticSummary')
    expect(analysis.finalAnalysis.scenarios[0]?.diagnosticSummary).toMatchObject({
      signals: [
        expect.objectContaining({
          id: 'high_danger_casts_completed',
          internalActionIds: ['try_high_danger_interrupt_focus'],
        }),
      ],
    })
  })

  it('filters out wax-chain tactics on stages without matching tips or mechanics', () => {
    const stage = {
      ...getStageById('RingingDeeps-2'),
      strategyTips: '',
    }
    const tacticalStrategies: LearningTacticalStrategy[] = [
      { id: 'strict-threat', profileOverrides: {} },
      { id: 'mechanic-wax-party-chain', profileOverrides: {} },
      { id: 'mechanic-wax-tank-chain', profileOverrides: {} },
    ]

    const filtered = filterLearningTacticalStrategiesForStage(stage, tacticalStrategies, ['flame_missiles'])

    expect(filtered.map((strategy) => strategy.id)).toEqual(['strict-threat'])
  })

  it('keeps wax-chain tactics when stage tips or mechanics explicitly reference them', () => {
    const stage = {
      ...getStageById('RingingDeeps-6'),
      strategyTips: '蜡像与暗影之锄要尽量打在同一侧。',
    }
    const tacticalStrategies: LearningTacticalStrategy[] = [
      { id: 'strict-threat', profileOverrides: {} },
      { id: 'mechanic-wax-party-chain', profileOverrides: {} },
    ]

    const filtered = filterLearningTacticalStrategiesForStage(stage, tacticalStrategies, ['wax_figure'])

    expect(filtered.map((strategy) => strategy.id)).toEqual(['strict-threat', 'mechanic-wax-party-chain'])
  })

  it('keeps intentional leak tactics only when stage tips describe leak or pressure handling', () => {
    const tacticalStrategies: LearningTacticalStrategy[] = [
      { id: 'strict-threat', profileOverrides: {} },
      { id: 'allow-irregular-leak', profileOverrides: { irregularThreatPolicy: 'allow_leak_when_tank_pressure_high' } },
    ]

    expect(
      filterLearningTacticalStrategiesForStage(
        { ...getStageById('WestFall-4'), strategyTips: '' },
        tacticalStrategies,
        ['murloc_upgrade'],
      ).map((strategy) => strategy.id),
    ).toEqual(['strict-threat'])

    expect(
      filterLearningTacticalStrategiesForStage(
        { ...getStageById('WestFall-4'), strategyTips: '无理目标技能可以在坦克压力高时选择漏一次。' },
        tacticalStrategies,
        ['murloc_upgrade'],
      ).map((strategy) => strategy.id),
    ).toEqual(['strict-threat', 'allow-irregular-leak'])
  })

  it('keeps mechanic-focus tactics only when stage tips ask for priority kills or focus fire', () => {
    const tacticalStrategies: LearningTacticalStrategy[] = [
      { id: 'strict-threat', profileOverrides: {} },
      { id: 'mechanic-focus', profileOverrides: { targetPriorityMode: 'mechanic_focus' } },
      { id: 'kill-high-impact', profileOverrides: { targetPriorityMode: 'kill_high_impact' } },
    ]

    expect(
      filterLearningTacticalStrategiesForStage(
        { ...getStageById('WestFall-5'), strategyTips: '' },
        tacticalStrategies,
        ['murloc_attack'],
      ).map((strategy) => strategy.id),
    ).toEqual(['strict-threat'])

    expect(
      filterLearningTacticalStrategiesForStage(
        { ...getStageById('WestFall-5'), strategyTips: '优先击杀治疗者，然后集火高威胁目标。' },
        tacticalStrategies,
        ['murloc_attack'],
      ).map((strategy) => strategy.id),
    ).toEqual(['strict-threat', 'mechanic-focus', 'kill-high-impact'])
  })
})
