import type { EncounterEvent, EncounterState } from './encounterTypes'

export function enqueueEncounterEvent(state: EncounterState, event: EncounterEvent): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      eventQueue: [...state.runtime.eventQueue, event],
    },
  }
}
