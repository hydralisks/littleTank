import { campaignStageOrder, type StageInfo } from '../data/stageTemplates'
import { getPlayerClassCatalog } from '../data/playerBuildCatalog'
import type { PlayerClassId } from '../encounter/encounterTypes'
import {
  WARRIOR_T_CLASS_ID,
  getPlayerClassRuntimeDefinitions,
} from '../playerClasses/playerClassRuntimeRegistry'
import type { ClassProgressionState } from './classProgression'
import { getChallengeGroupForStage, isChallengeStageOpen } from './classTrialPolicy'

export interface StageClassAvailabilityInput extends ClassProgressionState {
  highestClearedCampaignStageIndex: number
  registeredClassIds?: readonly PlayerClassId[]
  enabledClassIds?: readonly PlayerClassId[]
}

function getFirstChapterEndIndex() {
  const configuredEndIndex = campaignStageOrder.indexOf('RingingDeeps-6')
  return configuredEndIndex >= 0
    ? configuredEndIndex
    : Math.min(5, campaignStageOrder.length - 1)
}

export function getAvailableClassIdsForStage(
  stage: StageInfo,
  input: StageClassAvailabilityInput,
) {
  const registered = new Set(
    input.registeredClassIds ?? getPlayerClassRuntimeDefinitions().map((entry) => entry.classId),
  )
  const enabled = new Set(
    input.enabledClassIds ?? getPlayerClassCatalog().map((entry) => entry.classId),
  )
  const contentCap = stage.allowedClassIds?.length
    ? new Set(stage.allowedClassIds)
    : null
  const eligible = new Set<PlayerClassId>([WARRIOR_T_CLASS_ID])
  const campaignIndex = campaignStageOrder.indexOf(stage.id)
  const firstChapterEndIndex = getFirstChapterEndIndex()

  if (campaignIndex >= 0) {
    if (campaignIndex > firstChapterEndIndex) {
      for (const classId of input.campaignUnlockedClassIds) {
        eligible.add(classId)
      }
    }
  } else if (
    stage.id.startsWith('Challenge-')
    && isChallengeStageOpen(stage.id, input.highestClearedCampaignStageIndex)
  ) {
    for (const classId of input.campaignUnlockedClassIds) {
      eligible.add(classId)
    }
    const group = getChallengeGroupForStage(stage.id)
    if (group?.trialClassId) {
      eligible.add(group.trialClassId)
    }
  } else {
    return []
  }

  const eligibleOrder = new Map([...eligible].map((classId, index) => [classId, index]))
  const runtimeOrder = new Map(
    getPlayerClassRuntimeDefinitions().map((entry) => [entry.classId, entry.selectionOrder]),
  )
  return [...eligible]
    .filter((classId) => registered.has(classId) && enabled.has(classId) && (!contentCap || contentCap.has(classId)))
    .sort((left, right) => {
      return (runtimeOrder.get(left) ?? 1000 + (eligibleOrder.get(left) ?? 0))
        - (runtimeOrder.get(right) ?? 1000 + (eligibleOrder.get(right) ?? 0))
        || left.localeCompare(right)
    })
}

export function resolveStageClassId(
  preferredClassId: PlayerClassId,
  availableClassIds: readonly PlayerClassId[],
) {
  if (availableClassIds.includes(preferredClassId)) {
    return preferredClassId
  }
  if (availableClassIds.includes(WARRIOR_T_CLASS_ID)) {
    return WARRIOR_T_CLASS_ID
  }
  return availableClassIds[0] ?? null
}
