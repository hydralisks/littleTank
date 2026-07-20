import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = process.cwd()
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')
const challengeStageOutputPath = path.join(designerDataDir, 'challenge_stage_content.xlsx')
const challengeEncounterOutputPath = path.join(designerDataDir, 'challenge_encounter_balance.xlsx')
const legacyChallengeWorkbookPath = path.join(designerDataDir, 'challenge.xlsx')

const SHEET_NAMES = {
  area: '\u533a\u57df',
  stage: '\u5173\u5361',
  legend: '\u56fe\u4f8b',
  opening: '\u5173\u5361\u5f00\u573a',
  placements: '\u654c\u4eba\u5e03\u7f6e',
  openingStatuses: '\u5f00\u573a\u72b6\u6001',
  affixBindings: '\u5173\u5361\u8bcd\u7f00\u7ed1\u5b9a',
  affixDefinitions: '\u8bcd\u7f00\u5b9a\u4e49',
  damageSourceDefinitions: '\u4f24\u5bb3\u6765\u6e90\u5b9a\u4e49',
  damageSourceBindings: '\u5173\u5361\u4f24\u5bb3\u6765\u6e90\u7ed1\u5b9a',
  specialRuleBindings: '\u7279\u6b8a\u89c4\u5219\u7ed1\u5b9a',
  specialRuleDefinitions: '\u7279\u6b8a\u89c4\u5219\u5b9a\u4e49',
}

const STAGE_SHEET_HEADERS = [
  'stageId',
  'areaId',
  'order',
  'title',
  'subtitle',
  'strategyTips',
  'affix1Title',
  'affix1Description',
  'affix1IconId',
  'affix2Title',
  'affix2Description',
  'affix2IconId',
  'rule1Title',
  'rule1Description',
  'rule1IconId',
  'rule2Title',
  'rule2Description',
  'rule2IconId',
  'unlockedActiveSkillIdsCsv',
  'passiveTalentUnlockTier',
  'challengeId',
  'recommendedDifficulty',
  'allowedClassIdsCsv',
  'sourceStageIdsCsv',
  'enemySummary',
  'buildRuleId',
  'recommendedActiveSkillNamesCsv',
  'recommendedPassiveTalentNamesCsv',
  'enabled',
]

const ENCOUNTER_SHEETS = [
  SHEET_NAMES.opening,
  SHEET_NAMES.placements,
  SHEET_NAMES.openingStatuses,
  SHEET_NAMES.affixBindings,
  SHEET_NAMES.affixDefinitions,
  SHEET_NAMES.damageSourceDefinitions,
  SHEET_NAMES.damageSourceBindings,
  SHEET_NAMES.specialRuleBindings,
  SHEET_NAMES.specialRuleDefinitions,
]

function splitCsv(value) {
  return String(value ?? '')
    .split(/[,，]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function ensureDesignerDataDir() {
  fs.mkdirSync(designerDataDir, { recursive: true })
}

function readWorkbookIfExists(filePath) {
  return fs.existsSync(filePath) ? XLSX.readFile(filePath) : null
}

function readSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets[sheetName]
  if (!sheet) {
    return []
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
}

function readLegacyChallengeWorkbook() {
  return readWorkbookIfExists(legacyChallengeWorkbookPath)
}

function readLegacySheetRows(workbook, index) {
  if (!workbook?.SheetNames[index]) {
    return []
  }

  return readSheetRows(workbook, workbook.SheetNames[index])
}

function buildStageRowsFromLegacyWorkbook(workbook) {
  const challengeRows = readLegacySheetRows(workbook, 0)
  const affixBindings = readLegacySheetRows(workbook, 4)
  const affixDefinitions = readLegacySheetRows(workbook, 5)
  const ruleBindings = readLegacySheetRows(workbook, 8)
  const ruleDefinitions = readLegacySheetRows(workbook, 9)
  const affixById = new Map(affixDefinitions.map((row) => [String(row.affixId ?? ''), row]))
  const ruleById = new Map(ruleDefinitions.map((row) => [String(row.ruleId ?? ''), row]))
  const affixIdsByStageId = new Map(affixBindings.map((row) => [String(row.stageId ?? ''), splitCsv(row.affixIdsCsv)]))
  const ruleIdsByStageId = new Map(ruleBindings.map((row) => [String(row.stageId ?? ''), splitCsv(row.ruleIdsCsv)]))

  return challengeRows.map((row, index) => {
    const stageId = String(row.stageId ?? '')
    const affixes = (affixIdsByStageId.get(stageId) ?? []).map((id) => affixById.get(id)).filter(Boolean)
    const rules = (ruleIdsByStageId.get(stageId) ?? []).map((id) => ruleById.get(id)).filter(Boolean)

    return {
      stageId,
      areaId: 'Challenge',
      order: index + 1,
      title: row.title ?? stageId,
      subtitle: row.subtitle ?? '',
      strategyTips: row.designerNotes ?? '',
      affix1Title: affixes[0]?.affixName ?? '',
      affix1Description: affixes[0]?.description ?? '',
      affix1IconId: affixes[0]?.iconId ?? '',
      affix2Title: affixes[1]?.affixName ?? '',
      affix2Description: affixes[1]?.description ?? '',
      affix2IconId: affixes[1]?.iconId ?? '',
      rule1Title: rules[0]?.ruleName ?? '',
      rule1Description: rules[0]?.description ?? '',
      rule1IconId: rules[0]?.iconId ?? '',
      rule2Title: rules[1]?.ruleName ?? '',
      rule2Description: rules[1]?.description ?? '',
      rule2IconId: rules[1]?.iconId ?? '',
      unlockedActiveSkillIdsCsv: '',
      passiveTalentUnlockTier: '',
      challengeId: row.challengeId ?? '',
      recommendedDifficulty: row.recommendedDifficulty ?? '',
      allowedClassIdsCsv: row.allowedClassIdsCsv ?? '',
      sourceStageIdsCsv: row.sourceStageIdsCsv ?? '',
      enemySummary: row.enemySummary ?? '',
      buildRuleId: row.buildRuleId ?? '',
      recommendedActiveSkillNamesCsv: row.recommendedActiveSkillNamesCsv ?? '',
      recommendedPassiveTalentNamesCsv: row.recommendedPassiveTalentNamesCsv ?? '',
      enabled: row.enabled ?? true,
    }
  })
}

function buildLegendRowsFromLegacyWorkbook(workbook) {
  const affixDefinitions = readLegacySheetRows(workbook, 5)
  const ruleDefinitions = readLegacySheetRows(workbook, 9)
  const rows = []

  for (const affix of affixDefinitions) {
    if (!affix.affixId) {
      continue
    }

    rows.push({
      areaId: 'Challenge',
      id: affix.affixId,
      iconId: affix.iconId ?? '',
      label: affix.affixName ?? affix.affixId,
      source: '\u8bcd\u7f00',
      target: affix.targetSelector ?? '',
      description: affix.description ?? '',
    })
  }

  for (const rule of ruleDefinitions) {
    if (!rule.ruleId) {
      continue
    }

    rows.push({
      areaId: 'Challenge',
      id: rule.ruleId,
      iconId: rule.iconId ?? '',
      label: rule.ruleName ?? rule.ruleId,
      source: '\u7279\u6b8a\u89c4\u5219',
      target: rule.ruleLogicId ?? '',
      description: rule.description ?? '',
    })
  }

  return rows
}

function defaultChallengeAreaRows() {
  return [{
    areaId: 'Challenge',
    title: '\u6311\u6218\u6a21\u5f0f',
    shortTitle: '\u6311\u6218',
    mapLabel: '\u72ec\u7acb\u6311\u6218',
    description: '\u4e3b\u7ebf\u5173\u5361\u4ee5\u5916\u7684\u72ec\u7acb\u6218\u6597\u6311\u6218\u3002',
    accent: '#8bd3a7',
  }]
}

function writeRows(workbook, sheetName, rows, headers) {
  const worksheet = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows, headers ? { header: headers } : undefined)
    : XLSX.utils.aoa_to_sheet(headers ? [headers] : [[]])
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
}

function writeChallengeStageWorkbook(filePath = challengeStageOutputPath) {
  const existingWorkbook = readWorkbookIfExists(filePath)
  const legacyWorkbook = readLegacyChallengeWorkbook()
  const areaRows = readSheetRows(existingWorkbook, SHEET_NAMES.area)
  const stageRows = readSheetRows(existingWorkbook, SHEET_NAMES.stage)
  const legendRows = readSheetRows(existingWorkbook, SHEET_NAMES.legend)
  const workbook = XLSX.utils.book_new()
  writeRows(workbook, SHEET_NAMES.area, areaRows.length > 0 ? areaRows : defaultChallengeAreaRows(), [
    'areaId',
    'title',
    'shortTitle',
    'mapLabel',
    'description',
    'accent',
  ])
  writeRows(
    workbook,
    SHEET_NAMES.stage,
    stageRows.length > 0 ? stageRows : buildStageRowsFromLegacyWorkbook(legacyWorkbook),
    STAGE_SHEET_HEADERS,
  )
  writeRows(workbook, SHEET_NAMES.legend, legendRows.length > 0 ? legendRows : buildLegendRowsFromLegacyWorkbook(legacyWorkbook), [
    'areaId',
    'id',
    'iconId',
    'label',
    'source',
    'target',
    'description',
  ])
  XLSX.writeFile(workbook, filePath)
  return filePath
}

function writeChallengeEncounterWorkbook(filePath = challengeEncounterOutputPath) {
  const existingWorkbook = readWorkbookIfExists(filePath)
  const legacyWorkbook = readLegacyChallengeWorkbook()
  const workbook = XLSX.utils.book_new()
  for (const [index, sheetName] of ENCOUNTER_SHEETS.entries()) {
    const rows = readSheetRows(existingWorkbook, sheetName)
    writeRows(workbook, sheetName, rows.length > 0 ? rows : readLegacySheetRows(legacyWorkbook, index + 1))
  }
  XLSX.writeFile(workbook, filePath)
  return filePath
}

export function writeChallengeWorkbooks(paths = {}) {
  ensureDesignerDataDir()
  const stagePath = writeChallengeStageWorkbook(paths.stagePath ?? challengeStageOutputPath)
  const encounterPath = writeChallengeEncounterWorkbook(paths.encounterPath ?? challengeEncounterOutputPath)
  return { stagePath, encounterPath }
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  const { stagePath, encounterPath } = writeChallengeWorkbooks()
  console.log(`Challenge stage workbook generated: ${path.relative(projectRoot, stagePath)}`)
  console.log(`Challenge encounter workbook generated: ${path.relative(projectRoot, encounterPath)}`)
}
