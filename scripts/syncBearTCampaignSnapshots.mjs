import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'stage_content.xlsx')
const playerBuildWorkbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const sheetName = '关卡'

const BEAR_UNLOCKS_BY_STAGE = new Map([
  ['RingingDeeps-6', [
    'druid_bear_t_growl',
    'druid_bear_t_mangle',
    'druid_bear_t_thrash',
    'druid_bear_t_skull_bash',
    'druid_bear_t_ironfur',
  ]],
  ['WestFall-1', [
    'druid_bear_t_frenzied_regeneration',
    'druid_bear_t_swipe',
  ]],
  ['WestFall-3', [
    'druid_bear_t_moonfire',
    'druid_bear_t_barkskin',
  ]],
  ['WestFall-5', ['druid_bear_t_rage_of_the_sleeper']],
  ["Zul'Aman-1", ['druid_bear_t_lunar_beam']],
  ["Zul'Aman-2", ['druid_bear_t_incarnation_ursoc']],
  ["Zul'Aman-3", ['druid_bear_t_survival_instincts']],
  ["Zul'Aman-5", [
    'druid_bear_t_regrowth',
    'druid_bear_t_berserk',
    'druid_bear_t_roar',
  ]],
])

function parseCsv(value) {
  return String(value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
}

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function writeStringCell(sheet, row, col, value) {
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = sheet[address] ?? {}
  sheet[address] = { ...existing, t: 's', v: value, w: value }
}

const workbook = XLSX.readFile(workbookPath, { cellStyles: true })
const sheet = workbook.Sheets[sheetName]
if (!sheet?.['!ref']) throw new Error(`Missing ${sheetName} sheet in ${workbookPath}`)

const range = XLSX.utils.decode_range(sheet['!ref'])
const headerColumns = new Map()
for (let col = range.s.c; col <= range.e.c; col += 1) {
  headerColumns.set(String(readCell(sheet, range.s.r, col)), col)
}

const stageColumn = headerColumns.get('stageId')
const unlockColumn = headerColumns.get('unlockedActiveSkillIdsCsv')
if (stageColumn === undefined || unlockColumn === undefined) {
  throw new Error('Missing stageId or unlockedActiveSkillIdsCsv in campaign stage workbook')
}

const updatedStageIds = []
for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
  const stageId = String(readCell(sheet, row, stageColumn))
  const bearUnlocks = BEAR_UNLOCKS_BY_STAGE.get(stageId)
  if (!bearUnlocks) continue

  const existingIds = parseCsv(readCell(sheet, row, unlockColumn))
    .filter((skillId) => !skillId.startsWith('druid_bear_t_'))
  writeStringCell(sheet, row, unlockColumn, [...existingIds, ...bearUnlocks].join(','))
  updatedStageIds.push(stageId)
}

if (updatedStageIds.length !== BEAR_UNLOCKS_BY_STAGE.size) {
  throw new Error(`Expected ${BEAR_UNLOCKS_BY_STAGE.size} campaign stages, updated ${updatedStageIds.length}`)
}

XLSX.writeFile(workbook, workbookPath, {
  bookType: 'xlsx',
  cellStyles: true,
  compression: true,
})

function cloneBearDefaultRows(targetWorkbook, sheetName, identityHeader) {
  const targetSheet = targetWorkbook.Sheets[sheetName]
  if (!targetSheet?.['!ref']) throw new Error(`Missing ${sheetName} in ${playerBuildWorkbookPath}`)

  const targetRange = XLSX.utils.decode_range(targetSheet['!ref'])
  const columns = new Map()
  for (let col = targetRange.s.c; col <= targetRange.e.c; col += 1) {
    columns.set(String(readCell(targetSheet, targetRange.s.r, col)), col)
  }
  for (const header of ['classId', 'buildRuleId', identityHeader]) {
    if (!columns.has(header)) throw new Error(`Missing ${sheetName}.${header}`)
  }

  const sourceRows = []
  const existingIdentities = new Set()
  for (let row = targetRange.s.r + 1; row <= targetRange.e.r; row += 1) {
    const classId = String(readCell(targetSheet, row, columns.get('classId')))
    const buildRuleId = String(readCell(targetSheet, row, columns.get('buildRuleId')))
    if (classId !== 'druid_bear_t') continue
    if (buildRuleId === '8slot_0') sourceRows.push(row)
    if (buildRuleId === '8slot_1') {
      existingIdentities.add(String(readCell(targetSheet, row, columns.get(identityHeader))))
    }
  }

  for (const sourceRow of sourceRows) {
    const identity = String(readCell(targetSheet, sourceRow, columns.get(identityHeader)))
    if (existingIdentities.has(identity)) continue

    const targetRow = targetRange.e.r + 1
    for (let col = targetRange.s.c; col <= targetRange.e.c; col += 1) {
      const sourceAddress = XLSX.utils.encode_cell({ r: sourceRow, c: col })
      const targetAddress = XLSX.utils.encode_cell({ r: targetRow, c: col })
      const sourceCell = targetSheet[sourceAddress]
      if (sourceCell) targetSheet[targetAddress] = { ...sourceCell }
    }
    writeStringCell(targetSheet, targetRow, columns.get('buildRuleId'), '8slot_1')
    targetRange.e.r = targetRow
    targetSheet['!ref'] = XLSX.utils.encode_range(targetRange)
    existingIdentities.add(identity)
  }

  return existingIdentities.size
}

const playerBuildWorkbook = XLSX.readFile(playerBuildWorkbookPath, { cellStyles: true })
const activeDefaultCount = cloneBearDefaultRows(playerBuildWorkbook, '默认主动构筑', 'hotkey')
const passiveDefaultCount = cloneBearDefaultRows(playerBuildWorkbook, '默认被动构筑', 'talentId')
if (activeDefaultCount !== 8 || passiveDefaultCount !== 5) {
  throw new Error(`Expected Bear 8slot_1 defaults 8/5, found ${activeDefaultCount}/${passiveDefaultCount}`)
}
XLSX.writeFile(playerBuildWorkbook, playerBuildWorkbookPath, {
  bookType: 'xlsx',
  cellStyles: true,
  compression: true,
})

console.log(`Updated Bear T campaign snapshots for ${updatedStageIds.join(', ')}`)
console.log(`Maintained Bear T 8slot_1 defaults (${activeDefaultCount} active, ${passiveDefaultCount} passive)`)
