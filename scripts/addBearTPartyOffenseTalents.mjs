import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workbookPath = path.join(projectRoot, 'public', 'designer-data', 'player_build.xlsx')
const workbook = readDesignerWorkbook(workbookPath)
const exclusiveGroup = 'druid_bear_t_party_offense'

const replacements = [
  {
    oldId: 'druid_bear_t_ironfur_reserve',
    id: 'druid_bear_t_iron_thorns',
    name: '铁棘',
    logicId: 'bear_iron_thorns',
    description: '每层铁鬃使队伍造成的伤害提高15%，最多提高45%。',
    tags: 'party,damage,ironfur',
    valueA: 0.15,
  },
  {
    oldId: 'druid_bear_t_blood_scent',
    id: 'druid_bear_t_natural_inspiration',
    name: '自然鼓舞',
    logicId: 'bear_natural_inspiration',
    description: '队伍自动攻击间隔缩短25%。',
    tags: 'party,damage,auto-attack',
    valueA: 0.25,
  },
  {
    oldId: 'druid_bear_t_pack_presence',
    id: 'druid_bear_t_mark_of_the_wild',
    name: '野性印记',
    logicId: 'bear_mark_of_the_wild',
    description: '熊T自身和队伍造成的伤害提高25%。',
    tags: 'party,damage,player',
    valueA: 0.25,
  },
]

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing sheet ${sheetName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheetName, sheet, range, columns }
}

function findUniqueRow(table, keyHeader, keyValues) {
  const col = table.columns.get(keyHeader)
  if (col === undefined) throw new Error(`Missing ${keyHeader} in ${table.sheetName}`)
  const matches = []
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (keyValues.includes(String(readCell(table.sheet, row, col)))) matches.push(row)
  }
  if (matches.length !== 1) {
    throw new Error(`Expected one ${keyHeader} row for ${keyValues.join('/')}, found ${matches.length}`)
  }
  return matches[0]
}

function writeCell(table, row, header, value) {
  const col = table.columns.get(header)
  if (col === undefined) throw new Error(`Missing ${header} in ${table.sheetName}`)
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

function updateRow(table, row, values) {
  for (const [header, value] of Object.entries(values)) writeCell(table, row, header, value)
}

const talentDefinitions = getTable('被动天赋定义')
const talentEffects = getTable('被动天赋效果')
const icons = getTable('图标资源映射')

for (const replacement of replacements) {
  const definitionRow = findUniqueRow(talentDefinitions, 'talentId', [replacement.oldId, replacement.id])
  updateRow(talentDefinitions, definitionRow, {
    talentId: replacement.id,
    talentName: replacement.name,
    category: 'party',
    cost: 3,
    description: replacement.description,
    iconId: `${replacement.id}_pic`,
    talentLogicId: replacement.logicId,
    tier: 1,
    talentTagsCsv: replacement.tags,
    exclusiveGroup,
    grantedStatusIdsCsv: '',
    enabled: true,
  })

  const effectRow = findUniqueRow(talentEffects, 'talentEffectId', [
    `${replacement.oldId}_main`,
    `${replacement.id}_main`,
  ])
  updateRow(talentEffects, effectRow, {
    talentEffectId: `${replacement.id}_main`,
    talentId: replacement.id,
    effectIndex: 1,
    talentLogicId: replacement.logicId,
    // The validator accepts one scope per effect row; runtime applies this talent to both player and party.
    targetScope: replacement.id === 'druid_bear_t_mark_of_the_wild' ? 'player' : 'party',
    valueA: replacement.valueA,
    valueB: 0,
    statusId: '',
    skillId: '',
    notes: replacement.description,
    enabled: true,
  })

  const iconRow = findUniqueRow(icons, 'iconId', [`${replacement.oldId}_pic`, `${replacement.id}_pic`])
  updateRow(icons, iconRow, {
    iconId: `${replacement.id}_pic`,
    iconName: replacement.name,
    assetKey: 'bear-leaf',
    iconType: 'talent',
    enabled: true,
  })
}

for (const sheetName of ['玩家主动状态定义', '玩家被动状态定义']) {
  const table = getTable(sheetName)
  const statusIdCol = table.columns.get('statusId')
  if (statusIdCol === undefined) continue
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    const statusId = String(readCell(table.sheet, row, statusIdCol))
    if (statusId === 'druid_bear_t_ironfur_reserve' || statusId === 'druid_bear_t_pack_presence') {
      writeCell(table, row, 'enabled', false)
    }
  }
}

for (const statusIconId of [
  'druid_bear_t_ironfur_reserve_status_pic',
  'druid_bear_t_pack_presence_status_pic',
]) {
  const iconRow = findUniqueRow(icons, 'iconId', [statusIconId])
  writeCell(icons, iconRow, 'enabled', false)
}

const defaults = getTable('默认被动构筑')
const defaultTalentCol = defaults.columns.get('talentId')
if (defaultTalentCol === undefined) throw new Error('Missing talentId in 默认被动构筑')
for (let row = defaults.range.s.r + 1; row <= defaults.range.e.r; row += 1) {
  const talentId = String(readCell(defaults.sheet, row, defaultTalentCol))
  if (talentId === 'druid_bear_t_pack_presence') {
    writeCell(defaults, row, 'talentId', 'druid_bear_t_mark_of_the_wild')
  }
}

writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
console.log('Applied Bear T mutually exclusive party offense talents')
