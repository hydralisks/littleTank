import { getEnemySkillDefinition } from '../data/enemyCatalog'
import type { EnemySeed } from '../encounter/encounterTypes'

export interface StaticPriorityKillTarget {
  enemyId: string
  enemyName: string
  score: number
  reason: string
}

export interface StaticPriorityInterruptTarget {
  enemyId: string
  enemyName: string
  skillId: string
  skillName: string
  score: number
  reason: string
}

type EncounterTemplateLike = {
  enemies: readonly EnemySeed[]
}

function clampScore(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

function getEnemySkillIds(enemy: Pick<EnemySeed, 'skillCycle' | 'skillIds'>) {
  return enemy.skillCycle.length > 0 ? enemy.skillCycle : enemy.skillIds
}

export function estimateEnemySkillImpact(skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return 0
  }

  const directDamage =
    skill.playerDamage +
    Math.max(skill.partyDamageOnHit, skill.partyDamageOnMiss) * 0.8 +
    Math.max(skill.pressureOnHit, skill.pressureOnMiss) * 0.35
  const statusImpact = skill.appliedTargetStatusIds.length * 12 + skill.appliedSelfStatusIds.length * 8
  const supportImpact =
    skill.targetRuleId === 'self' ||
    skill.targetRuleId === 'otherEnemy' ||
    skill.targetRuleId === 'mostInjured'
      ? 24
      : 0
  const channelImpact = skill.channelingMs > 0 ? 18 : 0
  const dangerImpact =
    skill.dangerLevel === 'high'
      ? 28
      : skill.dangerLevel === 'medium'
        ? 14
        : 4

  return directDamage + statusImpact + supportImpact + channelImpact + dangerImpact
}

export function estimateEnemyCycleThreat(enemy: Pick<EnemySeed, 'skillCycle' | 'skillIds'>) {
  const skillIds = getEnemySkillIds(enemy)
  if (skillIds.length === 0) {
    return 0
  }

  const cycleMs = skillIds.reduce((sum, skillId) => {
    const skill = getEnemySkillDefinition(skillId)
    return sum + Math.max(500, (skill?.castTimeMs ?? 0) + (skill?.channelingMs ?? 0) + (skill?.recoveryMs ?? 0))
  }, 0)
  const totalImpact = skillIds.reduce((sum, skillId) => sum + estimateEnemySkillImpact(skillId), 0)

  return cycleMs > 0 ? totalImpact / (cycleMs / 1000) : totalImpact / skillIds.length
}

function estimateEffectiveKillCost(enemy: Pick<EnemySeed, 'hp' | 'maxHp' | 'statuses'>) {
  const currentHp = Math.max(1, enemy.hp)
  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
  const injuredBonus = hpRatio <= 0.5 ? 0.72 : hpRatio <= 0.75 ? 0.86 : 1
  const defensiveStatusMultiplier = enemy.statuses.some((status) =>
    status.damageReductionRatio ||
    status.absorbRemaining ||
    /guard|shield|fortified|aegis|ward/i.test(status.effectLogicId ?? status.id),
  )
    ? 1.2
    : 1

  return currentHp * injuredBonus * defensiveStatusMultiplier
}

function buildKillReason(enemy: EnemySeed, cycleThreat: number, killCost: number) {
  const reasons = [`击杀成本 ${Math.round(killCost)}`, `平均技能威胁 ${Math.round(cycleThreat)}`]
  if (enemy.hp < enemy.maxHp) {
    reasons.push('当前已受伤，清掉它能更快降低敌方输出')
  }
  if (enemy.threatLogic === 'irregular') {
    reasons.push('irregular 仇恨会增加额外维护成本')
  }
  return reasons.join('；')
}

export function getStaticPriorityKillTargets(template: EncounterTemplateLike): StaticPriorityKillTarget[] {
  return template.enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => {
      const cycleThreat = estimateEnemyCycleThreat(enemy)
      const killCost = estimateEffectiveKillCost(enemy)
      const threatLogicBonus = enemy.threatLogic === 'irregular' ? 8 : enemy.threatLogic === 'bloodlust' ? 5 : 0
      const currentCastBonus = enemy.cast ? estimateEnemySkillImpact(enemy.cast.id) * 0.35 : 0
      const peakSkillThreat = getEnemySkillIds(enemy).reduce(
        (peak, skillId) => Math.max(peak, estimateEnemySkillImpact(skillId)),
        0,
      )
      const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
      const injuredPriorityBonus =
        hpRatio <= 0.5
          ? 16
          : hpRatio <= 0.75
            ? 8
            : 0
      const score = clampScore(
        cycleThreat * 2.1 +
        peakSkillThreat * 0.45 +
        injuredPriorityBonus +
        threatLogicBonus +
        currentCastBonus,
      )

      return {
        enemyId: enemy.id,
        enemyName: enemy.name,
        score,
        reason: buildKillReason(enemy, cycleThreat, killCost),
      }
    })
    .sort((left, right) => right.score - left.score || left.enemyId.localeCompare(right.enemyId))
}

function buildInterruptReason(skillId: string, score: number) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return `未知技能，评分 ${Math.round(score)}`
  }

  const reasons = [`可阻止伤害/压力约 ${Math.round(score)}`]
  if (skill.partyDamageOnHit > 0 || skill.partyDamageOnMiss > 0 || skill.pressureOnHit > 0 || skill.pressureOnMiss > 0) {
    reasons.push('直接降低队伍压力')
  }
  if (skill.appliedTargetStatusIds.length > 0) {
    reasons.push('避免目标负面状态并保护输出节奏')
  }
  if (skill.appliedSelfStatusIds.length > 0 || skill.targetRuleId === 'self' || skill.targetRuleId === 'otherEnemy' || skill.targetRuleId === 'mostInjured') {
    reasons.push('保护输出节奏或阻止敌方增益/治疗')
  }
  if (skill.channelingMs > 0) {
    reasons.push('引导阶段需要控制处理')
  }
  return reasons.join('；')
}

function estimateInterruptPreventionScore(enemy: Pick<EnemySeed, 'hp' | 'maxHp'>, skillId: string) {
  const skill = getEnemySkillDefinition(skillId)
  if (!skill) {
    return 0
  }

  const preventedDamage =
    skill.playerDamage +
    Math.max(skill.partyDamageOnHit, skill.partyDamageOnMiss) +
    Math.max(skill.pressureOnHit, skill.pressureOnMiss) * 0.75
  const targetStatusImpact = skill.appliedTargetStatusIds.length * 8
  const selfStatusImpact = skill.appliedSelfStatusIds.length * 6
  const supportImpact =
    skill.targetRuleId === 'self' ||
    skill.targetRuleId === 'otherEnemy' ||
    skill.targetRuleId === 'mostInjured'
      ? 10
      : 0
  const channelImpact = skill.channelingMs > 0 ? 4 : 0
  const dangerImpact =
    skill.dangerLevel === 'high'
      ? 4
      : skill.dangerLevel === 'medium'
        ? 3
        : 0
  const enemyInjuryBonus = enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= 0.5 ? 8 : 0

  return preventedDamage + targetStatusImpact + selfStatusImpact + supportImpact + channelImpact + dangerImpact + enemyInjuryBonus
}

export function getStaticPriorityInterrupts(template: EncounterTemplateLike): StaticPriorityInterruptTarget[] {
  return template.enemies
    .filter((enemy) => enemy.hp > 0)
    .flatMap((enemy) =>
      getEnemySkillIds(enemy)
        .flatMap((skillId) => {
          const skill = getEnemySkillDefinition(skillId)
          if (!skill || skill.castBreakRule === 'unstoppable') {
            return []
          }

          const score = clampScore(estimateInterruptPreventionScore(enemy, skillId))
          return [{
            enemyId: enemy.id,
            enemyName: enemy.name,
            skillId,
            skillName: skill.skillName,
            score,
            reason: buildInterruptReason(skillId, score),
          }]
        }),
    )
    .sort((left, right) => right.score - left.score || left.enemyId.localeCompare(right.enemyId) || left.skillId.localeCompare(right.skillId))
}
