import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'manual_playtest_builds.xlsx')
const workbook = XLSX.readFile(workbookPath, { cellStyles: true })
const sheetName = workbook.SheetNames[0]
const sheet = workbook.Sheets[sheetName]
if (!sheet?.['!ref']) throw new Error('Missing manual playtest sheet')

const bearRatings = [
  ['Challenge-1', 'CH-1', 'balance'],
  ['Challenge-2', 'CH-2', 'balance'],
  ['Challenge-3', 'CH-3', 'expert'],
  ['WestFall-1', 'WF-1', 'easy'],
  ['WestFall-2', 'WF-2', 'balance'],
  ['WestFall-3', 'WF-3', 'balance'],
  ['WestFall-4', 'WF-4', 'expert'],
  ['WestFall-5', 'WF-5', 'hard'],
  ['WestFall-6', 'WF-6', 'expert'],
]

const bearRecommendationsByStage = new Map([
  ['WestFall-6', {
    recommendedActiveSkillNamesCsv: '裂伤,痛击,月火术,铁鬃,树皮术,沉睡者之怒,低吼',
    recommendedActiveSkillIdsCsv: 'druid_bear_t_mangle,druid_bear_t_thrash,druid_bear_t_moonfire,druid_bear_t_ironfur,druid_bear_t_barkskin,druid_bear_t_rage_of_the_sleeper,druid_bear_t_growl',
    recommendedPassiveTalentNamesCsv: '野性专注,疼痛豁免,铁棘',
    recommendedPassiveTalentIdsCsv: 'druid_bear_t_savage_focus,druid_bear_t_pain_immunity,druid_bear_t_iron_thorns',
    source: 'manual_user_2026-07-29',
    notes: 'manual_playtest_result_and_recommended_build',
  }],
])

function readCell(row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]
}

function writeStyledCell(row, col, value, styleSource) {
  const type = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  sheet[XLSX.utils.encode_cell({ r: row, c: col })] = {
    ...(styleSource?.s === undefined ? {} : { s: styleSource.s }),
    t: type,
    v: value,
    w: String(value),
  }
}

let range = XLSX.utils.decode_range(sheet['!ref'])
const columns = new Map()
for (let col = range.s.c; col <= range.e.c; col += 1) {
  columns.set(String(readCell(range.s.r, col)?.v ?? ''), col)
}

if (!columns.has('classId')) {
  const classIdCol = range.e.c + 1
  writeStyledCell(range.s.r, classIdCol, 'classId', readCell(range.s.r, range.e.c))
  columns.set('classId', classIdCol)
  range.e.c = classIdCol
}

const classIdCol = columns.get('classId')
for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
  if (!String(readCell(row, classIdCol)?.v ?? '').trim()) {
    writeStyledCell(row, classIdCol, 'warrior_t', readCell(row, classIdCol - 1))
  }
}

const titleByStageId = new Map()
for (const fileName of ['stage_content.xlsx', 'challenge_stage_content.xlsx']) {
  const stageWorkbook = readDesignerWorkbook(path.join(projectRoot, 'public', 'designer-data', fileName))
  for (const stageSheetName of stageWorkbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(stageWorkbook.Sheets[stageSheetName], { defval: '' })
    for (const row of rows) {
      if (row.stageId && row.title) titleByStageId.set(String(row.stageId), String(row.title))
    }
  }
}

function findRow(stageId, classId) {
  const stageIdCol = columns.get('stageId')
  const matches = []
  for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
    if (String(readCell(row, stageIdCol)?.v ?? '') === stageId && String(readCell(row, classIdCol)?.v ?? '') === classId) {
      matches.push(row)
    }
  }
  if (matches.length > 1) throw new Error(`Duplicate manual playtest row ${stageId}/${classId}`)
  return matches[0]
}

function writeRow(row, values) {
  const styleRow = Math.max(range.s.r + 1, Math.min(row - 1, range.e.r))
  for (const [header, col] of columns) {
    if (!(header in values)) continue
    writeStyledCell(row, col, values[header], readCell(styleRow, col) ?? readCell(styleRow, Math.max(range.s.c, col - 1)))
  }
}

for (const [stageId, shortStageId, manualDifficulty] of bearRatings) {
  const recommendation = bearRecommendationsByStage.get(stageId)
  let row = findRow(stageId, 'druid_bear_t')
  if (row === undefined) {
    row = range.e.r + 1
    range.e.r = row
  }
  writeRow(row, {
    stageId,
    shortStageId,
    stageTitle: titleByStageId.get(stageId) ?? stageId,
    manualDifficulty,
    recommendedActiveSkillNamesCsv: recommendation?.recommendedActiveSkillNamesCsv ?? '',
    recommendedActiveSkillIdsCsv: recommendation?.recommendedActiveSkillIdsCsv ?? '',
    recommendedPassiveTalentNamesCsv: recommendation?.recommendedPassiveTalentNamesCsv ?? '',
    recommendedPassiveTalentIdsCsv: recommendation?.recommendedPassiveTalentIdsCsv ?? '',
    source: recommendation?.source ?? 'manual_user_2026-07-26',
    autoBestBuildId: '',
    autoBestPassRate: '',
    notes: recommendation?.notes ?? 'manual_playtest_difficulty',
    enabled: true,
    classId: 'druid_bear_t',
  })
}

sheet['!ref'] = XLSX.utils.encode_range(range)
writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
console.log(`Synchronized ${bearRatings.length} Bear T manual playtest ratings`)
