import { campaignStageOrder, type StageId } from '../data/stageTemplates'
import type { PlayerClassId } from '../encounter/encounterTypes'

export interface ChallengeGroupPolicy {
  challengeIds: readonly [StageId, StageId, StageId]
  requiredCampaignStageId: StageId
  trialClassId?: PlayerClassId
}

export interface ClassTrialPolicy extends ChallengeGroupPolicy {
  trialClassId: PlayerClassId
}

export const CHALLENGE_GROUP_POLICIES: readonly ChallengeGroupPolicy[] = [
  {
    challengeIds: ['Challenge-1', 'Challenge-2', 'Challenge-3'],
    requiredCampaignStageId: 'RingingDeeps-6',
    trialClassId: 'druid_bear_t',
  },
  {
    challengeIds: ['Challenge-4', 'Challenge-5', 'Challenge-6'],
    requiredCampaignStageId: 'WestFall-6',
    trialClassId: 'dk_blood_t',
  },
  {
    challengeIds: ['Challenge-7', 'Challenge-8', 'Challenge-9'],
    requiredCampaignStageId: "Zul'Aman-6",
    trialClassId: undefined,
  },
] as const

function validateChallengeGroups() {
  const seen = new Set<StageId>()
  for (const group of CHALLENGE_GROUP_POLICIES) {
    if (new Set(group.challengeIds).size !== 3) {
      throw new Error(`Challenge group must contain three distinct stages: ${group.challengeIds.join(',')}`)
    }
    for (const stageId of group.challengeIds) {
      if (seen.has(stageId)) {
        throw new Error(`Challenge stage appears in multiple groups: ${stageId}`)
      }
      seen.add(stageId)
    }
  }
}

validateChallengeGroups()

export function getChallengeGroupForStage(stageId: StageId) {
  return CHALLENGE_GROUP_POLICIES.find((group) => group.challengeIds.includes(stageId))
}

export function getClassTrialPolicy(classId: PlayerClassId): ClassTrialPolicy | undefined {
  return CHALLENGE_GROUP_POLICIES.find(
    (group): group is ClassTrialPolicy => group.trialClassId === classId,
  )
}

export function isChallengeStageOpen(stageId: StageId, highestClearedCampaignStageIndex: number) {
  const group = getChallengeGroupForStage(stageId)
  if (!group) {
    return false
  }
  const milestoneIndex = campaignStageOrder.indexOf(group.requiredCampaignStageId)
  if (milestoneIndex < 0) {
    throw new Error(`Challenge milestone is not in campaign order: ${group.requiredCampaignStageId}`)
  }
  return highestClearedCampaignStageIndex >= milestoneIndex
}
