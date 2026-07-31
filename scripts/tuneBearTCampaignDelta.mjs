import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const workbook = readDesignerWorkbook(workbookPath)

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function findTableWithRow(keyHeader, keyValue, requiredHeaders = []) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet?.['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!ref'])
    const columns = new Map()
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      columns.set(String(readCell(sheet, range.s.r, col)), col)
    }
    if (requiredHeaders.some((header) => !columns.has(header))) continue
    const keyCol = columns.get(keyHeader)
    if (keyCol === undefined) continue
    for (let row = range.s.r + 1; row <= range.e.r; row += 1) {
      if (String(readCell(sheet, row, keyCol)) === keyValue) {
        return { sheet, row, columns }
      }
    }
  }
  throw new Error(`Missing row ${keyHeader}=${keyValue}`)
}

function writeCell(table, header, value) {
  const col = table.columns.get(header)
  if (col === undefined) throw new Error(`Missing column ${header}`)
  const address = XLSX.utils.encode_cell({ r: table.row, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

const incarnationEffect = findTableWithRow(
  'skillEffectId',
  'druid_bear_t_incarnation_ursoc_main',
)
writeCell(incarnationEffect, 'valueA', 0.35)
writeCell(incarnationEffect, 'valueB', 0)
writeCell(incarnationEffect, 'durationMs', 30000)
writeCell(incarnationEffect, 'notes', '30秒最大生命值+35%；期间熊T技能仇恨倍率提高30%。')

const incarnationSkill = findTableWithRow(
  'skillId',
  'druid_bear_t_incarnation_ursoc',
  ['skillName', 'description'],
)
writeCell(incarnationSkill, 'description', '短时间提高最大生命值和仇恨稳定性。')

const incarnationStatus = findTableWithRow(
  'statusId',
  'druid_bear_t_incarnation_ursoc',
  ['statusCategory', 'effectLogicId'],
)
writeCell(incarnationStatus, 'durationMs', 30000)
writeCell(incarnationStatus, 'description', '最大生命值提高35%。')

writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)

console.log('Applied Bear T campaign delta tuning')
