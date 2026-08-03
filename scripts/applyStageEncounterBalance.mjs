import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = getDesignerDataDir()
const sheetName = '敌人布置'

const allowedFiles = new Set([
  'challenge_encounter_balance.xlsx',
  'encounter_balance.xlsx',
])

const allowedFields = new Set([
  'enemyId',
  'row',
  'col',
  'nameOverride',
  'hpOverride',
  'maxHpOverride',
  'openingCastSkillNum',
  'openingRecoveryRemainingMs',
])

function getDesignerDataDir() {
  const designerDataArg = process.argv.find((arg) => arg.startsWith('--designer-data-dir='))
  if (!designerDataArg) return path.join(projectRoot, 'public', 'designer-data')
  const designerDataPath = path.resolve(projectRoot, designerDataArg.slice('--designer-data-dir='.length))
  const relativePath = path.relative(projectRoot, designerDataPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Designer data directory must stay inside project root: ${designerDataPath}`)
  }
  if (!fs.statSync(designerDataPath).isDirectory()) {
    throw new Error(`Designer data directory is not a directory: ${designerDataPath}`)
  }
  return designerDataPath
}

function getManifestPath() {
  const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='))
  if (!manifestArg) throw new Error('Missing --manifest=<path>')
  const manifestPath = path.resolve(projectRoot, manifestArg.slice('--manifest='.length))
  const relativePath = path.relative(projectRoot, manifestPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Manifest must stay inside project root: ${manifestPath}`)
  }
  return manifestPath
}

function parseManifest(manifestPath) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const fileNames = Object.keys(manifest)
  if (fileNames.length !== allowedFiles.size || fileNames.some((fileName) => !allowedFiles.has(fileName))) {
    throw new Error(`Manifest must contain only: ${[...allowedFiles].join(', ')}`)
  }

  for (const [fileName, updates] of Object.entries(manifest)) {
    if (!Array.isArray(updates)) throw new Error(`Updates must be an array for ${fileName}`)
    const seenKeys = new Set()
    for (const update of updates) {
      validateUpdate(fileName, update)
      const key = `${update.stageId}:${update.spawnId}`
      if (seenKeys.has(key)) throw new Error(`Duplicate update key in ${fileName}: ${key}`)
      seenKeys.add(key)
    }
  }
  return manifest
}

function validateUpdate(fileName, update) {
  if (!update || typeof update !== 'object') throw new Error(`Invalid update in ${fileName}`)
  if (typeof update.stageId !== 'string' || typeof update.spawnId !== 'string') {
    throw new Error(`Update requires string stageId and spawnId in ${fileName}`)
  }
  const validStage = fileName === 'challenge_encounter_balance.xlsx'
    ? /^Challenge-[1-9]$/.test(update.stageId)
    : /^WestFall-[1-3]$/.test(update.stageId)
  if (!validStage || !update.spawnId.startsWith(`${update.stageId}-e`)) {
    throw new Error(`Update is outside approved stages: ${fileName}/${update.stageId}/${update.spawnId}`)
  }
  if (!update.expectedBefore || typeof update.expectedBefore !== 'object') {
    throw new Error(`Missing expectedBefore for ${update.spawnId}`)
  }
  if (!update.values || typeof update.values !== 'object' || Object.keys(update.values).length === 0) {
    throw new Error(`Missing values for ${update.spawnId}`)
  }
  const uncoveredFields = Object.keys(update.values).filter((field) => (
    !Object.hasOwn(update.expectedBefore, field)
  ))
  if (uncoveredFields.length > 0) {
    throw new Error(`expectedBefore must cover every values field for ${update.spawnId}: ${uncoveredFields.join(', ')}`)
  }
  for (const field of [...Object.keys(update.expectedBefore), ...Object.keys(update.values)]) {
    if (!allowedFields.has(field)) throw new Error(`Field ${field} is not allowed for ${update.spawnId}`)
  }
}

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(workbook, fileName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing ${sheetName} in ${fileName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheet, range, columns }
}

function readTableRows(table) {
  const rows = []
  const stageCol = table.columns.get('stageId')
  const spawnCol = table.columns.get('spawnId')
  if (stageCol === undefined || spawnCol === undefined) throw new Error('Missing stageId or spawnId column')
  for (let rowIndex = table.range.s.r + 1; rowIndex <= table.range.e.r; rowIndex += 1) {
    rows.push({
      rowIndex,
      stageId: String(readCell(table.sheet, rowIndex, stageCol)),
      spawnId: String(readCell(table.sheet, rowIndex, spawnCol)),
    })
  }
  return rows
}

function findUniqueRow(table, fileName, update) {
  const rows = readTableRows(table)
  const matches = rows.filter((row) => (
    row.stageId === update.stageId && row.spawnId === update.spawnId
  ))
  if (matches.length !== 1) {
    throw new Error(`Expected one ${update.stageId}/${update.spawnId} row in ${fileName}, found ${matches.length}`)
  }
  return matches[0].rowIndex
}

function sameValue(actual, expected) {
  return String(actual ?? '') === String(expected ?? '')
}

function rowMatches(table, rowIndex, values) {
  return Object.entries(values).every(([field, expected]) => {
    const col = table.columns.get(field)
    if (col === undefined) throw new Error(`Missing column ${field}`)
    return sameValue(readCell(table.sheet, rowIndex, col), expected)
  })
}

function writeCell(table, rowIndex, field, value) {
  const col = table.columns.get(field)
  if (col === undefined) throw new Error(`Missing column ${field}`)
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

function prepareWorkbook(fileName, updates) {
  const workbookPath = path.join(designerDataDir, fileName)
  const workbook = readDesignerWorkbook(workbookPath)
  const table = getTable(workbook, fileName)
  let changedRows = 0

  for (const update of updates) {
    const rowIndex = findUniqueRow(table, fileName, update)
    if (rowMatches(table, rowIndex, update.values)) continue
    if (!rowMatches(table, rowIndex, update.expectedBefore)) {
      throw new Error(`Current values do not match expectedBefore for ${fileName}/${update.stageId}/${update.spawnId}`)
    }
    for (const [field, value] of Object.entries(update.values)) writeCell(table, rowIndex, field, value)
    changedRows += 1
  }

  return { workbook, workbookPath, changedRows }
}

const manifestPath = getManifestPath()
const workbookUpdates = parseManifest(manifestPath)
const prepared = Object.entries(workbookUpdates).map(([fileName, updates]) => ({
  fileName,
  ...prepareWorkbook(fileName, updates),
}))

for (const entry of prepared) {
  if (entry.changedRows > 0) {
    const templateWorkbookPath = path.join(projectRoot, 'public', 'designer-data', entry.fileName)
    writeDesignerWorkbookCompact(entry.workbook, entry.workbookPath, projectRoot, templateWorkbookPath)
  }
  console.log(`${entry.fileName}: ${entry.changedRows} targeted rows updated`)
}
