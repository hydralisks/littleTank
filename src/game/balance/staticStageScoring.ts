import { createEncounterTemplate, getStageBuildRuleId } from '../data/encounterTemplates'
import { getEnemySkillDefinition, getEnemyStatusDefinition } from '../data/enemyCatalog'
import { getActiveSkillCatalog, getBuildRuleDefinition } from '../data/playerBuildCatalog'
import { getUnlockedActiveSkillIdsForStage } from '../data/stageTemplates'
import type { StageInfo } from '../data/stageTemplates'
import type { ActiveSkillDefinition } from '../encounter/encounterTypes'
import type { DifficultyLabel } from './difficultyScoring'
import {
  getStaticPriorityInterrupts,
  getStaticPriorityKillTargets,
} from './staticTacticalAdvice'

type EncounterTemplate = ReturnType<typeof createEncounterTemplate>
type EncounterEnemy = EncounterTemplate['enemies'][number]

export interface StaticStageDifficultyMetrics {
  enemyCount: number
  totalEnemyHp: number
  rawThreatScore: number
  unavoidablePressureScore: number
  answerablePressureScore: number
  toolMitigationScore: number
  enemySupportRisk: number
  effectiveSupportRisk: number
  executionComplexityScore: number
  adjustedThreatScore: number
  estimatedEnemyCastRisk: number
  estimatedPartyPressureRisk: number
  castDensityRisk: number
  targetComplexityRisk: number
  operationLoadRisk: number
  mechanicRisk: number
  toolCoverageScore: number
  durationPressureRisk: number
  availableActiveSkillCount: number
  playerAutoDamage: number
  playerAutoHeal: number
  partyAutoHeal: number
}

export interface StaticStageDifficultyScore {
  stageId: string
  score: number
  label: DifficultyLabel
  reasons: string[]
  priorityKillTargets: ReturnType<typeof getStaticPriorityKillTargets>
  priorityInterruptTargets: ReturnType<typeof getStaticPriorityInterrupts>
  metrics: StaticStageDifficultyMetrics
}

function clampScore(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

export function classifyStaticDifficulty(score: number): DifficultyLabel {
  if (!Number.isFinite(score)) {
    return 'invalid_data'
  }
  if (score < 15) {
    return 'trivial'
  }
  if (score < 30) {
    return 'easy'
  }
  if (score < 45) {
    return 'balanced'
  }
  if (score < 60) {
    return 'hard'
  }
  if (score < 75) {
    return 'expert'
  }
  if (score < 95) {
    return 'near_impossible'
  }
  return 'impossible'
}

function dangerMultiplier(dangerLevel: string) {
  switch (dangerLevel) {
    case 'high':
      return 1.35
    case 'medium':
      return 1.1
    default:
      return 0.85
  }
}

function breakRuleMultiplier(breakRule: string) {
  switch (breakRule) {
    case 'unstoppable':
      return 1.25
    case 'controlOnly':
      return 1.08
    default:
      return 1
  }
}

function breakRuleRealizationMultiplier(breakRule: string) {
  switch (breakRule) {
    case 'unstoppable':
      return 1
    case 'controlOnly':
      return 0.72
    default:
      return 0.58
  }
}

function targetRuleSupportRisk(targetRuleId: string) {
  switch (targetRuleId) {
    case 'party':
    case 'tankAndParty':
      return 10
    case 'otherEnemy':
    case 'self':
    case 'mostInjured':
      return 8
    default:
      return 0
  }
}

function estimateStatusSupportValue(statusId: string) {
  const status = getEnemyStatusDefinition(statusId)
  if (!status) {
    return 0
  }
  const valueA = status.valueA

  switch (status.effectLogicId) {
    case 'murlocHealing_status':
      return (valueA ?? 75) * 0.1
    case 'enemy_heal_small':
      return (valueA ?? 26) * 0.16
    case 'murlocUpgraded_status':
      return (valueA ?? 1) * 4
    case 'channel_self_until_end':
    case 'got!_status':
      return 4
    case 'run!_status':
      return 1.5
    default:
      return status.kind === 'enemyBuff' && status.effectLogicId !== 'none' ? 5 : 0
  }
}

function estimateSkillSupportRisk(skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return { raw: 0, effective: 0 }
  }

  const targetStatusSupport = skill.appliedTargetStatusIds.reduce(
    (sum, statusId) => sum + estimateStatusSupportValue(statusId),
    0,
  )
  const selfStatusSupport = skill.appliedSelfStatusIds.reduce(
    (sum, statusId) => sum + estimateStatusSupportValue(statusId),
    0,
  )
  const targetRuleSupport =
    skill.targetRuleId === 'mostInjured'
      ? 3
      : skill.targetRuleId === 'self' || skill.targetRuleId === 'otherEnemy'
        ? 1.5
        : 0
  const rawSupport = targetStatusSupport + selfStatusSupport + targetRuleSupport
  if (rawSupport <= 0) {
    return { raw: 0, effective: 0 }
  }

  const castWindowFactor = skill.castTimeMs + skill.channelingMs >= 2500 ? 0.82 : 1
  const overhealFactor = skill.targetRuleId === 'mostInjured' ? 0.55 : 1
  const effective =
    rawSupport *
    breakRuleRealizationMultiplier(skill.castBreakRule) *
    castWindowFactor *
    overhealFactor

  return { raw: rawSupport, effective }
}

function estimateSkillRisk(skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return { castRisk: 0, partyPressureRisk: 0 }
  }

  const directRisk =
    skill.playerDamage * 0.45 +
    Math.max(skill.partyDamageOnHit, skill.partyDamageOnMiss) * 0.55 +
    Math.max(skill.pressureOnHit, skill.pressureOnMiss) * 1.8
  const statusRisk = skill.appliedTargetStatusIds.length * 7 + skill.appliedSelfStatusIds.length * 5
  const channelRisk = skill.channelingMs > 0 ? 10 : 0
  const supportRisk = targetRuleSupportRisk(skill.targetRuleId)
  const castRisk =
    (directRisk + statusRisk + channelRisk + supportRisk) *
    dangerMultiplier(skill.dangerLevel) *
    breakRuleMultiplier(skill.castBreakRule)
  const partyPressureRisk =
    Math.max(skill.partyDamageOnHit, skill.partyDamageOnMiss) * 0.18 +
    Math.max(skill.pressureOnHit, skill.pressureOnMiss) * 1.15 +
    (skill.targetRuleId === 'party' || skill.targetRuleId === 'tankAndParty' ? 5 : 0)

  return { castRisk, partyPressureRisk }
}

function getAvailableActiveSkills(stage: StageInfo) {
  const buildRuleId = getStageBuildRuleId(stage)
  const rule = getBuildRuleDefinition(buildRuleId)
  const unlocked = new Set(getUnlockedActiveSkillIdsForStage(stage))
  const legalSkills = getActiveSkillCatalog()
    .filter((skill) => unlocked.has(skill.id))
    .filter((skill) => !rule?.classId || !skill.classId || skill.classId === rule.classId)
    .sort((left, right) => (left.uiOrder ?? 999) - (right.uiOrder ?? 999) || left.id.localeCompare(right.id))

  return rule ? legalSkills.slice(0, rule.maxActiveSlots) : legalSkills
}

function formatNumber(value: number) {
  return String(Math.round(value * 10) / 10)
}

function getEnemySkillIds(enemy: EncounterEnemy) {
  return enemy.skillCycle.length > 0 ? enemy.skillCycle : enemy.skillIds
}

function skillCastIntervalMs(skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return 0
  }

  return Math.max(1, skill.castTimeMs + skill.channelingMs + skill.recoveryMs)
}

function estimateCycleCastsPerMinute(enemy: EncounterEnemy) {
  const cycle = getEnemySkillIds(enemy)
  if (cycle.length === 0) {
    return 0
  }

  const cycleMs = cycle.reduce((sum, skillId) => sum + skillCastIntervalMs(skillId), 0)
  return cycleMs > 0 ? (60_000 / cycleMs) * cycle.length : 0
}

function estimateCastDensityRisk(enemies: readonly EncounterEnemy[]) {
  const castsPerMinute = enemies.reduce((sum, enemy) => sum + estimateCycleCastsPerMinute(enemy), 0)
  const dangerousCastsPerMinute = enemies.reduce((sum, enemy) => {
    const cycle = getEnemySkillIds(enemy)
    const dangerousCount = cycle.filter((skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      return skill && (
        skill.dangerLevel === 'high' ||
        skill.castBreakRule === 'controlOnly' ||
        skill.channelingMs > 0 ||
        targetRuleSupportRisk(skill.targetRuleId) > 0
      )
    }).length
    const cycleMs = cycle.reduce((innerSum, skillId) => innerSum + skillCastIntervalMs(skillId), 0)
    return sum + (cycleMs > 0 ? (60_000 / cycleMs) * dangerousCount : 0)
  }, 0)

  return castsPerMinute * 0.08 + dangerousCastsPerMinute * 0.32
}

function estimateEnemySupportRisk(enemies: readonly EncounterEnemy[]) {
  return enemies.reduce(
    (sum, enemy) => {
      const cycle = getEnemySkillIds(enemy)
      if (cycle.length === 0) {
        return sum
      }

      const cycleMs = cycle.reduce((innerSum, skillId) => innerSum + skillCastIntervalMs(skillId), 0)
      if (cycleMs <= 0) {
        return sum
      }

      const supportPerCycle = cycle.reduce(
        (innerSum, skillId) => {
          const support = estimateSkillSupportRisk(skillId)
          return {
            raw: innerSum.raw + support.raw,
            effective: innerSum.effective + support.effective,
          }
        },
        { raw: 0, effective: 0 },
      )
      const castsPerMinuteFactor = Math.min(2.4, 60_000 / cycleMs)
      return {
        raw: sum.raw + supportPerCycle.raw * castsPerMinuteFactor,
        effective: sum.effective + supportPerCycle.effective * castsPerMinuteFactor,
      }
    },
    { raw: 0, effective: 0 },
  )
}

function estimateTargetComplexityRisk(enemies: readonly EncounterEnemy[]) {
  const distinctEnemyTypes = new Set(enemies.map((enemy) => enemy.definitionId)).size
  const distinctRows = new Set(enemies.map((enemy) => enemy.row)).size
  const distinctCols = new Set(enemies.map((enemy) => enemy.col)).size
  const irregularCount = enemies.filter((enemy) => enemy.threatLogic === 'irregular').length
  const bloodlustCount = enemies.filter((enemy) => enemy.threatLogic === 'bloodlust').length
  const skillDiversity = new Set(enemies.flatMap(getEnemySkillIds)).size
  const spreadRisk = Math.max(0, distinctRows - 1) * 2 + Math.max(0, distinctCols - 2) * 1.2

  return (
    Math.max(0, enemies.length - 1) * 3.2 +
    Math.max(0, distinctEnemyTypes - 1) * 3.6 +
    Math.max(0, skillDiversity - 2) * 1.8 +
    irregularCount * 5.5 +
    bloodlustCount * 3.5 +
    spreadRisk
  )
}

function estimateMechanicRisk(enemies: readonly EncounterEnemy[], template: EncounterTemplate) {
  const skills = enemies
    .flatMap(getEnemySkillIds)
    .flatMap((skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      return skill ? [skill] : []
    })
  const targetRuleRisk = skills.reduce((sum, skill) => sum + targetRuleSupportRisk(skill.targetRuleId), 0)
  const channelRisk = skills.filter((skill) => skill.channelingMs > 0).length * 7
  const statusRisk = skills.reduce(
    (sum, skill) => sum + skill.appliedTargetStatusIds.length * 3.5 + skill.appliedSelfStatusIds.length * 4,
    0,
  )
  const unanswerableRisk = skills.filter((skill) => skill.castBreakRule === 'unstoppable' && skill.dangerLevel !== 'low').length * 5
  const openingStatusRisk =
    template.playerDebuffs.length * 6 +
    template.partyStatuses.length * 6 +
    template.enemies.reduce((sum, enemy) => sum + enemy.statuses.filter((status) => status.effectLogicId).length * 4, 0)
  const specialRuleRisk = template.stage.specialRules.length * 5 + template.stage.affixes.length * 3

  return targetRuleRisk * 0.35 + channelRisk + statusRisk + unanswerableRisk + openingStatusRisk + specialRuleRisk
}

function estimateOperationLoadRisk(
  enemies: readonly EncounterEnemy[],
  availableSkills: readonly ActiveSkillDefinition[],
  estimatedCastRisk: number,
) {
  const stopSkillCount = availableSkills.filter((skill) => skill.castStopMode === 'interrupt' || skill.castStopMode === 'control').length
  const defensiveSkillCount = availableSkills.filter((skill) =>
    ['shield_wall', 'ignore_pain', 'shield_block', 'intervene', 'rallying_cry', 'demoralizing_shout'].includes(skill.skillLogicId) ||
    skill.targetingType === 'self' ||
    skill.grantedStatusIds.length > 0,
  ).length
  const highRiskSkillCount = enemies.reduce((sum, enemy) => {
    return sum + getEnemySkillIds(enemy).filter((skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      return skill && (skill.dangerLevel === 'high' || skill.channelingMs > 0 || targetRuleSupportRisk(skill.targetRuleId) > 0)
    }).length
  }, 0)
  const stopBurden = Math.max(0, highRiskSkillCount - stopSkillCount) * 5
  const multitaskBurden = Math.max(0, enemies.length - 2) * 7 + Math.max(0, availableSkills.length - 3) * 2
  const defenseBurden = estimatedCastRisk >= 28 && defensiveSkillCount === 0 ? 8 : 0

  return stopBurden + multitaskBurden + defenseBurden + estimatedCastRisk * 0.18
}

function estimateToolCoverageScore(availableSkills: readonly ActiveSkillDefinition[], template: EncounterTemplate) {
  const hasInterrupt = availableSkills.some((skill) => skill.castStopMode === 'interrupt')
  const hasControl = availableSkills.some((skill) => skill.castStopMode === 'control')
  const hasTaunt = availableSkills.some((skill) => /taunt/i.test(skill.skillLogicId) || skill.skillLogicId === 'mass_taunt')
  const hasDefense = availableSkills.some((skill) =>
    ['shield_wall', 'ignore_pain', 'shield_block', 'intervene', 'rallying_cry', 'demoralizing_shout'].includes(skill.skillLogicId) ||
    skill.targetingType === 'self',
  )
  const hasMultiTarget = availableSkills.some((skill) =>
    skill.targetingType === 'allEnemy' ||
    skill.targetingType.includes('cross') ||
    skill.targetingType.includes('matrix') ||
    skill.targetingType.includes('2x2'),
  )
  const needsInterrupt = template.enemies.some((enemy) =>
    getEnemySkillIds(enemy).some((skillId) => getEnemySkillDefinition(skillId)?.castBreakRule === 'interruptOrControl'),
  )
  const needsControl = template.enemies.some((enemy) =>
    getEnemySkillIds(enemy).some((skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      return skill?.castBreakRule === 'controlOnly' || (skill?.channelingMs ?? 0) > 0
    }),
  )
  const needsThreat = template.enemies.some((enemy) => enemy.threatLogic === 'irregular' || enemy.threatState !== 'safe')
  const needsMultiTarget = template.enemies.length >= 4
  const needsDefense = template.enemies.some((enemy) =>
    getEnemySkillIds(enemy).some((skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      return skill && skill.playerDamage >= 30
    }),
  )
  let coverage =
    availableSkills.length * 2.2 +
    template.stage.playerAutoDamage * 0.7 +
    template.stage.playerAutoHeal * 0.6 +
    template.stage.partyAutoHeal * 0.5

  if (hasTaunt && needsThreat) coverage += 7
  if (hasInterrupt && needsInterrupt) coverage += 8
  if (hasControl && needsControl) coverage += 8
  if (hasDefense && needsDefense) coverage += 7
  if (hasMultiTarget && needsMultiTarget) coverage += 5

  if (needsInterrupt && !hasInterrupt) coverage -= 8
  if (needsControl && !hasControl) coverage -= 8
  if (needsDefense && !hasDefense) coverage -= 6
  if (needsThreat && !hasTaunt) coverage -= 8

  return coverage
}

function estimateDurationPressureRisk(template: EncounterTemplate, totalEnemyHp: number) {
  const partyAverageDamage =
    template.stage.partyAutoDamageIntervalMs > 0
      ? ((template.stage.partyAutoDamageMin + template.stage.partyAutoDamageMax) / 2) *
        template.stage.partyAutoDamageTargetCount *
        (1000 / template.stage.partyAutoDamageIntervalMs)
      : 0
  const expectedDps = Math.max(1, template.stage.playerAutoDamage + partyAverageDamage)
  const estimatedDurationSeconds = totalEnemyHp / expectedDps
  const ambientPressure = estimatedDurationSeconds * template.stage.tuning.ambientPressurePerSecond
  const longFightRisk = Math.max(0, estimatedDurationSeconds - 35) * 0.65

  return ambientPressure * 0.22 + longFightRisk
}

export function scoreStageStaticDifficulty(
  stage: StageInfo,
  template: EncounterTemplate = createEncounterTemplate(stage),
): StaticStageDifficultyScore {
  const enemyCount = template.enemies.length
  const totalEnemyHp = template.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0)
  const enemySkillRisks = template.enemies.flatMap((enemy) => getEnemySkillIds(enemy).map(estimateSkillRisk))
  const estimatedEnemyCastRisk =
    enemySkillRisks.reduce((sum, risk) => sum + risk.castRisk, 0) / Math.max(1, enemySkillRisks.length)
  const estimatedPartyPressureRisk =
    template.stage.tuning.ambientPressurePerSecond * 6 +
    enemySkillRisks.reduce((sum, risk) => sum + risk.partyPressureRisk, 0) / Math.max(1, enemySkillRisks.length)
  const availableActiveSkills = getAvailableActiveSkills(stage)
  const availableActiveSkillCount = availableActiveSkills.length
  const playerAutoDamage = template.stage.playerAutoDamage
  const playerAutoHeal = template.stage.playerAutoHeal
  const partyAutoHeal = template.stage.partyAutoHeal
  const castDensityRisk = estimateCastDensityRisk(template.enemies)
  const targetComplexityRisk = estimateTargetComplexityRisk(template.enemies)
  const mechanicRisk = estimateMechanicRisk(template.enemies, template)
  const operationLoadRisk = estimateOperationLoadRisk(template.enemies, availableActiveSkills, estimatedEnemyCastRisk)
  const toolCoverageScore = estimateToolCoverageScore(availableActiveSkills, template)
  const durationPressureRisk = estimateDurationPressureRisk(template, totalEnemyHp)
  const supportRisk = estimateEnemySupportRisk(template.enemies)
  const enemySupportRisk = supportRisk.raw
  const effectiveSupportRisk = supportRisk.effective
  const priorityKillTargets = getStaticPriorityKillTargets(template)
  const priorityInterruptTargets = getStaticPriorityInterrupts(template)
  const enemyBodyScore = enemyCount * 2.6 + totalEnemyHp / 76
  const castScore = estimatedEnemyCastRisk / 3 + castDensityRisk * 0.45
  const pressureScore = estimatedPartyPressureRisk / 2.7 + durationPressureRisk * 0.55
  const structureScore = targetComplexityRisk * 0.55 + operationLoadRisk * 0.55 + mechanicRisk * 0.3
  const limitedBuildRisk = availableActiveSkillCount <= 2 && totalEnemyHp >= 220 ? 10 : 0
  const earlyTutorialRelief = availableActiveSkillCount <= 2 && enemyCount <= 2 && totalEnemyHp < 220 ? 5 : 0
  const highHpMultiTargetRisk = enemyCount >= 4 && totalEnemyHp >= 500 ? 4 : 0
  const crowdedFightRelief = enemyCount >= 4 && availableActiveSkillCount >= 4 && toolCoverageScore >= 35 ? 4 : 0
  const lateMechanicRisk =
    stage.stageNumber >= 6 && enemyCount >= 4 && totalEnemyHp >= 580 && mechanicRisk >= 35 ? 16 : 0
  const rawThreatScore =
    enemyBodyScore +
    castScore +
    pressureScore +
    structureScore
  const unavoidableCastScore = template.enemies.reduce((sum, enemy) => {
    return sum + getEnemySkillIds(enemy).reduce((innerSum, skillId) => {
      const skill = getEnemySkillDefinition(skillId)
      if (!skill || skill.castBreakRule !== 'unstoppable') {
        return innerSum
      }

      const risk = estimateSkillRisk(skillId)
      return innerSum + risk.castRisk * 0.08
    }, 0)
  }, 0)
  const unavoidablePressureScore =
    durationPressureRisk * 0.35 +
    estimatedPartyPressureRisk * 0.35 +
    unavoidableCastScore
  const answerablePressureScore =
    enemyBodyScore * 0.12 +
    castScore * 0.72 +
    pressureScore * 0.45 +
    mechanicRisk * 0.22
  const toolMitigationScore = Math.max(0, toolCoverageScore * 1.2)
  const executionComplexityScore =
    targetComplexityRisk * 0.16 +
    operationLoadRisk * 0.18 +
    castDensityRisk * 0.12
  const answerableAfterMitigation = Math.max(0, answerablePressureScore - toolMitigationScore)
  const recoveryReliefFactor = Math.max(0.25, 1 - playerAutoHeal * 0.25 - partyAutoHeal * 0.2)
  const effectiveExecutionScore = executionComplexityScore * 1.4 * recoveryReliefFactor
  const attritionComplexityScore =
    (targetComplexityRisk * 0.3 + Math.max(0, totalEnemyHp - 400) * 0.018) *
    recoveryReliefFactor
  const effectiveSupportScore =
    effectiveSupportRisk * 0.14 +
    Math.max(0, effectiveSupportRisk - 25) * 0.58
  const score = clampScore(
    unavoidablePressureScore +
    answerableAfterMitigation +
    effectiveSupportScore +
    effectiveExecutionScore +
    attritionComplexityScore +
    limitedBuildRisk +
    highHpMultiTargetRisk +
    lateMechanicRisk -
    earlyTutorialRelief -
    crowdedFightRelief,
  )
  const metrics: StaticStageDifficultyMetrics = {
    enemyCount,
    totalEnemyHp,
    rawThreatScore: clampScore(rawThreatScore),
    unavoidablePressureScore: clampScore(unavoidablePressureScore),
    answerablePressureScore: clampScore(answerablePressureScore),
    toolMitigationScore: clampScore(toolMitigationScore),
    enemySupportRisk: clampScore(enemySupportRisk),
    effectiveSupportRisk: clampScore(effectiveSupportRisk),
    executionComplexityScore: clampScore(executionComplexityScore),
    adjustedThreatScore: score,
    estimatedEnemyCastRisk: clampScore(estimatedEnemyCastRisk),
    estimatedPartyPressureRisk: clampScore(estimatedPartyPressureRisk),
    castDensityRisk: clampScore(castDensityRisk),
    targetComplexityRisk: clampScore(targetComplexityRisk),
    operationLoadRisk: clampScore(operationLoadRisk),
    mechanicRisk: clampScore(mechanicRisk),
    toolCoverageScore: clampScore(toolCoverageScore),
    durationPressureRisk: clampScore(durationPressureRisk),
    availableActiveSkillCount,
    playerAutoDamage,
    playerAutoHeal,
    partyAutoHeal,
  }

  return {
    stageId: stage.id,
    score,
    label: classifyStaticDifficulty(score),
    metrics,
    priorityKillTargets,
    priorityInterruptTargets,
    reasons: [
      `敌人规模：${enemyCount} 名敌人，总生命值 ${Math.round(totalEnemyHp)}`,
      `静态V3：原始威胁 ${formatNumber(metrics.rawThreatScore)}，不可处理压力 ${formatNumber(metrics.unavoidablePressureScore)}，可处理压力 ${formatNumber(metrics.answerablePressureScore)}，工具抵消 ${formatNumber(metrics.toolMitigationScore)}，表面支援 ${formatNumber(metrics.enemySupportRisk)}，有效支援 ${formatNumber(metrics.effectiveSupportRisk)}，执行复杂度 ${formatNumber(metrics.executionComplexityScore)}，折算后 ${formatNumber(metrics.adjustedThreatScore)}`,
      `读条风险：平均 ${formatNumber(metrics.estimatedEnemyCastRisk)}，密度 ${formatNumber(metrics.castDensityRisk)}`,
      `目标与操作复杂度：目标结构 ${formatNumber(metrics.targetComplexityRisk)}，操作负载 ${formatNumber(metrics.operationLoadRisk)}，机制风险 ${formatNumber(metrics.mechanicRisk)}`,
      `队伍压力风险：${formatNumber(metrics.estimatedPartyPressureRisk)}，长线压力 ${formatNumber(metrics.durationPressureRisk)}`,
      `玩家工具覆盖：${availableActiveSkillCount} 个主动技能，工具覆盖分 ${formatNumber(metrics.toolCoverageScore)}，自动攻击 ${playerAutoDamage}/秒，玩家治疗 ${playerAutoHeal}/秒，队伍治疗 ${partyAutoHeal}/秒`,
    ],
  }
}
