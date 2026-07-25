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

function selectSheet(table, sheetName) {
  const sheet = table.workbook.Sheets[sheetName]
  if (!sheet?.['!ref']) {
    throw new Error(`Missing ${sheetName} sheet in ${path.basename(table.workbookPath)}`)
  }
  table.sheet = sheet
  table.range = XLSX.utils.decode_range(sheet['!ref'])
  table.columns = new Map()
  for (let col = table.range.s.c; col <= table.range.e.c; col += 1) {
    table.columns.set(String(readCell(sheet, table.range.s.r, col)), col)
  }
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

selectSheet(encounter, '敌人布置')
for (const [spawnId, hpOverride] of [
  ['Challenge-1-e01', 80],
  ['Challenge-1-e02', 80],
  ['Challenge-1-e03', 120],
  ['Challenge-1-e04', 120],
  ['Challenge-1-e05', 160],
]) {
  updateRow(encounter, 'spawnId', spawnId, { hpOverride, maxHpOverride: hpOverride })
}
updateRow(encounter, 'spawnId', 'Challenge-2-e01', {
  enemyId: 'kobold_miner',
  nameOverride: '狗头人矿工',
})
updateRow(encounter, 'spawnId', 'Challenge-2-e02', {
  enemyId: 'kobold_apprentice',
  nameOverride: '狗头人学徒',
})
updateRow(encounter, 'spawnId', 'Challenge-2-e03', {
  enemyId: 'murloc_tidehunter',
  nameOverride: '鱼人猎潮者',
})
updateRow(encounter, 'spawnId', 'Challenge-3-e03', {
  enemyId: 'murloc_tidehunter',
  nameOverride: '鱼人猎潮者',
})
updateRow(encounter, 'spawnId', 'Challenge-3-e04', {
  enemyId: 'murloc_tidehunter',
  nameOverride: '鱼人猎潮者',
})

selectSheet(encounter, '关卡开场')
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
  enemySummary: '狗头人矿工、狗头人学徒、鱼人猎潮者、寒光先知、狗头人拾荒者',
})
updateRow(stageContent, 'stageId', 'Challenge-3', {
  enemySummary: '老瞎眼、鱼人领军、鱼人猎潮者、鱼人斥候',
})
save(stageContent)

const playerBuild = openSheet('player_build.xlsx', '主动技能效果')
updateRow(playerBuild, 'skillEffectId', 'druid_bear_t_ironfur_main', {
  valueA: 20,
  notes: '每层20%物理减伤，最多3层。',
})
save(playerBuild)

console.log('Applied Bear T trial encounter baseline tuning for Challenge-2 and Challenge-3')
