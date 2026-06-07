import {
  getEnemyDefinition,
  getEnemySkillDefinition,
  type EnemySkillDefinition,
  type EnemyThreatLogic,
} from './enemyCatalog'
import { createEncounterTemplate } from './encounterTemplates'
import { getStageById, stageOrder, type StageId } from './stageTemplates'
import type { DangerLevel, EnemyCastBreakRule, EnemySkillDamageType } from '../encounter/encounterTypes'

export interface MonsterCodexSkillEntry {
  skillId: string
  name: string
  targetLabel: string
  castTimeMs: number
  channelingMs: number
  recoveryMs: number
  damageType: EnemySkillDamageType
  playerDamage: number
  partyDamageOnHit: number
  partyDamageOnMiss: number
  pressureOnHit: number
  pressureOnMiss: number
  breakRule: EnemyCastBreakRule
  breakRuleLabel: string
  dangerLevel: DangerLevel
  dangerLabel: string
  appliedStatusIds: string[]
}

export interface MonsterCodexStageEntry {
  stageId: StageId
  title: string
  areaTitle: string
  stageNumber: number
}

export interface MonsterCodexEntry {
  enemyId: string
  name: string
  baseMaxHp: number
  threatLogic: EnemyThreatLogic
  threatLogicLabel: string
  isSkull: boolean
  skillCycle: MonsterCodexSkillEntry[]
  skills: MonsterCodexSkillEntry[]
  appearsInStages: MonsterCodexStageEntry[]
  firstAppearingStage: MonsterCodexStageEntry | null
}

const THREAT_LOGIC_LABELS: Record<EnemyThreatLogic, string> = {
  normal: '普通',
  irregular: '无理',
  bloodlust: '嗜血',
}

const BREAK_RULE_LABELS: Record<EnemyCastBreakRule, string> = {
  interruptOrControl: '可打断或控制',
  controlOnly: '只能控制',
  unstoppable: '不可阻止',
}

const DANGER_LABELS: Record<DangerLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

function targetLabel(skill: EnemySkillDefinition) {
  switch (skill.targetRuleId) {
    case 'threatTarget':
      return '当前仇恨目标'
    case 'tankAndParty':
      return '坦克与队伍'
    case 'party':
      return '队伍'
    case 'otherEnemy':
      return '其他敌人'
    case 'self':
      return '自身'
    case 'mostInjured':
      return '最低生命敌人'
    default:
      return skill.targetRuleId
  }
}

function toSkillEntry(skillId: string): MonsterCodexSkillEntry | null {
  const skill = getEnemySkillDefinition(skillId)

  if (!skill) {
    return null
  }

  return {
    skillId: skill.skillId,
    name: skill.skillName,
    targetLabel: targetLabel(skill),
    castTimeMs: skill.castTimeMs,
    channelingMs: skill.channelingMs,
    recoveryMs: skill.recoveryMs,
    damageType: skill.damageType,
    playerDamage: skill.playerDamage,
    partyDamageOnHit: skill.partyDamageOnHit,
    partyDamageOnMiss: skill.partyDamageOnMiss,
    pressureOnHit: skill.pressureOnHit,
    pressureOnMiss: skill.pressureOnMiss,
    breakRule: skill.castBreakRule,
    breakRuleLabel: BREAK_RULE_LABELS[skill.castBreakRule],
    dangerLevel: skill.dangerLevel,
    dangerLabel: DANGER_LABELS[skill.dangerLevel],
    appliedStatusIds: [...skill.appliedTargetStatusIds, ...skill.appliedSelfStatusIds],
  }
}

function uniqueStrings(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

export function appendSeenEnemyDefinitionIds(
  currentIds: readonly string[],
  nextIds: readonly string[],
) {
  return uniqueStrings([...currentIds, ...nextIds])
}

export function getEnemyDefinitionIdsForStage(stageId: StageId) {
  const stage = getStageById(stageId)
  const template = createEncounterTemplate(stage)
  return uniqueStrings(template.enemies.map((enemy) => enemy.definitionId))
}

function getAppearingStages(enemyId: string): MonsterCodexStageEntry[] {
  return stageOrder.flatMap((stageId) => {
    const stage = getStageById(stageId)
    const template = createEncounterTemplate(stage)
    const appears = template.enemies.some((enemy) => enemy.definitionId === enemyId)

    return appears
      ? [{
          stageId,
          title: stage.title,
          areaTitle: stage.areaTitle,
          stageNumber: stage.stageNumber,
        }]
      : []
  })
}

export function buildMonsterCodexEntries(seenEnemyDefinitionIds: readonly string[]): MonsterCodexEntry[] {
  return uniqueStrings(seenEnemyDefinitionIds)
    .flatMap((enemyId) => {
      const enemy = getEnemyDefinition(enemyId)

      if (!enemy) {
        return []
      }

      const skills = enemy.skillIds.flatMap((skillId) => {
        const entry = toSkillEntry(skillId)
        return entry ? [entry] : []
      })
      const skillById = new Map(skills.map((skill) => [skill.skillId, skill]))
      const cycleIds = enemy.skillCycle.length > 0 ? enemy.skillCycle : enemy.skillIds
      const skillCycle = cycleIds.flatMap((skillId) => {
        const entry = skillById.get(skillId) ?? toSkillEntry(skillId)
        return entry ? [entry] : []
      })
      const appearsInStages = getAppearingStages(enemy.enemyId)

      return [{
        enemyId: enemy.enemyId,
        name: enemy.name,
        baseMaxHp: enemy.baseMaxHp,
        threatLogic: enemy.threatLogic,
        threatLogicLabel: THREAT_LOGIC_LABELS[enemy.threatLogic],
        isSkull: enemy.isSkull,
        skills,
        skillCycle,
        appearsInStages,
        firstAppearingStage: appearsInStages[0] ?? null,
      }]
    })
}
