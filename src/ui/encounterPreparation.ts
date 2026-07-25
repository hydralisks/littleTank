export type EncounterEntrySource = 'map' | 'victory-continue' | 'retry'
export type EncounterPhase = 'preparation' | 'active'

export function getInitialEncounterPhase(entrySource: EncounterEntrySource): EncounterPhase {
  return entrySource === 'retry' ? 'active' : 'preparation'
}
