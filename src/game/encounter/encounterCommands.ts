import type { EncounterCommand, EncounterState } from './encounterTypes'

export function enqueueEncounterCommand(state: EncounterState, command: EncounterCommand): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      commandQueue: [...state.runtime.commandQueue, command],
    },
  }
}

export function dispatchEncounterCommand(state: EncounterState, command: EncounterCommand): EncounterState {
  return enqueueEncounterCommand(
    {
      ...state,
      runtime: {
        ...state.runtime,
        lastRejectedCommandMessage: null,
        lastProcessedEvents: [],
      },
    },
    command,
  )
}
