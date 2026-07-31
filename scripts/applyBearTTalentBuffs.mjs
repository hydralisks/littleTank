import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')

const updates = [
  {
    talentId: 'druid_bear_t_thick_hide',
    valueA: 0.1,
    description: '常驻10%物理减伤，与铁鬃线性叠加。',
  },
  {
    talentId: 'druid_bear_t_ursine_threat',
    valueA: 0.35,
    description: '熊T技能额外仇恨提高35%。',
  },
  {
    talentId: 'druid_bear_t_natural_inspiration',
    valueA: 0.25,
    description: '队伍自动攻击间隔缩短25%。',
  },
  {
    talentId: 'druid_bear_t_mark_of_the_wild',
    valueA: 0.25,
    description: '熊T自身和队伍造成的伤害提高25%。',
  },
  {
    talentId: 'druid_bear_t_skull_bash_instinct',
    valueA: 15,
    description: '成功打断获得15怒气。',
  },
  {
    talentId: 'druid_bear_t_great_bear_vigor',
    valueA: 0.3,
    description: '最大生命值提高30%。',
  },
  {
    talentId: 'druid_bear_t_regrowth_of_the_pack',
    valueA: 0.5,
    description: '愈合同时治疗队伍原始即时治疗量的50%；持续治疗不治疗队伍。',
  },
]

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing player_build.xlsx.${sheetName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheetName, sheet, range, columns }
}

function findUniqueRow(table, keyHeader, keyValue) {
  const col = table.columns.get(keyHeader)
  if (col === undefined) throw new Error(`Missing ${table.sheetName}.${keyHeader}`)
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
  if (col === undefined) throw new Error(`Missing ${table.sheetName}.${header}`)
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'number' ? 'n' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

const workbook = readDesignerWorkbook(workbookPath)
const talents = getTable(workbook, '被动天赋定义')
const effects = getTable(workbook, '被动天赋效果')

for (const update of updates) {
  const talentRow = findUniqueRow(talents, 'talentId', update.talentId)
  const effectRow = findUniqueRow(effects, 'talentEffectId', `${update.talentId}_main`)
  writeCell(talents, talentRow, 'description', update.description)
  writeCell(effects, effectRow, 'valueA', update.valueA)
  writeCell(effects, effectRow, 'valueB', 0)
  writeCell(effects, effectRow, 'notes', update.description)
}

writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
console.log(`Updated ${updates.length} Bear T talents in public/designer-data/player_build.xlsx`)
for (const update of updates) console.log(`- ${update.talentId}: ${update.valueA}`)
