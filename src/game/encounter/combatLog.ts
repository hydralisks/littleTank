import type { CombatLogEvent, EncounterState } from './encounterTypes'

export function createCombatLogEventId(
  state: EncounterState,
  type: CombatLogEvent['type'],
  seed: string,
) {
  return `${state.timeMs}:${state.runtime.combatLog.length}:${type}:${seed}`
}

export function recordCombatLogEvent(state: EncounterState, event: CombatLogEvent): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      combatLog: [...state.runtime.combatLog, event],
    },
  }
}

export function recordCombatLogEvents(
  state: EncounterState,
  events: readonly CombatLogEvent[],
): EncounterState {
  if (events.length === 0) {
    return state
  }

  return {
    ...state,
    runtime: {
      ...state.runtime,
      combatLog: [...state.runtime.combatLog, ...events],
    },
  }
}
