import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')

function openSheet(fileName, sheetName) {
  const workbookPath = path.join(designerDataDir, fileName)
  const workbook = XLSX.readFile(workbookPath, { cellStyles: true })
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) {
    throw new Error(`Missing ${sheetName} sheet in ${fileName}`)
  }
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { workbookPath, workbook, sheet, range, columns }
}

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function writeStringCell(sheet, row, col, value) {
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = sheet[address] ?? {}
  sheet[address] = { ...existing, t: 's', v: value, w: value }
}

function findRow(table, keyColumn, keyValue) {
  const column = table.columns.get(keyColumn)
  if (column === undefined) {
    throw new Error(`Missing required header: ${keyColumn}`)
  }
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (String(readCell(table.sheet, row, column)) === keyValue) return row
  }
  throw new Error(`Missing row ${keyColumn}=${keyValue}`)
}

function updateRow(table, keyColumn, keyValue, values) {
  const row = findRow(table, keyColumn, keyValue)
  for (const [header, value] of Object.entries(values)) {
    const column = table.columns.get(header)
    if (column === undefined) {
      throw new Error(`Missing required header: ${header}`)
    }
    writeStringCell(table.sheet, row, column, String(value))
  }
}

function save(table) {
  XLSX.writeFile(table.workbook, table.workbookPath, {
    bookType: 'xlsx',
    cellStyles: true,
    compression: true,
  })
}

const encounter = openSheet('challenge_encounter_balance.xlsx', '词缀定义')
updateRow(encounter, 'affixId', 'affix_dislike', {
  description: '你的队伍开场的三次攻击会产生2倍仇恨',
  valueB: 2,
})

const placementSheet = encounter.workbook.Sheets['敌人布置']
if (!placementSheet?.['!ref']) {
  throw new Error('Missing 敌人布置 sheet in challenge_encounter_balance.xlsx')
}
encounter.sheet = placementSheet
encounter.range = XLSX.utils.decode_range(placementSheet['!ref'])
encounter.columns = new Map()
for (let col = encounter.range.s.c; col <= encounter.range.e.c; col += 1) {
  encounter.columns.set(String(readCell(placementSheet, encounter.range.s.r, col)), col)
}
updateRow(encounter, 'spawnId', 'Challenge-2-e03', {
  enemyId: 'murloc_tidehunter',
  nameOverride: '鱼人猎潮者',
})
updateRow(encounter, 'spawnId', 'Challenge-3-e03', {
  enemyId: 'murloc_tidehunter',
  nameOverride: '鱼人猎潮者',
})

const openingSheet = encounter.workbook.Sheets['关卡开场']
if (!openingSheet?.['!ref']) {
  throw new Error('Missing 关卡开场 sheet in challenge_encounter_balance.xlsx')
}
encounter.sheet = openingSheet
encounter.range = XLSX.utils.decode_range(openingSheet['!ref'])
encounter.columns = new Map()
for (let col = encounter.range.s.c; col <= encounter.range.e.c; col += 1) {
  encounter.columns.set(String(readCell(openingSheet, encounter.range.s.r, col)), col)
}
updateRow(encounter, 'stageId', 'Challenge-2', {
  playerHp: 140,
  playerMaxHp: 140,
  playerAutoHeal: 5,
})
updateRow(encounter, 'stageId', 'Challenge-3', {
  playerHp: 180,
  playerMaxHp: 180,
  playerAutoHeal: 5,
})
save(encounter)

const stageContent = openSheet('challenge_stage_content.xlsx', '关卡')
updateRow(stageContent, 'stageId', 'Challenge-2', {
  affix1Description: '你的队伍开场的三次攻击会产生2倍仇恨',
  enemySummary: '狗头人武僧、狗头人学徒、鱼人猎潮者、寒光先知、狗头人拾荒者',
})
updateRow(stageContent, 'stageId', 'Challenge-3', {
  enemySummary: '老瞎眼、寒光智者、鱼人领军、鱼人猎潮者、鱼人斥候',
})
save(stageContent)

console.log('Applied Bear T trial encounter baseline tuning for Challenge-2 and Challenge-3')
