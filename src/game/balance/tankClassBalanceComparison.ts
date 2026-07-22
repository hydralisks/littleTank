import type { PlayerClassId } from '../encounter/encounterTypes'
import type { DifficultyLabel } from './difficultyScoring'

const DIFFICULTY_ORDER: DifficultyLabel[] = [
  'trivial',
  'easy',
  'balanced',
  'hard',
  'expert',
  'near_impossible',
  'impossible',
  'invalid_data',
]

export interface TankClassTrialStageResult {
  stageId: string
  warriorBestPassRate: number
  classBestPassRate: number
  warriorDifficulty: DifficultyLabel
  classDifficulty: DifficultyLabel
}

export function compareTankClassTrialResults(input: {
  classId: PlayerClassId
  stages: readonly TankClassTrialStageResult[]
}) {
  if (input.stages.length !== 3) {
    throw new Error(`Tank class trial comparison requires exactly three stages: ${input.classId}`)
  }
  const stageResults = input.stages.map((stage) => {
    const flags: string[] = []
    if (stage.classBestPassRate < 0.05 && stage.warriorBestPassRate >= 0.15) {
      flags.push('tool_gap')
    }
    if (stage.classBestPassRate >= 0.85 && stage.warriorBestPassRate <= 0.69) {
      flags.push('strength_overflow')
    }
    const difficultyGap = Math.abs(
      DIFFICULTY_ORDER.indexOf(stage.classDifficulty) - DIFFICULTY_ORDER.indexOf(stage.warriorDifficulty),
    )
    if (difficultyGap > 1) {
      flags.push('difficulty_gap_over_one_tier')
    }
    return {
      ...stage,
      passRateDifference: stage.classBestPassRate - stage.warriorBestPassRate,
      flags,
    }
  })
  const averagePassRateDifference = stageResults.reduce(
    (total, stage) => total + stage.passRateDifference,
    0,
  ) / stageResults.length

  return {
    classId: input.classId,
    stageResults,
    averagePassRateDifference,
    averagePassRateDifferenceWithinTarget: Math.abs(averagePassRateDifference) <= 0.15,
    outperformsWarriorOnAllStages: stageResults.every((stage) => stage.passRateDifference > 0),
  }
}
