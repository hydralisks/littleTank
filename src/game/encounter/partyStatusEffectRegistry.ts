import type {
  EncounterEvent,
  EncounterState,
  PartyStatusRuntimeEntry,
  StatusEffect,
} from './encounterTypes'

export interface PartyStatusEffectHelpers {
  applyPartyPressureDelta: (state: EncounterState, delta: number) => EncounterState
}

export interface PartyStatusEffectHandler {
  intervalMs?: number
  onInterval?: (
    state: EncounterState,
    status: StatusEffect,
    runtime: PartyStatusRuntimeEntry,
    helpers: PartyStatusEffectHelpers,
  ) => EncounterState
  onEvent?: (
    state: EncounterState,
    status: StatusEffect,
    runtime: PartyStatusRuntimeEntry,
    event: EncounterEvent,
    helpers: PartyStatusEffectHelpers,
  ) => EncounterState
}

const PARTY_STATUS_EFFECT_REGISTRY: Record<string, PartyStatusEffectHandler> = {
  steady_relief: {
    intervalMs: 1000,
    onInterval: (state, _status, _runtime, helpers) => helpers.applyPartyPressureDelta(state, -2),
  },
  steady_pressure_rise: {
    intervalMs: 1000,
    onInterval: (state, _status, _runtime, helpers) => helpers.applyPartyPressureDelta(state, 2),
  },
  steady_pressure_rise_small: {
    intervalMs: 1000,
    onInterval: (state, _status, _runtime, helpers) => helpers.applyPartyPressureDelta(state, 1),
  },
  skill_relief_on_use: {
    onEvent: (state, _status, _runtime, event, helpers) =>
      event.type === 'player/skill-activated' && event.skillId === 'warrior_t_taunt'
        ? helpers.applyPartyPressureDelta(state, -10)
        : state,
  },
  asHisWish_status: {
    intervalMs: 10_000,
    onInterval: (state) => {
      const target = state.enemies
        .filter((enemy) => enemy.hp > 0)
        .sort((left, right) => right.tankThreat - left.tankThreat)[0]

      if (!target) {
        return state
      }

      return {
        ...state,
        party: {
          ...state.party,
          currentTargetId: target.id,
        },
      }
    },
  },
}

export function getPartyStatusEffectHandler(effectLogicId: string) {
  return PARTY_STATUS_EFFECT_REGISTRY[effectLogicId] ?? null
}
