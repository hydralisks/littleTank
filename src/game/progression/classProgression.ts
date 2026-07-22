import type { StageId } from '../data/stageTemplates'
import type { PlayerClassId } from '../encounter/encounterTypes'
import { WARRIOR_T_CLASS_ID } from '../playerClasses/playerClassRuntimeRegistry'
import { CHALLENGE_GROUP_POLICIES, getClassTrialPolicy } from './classTrialPolicy'

export type StageVictoriesByClass = Record<PlayerClassId, StageId[]>

export interface ClassProgressionState {
  challengeVictoriesByClass: StageVictoriesByClass
  campaignVictoriesByClass: StageVictoriesByClass
  campaignUnlockedClassIds: PlayerClassId[]
}

export interface StageVictory {
  mode: 'campaign' | 'challenge'
  stageId: StageId
  classId: PlayerClassId
}

function appendUnique<T>(values: readonly T[], value: T) {
  return values.includes(value) ? [...values] : [...values, value]
}

export function createEmptyClassProgression(): ClassProgressionState {
  return {
    challengeVictoriesByClass: {},
    campaignVictoriesByClass: {},
    campaignUnlockedClassIds: [WARRIOR_T_CLASS_ID],
  }
}

export function deriveCampaignUnlockedClassIds(
  challengeVictoriesByClass: StageVictoriesByClass,
  savedClassIds: readonly PlayerClassId[] = [],
) {
  const unlocked = new Set<PlayerClassId>([WARRIOR_T_CLASS_ID, ...savedClassIds])
  for (const group of CHALLENGE_GROUP_POLICIES) {
    if (!group.trialClassId) {
      continue
    }
    const victories = new Set(challengeVictoriesByClass[group.trialClassId] ?? [])
    if (group.challengeIds.every((stageId) => victories.has(stageId))) {
      unlocked.add(group.trialClassId)
    }
  }
  return [...unlocked]
}

export function recordStageVictory(
  current: ClassProgressionState,
  victory: StageVictory,
): ClassProgressionState {
  const target = victory.mode === 'challenge'
    ? current.challengeVictoriesByClass
    : current.campaignVictoriesByClass
  const nextTarget = {
    ...target,
    [victory.classId]: appendUnique(target[victory.classId] ?? [], victory.stageId),
  }
  const challengeVictoriesByClass = victory.mode === 'challenge'
    ? nextTarget
    : current.challengeVictoriesByClass

  return {
    challengeVictoriesByClass,
    campaignVictoriesByClass: victory.mode === 'campaign' ? nextTarget : current.campaignVictoriesByClass,
    campaignUnlockedClassIds: deriveCampaignUnlockedClassIds(
      challengeVictoriesByClass,
      current.campaignUnlockedClassIds,
    ),
  }
}

export function hasClassVictory(
  victoriesByClass: StageVictoriesByClass,
  classId: PlayerClassId,
  stageId: StageId,
) {
  return victoriesByClass[classId]?.includes(stageId) ?? false
}

export function getClassTrialProgress(
  victoriesByClass: StageVictoriesByClass,
  classId: PlayerClassId,
) {
  const policy = getClassTrialPolicy(classId)
  if (!policy) {
    return { completed: 0, required: 0 }
  }
  const victories = new Set(victoriesByClass[classId] ?? [])
  return {
    completed: policy.challengeIds.filter((stageId) => victories.has(stageId)).length,
    required: policy.challengeIds.length,
  }
}
