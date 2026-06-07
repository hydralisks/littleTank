import type {
  EncounterSpecialRuleDefinition,
  EncounterStageRuleRuntimeEntry,
  EncounterState,
  EnemyState,
  PlayerState,
  StatusEffect,
} from './encounterTypes'

export interface StageRuleLogicHelpers {
  appendOrReplaceEnemyStatus: (enemy: EnemyState, status: StatusEffect) => EnemyState
  appendOrReplacePartyStatus: (party: EncounterState['party'], status: StatusEffect) => EncounterState['party']
  appendOrReplacePlayerDebuff: (player: PlayerState, status: StatusEffect) => PlayerState
  clamp: (value: number, min: number, max: number) => number
  createEnemyStatusEffect: (statusId: string, durationMs?: number) => StatusEffect | null
  createPlayerBuildStatusEffect: (statusId: string, durationMs?: number) => StatusEffect | null
  playerHasDebuff: (player: PlayerState, statusId: string) => boolean
  removePlayerDebuff: (player: PlayerState, statusId: string) => PlayerState
}

export interface StageRuleLogicHandler {
  onEncounterStart?: (
    state: EncounterState,
    rule: EncounterSpecialRuleDefinition,
    helpers: StageRuleLogicHelpers,
  ) => EncounterState
  onTick?: (
    state: EncounterState,
    rule: EncounterSpecialRuleDefinition,
    deltaMs: number,
    helpers: StageRuleLogicHelpers,
  ) => EncounterState
  onEncounterEnd?: (
    state: EncounterState,
    rule: EncounterSpecialRuleDefinition,
    helpers: StageRuleLogicHelpers,
  ) => EncounterState
}

export function createInitialStageRuleRuntimeEntry(): EncounterStageRuleRuntimeEntry {
  return {
    initialized: false,
  }
}

function getRuleRuntimeEntry(
  state: EncounterState,
  rule: EncounterSpecialRuleDefinition,
): EncounterStageRuleRuntimeEntry {
  return state.runtime.stageRuleRuntime[rule.ruleLogicId] ?? createInitialStageRuleRuntimeEntry()
}

function setRuleRuntimeEntry(
  state: EncounterState,
  rule: EncounterSpecialRuleDefinition,
  entry: EncounterStageRuleRuntimeEntry,
): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      stageRuleRuntime: {
        ...state.runtime.stageRuleRuntime,
        [rule.ruleLogicId]: entry,
      },
    },
  }
}

function getRuleValue(rule: EncounterSpecialRuleDefinition, field: 'valueA' | 'valueB', fallback: number) {
  return typeof rule[field] === 'number' ? rule[field] : fallback
}

function getRuleIntervalMs(rule: EncounterSpecialRuleDefinition, fallback: number) {
  return Math.max(1, rule.tickIntervalMs ?? fallback)
}

function applyRuleStatusParameters(status: StatusEffect | null, rule: EncounterSpecialRuleDefinition) {
  return status
    ? {
        ...status,
        ...(typeof rule.valueA === 'number' ? { valueA: rule.valueA } : {}),
        ...(typeof rule.valueB === 'number' ? { valueB: rule.valueB } : {}),
        ...(typeof rule.tickIntervalMs === 'number' ? { tickIntervalMs: rule.tickIntervalMs } : {}),
      }
    : null
}

const stageRuleLogicRegistry: Record<string, StageRuleLogicHandler> = {
  watchAndLearn: {
    onEncounterStart: (state, rule) =>
      setRuleRuntimeEntry(state, rule, {
        ...getRuleRuntimeEntry(state, rule),
        initialized: true,
      }),
  },

  sensitiveParty: {
    onEncounterStart: (state, rule, helpers) => {
      const status = applyRuleStatusParameters(helpers.createEnemyStatusEffect('sensitive'), rule)
      return setRuleRuntimeEntry(
        status
          ? {
              ...state,
              party: helpers.appendOrReplacePartyStatus(state.party, status),
            }
          : state,
        rule,
        {
          ...getRuleRuntimeEntry(state, rule),
          initialized: true,
        },
      )
    },
  },

  'sensitiveParty?': {
    onEncounterStart: (state, rule, helpers) => {
      const status = applyRuleStatusParameters(helpers.createEnemyStatusEffect('sensitive?'), rule)
      return setRuleRuntimeEntry(
        status
          ? {
              ...state,
              party: helpers.appendOrReplacePartyStatus(state.party, status),
            }
          : state,
        rule,
        {
          ...getRuleRuntimeEntry(state, rule),
          initialized: true,
        },
      )
    },
  },

  incorrigible: {
    onEncounterStart: (state, rule, helpers) => {
      const status =
        helpers.createEnemyStatusEffect('incorrigibled') ??
        helpers.createPlayerBuildStatusEffect('incorrigibled')
      return setRuleRuntimeEntry(
        status
          ? {
              ...state,
              player: helpers.appendOrReplacePlayerDebuff(state.player, status),
            }
          : state,
        rule,
        {
          ...getRuleRuntimeEntry(state, rule),
          initialized: true,
        },
      )
    },
  },

  asYourWish: {
    onEncounterStart: (state, rule, helpers) => {
      const status = applyRuleStatusParameters(helpers.createEnemyStatusEffect('asHisWish'), rule)
      return setRuleRuntimeEntry(
        status
          ? {
              ...state,
              party: helpers.appendOrReplacePartyStatus(state.party, status),
            }
          : state,
        rule,
        {
          ...getRuleRuntimeEntry(state, rule),
          initialized: true,
        },
      )
    },
  },

  andThen: {
    onEncounterStart: (state, rule) =>
      setRuleRuntimeEntry(state, rule, {
        ...getRuleRuntimeEntry(state, rule),
        initialized: true,
        timerMs: getRuleRuntimeEntry(state, rule).timerMs ?? getRuleValue(rule, 'valueA', 15_000),
      }),

    onTick: (state, rule, deltaMs, helpers) => {
      const entry = getRuleRuntimeEntry(state, rule)
      const initialTimerMs = getRuleValue(rule, 'valueA', 15_000)
      const resetTimerMs = getRuleValue(rule, 'valueB', getRuleValue(rule, 'valueA', 15_000))

      if (state.runtime.lastProcessedEvents.some((event) => event.type === 'enemy/died')) {
        return setRuleRuntimeEntry(
          {
            ...state,
            player: helpers.removePlayerDebuff(state.player, 'battleHunger'),
          },
          rule,
          {
            ...entry,
            initialized: true,
            timerMs: resetTimerMs,
          },
        )
      }

      const remainingMs = Math.max(0, (entry.timerMs ?? initialTimerMs) - deltaMs)

      if (remainingMs > 0) {
        return setRuleRuntimeEntry(state, rule, {
          ...entry,
          initialized: true,
          timerMs: remainingMs,
        })
      }

      const status = helpers.createEnemyStatusEffect('battleHunger')
      return setRuleRuntimeEntry(
        status
          ? {
              ...state,
              player: helpers.appendOrReplacePlayerDebuff(state.player, status),
            }
          : state,
        rule,
        {
          ...entry,
          initialized: true,
          timerMs: 0,
        },
      )
    },
  },

  opening_pressure_shift: {
    onEncounterStart: (state, rule, helpers) => ({
      ...state,
      party: {
        ...state.party,
        pressure: helpers.clamp(
          state.party.pressure + getRuleValue(rule, 'valueA', 8),
          0,
          state.party.maxPressure,
        ),
      },
      runtime: {
        ...state.runtime,
        stageRuleRuntime: {
          ...state.runtime.stageRuleRuntime,
          [rule.ruleLogicId]: {
            ...getRuleRuntimeEntry(state, rule),
            initialized: true,
          },
        },
      },
    }),
  },

  periodic_reinforcement: {
    onEncounterStart: (state, rule) =>
      setRuleRuntimeEntry(state, rule, {
        ...getRuleRuntimeEntry(state, rule),
        initialized: true,
        timerMs: getRuleRuntimeEntry(state, rule).timerMs ?? getRuleIntervalMs(rule, 3000),
      }),

    onTick: (state, rule, deltaMs, helpers) => {
      const entry = getRuleRuntimeEntry(state, rule)
      const intervalMs = getRuleIntervalMs(rule, 3000)
      const remainingMs = Math.max(0, (entry.timerMs ?? intervalMs) - deltaMs)

      if (remainingMs > 0) {
        return setRuleRuntimeEntry(state, rule, {
          ...entry,
          initialized: true,
          timerMs: remainingMs,
        })
      }

      const status = helpers.createEnemyStatusEffect('enrage-song')
      if (!status) {
        return setRuleRuntimeEntry(state, rule, {
          ...entry,
          initialized: true,
          timerMs: intervalMs,
        })
      }

      const firstLivingEnemy = state.enemies.find((enemy) => enemy.hp > 0)
      if (!firstLivingEnemy) {
        return setRuleRuntimeEntry(state, rule, {
          ...entry,
          initialized: true,
          timerMs: intervalMs,
        })
      }

      return setRuleRuntimeEntry(
        {
          ...state,
          enemies: state.enemies.map((enemy) =>
            enemy.id === firstLivingEnemy.id ? helpers.appendOrReplaceEnemyStatus(enemy, status) : enemy,
          ),
        },
        rule,
        {
          ...entry,
          initialized: true,
          timerMs: intervalMs,
        },
      )
    },
  },

  player_control_tax: {
    onEncounterStart: (state, rule) =>
      setRuleRuntimeEntry(state, rule, {
        ...getRuleRuntimeEntry(state, rule),
        initialized: true,
        timerMs: getRuleRuntimeEntry(state, rule).timerMs ?? getRuleIntervalMs(rule, 1000),
      }),

    onTick: (state, rule, deltaMs, helpers) => {
      const entry = getRuleRuntimeEntry(state, rule)
      const intervalMs = getRuleIntervalMs(rule, 1000)
      const remainingMs = Math.max(0, (entry.timerMs ?? intervalMs) - deltaMs)

      if (remainingMs > 0) {
        return setRuleRuntimeEntry(state, rule, {
          ...entry,
          initialized: true,
          timerMs: remainingMs,
        })
      }

      const nextState = helpers.playerHasDebuff(state.player, 'stunned')
        ? {
            ...state,
            party: {
              ...state.party,
              pressure: helpers.clamp(
                state.party.pressure + getRuleValue(rule, 'valueA', 6),
                0,
                state.party.maxPressure,
              ),
            },
          }
        : state

      return setRuleRuntimeEntry(nextState, rule, {
        ...entry,
        initialized: true,
        timerMs: intervalMs,
      })
    },
  },
}

export function getStageRuleLogicHandler(ruleLogicId: string): StageRuleLogicHandler | null {
  return stageRuleLogicRegistry[ruleLogicId] ?? null
}
