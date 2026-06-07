export { dispatchEncounterCommand } from './encounterCommands'
import {
  activateSkill,
  getSkillActivationBlockReason,
  selectEnemy,
} from './encounterFactory'
import { enqueueEncounterEvent } from './encounterEvents'
import type { EncounterCommand, EncounterEvent, EncounterState } from './encounterTypes'

function appendProcessedEvent(
  state: EncounterState,
  processedEvents: EncounterEvent[],
  event: EncounterEvent,
) {
  processedEvents.push(event)
  return enqueueEncounterEvent(state, event)
}

function resetCommandProcessingState(state: EncounterState): EncounterState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      commandQueue: [],
      lastRejectedCommandMessage: null,
      lastProcessedEvents: [],
    },
  }
}

function rejectCommand(
  state: EncounterState,
  processedEvents: EncounterEvent[],
  command: EncounterCommand,
  message: string,
) {
  const nextState = appendProcessedEvent(state, processedEvents, {
    type: 'command/rejected',
    occurredAtMs: command.submittedAtMs,
    message,
    commandType: command.type,
  })

  return {
    ...nextState,
    runtime: {
      ...nextState.runtime,
      lastRejectedCommandMessage: message,
    },
  }
}

function canProcessEncounterInput(state: EncounterState) {
  return !state.result && !state.runtime.pauseOverlay
}

export function flushEncounterCommands(state: EncounterState): EncounterState {
  if (!canProcessEncounterInput(state)) {
    return state.runtime.lastProcessedEvents.length === 0 &&
      state.runtime.lastRejectedCommandMessage === null
      ? state
      : {
          ...state,
          runtime: {
            ...state.runtime,
            lastProcessedEvents: [],
            lastRejectedCommandMessage: null,
          },
        }
  }

  if (state.runtime.commandQueue.length === 0) {
    return state.runtime.lastProcessedEvents.length === 0 &&
      state.runtime.lastRejectedCommandMessage === null
      ? state
      : resetCommandProcessingState(state)
  }

  const processedEvents: EncounterEvent[] = []
  let nextState = resetCommandProcessingState(state)

  for (const command of state.runtime.commandQueue) {
    if (!canProcessEncounterInput(nextState)) {
      break
    }

    if (command.type === 'player/select-target') {
      const previousTargetId = nextState.player.currentTargetId
      nextState = selectEnemy(nextState, command.targetEnemyId)

      if (nextState.player.currentTargetId !== previousTargetId && nextState.player.currentTargetId) {
        nextState = appendProcessedEvent(nextState, processedEvents, {
          type: 'player/target-selected',
          occurredAtMs: command.submittedAtMs,
          targetEnemyId: nextState.player.currentTargetId,
        })
      }

      continue
    }

    const blockReason = getSkillActivationBlockReason(nextState, command.skillId)
    if (blockReason) {
      nextState = rejectCommand(nextState, processedEvents, command, blockReason)
      continue
    }

    nextState = activateSkill(nextState, command.skillId)
    nextState = appendProcessedEvent(nextState, processedEvents, {
      type: 'player/skill-activated',
      occurredAtMs: command.submittedAtMs,
      skillId: command.skillId,
    })
  }

  return {
    ...nextState,
    runtime: {
      ...nextState.runtime,
      lastProcessedEvents: processedEvents,
    },
  }
}
