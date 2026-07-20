import type {
  DangerLevel,
  EnemyCastBreakRule,
  EnemySkillDamageType,
  StatusKind,
} from '../encounter/encounterTypes'
import type { EnemySkillTargetRuleId, EnemyThreatLogic } from '../data/enemyCatalog'

export interface MonsterEstimateSkillInput {
  skillId: string
  skillName: string
  targetRuleId: EnemySkillTargetRuleId
  castTimeMs: number
  channelingMs: number
  recoveryMs: number
  damageType: EnemySkillDamageType
  playerDamage: number
  partyDamageOnHit: number
  partyDamageOnMiss: number
  pressureOnHit: number
  pressureOnMiss: number
  appliedTargetStatusIds: string[]
  appliedSelfStatusIds: string[]
  castBreakRule: EnemyCastBreakRule
  dangerLevel: DangerLevel
}

export interface MonsterEstimateEnemyInput {
  enemyId: string
  name: string
  maxHp: number
  threatLogic: EnemyThreatLogic
  isSkull: boolean
  skills: MonsterEstimateSkillInput[]
  skillCycle: string[]
}

export interface MonsterEstimateStageInput {
  stageId: string
  title: string
  enemies: MonsterEstimateEnemyInput[]
}

export interface MonsterEstimateStatusInput {
  statusId: string
  statusName: string
  durationMs: number
  effectLogicId: string
  kind: Exclude<StatusKind, 'neutral'>
  valueA?: number
  valueB?: number
  tickIntervalMs?: number
}

export interface MonsterStatusCoverageEstimate {
  statusId: string
  statusName: string
  kind: string
  effectLogicId: string
  expectedCoverage: number
  applicationsPerSec: number
}

export interface MonsterSkillEstimate {
  skillId: string
  skillName: string
  castsPerSec: number
  targetRuleId: EnemySkillTargetRuleId
  damageType: EnemySkillDamageType
  dangerLevel: DangerLevel
  castBreakRule: EnemyCastBreakRule
}

export interface MonsterCodexEstimateRow {
  enemyId: string
  name: string
  appearances: number
  stageIds: string[]
  averageMaxHp: number
  threatLogic: EnemyThreatLogic
  isSkull: boolean
  expectedTankDamagePerSec: number
  expectedPartyDamagePerSec: number
  expectedPressurePerSec: number
  expectedHealingPerSec: number
  expectedAbsorbPerSec: number
  requiredThreatPerSec: number
  interruptibleCastsPerSec: number
  controlOnlyCastsPerSec: number
  highDangerCastsPerSec: number
  statusCoverages: MonsterStatusCoverageEstimate[]
  skills: MonsterSkillEstimate[]
}

export interface MonsterCodexEstimateReport {
  generatedAt: string
  title: string
  monsters: MonsterCodexEstimateRow[]
}

export interface BuildMonsterCodexEstimateReportInput {
  generatedAt: string
  title: string
  templates: readonly MonsterEstimateStageInput[]
  statusDefinitions: Record<string, MonsterEstimateStatusInput | undefined>
}

interface MonsterAccumulator {
  enemyId: string
  name: string
  appearances: number
  stageIds: Set<string>
  maxHpTotal: number
  threatLogic: EnemyThreatLogic
  isSkull: boolean
  tankDamagePerSecTotal: number
  partyDamagePerSecTotal: number
  pressurePerSecTotal: number
  healingPerSecTotal: number
  absorbPerSecTotal: number
  requiredThreatPerSecTotal: number
  interruptibleCastsPerSecTotal: number
  controlOnlyCastsPerSecTotal: number
  highDangerCastsPerSecTotal: number
  statusApplicationsPerSec: Map<string, {
    status: MonsterEstimateStatusInput
    applicationsPerSec: number
  }>
  skillCastsPerSec: Map<string, {
    skill: MonsterEstimateSkillInput
    castsPerSec: number
  }>
}

const MIN_SKILL_SECONDS = 0.5

function roundMetric(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? roundMetric(value).toFixed(2) : '0.00'
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function skillDurationSec(skill: MonsterEstimateSkillInput) {
  return Math.max(
    MIN_SKILL_SECONDS,
    (Math.max(0, skill.castTimeMs) + Math.max(0, skill.channelingMs) + Math.max(0, skill.recoveryMs)) / 1000,
  )
}

function statusOutputAmount(status: MonsterEstimateStatusInput | undefined, output: 'healing' | 'absorb') {
  if (!status) {
    return 0
  }

  const durationSec = Math.max(0, status.durationMs / 1000)
  const tickSec = Math.max(0.001, (status.tickIntervalMs ?? 1000) / 1000)
  const tickCount = durationSec > 0 ? Math.floor(durationSec / tickSec) : 1
  const logic = status.effectLogicId.toLowerCase()
  const id = status.statusId.toLowerCase()

  if (output === 'healing') {
    if (logic.includes('healing') || logic.includes('heal') || id.includes('healing') || id.includes('potion')) {
      if (typeof status.valueB === 'number' && status.tickIntervalMs) {
        return status.valueB * tickCount
      }
      return status.valueA ?? 0
    }
    if (id.includes('regen_mist')) {
      return (status.valueA ?? 0) * tickCount
    }
  }

  if (output === 'absorb') {
    if (logic.includes('shelled') || logic.includes('absorb') || id.includes('shield') || id.includes('barrier')) {
      return status.valueA ?? 0
    }
  }

  return 0
}

function addStatusApplication(
  accumulator: MonsterAccumulator,
  status: MonsterEstimateStatusInput | undefined,
  applicationsPerSec: number,
) {
  if (!status || applicationsPerSec <= 0) {
    return
  }

  const current = accumulator.statusApplicationsPerSec.get(status.statusId)
  accumulator.statusApplicationsPerSec.set(status.statusId, {
    status,
    applicationsPerSec: (current?.applicationsPerSec ?? 0) + applicationsPerSec,
  })
}

function addSkillCast(accumulator: MonsterAccumulator, skill: MonsterEstimateSkillInput, castsPerSec: number) {
  const current = accumulator.skillCastsPerSec.get(skill.skillId)
  accumulator.skillCastsPerSec.set(skill.skillId, {
    skill,
    castsPerSec: (current?.castsPerSec ?? 0) + castsPerSec,
  })
}

function createAccumulator(enemy: MonsterEstimateEnemyInput): MonsterAccumulator {
  return {
    enemyId: enemy.enemyId,
    name: enemy.name,
    appearances: 0,
    stageIds: new Set(),
    maxHpTotal: 0,
    threatLogic: enemy.threatLogic,
    isSkull: enemy.isSkull,
    tankDamagePerSecTotal: 0,
    partyDamagePerSecTotal: 0,
    pressurePerSecTotal: 0,
    healingPerSecTotal: 0,
    absorbPerSecTotal: 0,
    requiredThreatPerSecTotal: 0,
    interruptibleCastsPerSecTotal: 0,
    controlOnlyCastsPerSecTotal: 0,
    highDangerCastsPerSecTotal: 0,
    statusApplicationsPerSec: new Map(),
    skillCastsPerSec: new Map(),
  }
}

function getCycleSkills(enemy: MonsterEstimateEnemyInput) {
  const skillById = new Map(enemy.skills.map((skill) => [skill.skillId, skill]))
  const cycleSkills = enemy.skillCycle.map((skillId) => skillById.get(skillId)).filter(Boolean) as MonsterEstimateSkillInput[]
  return cycleSkills.length > 0 ? cycleSkills : enemy.skills
}

function addEnemySample(
  accumulator: MonsterAccumulator,
  stage: MonsterEstimateStageInput,
  enemy: MonsterEstimateEnemyInput,
  statusDefinitions: Record<string, MonsterEstimateStatusInput | undefined>,
) {
  const cycleSkills = getCycleSkills(enemy)
  const cycleDurationSec = Math.max(
    MIN_SKILL_SECONDS,
    cycleSkills.reduce((sum, skill) => sum + skillDurationSec(skill), 0),
  )

  accumulator.appearances += 1
  accumulator.stageIds.add(stage.stageId)
  accumulator.maxHpTotal += enemy.maxHp

  for (const skill of cycleSkills) {
    const castsPerSec = 1 / cycleDurationSec
    const tankDamage = skill.targetRuleId === 'threatTarget' || skill.targetRuleId === 'tankAndParty'
      ? skill.playerDamage
      : 0
    const partyDamage = skill.targetRuleId === 'party' || skill.targetRuleId === 'tankAndParty'
      ? skill.partyDamageOnHit
      : 0
    const pressure = skill.targetRuleId === 'party' || skill.targetRuleId === 'tankAndParty'
      ? skill.pressureOnHit
      : 0

    accumulator.tankDamagePerSecTotal += tankDamage * castsPerSec
    accumulator.partyDamagePerSecTotal += partyDamage * castsPerSec
    accumulator.pressurePerSecTotal += pressure * castsPerSec
    accumulator.requiredThreatPerSecTotal += skill.targetRuleId === 'threatTarget'
      ? Math.max(0, skill.playerDamage) * castsPerSec
      : 0
    accumulator.interruptibleCastsPerSecTotal += skill.castBreakRule === 'interruptOrControl' ? castsPerSec : 0
    accumulator.controlOnlyCastsPerSecTotal += skill.castBreakRule === 'controlOnly' ? castsPerSec : 0
    accumulator.highDangerCastsPerSecTotal += skill.dangerLevel === 'high' ? castsPerSec : 0

    addSkillCast(accumulator, skill, castsPerSec)

    for (const statusId of [...skill.appliedTargetStatusIds, ...skill.appliedSelfStatusIds]) {
      const status = statusDefinitions[statusId]
      accumulator.healingPerSecTotal += statusOutputAmount(status, 'healing') * castsPerSec
      accumulator.absorbPerSecTotal += statusOutputAmount(status, 'absorb') * castsPerSec
      addStatusApplication(accumulator, status, castsPerSec)
    }
  }
}

function finalizeAccumulator(accumulator: MonsterAccumulator): MonsterCodexEstimateRow {
  const divisor = Math.max(1, accumulator.appearances)
  return {
    enemyId: accumulator.enemyId,
    name: accumulator.name,
    appearances: accumulator.appearances,
    stageIds: [...accumulator.stageIds].sort(),
    averageMaxHp: roundMetric(accumulator.maxHpTotal / divisor),
    threatLogic: accumulator.threatLogic,
    isSkull: accumulator.isSkull,
    expectedTankDamagePerSec: roundMetric(accumulator.tankDamagePerSecTotal / divisor),
    expectedPartyDamagePerSec: roundMetric(accumulator.partyDamagePerSecTotal / divisor),
    expectedPressurePerSec: roundMetric(accumulator.pressurePerSecTotal / divisor),
    expectedHealingPerSec: roundMetric(accumulator.healingPerSecTotal / divisor),
    expectedAbsorbPerSec: roundMetric(accumulator.absorbPerSecTotal / divisor),
    requiredThreatPerSec: roundMetric(accumulator.requiredThreatPerSecTotal / divisor),
    interruptibleCastsPerSec: roundMetric(accumulator.interruptibleCastsPerSecTotal / divisor),
    controlOnlyCastsPerSec: roundMetric(accumulator.controlOnlyCastsPerSecTotal / divisor),
    highDangerCastsPerSec: roundMetric(accumulator.highDangerCastsPerSecTotal / divisor),
    statusCoverages: [...accumulator.statusApplicationsPerSec.values()]
      .map(({ status, applicationsPerSec }) => ({
        statusId: status.statusId,
        statusName: status.statusName,
        kind: status.kind,
        effectLogicId: status.effectLogicId,
        applicationsPerSec: roundMetric(applicationsPerSec / divisor),
        expectedCoverage: roundMetric(Math.min(1, (applicationsPerSec / divisor) * Math.max(0, status.durationMs / 1000))),
      }))
      .sort((left, right) => right.expectedCoverage - left.expectedCoverage || left.statusId.localeCompare(right.statusId)),
    skills: [...accumulator.skillCastsPerSec.values()]
      .map(({ skill, castsPerSec }) => ({
        skillId: skill.skillId,
        skillName: skill.skillName,
        castsPerSec: roundMetric(castsPerSec / divisor),
        targetRuleId: skill.targetRuleId,
        damageType: skill.damageType,
        dangerLevel: skill.dangerLevel,
        castBreakRule: skill.castBreakRule,
      }))
      .sort((left, right) => right.castsPerSec - left.castsPerSec || left.skillId.localeCompare(right.skillId)),
  }
}

export function buildMonsterCodexEstimateReport(
  input: BuildMonsterCodexEstimateReportInput,
): MonsterCodexEstimateReport {
  const accumulators = new Map<string, MonsterAccumulator>()

  for (const stage of input.templates) {
    for (const enemy of stage.enemies) {
      const accumulator = accumulators.get(enemy.enemyId) ?? createAccumulator(enemy)
      accumulators.set(enemy.enemyId, accumulator)
      addEnemySample(accumulator, stage, enemy, input.statusDefinitions)
    }
  }

  return {
    generatedAt: input.generatedAt,
    title: input.title,
    monsters: [...accumulators.values()]
      .map(finalizeAccumulator)
      .sort((left, right) =>
        right.expectedTankDamagePerSec + right.expectedPartyDamagePerSec + right.expectedPressurePerSec -
          (left.expectedTankDamagePerSec + left.expectedPartyDamagePerSec + left.expectedPressurePerSec) ||
        left.enemyId.localeCompare(right.enemyId),
      ),
  }
}

function renderStatusSummary(row: MonsterCodexEstimateRow) {
  if (row.statusCoverages.length === 0) {
    return '-'
  }

  return row.statusCoverages
    .slice(0, 4)
    .map((status) => `${status.statusName}(${formatPercent(status.expectedCoverage)})`)
    .join('、')
}

function renderSkillSummary(row: MonsterCodexEstimateRow) {
  if (row.skills.length === 0) {
    return '-'
  }

  return row.skills
    .slice(0, 5)
    .map((skill) => `${skill.skillName}:${formatNumber(skill.castsPerSec)}/s`)
    .join('、')
}

export function renderMonsterCodexEstimateMarkdown(report: MonsterCodexEstimateReport) {
  const lines = [
    `# ${report.title}`,
    '',
    `生成时间：${report.generatedAt}`,
    '',
    '本报告按怪物模板聚合，不按单个关卡聚合。数值来自敌人技能循环的期望估算，用于怪物图鉴、策划表检查和关卡组合预评估；它不包含玩家打断、控制、减伤、击杀顺序造成的实际战斗偏移。',
    '',
    '## 字段说明',
    '',
    '| 字段 | 含义 | 为什么重要 |',
    '| --- | --- | --- |',
    '| expectedTankDamagePerSec | 怪物技能循环在命中坦克时的期望坦克承伤/秒 | 判断坦克生存压力和减伤覆盖需求 |',
    '| expectedPartyDamagePerSec | 怪物对队伍生命造成的期望伤害/秒 | 判断非坦克救火和团队血线压力 |',
    '| expectedPressurePerSec | 怪物对队伍压力条造成的期望压力/秒 | 判断漏怪、点名和团队失败风险 |',
    '| expectedHealingPerSec | 怪物通过技能或状态产生的期望治疗/秒 | 判断是否需要优先击杀或打断治疗者 |',
    '| expectedAbsorbPerSec | 怪物通过护盾类状态产生的期望吸收/秒 | 判断是否会拖慢击杀节奏 |',
    '| requiredThreatPerSec | 若想让威胁目标技能持续打坦克，坦克需要覆盖的近似仇恨/秒 | 判断起手接怪和嘲讽技能压力 |',
    '| interruptibleCastsPerSec | 可打断或控制的施法频率 | 判断打断资源需求 |',
    '| controlOnlyCastsPerSec | 只能控制处理的施法频率 | 判断眩晕、群控等控制资源需求 |',
    '| highDangerCastsPerSec | 高危险技能频率 | 判断该怪物是否应成为优先处理目标 |',
    '| 状态覆盖 | 按技能循环估算状态期望覆盖率 | 判断流血、护盾、强化等特殊机制的长期存在感 |',
    '',
    '## 怪物汇总',
    '',
    '| 怪物 | 出现 | 关卡 | 平均生命 | 仇恨逻辑 | 坦克伤害/s | 队伍伤害/s | 压力/s | 治疗/s | 吸收/s | 需求仇恨/s | 可打断/s | 仅控制/s | 高危/s | 状态覆盖 | 技能循环频率 |',
    '| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...report.monsters.map((row) =>
      `| ${row.name} (\`${row.enemyId}\`) | ${row.appearances} | ${row.stageIds.map((id) => `\`${id}\``).join(', ')} | ${formatNumber(row.averageMaxHp)} | \`${row.threatLogic}\`${row.isSkull ? ' / elite' : ''} | ${formatNumber(row.expectedTankDamagePerSec)} | ${formatNumber(row.expectedPartyDamagePerSec)} | ${formatNumber(row.expectedPressurePerSec)} | ${formatNumber(row.expectedHealingPerSec)} | ${formatNumber(row.expectedAbsorbPerSec)} | ${formatNumber(row.requiredThreatPerSec)} | ${formatNumber(row.interruptibleCastsPerSec)} | ${formatNumber(row.controlOnlyCastsPerSec)} | ${formatNumber(row.highDangerCastsPerSec)} | ${renderStatusSummary(row)} | ${renderSkillSummary(row)} |`,
    ),
    '',
  ]

  return `${lines.join('\n').trimEnd()}\n`
}
