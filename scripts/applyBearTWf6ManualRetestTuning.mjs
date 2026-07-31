import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataRoot = path.join(projectRoot, 'public', 'designer-data')
const playerBuildPath = path.join(designerDataRoot, 'player_build.xlsx')
const stageContentPath = path.join(designerDataRoot, 'stage_content.xlsx')
const challengeStageContentPath = path.join(designerDataRoot, 'challenge_stage_content.xlsx')

const playerBuild = readDesignerWorkbook(playerBuildPath)
const stageContent = readDesignerWorkbook(stageContentPath)
const challengeStageContent = readDesignerWorkbook(challengeStageContentPath)

const BEAR_SKILLS = [
  'druid_bear_t_growl',
  'druid_bear_t_mangle',
  'druid_bear_t_thrash',
  'druid_bear_t_skull_bash',
  'druid_bear_t_ironfur',
  'druid_bear_t_frenzied_regeneration',
  'druid_bear_t_swipe',
  'druid_bear_t_moonfire',
  'druid_bear_t_barkskin',
  'druid_bear_t_rage_of_the_sleeper',
  'druid_bear_t_lunar_beam',
  'druid_bear_t_incarnation_ursoc',
  'druid_bear_t_survival_instincts',
  'druid_bear_t_regrowth',
  'druid_bear_t_berserk',
  'druid_bear_t_roar',
]

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(workbook, workbookName, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing ${workbookName}.${sheetName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { workbookName, sheetName, sheet, range, columns }
}

function findUniqueRow(table, keyHeader, keyValue) {
  const col = table.columns.get(keyHeader)
  if (col === undefined) throw new Error(`Missing ${table.workbookName}.${table.sheetName}.${keyHeader}`)
  const matches = []
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (String(readCell(table.sheet, row, col)) === keyValue) matches.push(row)
  }
  if (matches.length !== 1) {
    throw new Error(`Expected one ${table.sheetName}.${keyHeader} row for ${keyValue}, found ${matches.length}`)
  }
  return matches[0]
}

function writeCell(table, row, header, value) {
  const col = table.columns.get(header)
  if (col === undefined) throw new Error(`Missing ${table.workbookName}.${table.sheetName}.${header}`)
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'boolean' ? 'b' : typeof value === 'number' ? 'n' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

function updateRow(table, keyHeader, keyValue, values) {
  const row = findUniqueRow(table, keyHeader, keyValue)
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
}

function parseCsv(value) {
  return String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
}

const activeSkills = getTable(playerBuild, 'player_build.xlsx', '主动技能定义')
const activeEffects = getTable(playerBuild, 'player_build.xlsx', '主动技能效果')
const activeStatuses = getTable(playerBuild, 'player_build.xlsx', '玩家主动状态定义')
const talents = getTable(playerBuild, 'player_build.xlsx', '被动天赋定义')
const talentEffects = getTable(playerBuild, 'player_build.xlsx', '被动天赋效果')

updateRow(activeSkills, 'skillId', 'druid_bear_t_ironfur', {
  resourceCost: 20,
  description: '消耗20点怒气叠加物理伤害减免，默认每层20%且最多3层。',
})
updateRow(activeEffects, 'skillEffectId', 'druid_bear_t_ironfur_main', {
  valueA: 20,
  notes: '默认每层20%物理伤害减免，最多3层。',
})
updateRow(activeStatuses, 'statusId', 'druid_bear_t_ironfur', {
  maxStacks: 3,
  description: '只对物理伤害生效的叠层减伤，每层默认20%，最多3层。',
})
updateRow(activeSkills, 'skillId', 'druid_bear_t_barkskin', {
  description: '自身获得10秒30%全伤害减伤，结束时可由天赋驱散减益。',
})
updateRow(activeEffects, 'skillEffectId', 'druid_bear_t_barkskin_main', {
  valueB: 0.3,
  durationMs: 10000,
  notes: '10秒30%全伤害减伤。',
})
updateRow(activeStatuses, 'statusId', 'druid_bear_t_barkskin', {
  durationMs: 10000,
  description: '10秒30%全伤害减伤。',
})
updateRow(activeSkills, 'skillId', 'druid_bear_t_rage_of_the_sleeper', {
  description: '成功释放获得25点怒气；自身获得10秒25%最大生命值和25%全伤害减伤，并将部分承伤转化为反击伤害与仇恨。',
  resourceCost: 20,
  unlockHint: 'WF-5解锁',
})
updateRow(activeSkills, 'skillId', 'druid_bear_t_survival_instincts', {
  unlockHint: 'ZA-3解锁',
})
updateRow(activeEffects, 'skillEffectId', 'druid_bear_t_rage_of_the_sleeper_main', {
  valueA: 0.25,
  valueB: 0.25,
  durationMs: 10000,
  notes: '10秒25%全伤害减伤、反击和25%最大生命值提升；成功释放获得25怒。',
})
updateRow(activeStatuses, 'statusId', 'druid_bear_t_rage_of_the_sleeper', {
  durationMs: 10000,
  description: '10秒25%全伤害减伤、反击和25%最大生命值提升。',
})

updateRow(talents, 'talentId', 'druid_bear_t_savage_focus', {
  description: '裂伤额外获得7怒。',
})
updateRow(talentEffects, 'talentEffectId', 'druid_bear_t_savage_focus_main', {
  valueA: 7,
  valueB: 0,
  notes: '裂伤额外获得7怒。',
})
updateRow(talents, 'talentId', 'druid_bear_t_iron_thorns', {
  description: '每层铁鬃使队伍造成的伤害提高15%，最多提高45%。',
})
updateRow(talentEffects, 'talentEffectId', 'druid_bear_t_iron_thorns_main', {
  valueA: 0.15,
  valueB: 0,
  notes: '每层铁鬃使队伍造成的伤害提高15%，最多提高45%。',
})
updateRow(talents, 'talentId', 'druid_bear_t_mark_of_the_wild', {
  description: '熊T自身和队伍造成的伤害提高25%。',
})
updateRow(talentEffects, 'talentEffectId', 'druid_bear_t_mark_of_the_wild_main', {
  valueA: 0.25,
  valueB: 0,
  notes: '熊T自身和队伍造成的伤害提高25%。',
})
updateRow(talents, 'talentId', 'druid_bear_t_bark_dispelling', {
  description: '树皮术结束时解除所有可驱散玩家减益，并治疗当前最大生命值的10%。',
})
updateRow(talentEffects, 'talentEffectId', 'druid_bear_t_bark_dispelling_main', {
  valueA: 0.1,
  valueB: 0,
  notes: '树皮术结束时解除所有可驱散玩家减益，并治疗当前最大生命值的10%。',
})
updateRow(talents, 'talentId', 'druid_bear_t_regenerative_bond', {
  cost: 1,
})
updateRow(talents, 'talentId', 'druid_bear_t_water_fire_immunity', {
  description: '铁鬃每层获得20%物理伤害减免和10%魔法伤害减免，最多3层。',
})
updateRow(talentEffects, 'talentEffectId', 'druid_bear_t_water_fire_immunity_main', {
  valueA: 0.2,
  valueB: 0.1,
  notes: '铁鬃每层获得20%物理伤害减免和10%魔法伤害减免，最多3层。',
})

const campaignStages = getTable(stageContent, 'stage_content.xlsx', '关卡')
for (const [stageId, oldSkillId, newSkillId] of [
  ['WestFall-5', 'druid_bear_t_survival_instincts', 'druid_bear_t_rage_of_the_sleeper'],
  ["Zul'Aman-3", 'druid_bear_t_rage_of_the_sleeper', 'druid_bear_t_survival_instincts'],
]) {
  const row = findUniqueRow(campaignStages, 'stageId', stageId)
  const unlockCol = campaignStages.columns.get('unlockedActiveSkillIdsCsv')
  if (unlockCol === undefined) throw new Error('Missing stage_content.xlsx.关卡.unlockedActiveSkillIdsCsv')
  const skillIds = parseCsv(readCell(campaignStages.sheet, row, unlockCol))
  const oldIndex = skillIds.indexOf(oldSkillId)
  const newCount = skillIds.filter((skillId) => skillId === newSkillId).length
  if (oldIndex >= 0 && newCount === 0) skillIds[oldIndex] = newSkillId
  else if (oldIndex < 0 && newCount !== 1) {
    throw new Error(`Expected ${stageId} to contain ${oldSkillId} or ${newSkillId}`)
  }
  writeCell(campaignStages, row, 'unlockedActiveSkillIdsCsv', skillIds.join(','))
}

const challengeStages = getTable(challengeStageContent, 'challenge_stage_content.xlsx', '关卡')
const challengeRows = []
for (let stageNumber = 1; stageNumber <= 9; stageNumber += 1) {
  challengeRows.push(findUniqueRow(challengeStages, 'stageId', `Challenge-${stageNumber}`))
}
const challengeUnlockCol = challengeStages.columns.get('unlockedActiveSkillIdsCsv')
if (challengeUnlockCol === undefined) {
  throw new Error('Missing challenge_stage_content.xlsx.关卡.unlockedActiveSkillIdsCsv')
}
for (const row of challengeRows) {
  const skillIds = parseCsv(readCell(challengeStages.sheet, row, challengeUnlockCol))
  const bearIndexes = skillIds
    .map((skillId, index) => skillId.startsWith('druid_bear_t_') ? index : -1)
    .filter((index) => index >= 0)
  const expectedBearSkills = BEAR_SKILLS.slice(0, bearIndexes.length)
  if (bearIndexes.length > BEAR_SKILLS.length) {
    throw new Error(`Challenge row contains ${bearIndexes.length} Bear skills, expected at most ${BEAR_SKILLS.length}`)
  }
  for (let index = 0; index < bearIndexes.length; index += 1) {
    skillIds[bearIndexes[index]] = expectedBearSkills[index]
  }
  writeCell(challengeStages, row, 'unlockedActiveSkillIdsCsv', skillIds.join(','))
}

writeDesignerWorkbookCompact(playerBuild, playerBuildPath, projectRoot)
writeDesignerWorkbookCompact(stageContent, stageContentPath, projectRoot)
writeDesignerWorkbookCompact(challengeStageContent, challengeStageContentPath, projectRoot)

console.log('Applied Bear T WF6 manual retest tuning to player, campaign, and challenge workbooks')
