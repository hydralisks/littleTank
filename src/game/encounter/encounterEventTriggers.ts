import type { EncounterEvent, EncounterState } from './encounterTypes'

export interface EncounterEventTriggerApplyResult<Runtime> {
  state: EncounterState
  runtime: Runtime
}

export interface EncounterEventTrigger<Runtime = unknown> {
  id: string
  eventTypes?: readonly EncounterEvent['type'][]
  getRuntime: (state: EncounterState) => Runtime
  setRuntime: (state: EncounterState, runtime: Runtime) => EncounterState
  apply: (
    state: EncounterState,
    event: EncounterEvent,
    runtime: Runtime,
  ) => EncounterEventTriggerApplyResult<Runtime>
}

function shouldTriggerForEvent<Runtime>(trigger: EncounterEventTrigger<Runtime>, event: EncounterEvent) {
  return !trigger.eventTypes || trigger.eventTypes.includes(event.type)
}

export function applyEncounterEventTriggers<Runtime>(
  state: EncounterState,
  events: readonly EncounterEvent[],
  triggers: readonly EncounterEventTrigger<Runtime>[],
) {
  if (events.length === 0 || triggers.length === 0) {
    return state
  }

  let nextState = state

  for (const event of events) {
    for (const trigger of triggers) {
      if (!shouldTriggerForEvent(trigger, event)) {
        continue
      }

      const result = trigger.apply(nextState, event, trigger.getRuntime(nextState))
      nextState = trigger.setRuntime(result.state, result.runtime)
    }
  }

  return nextState
}
