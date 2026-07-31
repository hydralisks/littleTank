import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignerWorkbook, writeDesignerWorkbookCompact, XLSX } from './designerWorkbookIO.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const designerDataDir = path.join(projectRoot, 'public', 'designer-data')

const workbookUpdates = {
  'challenge_encounter_balance.xlsx': [
    {
      sheetName: '敌人布置',
      keyHeader: 'spawnId',
      keyValue: 'Challenge-5-e02',
      values: { hpOverride: 550, maxHpOverride: 550 },
    },
    {
      sheetName: '敌人布置',
      keyHeader: 'spawnId',
      keyValue: 'Challenge-5-e03',
      values: { hpOverride: 825, maxHpOverride: 825 },
    },
    {
      sheetName: '敌人布置',
      keyHeader: 'spawnId',
      keyValue: 'Challenge-6-e01',
      values: { hpOverride: '', maxHpOverride: '' },
    },
    {
      sheetName: '词缀定义',
      keyHeader: 'affixId',
      keyValue: 'challenge_tide_order',
      values: {
        valueA: 0.18,
        valueB: 5,
        description: '后排或鱼人单位成功造成伤害时，对目标施加潮汐破绽：受到伤害提高18%，至多5层。',
      },
    },
    {
      sheetName: '词缀定义',
      keyHeader: 'affixId',
      keyValue: 'challenge_wax_order',
      values: { valueA: 14 },
    },
    {
      sheetName: '词缀定义',
      keyHeader: 'affixId',
      keyValue: 'challenge_scattered_opening',
      values: {
        valueA: 55,
        description: '战斗开始时，前排敌人对队伍获得55点初始仇恨。',
      },
    },
  ],
  'challenge_stage_content.xlsx': [
    {
      sheetName: '关卡',
      keyHeader: 'stageId',
      keyValue: 'Challenge-4',
      values: {
        affix2Description: '战斗开始时，前排敌人对队伍获得55点初始仇恨。',
      },
    },
    {
      sheetName: '关卡',
      keyHeader: 'stageId',
      keyValue: 'Challenge-6',
      values: {
        affix2Description: '后排或鱼人单位成功造成伤害时，对目标施加潮汐破绽：受到伤害提高18%，至多5层。',
      },
    },
  ],
}

function readCell(sheet, row, col) {
  return sheet[XLSX.utils.encode_cell({ r: row, c: col })]?.v ?? ''
}

function getTable(workbook, fileName, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`Missing sheet ${sheetName} in ${fileName}`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const columns = new Map()
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    columns.set(String(readCell(sheet, range.s.r, col)), col)
  }
  return { sheet, range, columns }
}

function findUniqueRow(table, fileName, sheetName, keyHeader, keyValue) {
  const keyColumn = table.columns.get(keyHeader)
  if (keyColumn === undefined) throw new Error(`Missing column ${keyHeader} in ${fileName}/${sheetName}`)
  const matches = []
  for (let row = table.range.s.r + 1; row <= table.range.e.r; row += 1) {
    if (String(readCell(table.sheet, row, keyColumn)) === keyValue) matches.push(row)
  }
  if (matches.length !== 1) {
    throw new Error(`Expected one ${keyHeader}=${keyValue} row in ${fileName}/${sheetName}, found ${matches.length}`)
  }
  return matches[0]
}

function writeCell(table, fileName, sheetName, row, header, value) {
  const col = table.columns.get(header)
  if (col === undefined) throw new Error(`Missing column ${header} in ${fileName}/${sheetName}`)
  const address = XLSX.utils.encode_cell({ r: row, c: col })
  const existing = table.sheet[address] ?? {}
  const type = typeof value === 'number' ? 'n' : typeof value === 'boolean' ? 'b' : 's'
  table.sheet[address] = { ...existing, t: type, v: value, w: String(value) }
}

for (const [fileName, updates] of Object.entries(workbookUpdates)) {
  const workbookPath = path.join(designerDataDir, fileName)
  const workbook = readDesignerWorkbook(workbookPath)
  for (const update of updates) {
    const table = getTable(workbook, fileName, update.sheetName)
    const row = findUniqueRow(table, fileName, update.sheetName, update.keyHeader, update.keyValue)
    for (const [header, value] of Object.entries(update.values)) {
      writeCell(table, fileName, update.sheetName, row, header, value)
    }
  }
  writeDesignerWorkbookCompact(workbook, workbookPath, projectRoot)
  console.log(`Applied ${updates.length} targeted updates to ${fileName}`)
}
