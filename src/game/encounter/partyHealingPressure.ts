import type { EncounterState } from './encounterTypes'

export function reducePartyPressureByEffectiveHealing(
  party: EncounterState['party'],
  effectiveHealing: number,
): EncounterState['party'] {
  if (effectiveHealing <= 0) {
    return party
  }

  return {
    ...party,
    pressure: Math.max(0, party.pressure - effectiveHealing),
  }
}
